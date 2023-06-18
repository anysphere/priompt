#!/usr/bin/env bash

SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" &> /dev/null && pwd )"

echo '{
  "packages": ["priompt", "priompt-preview"]
}' > "$SCRIPT_DIR"/pnpm-workspace.yaml


# copy over the examples/.env.example to examples/.env
cp -f "$SCRIPT_DIR"/examples/.env.example "$SCRIPT_DIR"/examples/.env