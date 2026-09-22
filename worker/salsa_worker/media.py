"""Everything that touches media: yt-dlp, ffmpeg, Beat This!. Subprocess runners are injectable for tests."""

from __future__ import annotations

import subprocess
from dataclasses import dataclass
from pathlib import Path

# Matches the server's rule: longer songs are refused rather than stored.
MAX_DURATION_S = 900

# yt-dlp messages that no retry will fix. Everything else (network, the bot
# check, a YouTube change fixed by the next yt-dlp) is treated as transient.
PERMANENT_MARKERS = (
    "Video unavailable",
    "Private video",
    "Unsupported URL",
    "is not a valid URL",
    "This video is not available",
    "members-only",
    "Sign in to confirm your age",
)


class PermanentError(Exception):
    """A failure that retrying will not fix; the song is marked failed."""


@dataclass(frozen=True)
class Fetched:
    path: Path
    title: str | None
    duration: float | None


def _last_line(text: str) -> str:
    lines = [line for line in text.strip().splitlines() if line.strip()]
    return lines[-1] if lines else "unknown error"


def fetch(url: str, workdir: Path, run=subprocess.run) -> Fetched:
    """Download the best audio as AAC in workdir/audio.m4a (~128 kbit/s, ~5 MB a song).

    AAC rather than Opus: Ogg Opus does not play in Safari on older iPhones,
    and every browser plays AAC. The re-encode from YouTube's Opus is inaudible
    for dancing to.
    """
    cmd = [
        "yt-dlp",
        "--no-playlist",
        "--no-warnings",
        "--no-progress",
        "-f", "bestaudio/best",
        "-x", "--audio-format", "m4a", "--audio-quality", "128K",
        "--match-filter", f"duration <= {MAX_DURATION_S}",
        "-o", str(workdir / "audio.%(ext)s"),
        # --print implies --simulate; without --no-simulate nothing is downloaded.
        "--no-simulate",
        "--print", "after_move:%(title)s\t%(duration)s",
        url,
    ]
    p = run(cmd, capture_output=True, text=True, timeout=900)
    if p.returncode != 0:
        msg = _last_line(p.stderr)
        if any(m in p.stderr for m in PERMANENT_MARKERS):
            raise PermanentError(msg)
        raise RuntimeError(msg)

    path = workdir / "audio.m4a"
    if not path.exists():
        # The duration filter skips silently, with exit code 0 and no output.
        raise PermanentError("Longer than 15 minutes, or nothing to download.")
    title, _, duration = _last_line(p.stdout).partition("\t") if p.stdout.strip() else ("", "", "")
    try:
        seconds = float(duration)
    except ValueError:
        seconds = None
    return Fetched(path, title or None, seconds)


def to_wav(src: Path, dest: Path, run=subprocess.run) -> None:
    """Mono 22.05 kHz WAV: what Beat This! resamples to anyway, and what its loader can read."""
    p = run(
        ["ffmpeg", "-nostdin", "-loglevel", "error", "-y", "-i", str(src), "-ac", "1", "-ar", "22050", str(dest)],
        capture_output=True,
        text=True,
        timeout=300,
    )
    if p.returncode != 0:
        raise PermanentError(f"Could not decode the audio: {_last_line(p.stderr)}")


def duration_of(path: Path, run=subprocess.run) -> float:
    p = run(
        ["ffprobe", "-v", "error", "-show_entries", "format=duration", "-of", "csv=p=0", str(path)],
        capture_output=True,
        text=True,
        timeout=60,
    )
    return float(p.stdout.strip())


class Analyzer:
    """Beat This! on CPU. The model loads on first use, so a run with no jobs never imports torch."""

    def __init__(self, checkpoint: str):
        self.checkpoint = checkpoint
        self._model = None

    def __call__(self, wav: Path) -> tuple[list[float], list[float]]:
        if self._model is None:
            import torch

            # Two of laptop's cores: it also runs Immich.
            torch.set_num_threads(2)
            from beat_this.inference import File2Beats

            self._model = File2Beats(checkpoint_path=self.checkpoint, device="cpu", dbn=False)
        beats, downbeats = self._model(str(wav))
        return [float(b) for b in beats], [float(d) for d in downbeats]
