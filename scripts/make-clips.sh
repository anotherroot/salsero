#!/usr/bin/env bash
# Generate the player's voice clips. Run once; the OUTPUT is committed, so
# neither a build nor the running app ever needs Piper or a network.
#
#   ./scripts/make-clips.sh
#
# The count is Spanish because that is how the dance is counted. 4 and 8 are
# silent on purpose — the salsa pause — so they have no clip.
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
for word in uno dos tres cinco seis siete; do
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
# Leading silence comes off completely — a word that starts late lands late
# however well it was scheduled. The END is only trimmed (stop_periods=1), and
# 50 ms of decay is kept. The earlier stop_periods=-1 hunted silence through
# the WHOLE file, which also ate the stop closures inside "cinco" and "siete" —
# a /k/ or /t/ closure is 50-80 ms of near-silence, and squeezing it to 20 ms
# clipped the words from the inside.
for f in "$work"/*.wav; do
  name=$(basename "$f" .wav)
  nix run nixpkgs#ffmpeg -- -y -i "$f" \
    -af "silenceremove=start_periods=1:start_threshold=-45dB:start_silence=0:stop_periods=1:stop_threshold=-45dB:stop_silence=0.05,loudnorm=I=-16:TP=-1.5:LRA=11" \
    -ac 1 -ar 48000 -c:a aac -b:a 64k "$out/$name.m4a"
done

ls -l "$out"
