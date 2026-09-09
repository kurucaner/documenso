#!/usr/bin/env bash
set -euo pipefail

# Sync documenso/documenso into origin/main, then merge main into fork and push.
#
# One-time setup:
#   git remote add upstream https://github.com/documenso/documenso.git
#
# Usage:
#   npm run sync:upstream
#   ./scripts/sync-upstream.sh
#
# Optional env overrides:
#   UPSTREAM_REMOTE=upstream ORIGIN_REMOTE=origin UPSTREAM_BRANCH=main FORK_BRANCH=fork
#   PUSH=false ./scripts/sync-upstream.sh   # fetch/merge only, no push

UPSTREAM_REMOTE="${UPSTREAM_REMOTE:-upstream}"
ORIGIN_REMOTE="${ORIGIN_REMOTE:-origin}"
UPSTREAM_BRANCH="${UPSTREAM_BRANCH:-main}"
FORK_BRANCH="${FORK_BRANCH:-fork}"
PUSH="${PUSH:-true}"

if ! git remote get-url "${UPSTREAM_REMOTE}" >/dev/null 2>&1; then
  echo "Error: remote '${UPSTREAM_REMOTE}' is not configured."
  echo "Run: git remote add upstream https://github.com/documenso/documenso.git"
  exit 1
fi

echo "→ Fetching ${UPSTREAM_REMOTE}..."
git fetch "${UPSTREAM_REMOTE}"

echo "→ Updating local ${UPSTREAM_BRANCH} from ${UPSTREAM_REMOTE}/${UPSTREAM_BRANCH}..."
git checkout "${UPSTREAM_BRANCH}"
git merge --ff-only "${UPSTREAM_REMOTE}/${UPSTREAM_BRANCH}"

if [[ "${PUSH}" == "true" ]]; then
  echo "→ Pushing ${UPSTREAM_BRANCH} to ${ORIGIN_REMOTE}..."
  git push "${ORIGIN_REMOTE}" "${UPSTREAM_BRANCH}"
else
  echo "→ Skipping push for ${UPSTREAM_BRANCH} (PUSH=false)"
fi

echo "→ Merging ${UPSTREAM_BRANCH} into ${FORK_BRANCH}..."
git checkout "${FORK_BRANCH}"
git merge "${UPSTREAM_BRANCH}"

if [[ "${PUSH}" == "true" ]]; then
  echo "→ Pushing ${FORK_BRANCH} to ${ORIGIN_REMOTE}..."
  git push "${ORIGIN_REMOTE}" "${FORK_BRANCH}"
else
  echo "→ Skipping push for ${FORK_BRANCH} (PUSH=false)"
fi

echo "✓ Sync complete"
git log --oneline -3
