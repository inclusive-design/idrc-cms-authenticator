#!/bin/sh
set -eu

wait_for_url () {
    echo "Testing $1..."
    printf 'GET %s\nHTTP 200' "$1" | hurl --retry "$2" > /dev/null;
    return 0
}

# GitHub Actions should use the docker/build-push-action action for building an image to make use
# of its GHA cache backend. GHA workflows should not use Docker Compose's '--build' option because
# Compose does not support BuildKit/buildx.
if [ "$GITHUB_ACTIONS" != "true" ]; then
    echo "Starting container..."
    docker compose up --build --detach
fi

echo "Waiting for server to be ready..."
wait_for_url "$1" 60

echo "Stopping container..."
docker compose down
