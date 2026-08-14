# Contributing to Codegard

## First-time setup

```bash
cp .env.example .env
make dev-build-up
```

## Branch naming

```
feat/short-description     # new feature
fix/short-description      # bug fix
chore/short-description    # tooling, config, dependencies
```

## Before every PR

CI checks the same things - better to catch them locally.

```bash
make format   # reformat backend, judge and frontend
make lint     # what CI will check
make test     # every suite
```

Linters run on your own machine, not in a container, so they need `ruff` and the
frontend's `node_modules` installed locally.

## Useful commands

```bash
make dev                 # start dev environment
make dev-logs            # follow logs
make dev-makemigrations  # create new migrations
make dev-shell           # open shell in backend container
make help                # full list of commands
```
