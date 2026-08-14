# Deployment

## Requirements

- VPS with root access and Docker Engine. The judge creates sandbox containers
  through the host Docker socket; managed container platforms are unsupported.
- Inbound 22, 80, 443.
- Domain served by Cloudflare nameservers, proxy enabled.
- Cloudflare R2 bucket with public access. The backend refuses to start without
  `R2_ACCOUNT_ID`, `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY`, `R2_BUCKET_NAME`,
  `R2_CUSTOM_DOMAIN`.
- Repository at `/opt/codegard`, or `WorkingDirectory` in
  `infra/codegard.service` adjusted to match.
- `.env` filled from `.env.example`. `REDIS_URL` must include the Redis
  password.

## 1. Swap

Required: without swap the kernel OOM killer fires on the first memory spike.

```bash
sudo fallocate -l 2G /swapfile
sudo chmod 600 /swapfile
sudo mkswap /swapfile
sudo swapon /swapfile
echo '/swapfile none swap sw 0 0' | sudo tee -a /etc/fstab
sudo sysctl vm.swappiness=10
echo 'vm.swappiness=10' | sudo tee /etc/sysctl.d/99-swappiness.conf
```

`swappiness=10` keeps swap for pressure rather than routine paging.

## 2. Memory limits

`mem_limit` is not set in `docker-compose.prod.yml`: correct values depend on
the host, and an undersized limit kills containers under normal load. Set them
per service once the host is known.

Baseline for 12 GB / 2 cores:

| service | mem_limit |
|---|---|
| postgres | 2g |
| backend | 2g |
| judge | 1g |
| redis | 1g |
| celery-worker | 768m |
| judge-results-consumer | 512m |
| celery-beat | 256m |
| flower | 256m |
| nginx | 128m |

Constraints:

- Sandboxes are not covered by these limits. Budget `JUDGE_WORKERS` × the
  problem's own memory limit on top.
- Leave ~1/3 of host RAM unallocated for the kernel and page cache.
- `oom_score_adj` in the compose file only sets kill order; it does not cap
  usage. Redis is capped separately by `REDIS_MAXMEMORY`.
- Verify against `docker stats` under load before tightening.

## 3. Firewall

Allow 80 and 443 from Cloudflare ranges only, plus 22 for SSH. Direct access to
the origin bypasses Cloudflare's caching and rate limiting.

Ranges: <https://www.cloudflare.com/ips-v4>, <https://www.cloudflare.com/ips-v6>.
The same list is in `infra/nginx/nginx.prod.conf` under `set_real_ip_from` and
must be kept in sync.

Oracle Cloud has two firewall layers: the console security list and the OS
firewall. The OS firewall permits only SSH by default.

## 4. TLS

Cloudflare terminates TLS for clients; the origin certificate secures the
Cloudflare-to-origin hop. Cloudflare Origin CA certificates are valid for 15
years, require no renewal, and are trusted only by Cloudflare, so the domain
must stay proxied.

1. Cloudflare → SSL/TLS → Origin Server → Create Certificate.
2. Install as `infra/nginx/certs/origin.pem` and `infra/nginx/certs/origin.key`
   on the server, `chmod 600` the key. The directory is gitignored.
3. In `docker-compose.prod.yml`, uncomment the `443:443` port mapping and the
   `certs` volume.
4. In `infra/nginx/nginx.prod.conf`, uncomment the `listen 443 ssl` directives
   and the http-to-https redirect server block.
5. Cloudflare → SSL/TLS → set encryption mode to **Full (strict)**.
6. Apply with `make prod-down && make prod` if the stack is already running.
   Verify `https://<domain>` responds and plain http redirects.

## 5. First run

```bash
docker pull python:3.13-slim   # optional; the judge pulls it on start if absent
make prod-build-up
make prod-superuser
```

Migrations and `collectstatic` run as one-shot services before the backend
starts.

Content is managed through `/admin/`. A problem published with zero test cases
accepts every submission.

## 6. Start on boot

`depends_on` conditions apply only when compose starts the stack. After a
reboot the Docker daemon starts containers from their restart policy in
arbitrary order, which costs several minutes of crash-restart cycles. Run
compose from systemd instead.

```bash
sudo cp infra/codegard.service /etc/systemd/system/
sudo systemctl daemon-reload
sudo systemctl enable --now codegard
```

Verify with `sudo reboot`, then `make prod-ps`.

## 7. Monitoring

```bash
make prod-ps      # service state and health
make prod-logs    # follow all services
```

Flower is bound to the server loopback and is not proxied. Reach it over an SSH
tunnel from a local machine, then open `http://localhost:5555`:

```bash
ssh -N -L 5555:localhost:5555 <user>@<server>
```
