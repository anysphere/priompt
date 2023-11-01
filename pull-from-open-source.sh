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

if [[ ! -d "$SCRIPT_DIR/priompt-opensource" ]]; then
  git clone git@github.com:anysphere/priompt "$SCRIPT_DIR/priompt-opensource"
fi

cd "$SCRIPT_DIR/priompt-opensource"
git checkout main
git checkout -- . || true
git restore --staged . || true
git checkout -- . || true
git clean -fd . || true
git pull
if [[ -n $(git status --porcelain) ]]; then
  echo -e "${RED}Your git state inside priompt-opensource is not empty. Aborting the script...${NC}"
  exit 1
fi

LAST_SYNCED_COMMIT=$(cat "$SCRIPT_DIR/../priompt-last-open-source-synced-commit.txt")
echo "LAST_SYNCED_COMMIT: $LAST_SYNCED_COMMIT"
COMMIT_IDS=$(git rev-list --reverse HEAD...$LAST_SYNCED_COMMIT)

echo "Commit IDs:"
echo $COMMIT_IDS

for COMMIT_ID in $COMMIT_IDS
do
  cd "$SCRIPT_DIR/priompt-opensource"
  git show $COMMIT_ID > "$SCRIPT_DIR/commit.patch"
  sd 'a/' 'a/' "$SCRIPT_DIR/commit.patch"
  sd 'b/' 'b/' "$SCRIPT_DIR/commit.patch"
  cd "$SCRIPT_DIR/../../.."
  git apply "$SCRIPT_DIR/commit.patch"
  git add .
  COMMIT_MSG=$(cd $SCRIPT_DIR/priompt-opensource && git log -1 --pretty=%B $COMMIT_ID | tr -d '\r')
  echo "$COMMIT_MSG" > "$SCRIPT_DIR/commit.template"
  echo -e "\n\n" >> "$SCRIPT_DIR/commit.template"
  COMMIT_AUTHOR=$(cd $SCRIPT_DIR/priompt-opensource && git log -1 --pretty=%an $COMMIT_ID)
  COMMIT_EMAIL=$(cd $SCRIPT_DIR/priompt-opensource && git log -1 --pretty=%ae $COMMIT_ID)
  echo "Co-authored-by: $COMMIT_AUTHOR <$COMMIT_EMAIL>" >> "$SCRIPT_DIR/commit.template"
  echo -e "\n\n" >> "$SCRIPT_DIR/commit.template"
  FULL_COMMIT=$(cd $SCRIPT_DIR && cat "$SCRIPT_DIR/commit.patch")
  echo "$FULL_COMMIT" | while IFS= read -r line
  do
    echo -e "# $line" >> "$SCRIPT_DIR/commit.template"
  done
  git commit --template="$SCRIPT_DIR/commit.template"
  COMMIT_ID_MAIN=$(git rev-parse HEAD)
  echo "$COMMIT_ID_MAIN" > "$SCRIPT_DIR/../priompt-last-internal-synced-commit.txt"
  echo "$COMMIT_ID" > "$SCRIPT_DIR/../priompt-last-open-source-synced-commit.txt"
done

echo "DONE! Now please push inside the main repo."

