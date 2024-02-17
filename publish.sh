#!/bin/bash

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" >/dev/null 2>&1 && pwd)"
cd "$SCRIPT_DIR"


# Check if a version bumping flag is provided
if [ $# -ne 1 ]; then
    echo "Error: Version bumping flag (patch, minor, or major) is required."
    exit 1
fi

# Validate the version bumping flag
case $1 in
    patch|minor|major)
        ;;
    *)
        echo "Error: Invalid version bumping flag. Use patch, minor, or major."
        exit 1
        ;;
esac
# Change to the priompt directory, increment the version, and publish the package
cd $SCRIPT_DIR/priompt
npm version $1
cd $SCRIPT_DIR/priompt-preview
npm version $1
cd $SCRIPT_DIR/tiktoken-node
npm version $1

cd $SCRIPT_DIR/priompt
pnpm publish-to-npm

cd $SCRIPT_DIR/priompt-preview
pnpm publish-to-npm

cd $SCRIPT_DIR/tiktoken-node
pnpm publish-to-npm