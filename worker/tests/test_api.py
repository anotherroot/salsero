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
