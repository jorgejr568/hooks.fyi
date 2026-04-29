#!/bin/sh
set -e
mc alias set local http://minio:9000 hooksminio hooksminio
mc mb --ignore-existing local/hooks-fyi
mc anonymous set download local/hooks-fyi || true
echo "MinIO bucket 'hooks-fyi' ready"
