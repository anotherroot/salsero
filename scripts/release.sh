#!/usr/bin/env bash
#
# release.sh — publish a new version of the Android apps; phones pick it up on
# their next start (see docs/deployment.md, "Releasing app updates").
#
#   nix develop .#android -c ./scripts/release.sh salsa|bachata|both [--required]
#
# Needs a clean git tree. Builds the signed direct release APK of each dance,
# checks its signing key and that its version code is above the published one,
# uploads it to /var/lib/salsa/releases/<dance>/<code>.apk and only then points
# current.json at it. --required makes every older version update before it
# can go on; that minimum stays for later releases.
# The ssh commands expand their variables here on purpose.
# shellcheck disable=SC2029
set -euo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
# shellcheck source=/dev/null
. "$REPO_ROOT/config/deploy/prod.config"
TARGET="$SERVER_USER@$SERVER_HOST"
RELEASES="/var/lib/salsa/releases"
PUBLIC="https://$PUBLIC_HOST"
# The release key's SHA-256 (~/.config/salsa/release.jks), as apksigner prints it.
CERT_RE='^38f47b2efda26d3270efc6f337ed75865ea0e7adfbe1951352e681cd4fe9b83a$'

info() { printf '==> %s\n' "$*"; }
die() { printf 'error: %s\n' "$*" >&2; exit 1; }
usage() { printf 'usage: %s salsa|bachata|both [--required]\n' "$(basename "$0")" >&2; exit 2; }

WHICH="${1:-}"
REQUIRED=0
case "$WHICH" in
	salsa) DANCES=(salsa) ;;
	bachata) DANCES=(bachata) ;;
	both) DANCES=(salsa bachata) ;;
	*) usage ;;
esac
case "${2:-}" in
	"") ;;
	--required) REQUIRED=1 ;;
	*) usage ;;
esac
[ $# -le 2 ] || usage

cd "$REPO_ROOT"
[ -z "$(git status --porcelain)" ] || die "the git tree is not clean: commit or stash first, a release names its commit"
COMMIT="$(git rev-parse --short HEAD)"

BT="${ANDROID_HOME:-}/build-tools/36.0.0"
for c in rsync ssh curl jq sha256sum; do
	command -v "$c" >/dev/null || die "'$c' is not on PATH. Run inside 'nix develop .#android'."
done
[ -x "$BT/apksigner" ] && [ -x "$BT/aapt2" ] || die "no build-tools 36.0.0 under ANDROID_HOME. Run inside 'nix develop .#android'."
[ -f "$HOME/.config/salsa/key.properties" ] || die "$HOME/.config/salsa/key.properties is missing (release signing, see docs/deployment.md)"
ssh -o ConnectTimeout=10 -o BatchMode=yes "$TARGET" true 2>/dev/null || die "cannot ssh to $TARGET"

BODY=$(mktemp)
trap 'rm -f "$BODY"' EXIT

release_one() {
	local dance="$1" cap apk cert badging code name status old old_min min sha size manifest
	cap="$(tr '[:lower:]' '[:upper:]' <<<"${dance:0:1}")${dance:1}"

	info "building $dance"
	./android/gradlew -p android "assemble${cap}DirectRelease"
	apk="$REPO_ROOT/android/app/build/outputs/apk/${dance}Direct/release/app-${dance}-direct-release.apk"
	[ -f "$apk" ] || die "no APK at $apk"

	info "checking the signature"
	cert=$("$BT/apksigner" verify --print-certs "$apk" | sed -n 's/^Signer #1 certificate SHA-256 digest: //p')
	[[ "$cert" =~ $CERT_RE ]] || die "signed with $cert, not the release key: it would not install over the phones' app"

	# The whole output: cutting it with head would kill aapt2 (SIGPIPE) under pipefail.
	badging=$("$BT/aapt2" dump badging "$apk")
	code=$(sed -n "1s/.* versionCode='\([0-9]*\)'.*/\1/p" <<<"$badging")
	name=$(sed -n "1s/.* versionName='\([^']*\)'.*/\1/p" <<<"$badging")
	[ -n "$code" ] && [ -n "$name" ] || die "cannot read the version from the APK"

	info "checking what is published"
	status=$(curl -sS -o "$BODY" -w '%{http_code}' "$PUBLIC/api/app-update/$dance")
	case "$status" in
		200) old=$(jq -r .versionCode "$BODY"); old_min=$(jq -r .minVersionCode "$BODY") ;;
		404) old=0; old_min=0 ;;
		*) die "the server answered $status for $PUBLIC/api/app-update/$dance" ;;
	esac
	[ "$code" -gt "$old" ] || die "version code $code is not above the published $old: bump versionCode in android/app/build.gradle.kts"
	min=$old_min
	[ "$REQUIRED" -eq 1 ] && min=$code

	sha=$(sha256sum "$apk" | cut -d' ' -f1)
	size=$(stat -c %s "$apk")
	manifest=$(jq -n --argjson code "$code" --arg name "$name" --argjson min "$min" --arg sha "$sha" --argjson size "$size" --arg commit "$COMMIT" \
		'{versionCode: $code, versionName: $name, minVersionCode: $min, sha256: $sha, size: $size, commit: $commit}')

	info "uploading $dance $name ($code)"
	ssh "$TARGET" "sudo install -d -o '$SERVICE_USER' -g '$SERVICE_USER' -m 0755 '$RELEASES' '$RELEASES/$dance'"
	rsync -az --rsync-path="sudo rsync" "$apk" "$TARGET:$RELEASES/$dance/$code.apk.part"
	ssh "$TARGET" "sudo chown '$SERVICE_USER:$SERVICE_USER' '$RELEASES/$dance/$code.apk.part' && sudo chmod 0644 '$RELEASES/$dance/$code.apk.part' && sudo mv '$RELEASES/$dance/$code.apk.part' '$RELEASES/$dance/$code.apk'"
	# The APK is in place; only now does current.json point at it.
	ssh "$TARGET" "sudo tee '$RELEASES/$dance/current.json.new' >/dev/null && sudo chown '$SERVICE_USER:$SERVICE_USER' '$RELEASES/$dance/current.json.new' && sudo mv '$RELEASES/$dance/current.json.new' '$RELEASES/$dance/current.json'" <<<"$manifest"

	info "published"
	curl -fsS "$PUBLIC/api/app-update/$dance" | jq .
	[ "$(curl -fsS "$PUBLIC/api/app-update/$dance" | jq -r .versionCode)" = "$code" ] || die "the server does not show $code"
	[ "$(curl -fsS -o /dev/null -w '%{http_code}' "$PUBLIC/releases/$dance/$code.apk")" = 200 ] || die "the APK is not downloadable"
	info "phones get $dance $name on their next start"
}

for d in "${DANCES[@]}"; do
	release_one "$d"
done
