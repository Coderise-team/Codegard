# Built from the repository root, because the schemas in shared/ have to end up
# inside the image: an image that needs files from the host cannot be pushed to
# a registry and pulled on a server.
FROM python:3.13-slim AS base

WORKDIR /app

ENV PYTHONPATH=/app/django_app:/shared

COPY --from=ghcr.io/astral-sh/uv:latest /uv /usr/local/bin/uv

COPY backend/pyproject.toml backend/uv.lock ./

RUN uv pip install --system --no-cache .

COPY backend/ ./
COPY shared/ /shared/


FROM base AS dev

RUN uv export --frozen --all-groups --no-hashes -o /tmp/requirements-dev.txt && \
    uv pip install --system --no-cache -r /tmp/requirements-dev.txt

EXPOSE 8000


FROM base AS web

EXPOSE 8000


FROM base AS test

RUN uv export --frozen --all-groups --no-hashes -o /tmp/requirements-dev.txt && \
    uv pip install --system --no-cache -r /tmp/requirements-dev.txt

RUN printf '#!/bin/sh\nset -e\npytest -v\n' > /usr/local/bin/run-tests \
    && chmod +x /usr/local/bin/run-tests
