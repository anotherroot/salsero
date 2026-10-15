"""One job end to end, and the drain loop. All I/O is passed in, so this is testable without torch or a network."""

from __future__ import annotations

import logging
import tempfile
from dataclasses import dataclass
from pathlib import Path
from typing import Callable

from .api import JobGone
from .media import MAX_DURATION_S, Fetched, PermanentError

log = logging.getLogger("salsa_worker")


@dataclass(frozen=True)
class Tools:
    fetch: Callable[[str, Path], Fetched]
    to_wav: Callable[[Path, Path], None]
    duration_of: Callable[[Path], float]
    analyze: Callable[[Path], tuple[list[float], list[float]]]


@dataclass(frozen=True)
class VideoTools:
    fetch_video: Callable[[str, Path], Path]
    to_mp4: Callable[[Path, Path], None]


def process(job: dict, api, tools: Tools, workdir: Path) -> bool:
    """Download (if needed), analyse, report. Failures are reported, never raised. True on success."""
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
        # yt-dlp's filter covers downloads; uploads are only checked here.
        if duration > MAX_DURATION_S:
            raise PermanentError("Longer than 15 minutes.")
        beats, downbeats = tools.analyze(wav)
        api.post_analysis(song_id, beats, downbeats, duration)
        log.info("song %s: %d beats", song_id, len(beats))
        return True
    except PermanentError as e:
        log.warning("song %s failed for good: %s", song_id, e)
        api.fail(song_id, str(e), True)
    except Exception as e:  # noqa: BLE001 — anything else is worth another try
        log.exception("song %s failed, will retry", song_id)
        api.fail(song_id, f"{type(e).__name__}: {e}", False)
    return False


def process_video(job: dict, api, tools: VideoTools, workdir: Path) -> bool:
    """Download at most 480p, re-encode, upload in chunks. Failures are reported, never raised. True unless it failed."""
    job_id = job["id"]
    try:
        out = workdir / "out.mp4"
        tools.to_mp4(tools.fetch_video(job["url"], workdir), out)
        api.upload_video(job_id, out)
        log.info("video %s: saved", job_id)
        return True
    except JobGone:
        # The link was removed while this ran, or an earlier upload already landed.
        log.info("video %s: no longer wanted", job_id)
        return True
    except PermanentError as e:
        log.warning("video %s failed for good: %s", job_id, e)
        api.fail_video(job_id, str(e), True)
    except Exception as e:  # noqa: BLE001 — anything else is worth another try
        log.exception("video %s failed, will retry", job_id)
        api.fail_video(job_id, f"{type(e).__name__}: {e}", False)
    return False


def run(api, tools: Tools, video_tools: VideoTools | None = None, max_jobs: int = 20) -> int:
    """Claim and process jobs until the queues are empty or a job fails. Returns how many were processed.

    Songs first: a song is seconds of work, an hour of video can be ten minutes
    of encoding. Stopping after a failure keeps one bad run (network down, a
    YouTube change) from spinning through the whole queue; the next timer tick
    carries on.
    """
    done = 0
    while done < max_jobs:
        job = api.claim()
        if job is None:
            break
        with tempfile.TemporaryDirectory(prefix="salsa-") as tmp:
            ok = process(job, api, tools, Path(tmp))
        done += 1
        if not ok:
            return done
    while video_tools is not None and done < max_jobs:
        job = api.claim_video()
        if job is None:
            break
        with tempfile.TemporaryDirectory(prefix="salsa-video-") as tmp:
            ok = process_video(job, api, video_tools, Path(tmp))
        done += 1
        if not ok:
            break
    return done
