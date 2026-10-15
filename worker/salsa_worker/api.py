"""The server's /api/worker contract (see src/routes/api/worker in the app). stdlib only."""

from __future__ import annotations

import json
import shutil
import urllib.error
import urllib.parse
import urllib.request
from pathlib import Path

from .media import PermanentError

USER_AGENT = "salsa-worker/0.1"


# What a saved video is uploaded in: the size the browser slices lesson videos
# into, far under Cloudflare's 100 MB request limit.
CHUNK_BYTES = 8 * 1024 * 1024


class ApiError(Exception):
    def __init__(self, method: str, path: str, status: int, message: str, received: int | None = None):
        super().__init__(f"{method} {path}: HTTP {status}: {message}")
        self.status = status
        self.message = message
        # A chunked upload's 409 says how far the server's file really is.
        self.received = received


class JobGone(Exception):
    """The server no longer wants this video: its link was removed, or it is already saved."""


def _received(headers) -> int | None:
    try:
        return int(headers.get("x-received-bytes"))
    except (TypeError, ValueError, AttributeError):
        return None


def _server_message(e: urllib.error.HTTPError) -> str:
    """SvelteKit answers API errors with {"message": ...}; fall back to the start of the body."""
    try:
        raw = e.read()[:2000]
    except Exception:  # noqa: BLE001 — the status alone is still worth reporting
        return e.reason or "no message"
    try:
        msg = json.loads(raw).get("message")
        if isinstance(msg, str) and msg:
            return msg
    except (ValueError, AttributeError):
        pass
    return raw.decode("utf-8", "replace").strip()[:200] or str(e.reason or "no message")


class Api:
    def __init__(self, base_url: str, token: str, urlopen=urllib.request.urlopen):
        self.base = base_url.rstrip("/")
        self.token = token
        self._urlopen = urlopen

    def _request(self, method: str, path: str, data=None, headers=None, timeout: int = 60):
        headers = {"User-Agent": USER_AGENT, "Authorization": f"Bearer {self.token}", **(headers or {})}
        # With a body and no type, urllib would send application/x-www-form-urlencoded,
        # and a production SvelteKit refuses form-type POSTs without a matching
        # Origin (CSRF) before any hook runs. Never let that default through.
        if data is not None and not any(k.lower() == "content-type" for k in headers):
            headers["Content-Type"] = "application/json"
        req = urllib.request.Request(self.base + path, data=data, method=method, headers=headers)
        try:
            return self._urlopen(req, timeout=timeout)
        except urllib.error.HTTPError as e:
            raise ApiError(method, path, e.code, _server_message(e), _received(e.headers)) from e

    def claim(self) -> dict | None:
        with self._request("POST", "/api/worker/claim", data=b"{}") as r:
            return None if r.status == 204 else json.load(r)

    def download_audio(self, song_id: int, dest: Path) -> None:
        with self._request("GET", f"/api/worker/songs/{song_id}/audio", timeout=300) as r, open(dest, "wb") as f:
            shutil.copyfileobj(r, f)

    def upload_audio(self, song_id: int, path: Path, mime: str, title: str | None, duration: float | None) -> None:
        headers = {"Content-Type": mime, "Content-Length": str(path.stat().st_size)}
        if title:
            headers["x-title"] = urllib.parse.quote(title)
        if duration:
            headers["x-duration"] = str(duration)
        with open(path, "rb") as f:
            self._request("PUT", f"/api/worker/songs/{song_id}/audio", data=f, headers=headers, timeout=600).close()

    def _json(self, path: str, body: dict) -> None:
        self._request("POST", path, data=json.dumps(body).encode()).close()

    def post_analysis(self, song_id: int, beats: list[float], downbeats: list[float], duration: float) -> None:
        """A 4xx means the server refused this analysis (e.g. no beats found): retrying gives the same answer."""
        try:
            self._json(
                f"/api/worker/songs/{song_id}/analysis",
                {"beats": beats, "downbeats": downbeats, "durationS": duration},
            )
        except ApiError as e:
            if 400 <= e.status < 500 and e.status not in (408, 429):
                raise PermanentError(f"Server refused the analysis: {e.message}") from e
            raise

    def fail(self, song_id: int, error: str, permanent: bool) -> None:
        self._json(f"/api/worker/songs/{song_id}/fail", {"error": error[:500], "permanent": permanent})

    # ── Saved videos: their own queue, see src/lib/server/video-downloads.ts ──

    def claim_video(self) -> dict | None:
        with self._request("POST", "/api/worker/videos/claim", data=b"{}") as r:
            return None if r.status == 204 else json.load(r)

    def upload_video(self, job_id: int, path: Path, chunk: int = CHUNK_BYTES) -> None:
        """In chunks, each saying where it starts. A 409 carries where the server's file
        really ends, and the upload carries on from there rather than from the top."""
        total = path.stat().st_size
        url = f"/api/worker/videos/{job_id}/file"
        offset = 0
        finished = False
        with open(path, "rb") as f:
            while not finished and offset < total:
                f.seek(offset)
                data = f.read(chunk)
                headers = {
                    "Content-Type": "video/mp4",
                    "Content-Range": f"bytes {offset}-{offset + len(data) - 1}/{total}",
                }
                try:
                    with self._request("PUT", url, data=data, headers=headers, timeout=300) as r:
                        finished = r.status == 201
                        offset = total if finished else _received(r.headers)
                        if offset is None:
                            raise RuntimeError("The server did not say how much it has.")
                except ApiError as e:
                    if e.status == 410:
                        raise JobGone(e.message) from e
                    if e.status == 409 and e.received is not None:
                        offset = e.received
                        continue
                    if e.status == 413:
                        raise PermanentError(e.message) from e
                    raise
        if not finished:
            # Only a 201 means the video is saved. Anything else (a 409 saying
            # the server already has more than this file) is not a success.
            raise RuntimeError(f"The upload did not finish: the server has {offset} of {total} bytes.")

    def fail_video(self, job_id: int, error: str, permanent: bool) -> None:
        self._json(f"/api/worker/videos/{job_id}/fail", {"error": error[:500], "permanent": permanent})
