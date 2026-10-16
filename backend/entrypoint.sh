#!/bin/sh
set -eu

chown -R appuser:appuser /app/media
exec su -s /bin/sh appuser -c "$*"
