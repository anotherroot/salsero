"""A pasted playlist or album as the worker reads it, before the person picks from it."""

from __future__ import annotations

from dataclasses import dataclass

# The most songs one list brings. Spotify's embed page itself stops at 100.
MAX_ITEMS = 200


@dataclass(frozen=True)
class ListItem:
    title: str
    artist: str | None
    duration_s: float | None
    url: str


@dataclass(frozen=True)
class TrackList:
    name: str | None
    items: list[ListItem]
    # More songs than were read: the pick list says "the first N".
    truncated: bool
