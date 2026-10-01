#!/usr/bin/env bash
# slot.sh — per-worktree dev environments ("feature slots") on fixed ports.
#
#   slot N:  vite dev on 5180+N · data in <worktree>/.data · tmux "salsa app - wt-<N>"
#   main:    vite dev on 5173   · data in .data             (never managed by this script)
#
# The flake points DATA_DIR at $PWD/.data, so every worktree already has its own
# database and media. On first `up` a slot's .data is cloned from main's: the
# database through sqlite3's .backup, the media as hard links (the app only ever
# creates or unlinks media files, so the links never leak a write back to main).
# uploads/ is not cloned — partial chunks are appended to in place.
#
# Slot state lives in tmux only (session "salsa app - wt-<N>"); prefix C-t cycles
# through a project's sessions. Adapted from done-list's scripts/slot.sh.
#
# Usage:
#   slot.sh new <slug> [-s N]   create worktree ../salsaapp-wt/<slug> + branch off master + up
#   slot.sh up <N> [path]       start slot N for the worktree at path (default: cwd)
#   slot.sh down <N>            stop slot N + remove its worktree (and its .data) & branch
#                               (refuses if dirty or unmerged to master)
#   slot.sh down-force <N>      stop + remove unconditionally
#   slot.sh status              show all slots
#   slot.sh reset-db <N>        re-clone main's database into slot N and restart its dev server

set -euo pipefail

SLOTS="1 2 3 4 5 6"
BASE_SESSION="${SALSA_SESSION:-salsa app}"

die() { echo "slot.sh: $*" >&2; exit 1; }

main_checkout() { git worktree list --porcelain | head -1 | sed 's/^worktree //'; }

dev_port() { echo $((5180 + $1)); }
session()  { echo "$BASE_SESSION - wt-$1"; }

check_slot_no() { [[ "${1:-}" =~ ^[123456]$ ]] || die "slot number must be 1-6 (got '${1:-}')"; }

session_wt() { tmux show-environment -t "=$(session "$1")" SALSA_WT 2>/dev/null | sed 's/^SALSA_WT=//' || true; }

in_shell() { # dir command — run in the flake's dev shell (the host has no node/sqlite3)
  local dir=$1; shift
  # cd first: the shellHook creates $PWD/.data/recordings, so it must land in $dir
  (cd "$dir" && nix develop "$MAIN" --command bash -c "$*")
}

clone_db() { # wt — copy main's database into the slot, consistent even while main's dev server runs
  local src="$MAIN/.data/salsa.db" dst="$1/.data/salsa.db"
  [[ -f $src ]] || { echo "main has no .data/salsa.db — the slot starts empty (set ADMIN_EMAIL/ADMIN_PASSWORD)"; return 0; }
  rm -f "$dst" "$dst-wal" "$dst-shm"
  in_shell "$1" "sqlite3 '$src' \".backup '$dst'\""
  echo "Cloned main's database into $dst"
}

ensure_data() { # wt
  local wt=$1
  [[ -f "$wt/.data/salsa.db" ]] && return 0
  mkdir -p "$wt/.data"
  clone_db "$wt"
  local entry name
  for entry in "$MAIN/.data"/*; do
    name=$(basename "$entry")
    case $name in salsa.db | salsa.db-* | uploads) continue ;; esac
    # merges into a dir the shellHook may already have made; never clobbers
    cp -al --update=none "$entry" "$wt/.data/"
  done
  echo "Linked main's media into $wt/.data"
}

ensure_node_modules() { # wt
  [[ -d "$1/node_modules" ]] && return 0
  echo "npm ci in $1 ..."
  in_shell "$1" "npm ci"
}

run_in_pane() { # target wt command...  — run inside the worktree's dev shell
  local target=$1 wt=$2; shift 2
  tmux send-keys -t "$target" "nix develop '$wt' --command bash -c '$*'" Enter
}

dev_cmd() { echo "npm run dev -- --port $(dev_port "$1") --strictPort"; }

print_urls() {
  local n=$1 wt=$2
  echo "slot $n:"
  echo "  app   http://localhost:$(dev_port "$n")"
  echo "  data  $wt/.data"
  echo "  tmux  session '$(session "$n")' (windows: nvim, dev) — prefix C-t cycles"
}

cmd_up() {
  local n=${1:-}; shift || true
  local wt=${1:-$PWD}
  check_slot_no "$n"
  wt=$(git -C "$wt" rev-parse --show-toplevel) || die "$wt is not inside the repo"
  [[ "$wt" == "$MAIN" ]] && die "refusing to run a slot on the main checkout (main uses 5173)"

  local sess; sess=$(session "$n")
  local existing; existing=$(session_wt "$n")
  if [[ -n $existing ]]; then
    [[ "$existing" == "$wt" ]] && { echo "slot $n already up for $wt"; print_urls "$n" "$wt"; return 0; }
    die "slot $n is already running for $existing (down it first)"
  fi
  tmux has-session -t "=$sess" 2>/dev/null && die "a session '$sess' exists but has no SALSA_WT — kill it first"

  command -v direnv >/dev/null && direnv allow "$wt" 2>/dev/null || true
  ensure_data "$wt"
  ensure_node_modules "$wt"

  tmux new-session -d -s "$sess" -n nvim -c "$wt"
  tmux set-environment -t "=$sess" SALSA_WT "$wt"
  run_in_pane "=$sess:nvim" "$wt" "nvim ."
  tmux new-window -t "=$sess:" -n dev -c "$wt"
  run_in_pane "=$sess:dev" "$wt" "$(dev_cmd "$n")"
  tmux select-window -t "=$sess:nvim"

  print_urls "$n" "$wt"
}

cmd_new() {
  local slug=${1:-}; shift || true
  [[ -n $slug ]] || die "usage: slot.sh new <slug> [-s N]"
  local n=""
  while [[ $# -gt 0 ]]; do
    case $1 in
      -s) n=$2; shift 2 ;;
      *) die "unknown option $1" ;;
    esac
  done
  if [[ -z $n ]]; then
    for s in $SLOTS; do
      [[ -z $(session_wt "$s") ]] && ! tmux has-session -t "=$(session "$s")" 2>/dev/null && { n=$s; break; }
    done
    [[ -n $n ]] || die "all slots are busy (slot.sh status)"
  fi
  check_slot_no "$n"

  local wt; wt="$(dirname "$MAIN")/salsaapp-wt/$slug"
  [[ -e $wt ]] && die "$wt already exists"
  git -C "$MAIN" worktree add -b "$slug" "$wt" master
  cmd_up "$n" "$wt"
}

assert_wt_safe_to_down() { # wt slot
  local wt=$1 n=$2
  [[ -z $(git -C "$wt" status --porcelain) ]] \
    || die "slot $n has uncommitted changes in $wt — commit them, or 'slot.sh down-force $n'"
  local branch unmerged
  branch=$(git -C "$wt" rev-parse --abbrev-ref HEAD 2>/dev/null || echo '?')
  unmerged=$(git -C "$wt" rev-list --count master..HEAD 2>/dev/null) \
    || die "slot $n: cannot compare '$branch' against 'master' — use 'slot.sh down-force $n' if intended"
  [[ $unmerged -eq 0 ]] \
    || die "slot $n branch '$branch' has $unmerged commit(s) not merged into master — merge them, or 'slot.sh down-force $n'"
}

cmd_down() {
  local n=$1 force=${2:-}; check_slot_no "$n"
  local wt; wt=$(session_wt "$n")
  [[ $force == "--force" || -z $wt ]] || assert_wt_safe_to_down "$wt" "$n"
  local branch=""
  [[ -n $wt ]] && branch=$(git -C "$wt" rev-parse --abbrev-ref HEAD 2>/dev/null || true)
  tmux kill-session -t "=$(session "$n")" 2>/dev/null \
    && echo "slot $n stopped" || echo "slot $n was not running"
  if [[ -z $wt ]]; then echo "slot $n has no recorded worktree — nothing to remove"; return 0; fi
  local gflag=""; [[ $force == "--force" ]] && gflag="--force"
  if git -C "$MAIN" worktree remove $gflag "$wt"; then
    echo "removed worktree $wt (and its .data)"
  else
    die "slot $n stopped but 'git worktree remove' failed for $wt"
  fi
  if [[ -n $branch && $branch != master && $branch != HEAD && $branch != "?" ]]; then
    local bflag="-d"; [[ $force == "--force" ]] && bflag="-D"
    git -C "$MAIN" branch $bflag "$branch" && echo "deleted branch $branch"
  fi
}

cmd_status() {
  for n in $SLOTS; do
    local wt branch=""
    wt=$(session_wt "$n")
    [[ -n $wt ]] && branch=$(git -C "$wt" rev-parse --abbrev-ref HEAD 2>/dev/null || echo '?')
    printf 'slot %s  :%s  %-20s %s\n' "$n" "$(dev_port "$n")" "${branch:-}" "${wt:-(down)}"
  done
}

cmd_reset_db() {
  local n=$1; check_slot_no "$n"
  local wt; wt=$(session_wt "$n")
  [[ -n $wt ]] || die "slot $n is not running"
  local sess; sess=$(session "$n")
  # The dev server holds the old file open; stop it before swapping the database.
  tmux send-keys -t "=$sess:dev" C-c
  sleep 1
  clone_db "$wt"
  run_in_pane "=$sess:dev" "$wt" "$(dev_cmd "$n")"
  echo "restarted the dev server in '$sess':dev"
}

MAIN=$(main_checkout)
[[ -d $MAIN ]] || die "could not resolve the main checkout (run inside the repo)"

cmd=${1:-}; shift || true
case $cmd in
  new)        cmd_new "$@" ;;
  up)         cmd_up "$@" ;;
  down)       cmd_down "${1:?slot number}" ;;
  down-force) cmd_down "${1:?slot number}" --force ;;
  status)     cmd_status ;;
  reset-db)   cmd_reset_db "${1:?slot number}" ;;
  *) sed -n '2,23p' "$0"; exit 1 ;;
esac
