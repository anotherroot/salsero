#!/usr/bin/env bash
#
# deploy.sh — ship salsaapp to its server.
#
#   ./scripts/deploy.sh [env] [--skip-build] [-h|--help]
#
# `env` defaults to `prod` and selects config/deploy/<env>.config. There is
# only one environment today; the argument exists so adding a second is a new
# config file rather than a rewrite.
#
# What it does, in order:
#   1. sanity-check the local toolchain and the SSH connection
#   2. build locally (npm run build)
#   3. rsync build/ + package.json + package-lock.json to the box
#   4. npm ci --omit=dev on the box
#   5. restart the systemd unit
#   6. health-check over loopback FROM INSIDE the box, and fail loudly
#
# What it deliberately does NOT do:
#   * ship secrets. Those are agenix, decrypted to an EnvironmentFile at
#     activation. Nothing sensitive travels with a deploy.
#   * run migrations or seed. Both happen at application boot, because
#     `npm ci --omit=dev` on the box does not install a TypeScript runner and
#     a deploy that must remember to seed eventually forgets.
#   * write the systemd unit, the nginx config or anything else declarative.
#     The NixOS host config owns all of that — see docs/deployment.md.
#   * roll back. There is no rollback. Redeploy from an older commit, and note
#     that migrations do not reverse.

set -euo pipefail

# Anchored to the repo, not the cwd, so it runs from anywhere — including from
# inside a git worktree, which `git rev-parse --show-toplevel` would get wrong.
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(dirname "$SCRIPT_DIR")"

DEPLOY_ENV="prod"
SKIP_BUILD=false

for arg in "$@"; do
	case "$arg" in
		-h|--help) grep '^#' "$0" | sed 's/^# \{0,1\}//; s/^#$//'; exit 0 ;;
		--skip-build) SKIP_BUILD=true ;;
		-*) echo "Unknown flag: $arg" >&2; exit 1 ;;
		*) DEPLOY_ENV="$arg" ;;
	esac
done

# ── output helpers ──────────────────────────────────────────────────────────
if [ -t 1 ]; then
	C_OK=$'\033[32m'; C_ERR=$'\033[31m'; C_DIM=$'\033[2m'; C_OFF=$'\033[0m'
else
	C_OK=""; C_ERR=""; C_DIM=""; C_OFF=""
fi
info()  { printf '%s==>%s %s\n' "$C_DIM" "$C_OFF" "$*"; }
ok()    { printf '%s ok %s %s\n' "$C_OK" "$C_OFF" "$*"; }
die()   { printf '%serror%s %s\n' "$C_ERR" "$C_OFF" "$*" >&2; exit 1; }

# ── config ──────────────────────────────────────────────────────────────────
CONFIG_FILE="$REPO_ROOT/config/deploy/${DEPLOY_ENV}.config"
if [ ! -f "$CONFIG_FILE" ]; then
	echo "error: no config for environment '${DEPLOY_ENV}'." >&2
	echo "Available:" >&2
	ls "$REPO_ROOT"/config/deploy/*.config 2>/dev/null | sed 's#.*/##; s#\.config$##; s#^#  - #' >&2
	exit 1
fi
# shellcheck source=/dev/null
source "$CONFIG_FILE"

: "${SERVER_USER:?SERVER_USER not set in $CONFIG_FILE}"
: "${SERVER_HOST:?SERVER_HOST not set in $CONFIG_FILE}"
: "${SERVER_PATH:?SERVER_PATH not set in $CONFIG_FILE}"
: "${SERVICE_NAME:?SERVICE_NAME not set in $CONFIG_FILE}"
: "${APP_PORT:?APP_PORT not set in $CONFIG_FILE}"
: "${SERVICE_USER:=$SERVICE_NAME}"

TARGET="$SERVER_USER@$SERVER_HOST"

# ── preflight ───────────────────────────────────────────────────────────────
info "deploying '${DEPLOY_ENV}' to ${TARGET}:${SERVER_PATH}"

for c in npm rsync ssh curl; do
	command -v "$c" >/dev/null 2>&1 || die "'$c' is not on PATH. Run inside 'nix develop'."
done

ssh -o ConnectTimeout=10 -o BatchMode=yes "$TARGET" true 2>/dev/null \
	|| die "cannot ssh to ${TARGET}. Check the host is up and your key is loaded:
    ssh ${TARGET}"

ssh "$TARGET" "sudo test -d '$SERVER_PATH'" \
	|| die "${SERVER_PATH} does not exist on the server.
It is created by systemd.tmpfiles in the NixOS host config. Apply that first:
    cd /home/tilen/.config/nixos-config
    nixos-rebuild switch --flake .#my-hetzner-vm --target-host ${TARGET} --sudo"

# ── build ───────────────────────────────────────────────────────────────────
if [ "$SKIP_BUILD" = true ]; then
	info "skipping build (--skip-build)"
	[ -d "$REPO_ROOT/build" ] || die "no build/ directory to ship. Drop --skip-build."
else
	info "building"
	(cd "$REPO_ROOT" && npm run build >/dev/null) || die "build failed. Run 'npm run build' to see why."
	ok "built"
fi

# ── ship ────────────────────────────────────────────────────────────────────
info "syncing"
# The target is 0750 service-user:service-user and we connect as a human, so
# rsync runs as root on the far side and ownership is fixed afterwards. This is
# the directory-tree equivalent of nikaudio's `sudo install` staging hop.
RS=(rsync -az --rsync-path="sudo rsync")
"${RS[@]}" --delete "$REPO_ROOT/build/" "$TARGET:$SERVER_PATH/build/"
"${RS[@]}" "$REPO_ROOT/package.json" "$REPO_ROOT/package-lock.json" "$TARGET:$SERVER_PATH/"
# drizzle's migrator reads this folder from disk at boot, from the unit's
# WorkingDirectory — see src/lib/server/db/index.ts.
"${RS[@]}" --delete "$REPO_ROOT/drizzle/" "$TARGET:$SERVER_PATH/drizzle/"
ssh "$TARGET" "sudo chown -R '$SERVICE_USER':'$SERVICE_USER' '$SERVER_PATH'"
ok "synced"

info "installing production dependencies"
# As the service user, not as the connecting human: the tree is owned by the
# service user, and node_modules written as root would be unreadable to it.
# HOME is set explicitly or npm tries to write a cache into /root.
ssh "$TARGET" "SERVER_PATH='$SERVER_PATH' SERVICE_USER='$SERVICE_USER' bash -s" <<'REMOTE'
set -euo pipefail
sudo -u "$SERVICE_USER" env HOME=/var/lib/salsa \
	npm --prefix "$SERVER_PATH" ci --omit=dev --no-audit --no-fund >/dev/null
REMOTE
ok "dependencies installed"

# ── restart ─────────────────────────────────────────────────────────────────
info "restarting ${SERVICE_NAME}"
ssh "$TARGET" "sudo systemctl restart '$SERVICE_NAME'"
sleep 2
ssh "$TARGET" "systemctl status '$SERVICE_NAME' --no-pager | head -15" || true
# `is-active` LAST, so its exit status is what drives the check.
if ! ssh "$TARGET" "systemctl is-active --quiet '$SERVICE_NAME'"; then
	echo >&2
	ssh "$TARGET" "sudo journalctl -u '$SERVICE_NAME' -n 40 --no-pager" >&2 || true
	die "${SERVICE_NAME} is not running after restart (journal above)."
fi

# ── health ──────────────────────────────────────────────────────────────────
# Curled from INSIDE the box over loopback, so this tests the service itself
# rather than nginx or Cloudflare.
info "health check"
for i in $(seq 1 20); do
	code="$(ssh "$TARGET" "curl -fsS -o /dev/null -w '%{http_code}' http://127.0.0.1:${APP_PORT}/health" 2>/dev/null || true)"
	if [ "$code" = "200" ]; then
		ok "healthy after ${i}s"
		echo
		ok "deployed. https://${PUBLIC_HOST:-salsa.anotherroot.eu}"
		exit 0
	fi
	sleep 1
done

echo >&2
ssh "$TARGET" "sudo journalctl -u '$SERVICE_NAME' -n 40 --no-pager" >&2 || true
die "/health never returned 200 on 127.0.0.1:${APP_PORT} (journal above)."
