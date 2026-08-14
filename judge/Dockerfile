# Built from the repository root — see backend/Dockerfile for why.
FROM python:3.13-slim AS base

WORKDIR /app

ENV PYTHONPATH=/shared

COPY --from=ghcr.io/astral-sh/uv:latest /uv /usr/local/bin/uv

COPY judge/pyproject.toml judge/uv.lock ./

RUN uv pip install --system --no-cache .

COPY judge/ ./
COPY shared/ /shared/


FROM base AS web

COPY judge/entrypoint.sh /entrypoint.sh
RUN chmod +x /entrypoint.sh

EXPOSE 8001

ENTRYPOINT ["/entrypoint.sh"]
CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8001"]


FROM base AS test

RUN uv export --frozen --all-groups --no-hashes -o /tmp/requirements-dev.txt && \
    uv pip install --system --no-cache -r /tmp/requirements-dev.txt

RUN printf '#!/bin/sh\nset -e\npytest -v\n' > /usr/local/bin/run-tests \
    && chmod +x /usr/local/bin/run-tests
