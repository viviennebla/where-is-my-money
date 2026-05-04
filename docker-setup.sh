#!/bin/sh
# Install Docker CLI in Alpine container (idempotent - skips if already installed)
if ! command -v docker >/dev/null 2>&1; then
    apk add -q docker-cli docker-cli-compose
fi
docker --version
