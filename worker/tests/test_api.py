import io
import json
import logging
import urllib.error

import pytest

from salsa_worker import __main__ as entry
from salsa_worker import jobs
from salsa_worker.api import Api, ApiError, JobGone
from salsa_worker.media import PermanentError

FORM_TYPES = ("application/x-www-form-urlencoded", "multipart/form-data", "text/plain")


class Response(io.BytesIO):
    def __init__(self, status=200, body=b"", headers=None):
        super().__init__(body)
        self.status = status
        self.headers = headers or {}


def fake_urlopen(status=204, body=b"", error: urllib.error.HTTPError | None = None):
    requests = []

    def urlopen(req, timeout=None):
        requests.append(req)
        if error:
            raise error
        return Response(status, body)

    urlopen.requests = requests
    return urlopen


def http_error(code, body: bytes, headers=None):
    return urllib.error.HTTPError("http://s/x", code, "err", headers or {}, io.BytesIO(body))


def content_type(req):
    # urllib stores header names capitalize()d: "Content-type".
    return req.get_header("Content-type")


def test_claim_is_json_with_token_and_user_agent():
    urlopen = fake_urlopen(200, b'{"id": 1, "kind": "download", "url": "u"}')
    assert Api("http://s/", "tok", urlopen=urlopen).claim() == {"id": 1, "kind": "download", "url": "u"}
    (req,) = urlopen.requests
    assert req.get_method() == "POST"
    assert req.full_url == "http://s/api/worker/claim"
    # A form type without an Origin is refused by SvelteKit's CSRF check in production.
    assert content_type(req) == "application/json"
    assert not content_type(req).startswith(FORM_TYPES)
    assert json.loads(req.data) == {}
    assert req.get_header("Authorization") == "Bearer tok"
    assert req.get_header("User-agent") == "salsa-worker/0.1"


def test_empty_queue_is_none():
    assert Api("http://s", "t", urlopen=fake_urlopen(204)).claim() is None


def test_every_request_with_a_body_has_a_non_form_type(tmp_path):
    urlopen = fake_urlopen(204)
    api = Api("http://s", "t", urlopen=urlopen)
    audio = tmp_path / "a.m4a"
    audio.write_bytes(b"m4a")
    api.claim()
    api.upload_audio(1, audio, "audio/mp4", "Título", 200.0)
    api.post_analysis(1, [0.5], [0.5], 1.0)
    api.fail(1, "boom", False)
    types = [content_type(r) for r in urlopen.requests]
    assert types == ["application/json", "audio/mp4", "application/json", "application/json"]
    assert all(r.get_header("User-agent") == "salsa-worker/0.1" for r in urlopen.requests)
    assert all(r.get_header("Authorization") == "Bearer t" for r in urlopen.requests)


def test_refused_analysis_is_permanent_with_the_server_message():
    urlopen = fake_urlopen(error=http_error(400, b'{"message":"no beats found"}'))
    with pytest.raises(PermanentError) as e:
        Api("http://s", "t", urlopen=urlopen).post_analysis(1, [], [], 1.0)
    assert "no beats found" in str(e.value)
    assert "b'" not in str(e.value)


def test_server_trouble_on_analysis_is_not_permanent():
    urlopen = fake_urlopen(error=http_error(502, b"Bad gateway"))
    with pytest.raises(ApiError) as e:
        Api("http://s", "t", urlopen=urlopen).post_analysis(1, [0.5], [], 1.0)
    assert not isinstance(e.value, PermanentError)
    assert e.value.status == 502
    assert "Bad gateway" in str(e.value)


def test_main_logs_the_real_error(monkeypatch, caplog):
    monkeypatch.setenv("SALSA_URL", "http://s")
    monkeypatch.setenv("SALSA_WORKER_TOKEN", "t")
    monkeypatch.setenv("BEAT_THIS_CHECKPOINT", "/nowhere.ckpt")

    def run(api, tools, **kwargs):
        raise ApiError("POST", "/api/worker/claim", 403, "Cross-site POST form submissions are forbidden")

    monkeypatch.setattr(jobs, "run", run)
    with caplog.at_level(logging.ERROR):
        assert entry.main() == 1
    assert "HTTP 403: Cross-site POST form submissions are forbidden" in caplog.text


def scripted_urlopen(*answers):
    """One answer per request, in order: a Response, or an HTTPError to raise."""
    requests = []
    queue = list(answers)

    def urlopen(req, timeout=None):
        requests.append(req)
        answer = queue.pop(0)
        if isinstance(answer, Exception):
            raise answer
        return answer

    urlopen.requests = requests
    return urlopen


def test_claim_video_and_fail_video(tmp_path):
    urlopen = fake_urlopen(200, b'{"id": 4, "url": "https://youtu.be/x"}')
    api = Api("http://s", "t", urlopen=urlopen)
    assert api.claim_video() == {"id": 4, "url": "https://youtu.be/x"}
    api.fail_video(4, "boom", True)
    assert [r.full_url for r in urlopen.requests] == [
        "http://s/api/worker/videos/claim",
        "http://s/api/worker/videos/4/fail",
    ]
    assert json.loads(urlopen.requests[1].data) == {"error": "boom", "permanent": True}
    assert Api("http://s", "t", urlopen=fake_urlopen(204)).claim_video() is None


def test_upload_video_sends_chunks_with_ranges(tmp_path):
    video = tmp_path / "out.mp4"
    video.write_bytes(b"0123456789")
    urlopen = scripted_urlopen(
        Response(204, headers={"x-received-bytes": "4"}),
        Response(204, headers={"x-received-bytes": "8"}),
        Response(201, b"{}"),
    )
    Api("http://s", "t", urlopen=urlopen).upload_video(7, video, chunk=4)
    assert [r.full_url for r in urlopen.requests] == ["http://s/api/worker/videos/7/file"] * 3
    assert [r.get_header("Content-range") for r in urlopen.requests] == [
        "bytes 0-3/10",
        "bytes 4-7/10",
        "bytes 8-9/10",
    ]
    assert [r.data for r in urlopen.requests] == [b"0123", b"4567", b"89"]
    assert all(r.get_method() == "PUT" and content_type(r) == "video/mp4" for r in urlopen.requests)


def test_upload_video_resumes_where_the_server_is(tmp_path):
    video = tmp_path / "out.mp4"
    video.write_bytes(b"0123456789")
    urlopen = scripted_urlopen(
        Response(204, headers={"x-received-bytes": "4"}),
        http_error(409, b'{"message":"wrong place"}', {"x-received-bytes": "6"}),
        Response(201, b"{}"),
    )
    Api("http://s", "t", urlopen=urlopen).upload_video(7, video, chunk=4)
    assert [r.get_header("Content-range") for r in urlopen.requests] == [
        "bytes 0-3/10",
        "bytes 4-7/10",
        "bytes 6-9/10",
    ]


def test_upload_video_gone_and_too_large(tmp_path):
    video = tmp_path / "out.mp4"
    video.write_bytes(b"0123")
    gone = scripted_urlopen(http_error(410, b'{"message":"no longer wanted"}'))
    with pytest.raises(JobGone):
        Api("http://s", "t", urlopen=gone).upload_video(7, video)
    big = scripted_urlopen(http_error(413, b'{"message":"bigger than the 1 GB limit"}'))
    with pytest.raises(PermanentError, match="1 GB"):
        Api("http://s", "t", urlopen=big).upload_video(7, video)


def test_upload_video_is_only_done_when_the_server_says_so(tmp_path):
    # A 409 that claims the server already has everything (a stale partial from
    # another encode) must not end the upload as if it had succeeded.
    video = tmp_path / "out.mp4"
    video.write_bytes(b"0123456789")
    urlopen = scripted_urlopen(http_error(409, b'{"message":"wrong place"}', {"x-received-bytes": "12"}))
    with pytest.raises(RuntimeError, match="did not finish"):
        Api("http://s", "t", urlopen=urlopen).upload_video(7, video, chunk=4)


def test_upload_video_needs_to_know_how_far_the_server_is(tmp_path):
    video = tmp_path / "out.mp4"
    video.write_bytes(b"0123456789")
    urlopen = scripted_urlopen(Response(204))
    with pytest.raises(RuntimeError, match="how much it has"):
        Api("http://s", "t", urlopen=urlopen).upload_video(7, video, chunk=4)


def test_claim_import_is_none_on_204_and_on_an_older_server():
    assert Api("http://s", "t", urlopen=fake_urlopen(204)).claim_import() is None
    old = Api("http://s", "t", urlopen=fake_urlopen(error=http_error(404, b'{"message":"Not found"}')))
    assert old.claim_import() is None
    got = Api("http://s", "t", urlopen=fake_urlopen(200, b'{"id": 3, "url": "u"}')).claim_import()
    assert got == {"id": 3, "url": "u"}


def test_report_import_posts_the_list():
    from salsa_worker.lists import ListItem, TrackList

    u = fake_urlopen(204)
    Api("http://s", "t", urlopen=u).report_import(
        3, TrackList("Clase", [ListItem("Uno", "A", 200.0, "https://youtu.be/x")], True)
    )
    req = u.requests[0]
    assert req.full_url == "http://s/api/worker/imports/3/items"
    assert json.loads(req.data) == {
        "name": "Clase",
        "items": [{"title": "Uno", "artist": "A", "durationS": 200.0, "url": "https://youtu.be/x"}],
        "truncated": True,
    }


def test_report_import_after_a_cancel_is_gone_and_a_refusal_permanent():
    from salsa_worker.lists import TrackList

    gone = Api("http://s", "t", urlopen=fake_urlopen(error=http_error(410, b'{"message":"gone"}')))
    with pytest.raises(JobGone):
        gone.report_import(3, TrackList("x", [], False))
    bad = Api("http://s", "t", urlopen=fake_urlopen(error=http_error(400, b'{"message":"too long"}')))
    with pytest.raises(PermanentError):
        bad.report_import(3, TrackList("x", [], False))


def test_starts_wanted_lists_ids_and_an_older_server_has_none():
    urlopen = fake_urlopen(200, b'[{"id": 4}, {"id": 9}]')
    assert Api("http://s", "t", urlopen=urlopen).starts_wanted() == [4, 9]
    (req,) = urlopen.requests
    assert req.get_method() == "GET"
    assert req.full_url == "http://s/api/worker/starts"
    old = fake_urlopen(error=http_error(404, b"Not found"))
    assert Api("http://s", "t", urlopen=old).starts_wanted() == []


def test_post_start_and_the_analysis_carry_where_the_music_starts():
    urlopen = fake_urlopen(204)
    api = Api("http://s", "t", urlopen=urlopen)
    api.post_start(7, 18.5)
    api.post_analysis(7, [0.5], [0.5], 30.0, start=2.0)
    api.post_analysis(7, [0.5], [0.5], 30.0)
    start, analysis, old = urlopen.requests
    assert start.full_url == "http://s/api/worker/songs/7/start"
    assert content_type(start) == "application/json"
    assert json.loads(start.data) == {"startS": 18.5}
    assert json.loads(analysis.data)["startS"] == 2.0
    assert "startS" not in json.loads(old.data)


def test_timeline_routes(tmp_path):
    urlopen = scripted_urlopen(
        Response(200, b'{"id": 7}'),
        Response(200, b"video"),
        Response(204),
        Response(201, b"{}"),
        Response(204),
    )
    api = Api("http://s", "t", urlopen=urlopen)
    assert api.claim_timeline() == {"id": 7}
    dest = tmp_path / "src.mp4"
    api.download_timeline_source(7, dest)
    assert dest.read_bytes() == b"video"
    api.put_piece(7, 1, [(60000, b"jpg")], b"mp3")
    api.finish_timeline(7, 2, 90000)
    api.fail_timeline(7, "boom", False)
    assert [r.full_url for r in urlopen.requests] == [
        "http://s/api/worker/timelines/claim",
        "http://s/api/worker/timelines/7/source",
        "http://s/api/worker/timelines/7/pieces/1",
        "http://s/api/worker/timelines/7/done",
        "http://s/api/worker/timelines/7/fail",
    ]
    piece = urlopen.requests[2]
    assert piece.get_method() == "PUT"
    assert content_type(piece) == "application/json"
    assert json.loads(piece.data) == {"frames": [{"t_ms": 60000, "data": "anBn"}], "sound": "bXAz"}
    assert json.loads(urlopen.requests[3].data) == {"pieces": 2, "duration_ms": 90000}


def test_put_piece_without_sound(tmp_path):
    urlopen = fake_urlopen(204)
    Api("http://s", "t", urlopen=urlopen).put_piece(7, 0, [], None)
    assert json.loads(urlopen.requests[0].data) == {"frames": [], "sound": None}


def test_put_piece_410_is_gone():
    api = Api("http://s", "t", urlopen=fake_urlopen(error=http_error(410, b'{"message": "gone"}')))
    with pytest.raises(JobGone):
        api.put_piece(7, 0, [], None)


def test_claim_timeline_on_an_older_server_is_none():
    assert Api("http://s", "t", urlopen=fake_urlopen(error=http_error(404, b"{}"))).claim_timeline() is None
    assert Api("http://s", "t", urlopen=fake_urlopen(204)).claim_timeline() is None


def test_loop_routes(tmp_path):
    urlopen = scripted_urlopen(
        Response(200, b'{"id": 4, "start_ms": 0, "end_ms": 1000}'),
        Response(204),
        Response(204),
        Response(201, b"{}"),
        Response(204),
    )
    api = Api("http://s", "t", urlopen=urlopen)
    assert api.claim_loop() == {"id": 4, "start_ms": 0, "end_ms": 1000}
    url, headers = api.loop_source_url(4)
    assert url == "http://s/api/worker/loops/4/source"
    assert headers["Authorization"] == "Bearer t"
    strip = tmp_path / "strip.jpg"
    strip.write_bytes(b"\xff\xd8\xffjpg")
    api.put_loop(4, "strip", strip)
    api.put_loop(4, "still", strip)
    api.finish_loop(4)
    api.fail_loop(4, "boom", True)
    assert [r.full_url for r in urlopen.requests] == [
        "http://s/api/worker/loops/claim",
        "http://s/api/worker/loops/4/strip",
        "http://s/api/worker/loops/4/still",
        "http://s/api/worker/loops/4/done",
        "http://s/api/worker/loops/4/fail",
    ]
    put = urlopen.requests[1]
    assert put.get_method() == "PUT"
    assert content_type(put) == "image/jpeg"
    assert put.data == b"\xff\xd8\xffjpg"


def test_claim_loop_none_on_204_and_on_an_older_server():
    assert Api("http://s", "t", urlopen=fake_urlopen(204)).claim_loop() is None
    assert Api("http://s", "t", urlopen=fake_urlopen(error=http_error(404, b"Not found"))).claim_loop() is None


def test_put_loop_410_is_gone(tmp_path):
    p = tmp_path / "s.jpg"
    p.write_bytes(b"x")
    api = Api("http://s", "t", urlopen=fake_urlopen(error=http_error(410, b'{"message": "gone"}')))
    with pytest.raises(JobGone):
        api.put_loop(4, "strip", p)
