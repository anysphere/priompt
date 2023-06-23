#!/usr/bin/env bash

set -e

SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" &> /dev/null && pwd )"

if [[ -n $(git status --porcelain) ]]; then
  echo -e "${RED}Your git state is not empty. Aborting the script...${NC}"
  exit 1
fi

# make sure we are on main, otherwise print warning
if [[ $(git branch --show-current) != "main" ]]; then
  echo "WARNING: You are not on main branch, please switch to main branch before running this script."
  exit 1
fi

# cd to the root everysphere folder
cd "$SCRIPT_DIR"/../../..

git subtree pull --prefix=backend/packages/priompt git@github.com:anysphere/vscode main

echo "NOW REVIEW THE CHANGES AND PUSH TO GITHUB"
echo "Run git push after reviewing git log NOW."