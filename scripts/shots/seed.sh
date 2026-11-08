#!/usr/bin/env bash
# The rig's class: copies a db, seeds a class into the COPY (seed-class.ts), and puts the media beside it.
# usage: seed.sh <db> <out-db> [<media-dir>]   (see README.md "A class")
# <media-dir> holds recordings/ and audio/ (the db's own data dir), copied beside the copy; its first .wav
# also becomes the class's song. The lesson's video is made with ffmpeg.
set -u
HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT="$(cd "$HERE/../.." && pwd)"
DB="${1:-}"; OUT="${2:-}"; MEDIA="${3:-}"
if [ -z "$DB" ] || [ -z "$OUT" ]; then echo "usage: seed.sh <db> <out-db> [<media-dir>]" >&2; exit 2; fi
[ -f "$DB" ] || { echo "no such db: $DB" >&2; exit 2; }
case "$OUT" in */.data/*) echo "seed.sh: never write under .data" >&2; exit 2 ;; esac
[ -e "$OUT" ] && { echo "seed.sh: $OUT exists" >&2; exit 2; }
mkdir -p "$(dirname "$OUT")"; OUT="$(cd "$(dirname "$OUT")" && pwd)/$(basename "$OUT")"
cp "$DB" "$OUT"
for ext in -wal -shm; do [ -f "$DB$ext" ] && cp "$DB$ext" "$OUT$ext"; done
VIDEO=""; VIDEO_BYTES=""; AUDIO=""
# the lesson's video: 12 s of an upright test picture, VP9 (the rig's Chromium plays no H.264)
mkdir -p "$OUT.data/lesson-videos"
VIDEO="5a170000-0000-4000-8000-000000000001.webm"
if ( unset LD_LIBRARY_PATH; nix run nixpkgs#ffmpeg -- -v error -f lavfi -i testsrc2=size=270x480:rate=25:duration=12 \
    -c:v libvpx-vp9 -crf 45 -b:v 0 "$OUT.data/lesson-videos/$VIDEO" ); then
  VIDEO_BYTES="$(stat -c %s "$OUT.data/lesson-videos/$VIDEO")"
else
  echo "seed.sh: no ffmpeg video; the lesson has none" >&2; VIDEO=""
fi
if [ -n "$MEDIA" ]; then
  for d in recordings audio; do [ -d "$MEDIA/$d" ] && cp -r "$MEDIA/$d" "$OUT.data/"; done
  # a copy under its own name: the db's own song keeps its file (songs.audio_file is unique)
  src="$(ls "$MEDIA/audio" 2>/dev/null | grep -E '\.wav$' | head -n 1)"
  if [ -n "$src" ]; then
    AUDIO="5a170000-0000-4000-8000-0000000000a1.wav"
    cp "$MEDIA/audio/$src" "$OUT.data/audio/$AUDIO"
  fi
fi
cd "$ROOT"
export SHOTS_SEED_DB="$OUT" SHOTS_SEED_VIDEO="$VIDEO" SHOTS_SEED_VIDEO_BYTES="$VIDEO_BYTES" SHOTS_SEED_AUDIO="$AUDIO"
nix develop --command npx vitest run --config scripts/shots/seed.config.ts || { rm -rf "$OUT" "$OUT-wal" "$OUT-shm" "$OUT.data"; exit 1; }
echo "seeded: $OUT"
