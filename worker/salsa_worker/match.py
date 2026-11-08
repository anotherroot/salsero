"""Which YouTube result is the Spotify song: a score per result, the highest wins.

No list of matches is ever shown: the best one is downloaded, and a person who
hears the wrong version pastes another link (Use another YouTube link).
"""

from __future__ import annotations

import re
import unicodedata
from dataclasses import dataclass
from typing import TYPE_CHECKING

if TYPE_CHECKING:
    from .spotify import Track


@dataclass(frozen=True)
class Candidate:
    url: str
    title: str
    channel: str
    duration_s: float | None


LENGTH_CLOSE_S, LENGTH_CLOSE = 3, 40
LENGTH_NEAR_S, LENGTH_NEAR = 15, 25
LENGTH_FAR = -30
TOPIC = 20
AUDIO = 8
WRONG_VERSION = -25
TITLE_WORD = 2
ARTIST = 10

# Words that mark another version than the record, unless the record's own title has them.
VERSION_WORDS = ("live", "en vivo", "cover", "karaoke", "remix", "slowed", "sped up", "8d", "instrumental", "lyrics")


def fold(text: str) -> str:
    """Lower case without accents, so "EN VIVO" and "en vivo" are one."""
    return "".join(c for c in unicodedata.normalize("NFKD", text.lower()) if not unicodedata.combining(c))


def _has(text: str, phrase: str) -> bool:
    return re.search(rf"(?<!\w){re.escape(phrase)}(?!\w)", text) is not None


def score(track: Track, c: Candidate) -> float:
    title, channel, want = fold(c.title), fold(c.channel), fold(track.title)
    s = 0.0
    if track.duration_s is not None:
        # No length (a stream, some flat entries) is as good as a wrong one.
        off = abs(track.duration_s - c.duration_s) if c.duration_s is not None else None
        if off is None:
            s += LENGTH_FAR
        else:
            s += LENGTH_CLOSE if off <= LENGTH_CLOSE_S else LENGTH_NEAR if off <= LENGTH_NEAR_S else LENGTH_FAR
    if channel.endswith(" - topic"):
        s += TOPIC
    if _has(title, "official audio") or _has(title, "audio"):
        s += AUDIO
    for w in VERSION_WORDS:
        if _has(title, w) and not _has(want, w):
            s += WRONG_VERSION
    s += TITLE_WORD * sum(1 for w in set(re.findall(r"\w+", want)) if _has(title, w))
    if track.artists:
        first = fold(track.artists[0])
        if first and (first in title or first in channel):
            s += ARTIST
    return s


def best(track: Track, cands: list[Candidate]) -> Candidate | None:
    """The highest score; the first of equals. A result longer than a song may be
    (an hour's mix) never wins: the download would refuse it after the pick.
    None when nothing is left."""
    from .media import MAX_DURATION_S  # media imports this module

    fits = [c for c in cands if c.duration_s is None or c.duration_s <= MAX_DURATION_S]
    if not fits:
        return None
    return max(fits, key=lambda c: score(track, c))
