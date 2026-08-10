# Deploying Codegard

Everything here happens on the server and is not part of the images. Run it
once, in order, when setting up a new machine.

## 1. Prerequisites

- A VPS with root and Docker (the judge starts containers through the host's
  Docker socket, so managed platforms are out).
- Ports 80 and 443 reachable, port 22 for SSH.
- The domain on Cloudflare nameservers with the proxy (orange cloud) on.
- `.env` filled from `.env.example`. `REDIS_URL` must carry the Redis password,
  or the judge will not start.
- `docker pull python:3.13-slim` beforehand — otherwise the first submission
  waits for a 150 MB download.

## 2. Swap file

Without swap the kernel kills a container the moment memory runs out, and the
victim is usually the largest one, Postgres. Swap trades speed for staying
alive under a spike.

```bash
sudo fallocate -l 2G /swapfile
sudo chmod 600 /swapfile
sudo mkswap /swapfile
sudo swapon /swapfile
echo '/swapfile none swap sw 0 0' | sudo tee -a /etc/fstab
sudo sysctl vm.swappiness=10   # only under real pressure, not for routine paging
echo 'vm.swappiness=10' | sudo tee /etc/sysctl.d/99-swappiness.conf
```

## 3. Firewall

Two rules matter: SSH stays open, and the site is reachable **only through
Cloudflare**. Otherwise anyone can hit the origin directly, bypassing the rate
limits and the cache.

Allow 80 and 443 from the Cloudflare ranges only, the same list that is in
`infra/nginx/nginx.prod.conf` (`set_real_ip_from`). Current lists:
<https://www.cloudflare.com/ips-v4>, <https://www.cloudflare.com/ips-v6>.

On Oracle Cloud there are **two** firewalls: the security list in the console
and the one inside the OS. The OS one blocks everything except SSH by default,
which is the usual reason a site opened in the console still does not answer.

## 4. TLS certificate

Cloudflare terminates TLS for visitors; this certificate encrypts the last hop
from Cloudflare to the server. It is issued by Cloudflare, valid for 15 years,
and needs no renewal — but it is only trusted by Cloudflare, so the site must
stay behind the proxy.

1. Cloudflare dashboard → SSL/TLS → Origin Server → Create Certificate.
2. Save the two files on the server as `infra/nginx/certs/origin.pem` and
   `infra/nginx/certs/origin.key` (`chmod 600` the key). They are gitignored.
3. Uncomment in `docker-compose.prod.yml`: the `443:443` port and the `certs`
   volume.
4. Uncomment in `infra/nginx/nginx.prod.conf`: the `listen 443 ssl` block with
   the certificate paths, and the small `server` block above it that redirects
   http to https.
5. Cloudflare dashboard → SSL/TLS → set the mode to **Full (strict)**. Anything
   less leaves the last hop unencrypted or unverified.
6. `make prod-restart`, then check `https://<domain>` and that plain http
   redirects.

## 5. First run

```bash
make prod-up-build
docker compose -f docker-compose.prod.yml run --rm backend \
  python django_app/manage.py createsuperuser
```

Then log into `/admin/`, add problems, and remember the house rule: **never
publish a problem without test cases** — a problem with zero tests accepts every
submission.

## 6. Watching it

- `make prod-logs` — everything, live.
- Flower (Celery tasks) is not exposed. Reach it over an SSH tunnel:
  `ssh -L 5555:localhost:5555 <user>@<server>`, then open `localhost:5555`.
