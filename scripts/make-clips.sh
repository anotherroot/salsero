#!/usr/bin/env bash
# Generate the player's voice clips. Run once; the OUTPUT is committed, so
# neither a build nor the running app ever needs Piper or a network.
#
#   ./scripts/make-clips.sh
#
# The count is Spanish because that is how the dance is counted. Every count
# from 1 to 8 gets a clip: salsa's silent 4 and 8 are the DANCE's pause, which
# the player's count pattern decides, not this script. Son speaks 4 and 8 and
# rests on 1 and 5 instead.
set -euo pipefail
cd "$(dirname "$0")/.."
out=static/clips
mkdir -p "$out"

work=$(mktemp -d)
trap 'rm -rf "$work"' EXIT

# nixpkgs' piper-tts does NOT fetch voices itself (no --download-dir, and -m
# wants a real .onnx path), so the model is pulled straight from the Piper
# voices repo. Cached in .data/ so a re-run is instant; .data/ is gitignored.
voice_base=https://huggingface.co/rhasspy/piper-voices/resolve/main/es/es_ES/davefx/medium/es_ES-davefx-medium
cache=.data/piper
mkdir -p "$cache"
for ext in onnx onnx.json; do
  [ -s "$cache/voice.$ext" ] || curl -fL --retry 3 -o "$cache/voice.$ext" "$voice_base.$ext"
done

# Piper's natural rate, on purpose. An earlier version sped the words up to
# 0.75 so each one finished inside a beat, and the result sounded clipped: at a
# fast count you heard the front of "cinco" and then "seis" on top of it. The
# player schedules every count on its own source node, so words overlapping is
# free and correct — a word half-spoken under the next one is how a person
# counts. --sentence-silence 0 drops the pause Piper adds after a sentence.
for word in uno dos tres cuatro cinco seis siete ocho; do
  echo "$word" | nix run nixpkgs#piper-tts -- \
    -m "$cache/voice.onnx" -c "$cache/voice.onnx.json" \
    --sentence-silence 0 \
    -f "$work/$word.wav"
done

# The clave: a woodblock is a short, hard, high click. A 2.5 kHz sine cut to
# 45 ms with a steep exponential decay is close enough to sit in a salsa mix,
# and it costs no voice model.
nix run nixpkgs#ffmpeg -- -y -f lavfi \
  -i "sine=frequency=2500:duration=0.045" \
  -af "afade=t=out:st=0:d=0.045:curve=exp,volume=0.9" \
  "$work/clave.wav"

# One shape for every clip: mono 48 kHz AAC, loudness-normalised so the count
# carries over a song without a per-clip volume fudge.
#
# Silence is trimmed off BOTH ends and nowhere else, which is fussier than it
# looks. `silenceremove` only ever strips from the START; its `stop_periods`
# does NOT mean "trim the tail" — a positive value truncates the file at the
# first silence it finds, and a negative one hunts silence through the whole
# stream. Either wrecks a word from the inside, because the /k/ in "cinco" and
# the /t/ in "siete" are 50-80 ms of near-silence. (Measured: stop_periods=1
# cut "cinco" to 0.05 s, intermittently — Piper's duration predictor is
# stochastic, so whether that closure dips below the threshold varies per run.)
#
# So the tail is trimmed by reversing, stripping the (now leading) silence, and
# reversing back. start_periods=1 removes exactly one run, so internal closures
# survive. 50 ms of decay is kept; leading silence goes entirely, because a
# word that starts late lands late however well it was scheduled.
trim_ends="silenceremove=start_periods=1:start_threshold=-45dB:start_silence=0,\
areverse,\
silenceremove=start_periods=1:start_threshold=-45dB:start_silence=0.05,\
areverse"
for f in "$work"/*.wav; do
  name=$(basename "$f" .wav)
  nix run nixpkgs#ffmpeg -- -y -i "$f" \
    -af "$trim_ends,loudnorm=I=-16:TP=-1.5:LRA=11" \
    -ac 1 -ar 48000 -c:a aac -b:a 64k "$out/$name.m4a"
done

# The pipeline is not deterministic, so it checks its own work. A clip that
# came out empty or absurdly long must never reach a commit: it would ship a
# count with a silent beat in it and look like a scheduling bug.
fail=0
for f in "$out"/*.m4a; do
  name=$(basename "$f" .m4a)
  # ffprobe, not `ffmpeg -i`: the latter exits 1 when given no output file,
  # which under `set -eo pipefail` kills this script before it reports anything.
  d=$(nix shell nixpkgs#ffmpeg -c ffprobe -v error \
    -show_entries format=duration -of csv=p=0 "$f")
  if [ "$name" = clave ]; then lo=0.03; hi=0.08; else lo=0.20; hi=0.80; fi
  if awk "BEGIN{exit !($d < $lo || $d > $hi)}"; then
    echo "FAIL $name: ${d}s is outside ${lo}-${hi}s" >&2
    fail=1
  else
    printf '  ok %-8s %ss\n' "$name" "$d"
  fi
done
[ "$fail" = 0 ] || { echo "Re-run; Piper's output varies between runs." >&2; exit 1; }

ls -l "$out"
