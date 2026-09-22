import io
import json
import logging
import urllib.error

import pytest

from salsa_worker import __main__ as entry
from salsa_worker import jobs
from salsa_worker.api import Api, ApiError
from salsa_worker.media import PermanentError

FORM_TYPES = ("application/x-www-form-urlencoded", "multipart/form-data", "text/plain")


class Response(io.BytesIO):
    def __init__(self, status=200, body=b""):
        super().__init__(body)
        self.status = status


def fake_urlopen(status=204, body=b"", error: urllib.error.HTTPError | None = None):
    requests = []

    def urlopen(req, timeout=None):
        requests.append(req)
        if error:
            raise error
        return Response(status, body)

    urlopen.requests = requests
    return urlopen


def http_error(code, body: bytes):
    return urllib.error.HTTPError("http://s/x", code, "err", {}, io.BytesIO(body))


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

    def run(api, tools):
        raise ApiError("POST", "/api/worker/claim", 403, "Cross-site POST form submissions are forbidden")

    monkeypatch.setattr(jobs, "run", run)
    with caplog.at_level(logging.ERROR):
        assert entry.main() == 1
    assert "HTTP 403: Cross-site POST form submissions are forbidden" in caplog.text
