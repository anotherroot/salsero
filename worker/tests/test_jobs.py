from pathlib import Path

from salsa_worker import jobs, media
from salsa_worker.api import JobGone


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

    def post_analysis(self, song_id, beats, downbeats, duration, start=None):
        self.calls.append(("post_analysis", song_id, beats, downbeats, duration, start))

    def starts_wanted(self):
        wanted, self.wanted = getattr(self, "wanted", []), []
        return wanted

    def post_start(self, song_id, start):
        self.calls.append(("post_start", song_id, start))

    def fail(self, song_id, error, permanent):
        self.calls.append(("fail", song_id, error, permanent))


def tools(fetch=None, analyze=None, music_start=None):
    def default_fetch(url, workdir):
        p = workdir / "audio.m4a"
        p.write_bytes(b"m4a")
        return media.Fetched(p, "Title", 200.0)

    return jobs.Tools(
        fetch=fetch or default_fetch,
        to_wav=lambda src, dest: dest.write_bytes(b"wav"),
        duration_of=lambda path: 42.0,
        analyze=analyze or (lambda wav: ([0.5, 1.0], [0.5])),
        music_start=music_start or (lambda wav: 1.5),
    )


def test_download_job_uploads_then_analyses(tmp_path):
    api = FakeApi([])
    jobs.process({"id": 7, "kind": "download", "url": "https://y"}, api, tools(), tmp_path)
    assert api.calls == [
        ("upload_audio", 7, "audio/mp4", "Title", 200.0),
        ("post_analysis", 7, [0.5, 1.0], [0.5], 200.0, 1.5),
    ]


def test_analyze_job_fetches_audio_from_the_server(tmp_path):
    api = FakeApi([])
    jobs.process({"id": 3, "kind": "analyze", "url": None}, api, tools(), tmp_path)
    assert api.calls == [("download_audio", 3), ("post_analysis", 3, [0.5, 1.0], [0.5], 42.0, 1.5)]


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
        music_start=lambda wav: 0.0,
    )
    api = FakeApi([])
    assert jobs.process({"id": 4, "kind": "analyze", "url": None}, api, t, tmp_path) is False
    assert api.calls == [("download_audio", 4), ("fail", 4, "Longer than 15 minutes.", True)]


def test_a_refused_analysis_fails_for_good(tmp_path):
    class Refusing(FakeApi):
        def post_analysis(self, song_id, beats, downbeats, duration, start=None):
            raise media.PermanentError("Server refused the analysis: no beats found")

    api = Refusing([])
    assert jobs.process({"id": 5, "kind": "analyze", "url": None}, api, tools(), tmp_path) is False
    assert api.calls[-1] == ("fail", 5, "Server refused the analysis: no beats found", True)


class VideoApi(FakeApi):
    def __init__(self, queue, videos, upload=None):
        super().__init__(queue)
        self.videos = list(videos)
        self._upload = upload

    def claim_video(self):
        return self.videos.pop(0) if self.videos else None

    def upload_video(self, job_id, path):
        self.calls.append(("upload_video", job_id, path.name))
        if self._upload:
            self._upload()

    def fail_video(self, job_id, error, permanent):
        self.calls.append(("fail_video", job_id, error, permanent))


def video_tools(fetch_video=None):
    def default_fetch(url, workdir):
        p = workdir / "video.mkv"
        p.write_bytes(b"mkv")
        return p

    return jobs.VideoTools(
        fetch_video=fetch_video or default_fetch,
        to_mp4=lambda src, dest: dest.write_bytes(b"mp4"),
    )


def test_run_does_songs_before_videos():
    api = VideoApi([{"id": 1, "kind": "analyze", "url": None}], [{"id": 9, "url": "https://y"}])
    assert jobs.run(api, tools(), video_tools()) == 2
    assert [c[0] for c in api.calls] == ["download_audio", "post_analysis", "upload_video"]
    assert api.calls[-1] == ("upload_video", 9, "out.mp4")


def test_a_failed_song_leaves_the_videos_for_the_next_tick():
    def analyze(wav):
        raise RuntimeError("model crashed")

    api = VideoApi([{"id": 1, "kind": "analyze", "url": None}], [{"id": 9, "url": "https://y"}])
    assert jobs.run(api, tools(analyze=analyze), video_tools()) == 1
    assert len(api.videos) == 1


def test_a_video_whose_link_went_is_not_a_failure(tmp_path):
    def gone():
        raise JobGone("no longer wanted")

    api = VideoApi([], [], upload=gone)
    assert jobs.process_video({"id": 9, "url": "u"}, api, video_tools(), tmp_path) is True
    assert [c[0] for c in api.calls] == ["upload_video"]


def test_a_private_video_fails_for_good(tmp_path):
    def fetch_video(url, workdir):
        raise media.PermanentError("ERROR: Private video")

    api = VideoApi([], [])
    assert jobs.process_video({"id": 9, "url": "u"}, api, video_tools(fetch_video), tmp_path) is False
    assert api.calls == [("fail_video", 9, "ERROR: Private video", True)]


def test_run_measures_the_wanted_starts_after_the_songs_queue():
    api = FakeApi([{"id": 1, "kind": "analyze", "url": None}])
    api.wanted = [11, 12]
    assert jobs.run(api, tools()) == 3
    assert api.calls[-4:] == [
        ("download_audio", 11),
        ("post_start", 11, 1.5),
        ("download_audio", 12),
        ("post_start", 12, 1.5),
    ]


def test_a_song_that_will_not_decode_is_measured_as_zero():
    def to_wav(src, dest):
        raise media.PermanentError("Could not decode the audio")

    api = FakeApi([])
    api.wanted = [11]
    t = tools()
    t = jobs.Tools(fetch=t.fetch, to_wav=to_wav, duration_of=t.duration_of, analyze=t.analyze, music_start=t.music_start)
    jobs.run(api, t)
    assert api.calls == [("download_audio", 11), ("post_start", 11, 0.0)]


def test_the_starts_pass_counts_against_max_jobs():
    api = FakeApi([{"id": i, "kind": "analyze", "url": None} for i in range(2)])
    api.wanted = [11, 12, 13]
    assert jobs.run(api, tools(), max_jobs=3) == 3
    assert [c for c in api.calls if c[0] == "post_start"] == [("post_start", 11, 1.5)]


def test_a_song_whose_audio_is_gone_is_measured_as_zero_and_the_rest_go_on():
    from salsa_worker.api import ApiError

    class Missing(FakeApi):
        def download_audio(self, song_id, dest):
            if song_id == 11:
                raise ApiError("GET", "/api/worker/songs/11/audio", 404, "No audio yet")
            super().download_audio(song_id, dest)

    api = Missing([])
    api.wanted = [11, 12]
    jobs.run(api, tools())
    assert [c for c in api.calls if c[0] == "post_start"] == [("post_start", 11, 0.0), ("post_start", 12, 1.5)]


def test_server_trouble_in_the_starts_pass_leaves_the_videos_to_run():
    from salsa_worker.api import ApiError

    class Down(FakeApi):
        def download_audio(self, song_id, dest):
            raise ApiError("GET", "/x", 502, "Bad gateway")

        def claim_video(self):
            self.calls.append(("claim_video",))
            return None

    api = Down([])
    api.wanted = [11, 12]
    jobs.run(api, tools(), video_tools=video_tools())
    assert ("claim_video",) in api.calls
    assert [c for c in api.calls if c[0] == "post_start"] == []
