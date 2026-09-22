"""The server's /api/worker contract (see src/routes/api/worker in the app). stdlib only."""

from __future__ import annotations

import json
import shutil
import urllib.error
import urllib.parse
import urllib.request
from pathlib import Path


class ApiError(Exception):
    pass


class Api:
    def __init__(self, base_url: str, token: str, urlopen=urllib.request.urlopen):
        self.base = base_url.rstrip("/")
        self.token = token
        self._urlopen = urlopen

    def _request(self, method: str, path: str, data=None, headers=None, timeout: int = 60):
        req = urllib.request.Request(
            self.base + path,
            data=data,
            method=method,
            headers={"Authorization": f"Bearer {self.token}", **(headers or {})},
        )
        try:
            return self._urlopen(req, timeout=timeout)
        except urllib.error.HTTPError as e:
            raise ApiError(f"{method} {path}: HTTP {e.code} {e.read()[:200]!r}") from e

    def claim(self) -> dict | None:
        with self._request("POST", "/api/worker/claim", data=b"") as r:
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
        data = json.dumps(body).encode()
        self._request("POST", path, data=data, headers={"Content-Type": "application/json"}).close()

    def post_analysis(self, song_id: int, beats: list[float], downbeats: list[float], duration: float) -> None:
        self._json(
            f"/api/worker/songs/{song_id}/analysis",
            {"beats": beats, "downbeats": downbeats, "durationS": duration},
        )

    def fail(self, song_id: int, error: str, permanent: bool) -> None:
        self._json(f"/api/worker/songs/{song_id}/fail", {"error": error[:500], "permanent": permanent})
