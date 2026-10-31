#!/usr/bin/env bash
# Per-dance home-screen icons. Rasterises static/icon-<dance>.svg (the flame
# for salsa, the heart for bachata -- two different drawings, not one tinted)
# to the PWA PNGs and the Android launcher icon. Output is committed --
# production never runs this.
#
# rsvg-convert is NOT in flake.nix's devShell, on purpose, the same way
# make-clips.sh's Piper and ffmpeg are not: this is a committed one-off, so
# the tool only has to exist on the machine regenerating the icons, not in
# every dev's day-to-day shell or on the server. `nix shell nixpkgs#librsvg
# -c rsvg-convert` pulls it straight from nixpkgs for the one call, exactly
# like make-clips.sh's `nix shell nixpkgs#ffmpeg -c ffprobe`. Do not add
# librsvg to the flake to "fix" a missing binary -- that is not missing, it is
# deliberately not there.
set -euo pipefail
cd "$(dirname "$0")/.."
mkdir -p static/icons android/app/src/main/res/mipmap-xxxhdpi

raster() {  # slug, size, out
	nix shell nixpkgs#librsvg -c rsvg-convert \
		-w "$2" -h "$2" "static/icon-$1.svg" -o "$3"
}

for dance in salsa bachata; do
	raster "$dance" 192 "static/icons/$dance-192.png"
	raster "$dance" 512 "static/icons/$dance-512.png"
	raster "$dance" 192 "android/app/src/main/res/mipmap-xxxhdpi/ic_$dance.png"
done
echo "wrote static/icons/ and the Android launcher icons"
