import io
from pathlib import Path

import pytest

from salsa_worker import spotify
from salsa_worker.media import PermanentError

FIXTURE = Path(__file__).parent / "fixtures" / "spotify-embed-track.html"
TRACK = "0wDEs6WvqDHq4XJZC0dHhO"


class Page:
    def __init__(self, body: bytes):
        self.body = body

    def __enter__(self):
        return io.BytesIO(self.body)

    def __exit__(self, *a):
        return False


def opener(body: bytes, seen: list | None = None):
    def urlopen(req, timeout):
        if seen is not None:
            seen.append(req.full_url)
        return Page(body)

    return urlopen


def test_read_track_reads_the_embed_page():
    seen = []
    url = f"https://open.spotify.com/track/{TRACK}?si=abc"
    t = spotify.read_track(url, urlopen=opener(FIXTURE.read_bytes(), seen))
    assert seen == [f"https://open.spotify.com/embed/track/{TRACK}"]
    assert t.title == "Hoja En Blanco"
    assert t.artists == ["Monchy & Alexandra"]
    assert t.duration_s == pytest.approx(307.2)
    assert t.url == url


def test_a_page_without_track_data_fails_for_good():
    with pytest.raises(PermanentError):
        spotify.read_track(f"https://open.spotify.com/track/{TRACK}", urlopen=opener(b"<html></html>"))


def test_a_link_that_is_not_a_track_fails_for_good():
    with pytest.raises(PermanentError):
        spotify.read_track("https://open.spotify.com/playlist/abc", urlopen=opener(b""))


@pytest.mark.parametrize(
    "url,expected",
    [
        (f"https://open.spotify.com/track/{TRACK}?si=1", True),
        (f"https://open.spotify.com/intl-de/track/{TRACK}", True),
        (f"spotify:track:{TRACK}", True),
        ("https://open.spotify.com/playlist/37i9dQZF1DX4OzrY981I1W", False),
        ("https://www.youtube.com/watch?v=Fd8nEwF3hHk", False),
    ],
)
def test_is_spotify_track(url, expected):
    assert spotify.is_spotify_track(url) is expected


@pytest.mark.parametrize("code", [400, 404])
def test_a_track_spotify_does_not_have_fails_for_good(code):
    import urllib.error

    def urlopen(req, timeout):
        raise urllib.error.HTTPError(req.full_url, code, "Not Found", {}, None)

    with pytest.raises(PermanentError):
        spotify.read_track(f"https://open.spotify.com/track/{TRACK}", urlopen=urlopen)


def test_a_server_error_at_spotify_is_tried_again():
    import urllib.error

    def urlopen(req, timeout):
        raise urllib.error.HTTPError(req.full_url, 503, "Unavailable", {}, None)

    with pytest.raises(urllib.error.HTTPError):
        spotify.read_track(f"https://open.spotify.com/track/{TRACK}", urlopen=urlopen)
