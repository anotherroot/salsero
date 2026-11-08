"""Reading a Spotify track's name, artists and length from Spotify's public embed page.

No account and no API key: the embed page carries the track as JSON in its
`__NEXT_DATA__` script. Spotify's audio is never downloaded (it is DRM'd);
the worker finds the same song on YouTube (see match.py).
"""

from __future__ import annotations

import json
import re
import urllib.error
import urllib.request
from dataclasses import dataclass
from urllib.parse import urlparse

from .media import PermanentError

BROWSER_UA = "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130 Safari/537.36"
NEXT_DATA = re.compile(r'<script id="__NEXT_DATA__" type="application/json">(.*?)</script>', re.S)


@dataclass(frozen=True)
class Track:
    title: str
    artists: list[str]
    duration_s: float | None
    url: str


def _track_id(url: str) -> str | None:
    """The track id of an open.spotify.com/track link (any /intl-xx/ prefix) or a spotify:track: URI."""
    raw = url.strip()
    if raw.startswith("spotify:"):
        parts = raw.split(":")[1:]
    else:
        u = urlparse(raw)
        if u.hostname is None or u.hostname.lower() != "open.spotify.com":
            return None
        parts = [p for p in u.path.split("/") if p]
    if parts and parts[0].startswith("intl-"):
        parts = parts[1:]
    if len(parts) >= 2 and parts[0] == "track" and parts[1]:
        return parts[1]
    return None


def is_spotify_track(url: str) -> bool:
    return _track_id(url) is not None


def _find_track(node):
    """The first dict with `"type": "track"` and a name, depth first."""
    if isinstance(node, dict):
        if node.get("type") == "track" and isinstance(node.get("name"), str):
            return node
        for v in node.values():
            found = _find_track(v)
            if found is not None:
                return found
    elif isinstance(node, list):
        for v in node:
            found = _find_track(v)
            if found is not None:
                return found
    return None


def read_track(url: str, urlopen=urllib.request.urlopen) -> Track:
    track_id = _track_id(url)
    if track_id is None:
        raise PermanentError("Not a Spotify song link.")
    req = urllib.request.Request(
        f"https://open.spotify.com/embed/track/{track_id}", headers={"User-Agent": BROWSER_UA}
    )
    try:
        with urlopen(req, timeout=20) as r:
            html = r.read().decode("utf-8", "replace")
    except urllib.error.HTTPError as e:
        # No such track (removed, mistyped): no retry will find it. A 5xx or 429 is tried again.
        if e.code in (400, 404):
            raise PermanentError("Spotify has no song at this link.") from e
        raise
    m = NEXT_DATA.search(html)
    if not m:
        raise PermanentError("Spotify gave no song for this link.")
    data = json.loads(m.group(1))
    try:
        entity = data["props"]["pageProps"]["state"]["data"]["entity"]
    except (KeyError, TypeError):
        entity = None
    if not (isinstance(entity, dict) and entity.get("type") == "track"):
        entity = _find_track(data)
    if entity is None:
        raise PermanentError("Spotify gave no song for this link.")
    artists = [a["name"] for a in entity.get("artists") or [] if isinstance(a, dict) and a.get("name")]
    ms = entity.get("duration")
    return Track(
        title=entity["name"],
        artists=artists,
        duration_s=ms / 1000 if isinstance(ms, (int, float)) and ms > 0 else None,
        url=url,
    )
