#!/bin/sh
set -eu

mkdir -p /app/logs
chown -R nimir:nimir /app/logs

exec su-exec nimir:nimir "$@"
