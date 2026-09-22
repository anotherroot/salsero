from pathlib import Path

from salsa_worker import jobs, media


class FakeApi:
    def __init__(self, queue):
        self.queue = list(queue)
        self.calls = []

    def claim(self):
        return self.queue.pop(0) if self.queue else None

    def download_audio(self, song_id, dest: Path):
        self.calls.append(("download_audio", song_id))
        dest.write_bytes(b"mp3")

    def upload_audio(self, song_id, path, mime, title, duration):
        self.calls.append(("upload_audio", song_id, mime, title, duration))

    def post_analysis(self, song_id, beats, downbeats, duration):
        self.calls.append(("post_analysis", song_id, beats, downbeats, duration))

    def fail(self, song_id, error, permanent):
        self.calls.append(("fail", song_id, error, permanent))


def tools(fetch=None, analyze=None):
    def default_fetch(url, workdir):
        p = workdir / "audio.m4a"
        p.write_bytes(b"m4a")
        return media.Fetched(p, "Title", 200.0)

    return jobs.Tools(
        fetch=fetch or default_fetch,
        to_wav=lambda src, dest: dest.write_bytes(b"wav"),
        duration_of=lambda path: 42.0,
        analyze=analyze or (lambda wav: ([0.5, 1.0], [0.5])),
    )


def test_download_job_uploads_then_analyses(tmp_path):
    api = FakeApi([])
    jobs.process({"id": 7, "kind": "download", "url": "https://y"}, api, tools(), tmp_path)
    assert api.calls == [
        ("upload_audio", 7, "audio/mp4", "Title", 200.0),
        ("post_analysis", 7, [0.5, 1.0], [0.5], 200.0),
    ]


def test_analyze_job_fetches_audio_from_the_server(tmp_path):
    api = FakeApi([])
    jobs.process({"id": 3, "kind": "analyze", "url": None}, api, tools(), tmp_path)
    assert api.calls == [("download_audio", 3), ("post_analysis", 3, [0.5, 1.0], [0.5], 42.0)]


def test_permanent_error_fails_the_song_for_good(tmp_path):
    def fetch(url, workdir):
        raise media.PermanentError("Video unavailable")

    api = FakeApi([])
    jobs.process({"id": 1, "kind": "download", "url": "u"}, api, tools(fetch=fetch), tmp_path)
    assert api.calls == [("fail", 1, "Video unavailable", True)]


def test_other_errors_are_retried(tmp_path):
    def analyze(wav):
        raise MemoryError("out of memory")

    api = FakeApi([])
    jobs.process({"id": 1, "kind": "analyze", "url": None}, api, tools(analyze=analyze), tmp_path)
    assert api.calls[-1] == ("fail", 1, "MemoryError: out of memory", False)


def test_run_drains_the_queue_and_counts(tmp_path):
    api = FakeApi([{"id": 1, "kind": "analyze", "url": None}, {"id": 2, "kind": "analyze", "url": None}])
    assert jobs.run(api, tools()) == 2
    assert jobs.run(api, tools()) == 0


def test_run_stops_at_max_jobs():
    api = FakeApi([{"id": i, "kind": "analyze", "url": None} for i in range(5)])
    assert jobs.run(api, tools(), max_jobs=3) == 3


def test_process_says_whether_it_succeeded(tmp_path):
    def analyze(wav):
        raise RuntimeError("model crashed")

    job = {"id": 1, "kind": "analyze", "url": None}
    assert jobs.process(job, FakeApi([]), tools(), tmp_path) is True
    assert jobs.process(job, FakeApi([]), tools(analyze=analyze), tmp_path) is False


def test_run_stops_after_a_failed_job():
    def analyze(wav):
        raise RuntimeError("model crashed")

    api = FakeApi([{"id": i, "kind": "analyze", "url": None} for i in range(3)])
    assert jobs.run(api, tools(analyze=analyze)) == 1
    assert [c for c in api.calls if c[0] == "fail"] == [("fail", 0, "RuntimeError: model crashed", False)]
    assert len(api.queue) == 2  # left for the next tick


def test_an_upload_longer_than_15_minutes_fails_for_good(tmp_path):
    def analyze(wav):
        raise AssertionError("must not analyse")

    t = jobs.Tools(
        fetch=None,
        to_wav=lambda src, dest: dest.write_bytes(b"wav"),
        duration_of=lambda path: media.MAX_DURATION_S + 1.0,
        analyze=analyze,
    )
    api = FakeApi([])
    assert jobs.process({"id": 4, "kind": "analyze", "url": None}, api, t, tmp_path) is False
    assert api.calls == [("download_audio", 4), ("fail", 4, "Longer than 15 minutes.", True)]


def test_a_refused_analysis_fails_for_good(tmp_path):
    class Refusing(FakeApi):
        def post_analysis(self, song_id, beats, downbeats, duration):
            raise media.PermanentError("Server refused the analysis: no beats found")

    api = Refusing([])
    assert jobs.process({"id": 5, "kind": "analyze", "url": None}, api, tools(), tmp_path) is False
    assert api.calls[-1] == ("fail", 5, "Server refused the analysis: no beats found", True)
