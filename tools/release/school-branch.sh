#!/usr/bin/env bash
# Release management per school (release 16). Each client school has its own branch, cut from dev:
#
#   main ──► dev ──► school/<subdomain>   (one branch per school; holds schools/<subdomain>/school.json)
#
#   create <sub> <school.json>   Cut school/<sub> from dev, add its school.json (downloaded from Client Delivery › Release & branch), push.
#   uat    <sub> <version>       Tag the UAT build of this version: <sub>-uat-v<version>.
#   live   <sub> <version>       After the client signs off: tag the live release <sub>-v<version>.
#   update <sub>                 Bring product fixes from dev into the school's branch (merge, no rebase, so tags stay valid).
#   list                         List the school branches and their latest tags.
#
# The school's branch never holds secrets: keys stay in AWS Secrets Manager. Run from the repository root.
set -euo pipefail
cmd=${1:-}; sub=${2:-}
need() { [ -n "$sub" ] || { echo "Give the school's subdomain, e.g. hillviewschool"; exit 2; }; [[ "$sub" =~ ^[a-z0-9-]{2,40}$ ]] || { echo "Subdomain: lower-case letters, digits and - only"; exit 2; }; }
branch() { echo "school/$sub"; }
push() { git -c push.negotiate=true push "$@"; }
ensure_dev() {
  git fetch -q origin
  if ! git rev-parse -q --verify origin/dev >/dev/null; then git branch -f dev origin/main && push origin dev; fi
}
case "$cmd" in
  create)
    need; file=${3:-}; [ -f "$file" ] || { echo "Give the school.json from Client Delivery"; exit 2; }
    ensure_dev
    if git rev-parse -q --verify "origin/$(branch)" >/dev/null; then echo "$(branch) already exists"; exit 1; fi
    git switch -c "$(branch)" origin/dev
    mkdir -p "schools/$sub" && cp "$file" "schools/$sub/school.json"
    git add "schools/$sub/school.json" && git commit -qm "School $sub: branch from dev with its set-up"
    push -u origin "$(branch)"
    echo "Created $(branch) from dev" ;;
  uat|live)
    need; ver=${3:-}; [[ "$ver" =~ ^[0-9]+\.[0-9]+$ ]] || { echo "Give the version, e.g. 1.0"; exit 2; }
    git fetch -q origin "$(branch)"
    tag=$([ "$cmd" = uat ] && echo "$sub-uat-v$ver" || echo "$sub-v$ver")
    msg=$([ "$cmd" = uat ] && echo "UAT build of $sub version $ver" || echo "Live release of $sub version $ver (client signed off)")
    git tag -a "$tag" "origin/$(branch)" -m "$msg"
    push origin "$tag"
    echo "Tagged $tag on $(branch)" ;;
  update)
    need; ensure_dev
    git switch "$(branch)" 2>/dev/null || git switch -c "$(branch)" "origin/$(branch)"
    git merge --no-edit origin/dev
    push origin "$(branch)"
    echo "Merged dev into $(branch)" ;;
  list)
    git fetch -q origin --tags
    git branch -r --list 'origin/school/*' | while read -r b; do s=${b#origin/school/}; echo "$s  $(git tag --list "$s-*" --sort=-creatordate | head -1)"; done ;;
  *) sed -n '2,12p' "$0"; exit 2 ;;
esac
