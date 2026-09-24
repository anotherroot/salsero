#!/usr/bin/env bash
# Per-dance home-screen icons. Tints static/icon.svg with each dance's accent
# and rasterises it. Output is committed — production never runs this.
#
# rsvg-convert is NOT in flake.nix's devShell, on purpose, the same way
# make-clips.sh's Piper and ffmpeg are not: this is a committed one-off, so
# the tool only has to exist on the machine regenerating the icons, not in
# every dev's day-to-day shell or on the server. `nix shell nixpkgs#librsvg
# -c rsvg-convert` pulls it straight from nixpkgs for the one call, exactly
# like make-clips.sh's `nix shell nixpkgs#ffmpeg -c ffprobe`. Do not add
# librsvg to the flake to "fix" a missing binary — that is not missing, it is
# deliberately not there.
set -euo pipefail
cd "$(dirname "$0")/.."
mkdir -p static/icons

# The accent hexes are NOT hard-coded here — they are read straight out of the
# registry (`src/lib/dances/dances.ts`) so there is one fewer place they can
# drift out of sync. A dance's `light-mode` `accent` is a `#rrggbb` on its own
# line inside that dance's object literal; `sed` cuts out the object by its
# `slug: {` … `},` bounds and `grep`/`grep -o` pull the first `accent:` (never
# `accentDark:`, which does not match the trailing colon) out of it.
dances_ts=src/lib/dances/dances.ts

hex_for() {  # slug -> its light-mode accent hex, from the registry
	local hex
	hex=$(sed -n "/^\t$1: {/,/^\t},\{0,1\}\$/p" "$dances_ts" |
		grep -m1 'accent:' | grep -oE '#[0-9a-fA-F]{6}')
	[ -n "$hex" ] || {
		echo "make-icons.sh: could not find $1's accent in $dances_ts" >&2
		exit 1
	}
	echo "$hex"
}

tint() {  # slug, hex
	sed "s/#c2410c/$2/gI" static/icon.svg >"/tmp/icon-$1.svg"
	for size in 192 512; do
		nix shell nixpkgs#librsvg -c rsvg-convert \
			-w "$size" -h "$size" "/tmp/icon-$1.svg" -o "static/icons/$1-$size.png"
	done
	rm "/tmp/icon-$1.svg"
}

tint salsa "$(hex_for salsa)"
tint bachata "$(hex_for bachata)"
echo "wrote static/icons/"
