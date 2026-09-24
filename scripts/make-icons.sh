#!/usr/bin/env bash
# Per-dance home-screen icons. Tints static/icon.svg with each dance's accent
# and rasterises it. Output is committed — production never runs this.
set -euo pipefail
cd "$(dirname "$0")/.."
mkdir -p static/icons

tint() {  # slug, hex
	sed "s/#c2410c/$2/gI" static/icon.svg >"/tmp/icon-$1.svg"
	for size in 192 512; do
		rsvg-convert -w "$size" -h "$size" "/tmp/icon-$1.svg" -o "static/icons/$1-$size.png"
	done
	rm "/tmp/icon-$1.svg"
}

tint salsa '#c2410c'
tint bachata '#0f766e'
echo "wrote static/icons/"
