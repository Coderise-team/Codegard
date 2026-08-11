#!/bin/sh
set -e
python -m app.sandbox_image
exec "$@"
