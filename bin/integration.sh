#!/bin/sh
set -eu

wait_for_url () {
    echo "Testing $1..."
    printf 'GET %s\nHTTP 200' "$1" | hurl --retry "$2" > /dev/null;
    return 0
}

echo "Starting container..."
docker compose up --detach --build

echo "Waiting for server to be ready..."
wait_for_url "$1" 60

echo "Stopping container..."
docker compose down
