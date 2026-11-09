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

from .lists import MAX_ITEMS, ListItem, TrackList
from .media import PermanentError

BROWSER_UA = "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130 Safari/537.36"
NEXT_DATA = re.compile(r'<script id="__NEXT_DATA__" type="application/json">(.*?)</script>', re.S)


@dataclass(frozen=True)
class Track:
    title: str
    artists: list[str]
    duration_s: float | None
    url: str


def _path(url: str) -> list[str]:
    """`[type, id]` of an open.spotify.com link (any /intl-xx/ prefix) or a spotify: URI; [] for anything else."""
    raw = url.strip()
    if raw.startswith("spotify:"):
        parts = raw.split(":")[1:]
    else:
        u = urlparse(raw)
        if u.hostname is None or u.hostname.lower() != "open.spotify.com":
            return []
        parts = [p for p in u.path.split("/") if p]
    if parts and parts[0].startswith("intl-"):
        parts = parts[1:]
    return parts[:2] if len(parts) >= 2 and parts[1] else []


def _track_id(url: str) -> str | None:
    parts = _path(url)
    return parts[1] if parts and parts[0] == "track" else None


def is_spotify_list(url: str) -> bool:
    parts = _path(url)
    return bool(parts) and parts[0] in ("playlist", "album")


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


def _fetch_entity(kind: str, spotify_id: str, urlopen) -> dict:
    """The embed page's entity (a track, playlist or album) from its `__NEXT_DATA__` JSON."""
    req = urllib.request.Request(
        f"https://open.spotify.com/embed/{kind}/{spotify_id}", headers={"User-Agent": BROWSER_UA}
    )
    try:
        with urlopen(req, timeout=20) as r:
            html = r.read().decode("utf-8", "replace")
    except urllib.error.HTTPError as e:
        # No such track or list (removed, mistyped): no retry will find it. A 5xx or 429 is tried again.
        if e.code in (400, 404):
            raise PermanentError("Spotify has nothing at this link.") from e
        raise
    m = NEXT_DATA.search(html)
    if not m:
        raise PermanentError("Spotify gave nothing for this link.")
    data = json.loads(m.group(1))
    try:
        entity = data["props"]["pageProps"]["state"]["data"]["entity"]
    except (KeyError, TypeError):
        entity = None
    if isinstance(entity, dict) and entity.get("type") == kind:
        return entity
    if kind == "track":
        found = _find_track(data)
        if found is not None:
            return found
    raise PermanentError("Spotify gave nothing for this link.")


def _seconds(ms) -> float | None:
    return ms / 1000 if isinstance(ms, (int, float)) and ms > 0 else None


def read_track(url: str, urlopen=urllib.request.urlopen) -> Track:
    track_id = _track_id(url)
    if track_id is None:
        raise PermanentError("Not a Spotify song link.")
    entity = _fetch_entity("track", track_id, urlopen)
    artists = [a["name"] for a in entity.get("artists") or [] if isinstance(a, dict) and a.get("name")]
    return Track(title=entity["name"], artists=artists, duration_s=_seconds(entity.get("duration")), url=url)


# The embed page lists at most this many songs, and does not say how many there are.
EMBED_LIMIT = 100


def read_list(url: str, urlopen=urllib.request.urlopen) -> TrackList:
    """A Spotify playlist's or album's songs, from its embed page."""
    parts = _path(url)
    if not parts or parts[0] not in ("playlist", "album"):
        raise PermanentError("Not a Spotify playlist or album.")
    entity = _fetch_entity(parts[0], parts[1], urlopen)
    items: list[ListItem] = []
    for t in entity.get("trackList") or []:
        uri, title = t.get("uri"), t.get("title")
        if not (isinstance(uri, str) and uri.startswith("spotify:track:") and isinstance(title, str)):
            continue
        # "Pitbull,\u00a0Sensato": the embed's own separator.
        artist = " ".join((t.get("subtitle") or "").replace("\u00a0", " ").split()) or None
        items.append(
            ListItem(
                title=title,
                artist=artist,
                duration_s=_seconds(t.get("duration")),
                url=f"https://open.spotify.com/track/{uri.split(':')[2]}",
            )
        )
    return TrackList(
        name=entity.get("name") or entity.get("title"),
        items=items[:MAX_ITEMS],
        truncated=len(items) > MAX_ITEMS or len(items) >= EMBED_LIMIT,
    )
