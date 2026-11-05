#!/usr/bin/env bash
# Screenshot rig: see README.md.
# usage: shots.sh <db-copy> <out-dir> <width>x<height> [--theme light|dark] [--pages FILE] [--group ID]
set -u
HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT="$(cd "$HERE/../.." && pwd)"
DB="${1:-}"; OUT="${2:-}"; SIZE="${3:-}"
if [ -z "$DB" ] || [ -z "$OUT" ] || [ -z "$SIZE" ]; then
  echo "usage: shots.sh <db-copy> <out-dir> <width>x<height> [--theme light|dark] [--pages FILE] [--group ID]" >&2; exit 2
fi
shift 3
THEME=light; PAGES="$HERE/pages.txt"; GROUP=""
while [ $# -gt 0 ]; do
  case "$1" in
    --theme) THEME="${2:-}"; shift 2 ;;
    --pages) PAGES="${2:-}"; shift 2 ;;
    --group) GROUP="${2:-}"; shift 2 ;;
    *) echo "unknown argument: $1" >&2; exit 2 ;;
  esac
done
[ -f "$DB" ] || { echo "no such db: $DB" >&2; exit 2; }
mkdir -p "$OUT"; OUT="$(cd "$OUT" && pwd)"; PAGES="$(cd "$(dirname "$PAGES")" && pwd)/$(basename "$PAGES")"

TMP="$(mktemp -d)"
SERVER_PID=""
cleanup() {
  if [ -n "$SERVER_PID" ]; then
    # the server runs in its own session (setsid), so its pid is its process group: stop the whole group
    kill -TERM -- "-$SERVER_PID" 2>/dev/null
    for _ in 1 2 3 4 5 6 7 8 9 10; do kill -0 -- "-$SERVER_PID" 2>/dev/null || break; sleep 0.5; done
    kill -KILL -- "-$SERVER_PID" 2>/dev/null
  fi
  rm -rf "$TMP"
}
trap cleanup EXIT
trap 'exit 130' INT TERM

cp "$DB" "$TMP/salsa.db"
for ext in -wal -shm; do [ -f "$DB$ext" ] && cp "$DB$ext" "$TMP/salsa.db$ext"; done

PORT=""
for _ in $(seq 1 50); do
  p=$((20000 + RANDOM % 20000))
  if ! (exec 3<>"/dev/tcp/127.0.0.1/$p") 2>/dev/null; then PORT=$p; break; fi
done
[ -n "$PORT" ] || { echo "no free port found" >&2; exit 1; }

FAKETIME_LIB="$(nix build --no-link --print-out-paths nixpkgs#libfaketime)/lib/libfaketimeMT.so.1" || exit 1
[ -f "$FAKETIME_LIB" ] || { echo "shots: libfaketime not found at $FAKETIME_LIB" >&2; exit 1; }
cd "$ROOT"
export SHOTS_FAKETIME_LIB="$FAKETIME_LIB"
export SHOTS_TMP="$TMP" SHOTS_PORT="$PORT" SHOTS_INSTANT="$(cat "$HERE/instant.txt")"
setsid nix develop --command bash -c '
  export DATA_DIR="$SHOTS_TMP" DATABASE_PATH="$SHOTS_TMP/salsa.db"
  # the server clock starts at the fixed instant (UTC) and runs on from there (faketime start-at form), so timers still work
  export TZ=UTC LD_PRELOAD="$SHOTS_FAKETIME_LIB" FAKETIME="@$SHOTS_INSTANT" FAKETIME_DONT_FAKE_MONOTONIC=1 FAKETIME_NO_CACHE=1
  exec npx vite dev --port "$SHOTS_PORT" --strictPort --host 127.0.0.1
' >"$TMP/server.log" 2>&1 &
SERVER_PID=$!

up=""
for _ in $(seq 1 120); do
  if ! kill -0 "$SERVER_PID" 2>/dev/null; then break; fi
  if curl -fsS -m 3 "http://127.0.0.1:$PORT/health" >/dev/null 2>&1; then up=1; break; fi
  sleep 1
done
if [ -z "$up" ]; then
  echo "shots: the dev server never answered /health on port $PORT; server log:" >&2
  tail -n 30 "$TMP/server.log" >&2
  exit 1
fi

# Playwright and its browsers must come from the same nixpkgs.
unset LD_LIBRARY_PATH
PLAYWRIGHT_BROWSERS_PATH="$(nix build --no-link --print-out-paths nixpkgs#playwright-driver.browsers)" || exit 1
export PLAYWRIGHT_BROWSERS_PATH
timeout 900 nix shell --impure --expr 'with (builtins.getFlake "nixpkgs").legacyPackages.x86_64-linux; python3.withPackages (p: [p.playwright p.pillow])' \
  -c python3 -I "$HERE/shots.py" shoot --db "$TMP/salsa.db" --base "http://127.0.0.1:$PORT" \
  --out "$OUT" --size "$SIZE" --theme "$THEME" --pages "$PAGES" ${GROUP:+--group "$GROUP"}
exit $?
