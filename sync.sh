#!/usr/bin/env bash

set -e

SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" &> /dev/null && pwd )"

if [[ -n $(git status --porcelain) ]]; then
  echo -e "${RED}Your git state is not empty. Aborting the script...${NC}"
  exit 1
fi

# TODO: push to the open-source using git subtree
# also copy over the eslintrc.base.json

# copy over the eslintrc.base.json
cp -f "$SCRIPT_DIR"/../../.eslintrc.base.json ./eslintrc.base.json
if [[ -n $(git status --porcelain) ]]; then
  git add .
  git commit -m "update the eslintrc.base.json"
fi