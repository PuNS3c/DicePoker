#!/usr/bin/env bash

set -euo pipefail

require_command() {
  if ! command -v "$1" >/dev/null 2>&1; then
    printf 'Missing required command: %s\n' "$1" >&2
    exit 1
  fi
}

has_worktree_changes() {
  ! git diff --quiet || ! git diff --cached --quiet || [ -n "$(git ls-files --others --exclude-standard)" ]
}

list_untracked_files() {
  git ls-files --others --exclude-standard
}

require_command git
require_command npm
require_command gh

branch_name="$(git branch --show-current)"

if [ "$branch_name" != "main" ]; then
  printf 'Deploy script must run from the main branch. Current branch: %s\n' "$branch_name" >&2
  exit 1
fi

if ! has_worktree_changes; then
  printf 'No local changes to deploy.\n'
  exit 0
fi

untracked_files="$(list_untracked_files)"

if [ -n "$untracked_files" ]; then
  printf 'Refusing to deploy with untracked files present:\n%s\n' "$untracked_files" >&2
  printf 'Review and stage intended new files manually before deploying.\n' >&2
  exit 1
fi

commit_message="${1:-chore: deploy updates $(date -u +%Y-%m-%dT%H:%M:%SZ)}"

printf 'Running tests...\n'
npm test

printf 'Building production bundle...\n'
npm run build

printf 'Staging changes...\n'
git add -u

if git diff --cached --quiet; then
  printf 'No staged changes after build. Nothing to commit.\n'
  exit 0
fi

printf 'Creating commit...\n'
git commit -m "$commit_message"

printf 'Pushing main to origin...\n'
git push origin main

repo_slug="$(gh repo view --json owner,name --jq '.owner.login + "/" + .name')"

if ! gh api "repos/$repo_slug/pages" >/dev/null 2>&1; then
  printf 'Enabling GitHub Pages for GitHub Actions...\n'
  gh api -X POST "repos/$repo_slug/pages" -f build_type=workflow >/dev/null
fi

head_sha="$(git rev-parse HEAD)"
run_id=""

printf 'Waiting for the GitHub Pages workflow to start...\n'
for _ in $(seq 1 20); do
  run_id="$(gh run list --workflow "Deploy GitHub Pages" --branch main --limit 10 --json databaseId,headSha --jq "map(select(.headSha == \"$head_sha\"))[0].databaseId")"

  if [ -n "$run_id" ] && [ "$run_id" != "null" ]; then
    break
  fi

  sleep 3
done

if [ -z "$run_id" ] || [ "$run_id" = "null" ]; then
  printf 'Could not find the deployment workflow run for commit %s\n' "$head_sha" >&2
  exit 1
fi

printf 'Watching workflow run %s...\n' "$run_id"
gh run watch "$run_id" --exit-status

page_url="$(gh api "repos/$repo_slug/pages" --jq '.html_url')"
printf 'Live URL: %s\n' "$page_url"
