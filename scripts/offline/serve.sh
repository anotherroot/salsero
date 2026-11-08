#!/usr/bin/env bash
# The offline walk's server: see README.md.
# usage: serve.sh <db-copy>     (SKIP_BUILD=1 serves the build already in build/)
# Prints `port <n>` (the ORIGIN's, for walk.py's network), `upstream <n>` (the server's own),
# `db <path>` and `log <path>` once /health answers, then runs until killed.
set -u
HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT="$(cd "$HERE/../.." && pwd)"
DB="${1:-}"
[ -n "$DB" ] || { echo "usage: serve.sh <db-copy>" >&2; exit 2; }
[ -f "$DB" ] || { echo "no such db: $DB" >&2; exit 2; }

TMP="$(mktemp -d)"
SERVER_PID=""
cleanup() {
  if [ -n "$SERVER_PID" ]; then
    # the server runs in its own session (setsid): its pid is its process group
    kill -TERM -- "-$SERVER_PID" 2>/dev/null
    for _ in 1 2 3 4 5 6 7 8 9 10; do kill -0 -- "-$SERVER_PID" 2>/dev/null || break; sleep 0.5; done
    kill -KILL -- "-$SERVER_PID" 2>/dev/null
  fi
  rm -rf "$TMP"
}
trap cleanup EXIT
trap 'exit 130' INT TERM HUP

# The copy, never the original (and never .data/): a plain copy, so sqlite never opens the source.
cp "$DB" "$TMP/salsa.db" || exit 1
for ext in -wal -shm; do [ -f "$DB$ext" ] && cp "$DB$ext" "$TMP/salsa.db$ext"; done
# files beside the db (<db>.data/: lesson-videos/, recordings/ ...) join the data dir, as in scripts/shots
[ -d "$DB.data" ] && cp -r "$DB.data/." "$TMP/"
cd "$ROOT"

# Migrate it, and a session `walk` for the dance's first admin (as scripts/shots/shots.py `prepare`).
nix develop -c node --input-type=module -e '
  import Database from "better-sqlite3";
  import { drizzle } from "drizzle-orm/better-sqlite3";
  import { migrate } from "drizzle-orm/better-sqlite3/migrator";
  const db = new Database(process.argv[1]);
  db.pragma("foreign_keys = ON");
  migrate(drizzle(db), { migrationsFolder: "drizzle" });
  const dance = process.env.WALK_DANCE ?? "salsa";
  const admin = db.prepare("select id from users where dance = ? order by is_admin desc, created_at limit 1").get(dance);
  if (!admin) { console.error("serve: no account in " + dance); process.exit(1); }
  const now = Date.now();
  db.prepare("delete from sessions where id = ?").run("walk");
  db.prepare("insert into sessions (id, user_id, expires_at, created_at) values (?, ?, ?, ?)").run("walk", admin.id, now + 86400000, now);
  db.close();
' "$TMP/salsa.db" || exit 1

if [ "${SKIP_BUILD:-}" != 1 ]; then
  nix develop -c npm run build >"$TMP/build.log" 2>&1 || { tail -n 40 "$TMP/build.log" >&2; exit 1; }
fi

free_port() {
  for _ in $(seq 1 50); do
    p=$((20000 + RANDOM % 20000))
    if [ "$p" != "${1:-}" ] && ! (exec 3<>"/dev/tcp/127.0.0.1/$p") 2>/dev/null; then echo "$p"; return; fi
  done
  return 1
}
# Two ports: the server's own (UPSTREAM), and the one the browser uses (PORT, the ORIGIN), where
# walk.py puts its switchable network in front of the server: Playwright's offline does not hold
# for a service worker, so the walk cuts the connection itself.
UPSTREAM="$(free_port)" && PORT="$(free_port "$UPSTREAM")" || { echo "no free port found" >&2; exit 1; }

export WALK_TMP="$TMP" WALK_PORT="$PORT" WALK_UPSTREAM="$UPSTREAM"
setsid nix develop --command bash -c '
  export PORT="$WALK_UPSTREAM" HOST=127.0.0.1 ORIGIN="http://127.0.0.1:$WALK_PORT"
  export DATA_DIR="$WALK_TMP" DATABASE_PATH="$WALK_TMP/salsa.db" BODY_SIZE_LIMIT=20M
  exec node build
' >"$TMP/server.log" 2>&1 &
SERVER_PID=$!

up=""
for _ in $(seq 1 120); do
  kill -0 "$SERVER_PID" 2>/dev/null || break
  if curl -fsS -m 3 "http://127.0.0.1:$UPSTREAM/health" >/dev/null 2>&1; then up=1; break; fi
  sleep 1
done
if [ -z "$up" ]; then
  echo "serve: node build never answered /health on port $UPSTREAM; server log:" >&2
  tail -n 30 "$TMP/server.log" >&2
  exit 1
fi
echo "port $PORT"
echo "upstream $UPSTREAM"
echo "db $TMP/salsa.db"
echo "log $TMP/server.log"
wait "$SERVER_PID"
