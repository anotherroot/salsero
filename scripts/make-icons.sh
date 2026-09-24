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

tint() {  # slug, hex
	sed "s/#c2410c/$2/gI" static/icon.svg >"/tmp/icon-$1.svg"
	for size in 192 512; do
		nix shell nixpkgs#librsvg -c rsvg-convert \
			-w "$size" -h "$size" "/tmp/icon-$1.svg" -o "static/icons/$1-$size.png"
	done
	rm "/tmp/icon-$1.svg"
}

tint salsa '#c2410c'
tint bachata '#0f766e'
echo "wrote static/icons/"
