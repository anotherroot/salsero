"""Everything that touches media: yt-dlp, ffmpeg, Beat This!. Subprocess runners are injectable for tests."""

from __future__ import annotations

import json
import subprocess
from dataclasses import dataclass
from pathlib import Path

from .lists import MAX_ITEMS, ListItem, TrackList
from .match import Candidate

# The worker enforces this (yt-dlp's filter for downloads, a check after
# decoding for uploads): longer songs fail for good rather than being analysed.
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
    "The playlist does not exist",
    "This playlist is private",
)

# A saved video: an hour is a whole class, and anything longer is almost always a stream.
MAX_VIDEO_S = 3600


class PermanentError(Exception):
    """A failure that retrying will not fix; the song is marked failed."""


@dataclass(frozen=True)
class Fetched:
    path: Path
    title: str | None
    duration: float | None
    # The link the audio came from: reported to the server as `fetched_url`.
    url: str = ""


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
    return Fetched(path, title or None, seconds, url)


def search_youtube(query: str, n: int = 8, run=subprocess.run) -> list[Candidate]:
    """The first n YouTube results for a query, without downloading anything."""
    cmd = ["yt-dlp", "--flat-playlist", "--dump-single-json", "--no-warnings", f"ytsearch{n}:{query}"]
    p = run(cmd, capture_output=True, text=True, timeout=120)
    if p.returncode != 0:
        # The bot check, the network, a YouTube change: worth another try.
        raise RuntimeError(_last_line(p.stderr))
    out = []
    for e in json.loads(p.stdout or "{}").get("entries") or []:
        url = e.get("url") or e.get("webpage_url")
        if not url:
            continue
        d = e.get("duration")
        out.append(
            Candidate(
                url=url,
                title=e.get("title") or "",
                channel=e.get("channel") or e.get("uploader") or "",
                duration_s=float(d) if isinstance(d, (int, float)) else None,
            )
        )
    return out


# What `--flat-playlist` calls an entry whose video is gone or hidden.
UNAVAILABLE_TITLES = ("[Private video]", "[Deleted video]", "[Unavailable video]")


def read_youtube_list(url: str, run=subprocess.run) -> TrackList:
    """A YouTube playlist's videos, without downloading: one more than the cap, to tell a cut list."""
    cmd = [
        "yt-dlp", "--flat-playlist", "--dump-single-json", "--no-warnings",
        "--playlist-end", str(MAX_ITEMS + 1),
        url,
    ]
    p = run(cmd, capture_output=True, text=True, timeout=300)
    if p.returncode != 0:
        msg = _last_line(p.stderr)
        if any(m in p.stderr for m in PERMANENT_MARKERS):
            raise PermanentError(msg)
        raise RuntimeError(msg)
    data = json.loads(p.stdout or "{}")
    items: list[ListItem] = []
    for e in data.get("entries") or []:
        vid, title = e.get("id"), e.get("title")
        if not (isinstance(vid, str) and isinstance(title, str)):
            continue
        # A video gone from YouTube stays in the list under this name: it could never download.
        if title in UNAVAILABLE_TITLES:
            continue
        d = e.get("duration")
        items.append(
            ListItem(
                title=title,
                artist=None,
                duration_s=float(d) if isinstance(d, (int, float)) else None,
                url=f"https://www.youtube.com/watch?v={vid}",
            )
        )
    return TrackList(name=data.get("title"), items=items[:MAX_ITEMS], truncated=len(items) > MAX_ITEMS)


def fetch_video(url: str, workdir: Path, run=subprocess.run) -> Path:
    """At most 480p, picture and sound merged into workdir/video.mkv. to_mp4 re-encodes it next.

    480p by the SHORTER side (yt-dlp's `res`), so a vertical Short comes at 480x854
    rather than the 240x426 a `height<=480` filter would leave it.
    """
    cmd = [
        "yt-dlp",
        "--no-playlist",
        "--no-warnings",
        "--no-progress",
        "-f", "bv*+ba/b",
        "-S", "res:480",
        "--merge-output-format", "mkv",
        "--match-filter", f"duration <= {MAX_VIDEO_S}",
        "-o", str(workdir / "video.%(ext)s"),
        url,
    ]
    p = run(cmd, capture_output=True, text=True, timeout=1800)
    if p.returncode != 0:
        msg = _last_line(p.stderr)
        if any(m in p.stderr for m in PERMANENT_MARKERS):
            raise PermanentError(msg)
        raise RuntimeError(msg)
    made = sorted(workdir.glob("video.*"))
    if not made:
        # The duration filter skips silently, with exit code 0 and no output.
        raise PermanentError("Longer than 60 minutes, or nothing to download.")
    return made[0]


# The shorter side at most 480, the other in proportion: landscape and vertical alike.
SHORT_SIDE_480 = "scale='if(gt(iw,ih),-2,min(480,iw))':'if(gt(iw,ih),min(480,ih),-2)'"


def to_mp4(src: Path, dest: Path, run=subprocess.run) -> None:
    """H.264 and AAC with the index up front, so it plays on every phone and streams from the first byte.

    Always re-encoded, never remuxed: YouTube's 480p is often VP9 or AV1, which
    older iPhones cannot play. CRF 28 at 480p is roughly 5 MB a minute.
    """
    p = run(
        [
            "ffmpeg", "-nostdin", "-loglevel", "error", "-y", "-i", str(src),
            "-vf", SHORT_SIDE_480,
            "-c:v", "libx264", "-preset", "veryfast", "-crf", "28", "-pix_fmt", "yuv420p",
            "-c:a", "aac", "-b:a", "96k", "-ac", "2",
            "-movflags", "+faststart",
            str(dest),
        ],
        capture_output=True,
        text=True,
        timeout=3600,
    )
    if p.returncode != 0:
        raise PermanentError(f"Could not encode the video: {_last_line(p.stderr)}")


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


# ── Where the music starts (spec 2026-11-08, "Where the music starts") ──

WINDOW_S = 0.5
_SILENT_DB = -120.0
_RMS_KEY = "lavfi.astats.Overall.RMS_level="


def loudness_windows(wav: Path, run=subprocess.run) -> list[float]:
    """RMS level in dB per 0.5 s window of the whole file. The WAV is 22.05 kHz, so 11025 samples are 0.5 s."""
    p = run(
        [
            "ffmpeg", "-nostdin", "-hide_banner", "-loglevel", "error", "-i", str(wav),
            "-af",
            "aresample=22050,asetnsamples=11025,astats=metadata=1:reset=1,"
            "ametadata=print:key=lavfi.astats.Overall.RMS_level:file=-",
            "-f", "null", "-",
        ],
        capture_output=True,
        text=True,
        timeout=300,
    )
    levels = []
    for line in p.stdout.splitlines():
        if line.startswith(_RMS_KEY):
            value = line[len(_RMS_KEY):].strip()
            try:
                db = float(value)
            except ValueError:
                db = _SILENT_DB
            levels.append(db if db > _SILENT_DB else _SILENT_DB)
    return levels


def music_start(levels_db: list[float], window_s: float = WINDOW_S, below_db: float = 30.0, hold: int = 4) -> float:
    """Where the music starts: the first window from which `hold` windows in a row are within
    `below_db` of the song's median level. 0.0 when there is none.

    Measured on real songs: silence, then a quiet video scene, then the song.
    Plain silence detection misses the quiet scene; this does not, and a short
    dip later in the song does not count because only the first rise matters. 30 dB, not the
    spec's ~20: on the 2026-11-06 songs 20 dB started Sabes Tu Porque after its 3 s fade-in
    (4.0 s), 30 dB in it (2.5 s), and left the other 14 where they were (18, 5, 1.5, under 0.5)."""
    if not levels_db:
        return 0.0
    ordered = sorted(levels_db)
    median = ordered[len(ordered) // 2]
    floor = median - below_db
    for i in range(len(levels_db) - hold + 1):
        if all(level >= floor for level in levels_db[i : i + hold]):
            return round(i * window_s, 2)
    return 0.0


def music_start_of(wav: Path, run=subprocess.run) -> float:
    """The worker's tool: never raises (0.0 when unsure), so a song is measured once."""
    try:
        return music_start(loudness_windows(wav, run=run))
    except Exception:  # noqa: BLE001 — a measurement is a nicety, never a failed job
        return 0.0


# ── Timelines: what the AI looks at (frames every 2 s, the sound a minute at a time) ──

FRAME_EVERY_MS = 2000


def timeline_frames(src: Path, outdir: Path, run=subprocess.run) -> list[tuple[int, Path]]:
    """Small JPEG frames, one every 2 s, 384 px wide: frame n (from 1) shows (n - 1) * 2 s."""
    outdir.mkdir(parents=True, exist_ok=True)
    p = run(
        [
            "ffmpeg", "-nostdin", "-loglevel", "error", "-y", "-i", str(src),
            "-vf", "fps=1/2,scale=384:-2", "-q:v", "6",
            str(outdir / "f%05d.jpg"),
        ],
        capture_output=True,
        text=True,
        timeout=1800,
    )
    if p.returncode != 0:
        raise PermanentError(f"Could not read the video: {_last_line(p.stderr)}")
    files = sorted(outdir.glob("f*.jpg"))
    return [((int(f.stem[1:]) - 1) * FRAME_EVERY_MS, f) for f in files]


def timeline_sound(src: Path, outdir: Path, run=subprocess.run) -> list[Path]:
    """The sound in minute pieces, mono 16 kHz MP3 at 24 kbit/s: piece k is minute k.
    A video without sound (or one ffmpeg cannot decode the sound of) gives none."""
    outdir.mkdir(parents=True, exist_ok=True)
    p = run(
        [
            "ffmpeg", "-nostdin", "-loglevel", "error", "-y", "-i", str(src),
            "-vn", "-ac", "1", "-ar", "16000", "-c:a", "libmp3lame", "-b:a", "24k",
            "-f", "segment", "-segment_time", "60", "-reset_timestamps", "1",
            str(outdir / "a%04d.mp3"),
        ],
        capture_output=True,
        text=True,
        timeout=1800,
    )
    if p.returncode != 0:
        return []
    return sorted(outdir.glob("a*.mp3"))
