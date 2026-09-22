"""One job end to end, and the drain loop. All I/O is passed in, so this is testable without torch or a network."""

from __future__ import annotations

import logging
import tempfile
from dataclasses import dataclass
from pathlib import Path
from typing import Callable

from .media import Fetched, PermanentError

log = logging.getLogger("salsa_worker")


@dataclass(frozen=True)
class Tools:
    fetch: Callable[[str, Path], Fetched]
    to_wav: Callable[[Path, Path], None]
    duration_of: Callable[[Path], float]
    analyze: Callable[[Path], tuple[list[float], list[float]]]


def process(job: dict, api, tools: Tools, workdir: Path) -> None:
    """Download (if needed), analyse, report. Failures are reported, never raised."""
    song_id = job["id"]
    try:
        duration: float | None = None
        if job["kind"] == "download":
            fetched = tools.fetch(job["url"], workdir)
            # Upload first: once the server has the audio, a crash during
            # analysis only costs a re-analysis, not a re-download.
            api.upload_audio(song_id, fetched.path, "audio/mp4", fetched.title, fetched.duration)
            audio, duration = fetched.path, fetched.duration
        else:
            audio = workdir / "source"
            api.download_audio(song_id, audio)

        wav = workdir / "analysis.wav"
        tools.to_wav(audio, wav)
        if duration is None:
            duration = tools.duration_of(wav)
        beats, downbeats = tools.analyze(wav)
        api.post_analysis(song_id, beats, downbeats, duration)
        log.info("song %s: %d beats", song_id, len(beats))
    except PermanentError as e:
        log.warning("song %s failed for good: %s", song_id, e)
        api.fail(song_id, str(e), True)
    except Exception as e:  # noqa: BLE001 — anything else is worth another try
        log.exception("song %s failed, will retry", song_id)
        api.fail(song_id, f"{type(e).__name__}: {e}", False)


def run(api, tools: Tools, max_jobs: int = 20) -> int:
    """Claim and process jobs until the queue is empty. Returns how many were processed."""
    done = 0
    while done < max_jobs:
        job = api.claim()
        if job is None:
            break
        with tempfile.TemporaryDirectory(prefix="salsa-") as tmp:
            process(job, api, tools, Path(tmp))
        done += 1
    return done
