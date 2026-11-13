from pathlib import Path

from salsa_worker import jobs, media, spotify
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

    def upload_audio(self, song_id, path, mime, title, duration, *, artist=None, fetched_url=None, fetched_title=None):
        self.calls.append(("upload_audio", song_id, mime, title, duration))
        self.found = {"artist": artist, "fetched_url": fetched_url, "fetched_title": fetched_title}

    def post_analysis(self, song_id, beats, downbeats, duration, start=None):
        self.calls.append(("post_analysis", song_id, beats, downbeats, duration, start))

    def starts_wanted(self):
        wanted, self.wanted = getattr(self, "wanted", []), []
        return wanted

    def post_start(self, song_id, start):
        self.calls.append(("post_start", song_id, start))

    def fail(self, song_id, error, permanent):
        self.calls.append(("fail", song_id, error, permanent))


def tools(fetch=None, analyze=None, music_start=None, search=None, read_track=None, pause=None):
    def default_fetch(url, workdir):
        p = workdir / "audio.m4a"
        p.write_bytes(b"m4a")
        return media.Fetched(p, "Title", 200.0, url)

    return jobs.Tools(
        fetch=fetch or default_fetch,
        to_wav=lambda src, dest: dest.write_bytes(b"wav"),
        duration_of=lambda path: 42.0,
        analyze=analyze or (lambda wav: ([0.5, 1.0], [0.5])),
        music_start=music_start or (lambda wav: 1.5),
        search=search or (lambda q: []),
        read_track=read_track or (lambda url: None),
        pause=pause or (lambda: None),
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
    assert jobs.process(job, FakeApi([]), tools(), tmp_path) == "ok"
    assert jobs.process(job, FakeApi([]), tools(analyze=analyze), tmp_path) == "transient"


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
    assert jobs.process({"id": 4, "kind": "analyze", "url": None}, api, t, tmp_path) == "permanent"
    assert api.calls == [("download_audio", 4), ("fail", 4, "Longer than 15 minutes.", True)]


def test_a_refused_analysis_fails_for_good(tmp_path):
    class Refusing(FakeApi):
        def post_analysis(self, song_id, beats, downbeats, duration, start=None):
            raise media.PermanentError("Server refused the analysis: no beats found")

    api = Refusing([])
    assert jobs.process({"id": 5, "kind": "analyze", "url": None}, api, tools(), tmp_path) == "permanent"
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


SPOTIFY = "https://open.spotify.com/track/0wDEs6WvqDHq4XJZC0dHhO"
HOJA = spotify.Track(title="Hoja En Blanco", artists=["Monchy & Alexandra"], duration_s=307.2, url=SPOTIFY)


def test_a_spotify_song_is_found_on_youtube(tmp_path):
    searched, fetched = [], []
    match = media.Candidate("https://www.youtube.com/watch?v=hoja", "Hoja En Blanco", "Monchy & Alexandra - Topic", 307.0)

    def fetch(url, workdir):
        fetched.append(url)
        p = workdir / "audio.m4a"
        p.write_bytes(b"m4a")
        return media.Fetched(p, "Monchy & Alexandra - Hoja En Blanco (Audio)", 307.0, url)

    def search(q):
        searched.append(q)
        return [media.Candidate("https://www.youtube.com/watch?v=live", "Hoja En Blanco (En Vivo)", "Fan", 290.0), match]

    api = FakeApi([])
    t = tools(fetch=fetch, search=search, read_track=lambda url: HOJA)
    assert jobs.process({"id": 7, "kind": "download", "url": SPOTIFY}, api, t, tmp_path) == "ok"
    assert searched == ["Monchy & Alexandra Hoja En Blanco"]
    assert fetched == [match.url]
    assert api.calls[0] == ("upload_audio", 7, "audio/mp4", "Hoja En Blanco", 307.0)
    assert api.found == {
        "artist": "Monchy & Alexandra",
        "fetched_url": match.url,
        "fetched_title": "Monchy & Alexandra - Hoja En Blanco (Audio)",
    }


def test_no_match_on_youtube_fails_for_good(tmp_path):
    api = FakeApi([])
    t = tools(search=lambda q: [], read_track=lambda url: HOJA)
    assert jobs.process({"id": 7, "kind": "download", "url": SPOTIFY}, api, t, tmp_path) == "permanent"
    assert api.calls == [("fail", 7, "No match on YouTube", True)]


def test_a_youtube_song_reports_what_it_downloaded(tmp_path):
    api = FakeApi([])
    jobs.process({"id": 8, "kind": "download", "url": "https://youtu.be/x"}, api, tools(), tmp_path)
    assert api.found == {"artist": None, "fetched_url": "https://youtu.be/x", "fetched_title": "Title"}


def test_a_song_that_fails_for_good_does_not_stop_the_run():
    def fetch(url, workdir):
        raise media.PermanentError("Video unavailable")

    api = FakeApi([{"id": 1, "kind": "download", "url": "https://y"}, {"id": 2, "kind": "analyze", "url": None}])
    assert jobs.run(api, tools(fetch=fetch)) == 2
    assert api.calls[-1][0] == "post_analysis"


def test_the_worker_pauses_after_youtube_but_not_after_an_analysis():
    pauses = []
    api = FakeApi([{"id": 1, "kind": "download", "url": "https://y"}, {"id": 2, "kind": "analyze", "url": None}])
    jobs.run(api, tools(pause=lambda: pauses.append(1)))
    assert pauses == [1]



from salsa_worker.lists import ListItem, TrackList

LIST = TrackList("Clase", [ListItem("Uno", None, 200.0, "https://www.youtube.com/watch?v=a")], False)


class ImportApi(FakeApi):
    def __init__(self, queue, imports, report=None):
        super().__init__(queue)
        self.imports = list(imports)
        self._report = report

    def claim(self):
        self.calls.append(("claim",))
        return super().claim()

    def claim_import(self):
        self.calls.append(("claim_import",))
        return self.imports.pop(0) if self.imports else None

    def report_import(self, job_id, lst):
        self.calls.append(("report_import", job_id, lst.name))
        if self._report:
            self._report()

    def fail_import(self, job_id, error, permanent):
        self.calls.append(("fail_import", job_id, error, permanent))


def import_tools(spotify_read=None, youtube_read=None):
    return jobs.ImportTools(
        read_spotify=spotify_read or (lambda url: LIST),
        read_youtube=youtube_read or (lambda url: LIST),
    )


SP_LIST = "https://open.spotify.com/playlist/37i9dQZF1DX4OzrY981I1W"
YT_LIST = "https://www.youtube.com/playlist?list=PL1"


def test_an_import_reads_and_reports_pausing_only_after_youtube():
    pauses = []
    api = ImportApi([], [])
    assert jobs.process_import({"id": 1, "url": SP_LIST}, api, import_tools(), lambda: pauses.append(1)) == "ok"
    assert pauses == []
    assert jobs.process_import({"id": 2, "url": YT_LIST}, api, import_tools(), lambda: pauses.append(1)) == "ok"
    assert pauses == [1]
    assert [c for c in api.calls if c[0] == "report_import"] == [("report_import", 1, "Clase"), ("report_import", 2, "Clase")]


def test_an_import_failure_is_reported_as_it_is():
    def private(url):
        raise media.PermanentError("This playlist is private")

    def flaky(url):
        raise RuntimeError("HTTP 429")

    api = ImportApi([], [])
    assert jobs.process_import({"id": 1, "url": YT_LIST}, api, import_tools(youtube_read=private), lambda: None) == "permanent"
    assert jobs.process_import({"id": 2, "url": YT_LIST}, api, import_tools(youtube_read=flaky), lambda: None) == "transient"
    assert [c for c in api.calls if c[0] == "fail_import"] == [
        ("fail_import", 1, "This playlist is private", True),
        ("fail_import", 2, "RuntimeError: HTTP 429", False),
    ]


def test_a_cancelled_import_is_done_not_failed():
    def gone():
        raise JobGone("no longer wanted")

    api = ImportApi([], [], report=gone)
    assert jobs.process_import({"id": 1, "url": SP_LIST}, api, import_tools(), lambda: None) == "ok"
    assert not [c for c in api.calls if c[0] == "fail_import"]


def test_run_reads_imports_before_songs():
    api = ImportApi([{"id": 7, "kind": "analyze", "url": None}], [{"id": 1, "url": SP_LIST}])
    assert jobs.run(api, tools(), import_tools=import_tools()) == 2
    names = [c[0] for c in api.calls]
    assert names.index("report_import") < names.index("download_audio")


def test_a_transient_import_failure_ends_the_run_a_permanent_one_does_not():
    def flaky(url):
        raise RuntimeError("HTTP 429")

    api = ImportApi([{"id": 7, "kind": "analyze", "url": None}], [{"id": 1, "url": YT_LIST}])
    assert jobs.run(api, tools(), import_tools=import_tools(youtube_read=flaky)) == 1
    assert api.queue  # the song waits for the next tick

    def private(url):
        raise media.PermanentError("private")

    api = ImportApi([{"id": 7, "kind": "analyze", "url": None}], [{"id": 1, "url": YT_LIST}])
    assert jobs.run(api, tools(), import_tools=import_tools(youtube_read=private)) == 2


def test_no_import_tools_or_an_older_server_still_drains_songs():
    api = ImportApi([{"id": 7, "kind": "analyze", "url": None}], [{"id": 1, "url": SP_LIST}])
    assert jobs.run(api, tools()) == 1
    assert ("claim_import",) not in api.calls
    api = ImportApi([{"id": 7, "kind": "analyze", "url": None}], [])
    assert jobs.run(api, tools(), import_tools=import_tools()) == 1


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


class TimelineApi(VideoApi):
    def __init__(self, queue=(), videos=(), timelines=(), gone_on_piece=False):
        super().__init__(list(queue), list(videos))
        self.timelines = list(timelines)
        self.gone_on_piece = gone_on_piece

    def claim_timeline(self):
        return self.timelines.pop(0) if self.timelines else None

    def download_timeline_source(self, job_id, dest):
        dest.write_bytes(b"mp4")
        self.calls.append(("source", job_id))

    def put_piece(self, job_id, k, frames, sound):
        if self.gone_on_piece:
            raise JobGone("no longer wanted")
        self.calls.append(("piece", job_id, k, [t for t, _ in frames], sound))

    def finish_timeline(self, job_id, pieces, duration_ms):
        self.calls.append(("finish", job_id, pieces, duration_ms))

    def fail_timeline(self, job_id, error, permanent):
        self.calls.append(("fail_timeline", job_id, error, permanent))


def timeline_tools(duration=150.0, sounds=3):
    def frames(src, out):
        out.mkdir()
        got = []
        for i in range(int(duration // 2)):
            p = out / f"f{i + 1:05d}.jpg"
            p.write_bytes(b"jpg")
            got.append((i * 2000, p))
        return got

    def sound(src, out):
        out.mkdir()
        got = []
        for k in range(sounds):
            p = out / f"a{k:04d}.mp3"
            p.write_bytes(f"s{k}".encode())
            got.append(p)
        return got

    return jobs.TimelineTools(frames=frames, sound=sound, duration=lambda p: duration)


def test_process_timeline_groups_by_minute(tmp_path):
    api = TimelineApi()
    assert jobs.process_timeline({"id": 3}, api, timeline_tools(), tmp_path) is True
    pieces = [c for c in api.calls if c[0] == "piece"]
    assert [len(c[3]) for c in pieces] == [30, 30, 15]
    assert pieces[1][3][0] == 60000
    assert [c[4] for c in pieces] == [b"s0", b"s1", b"s2"]
    assert api.calls[-1] == ("finish", 3, 3, 150000)


def test_no_audio_stream_still_uploads_frames(tmp_path):
    api = TimelineApi()
    assert jobs.process_timeline({"id": 3}, api, timeline_tools(sounds=0), tmp_path) is True
    pieces = [c for c in api.calls if c[0] == "piece"]
    assert len(pieces) == 3
    assert all(c[4] is None for c in pieces)


def test_a_gone_timeline_is_not_a_failure(tmp_path):
    api = TimelineApi(gone_on_piece=True)
    assert jobs.process_timeline({"id": 3}, api, timeline_tools(), tmp_path) is True
    assert not [c for c in api.calls if c[0] == "fail_timeline"]


def test_a_video_over_an_hour_fails_for_good(tmp_path):
    api = TimelineApi()
    assert jobs.process_timeline({"id": 3}, api, timeline_tools(duration=3700.0), tmp_path) is False
    assert api.calls[-1] == ("fail_timeline", 3, "Longer than an hour.", True)


def test_run_prepares_timelines_after_songs_before_videos():
    api = TimelineApi(
        queue=[{"id": 1, "kind": "analyze", "url": None}],
        videos=[{"id": 9, "url": "https://y"}],
        timelines=[{"id": 3}],
    )
    assert jobs.run(api, tools(), video_tools(), timeline_tools=timeline_tools(duration=10.0, sounds=1)) == 3
    kinds = [c[0] for c in api.calls]
    assert kinds.index("post_analysis") < kinds.index("finish") < kinds.index("upload_video")


class LoopApi(TimelineApi):
    def __init__(self, loops=(), gone_on_strip=False, **kw):
        super().__init__(**kw)
        self.loops = list(loops)
        self.gone_on_strip = gone_on_strip

    def claim_loop(self):
        return self.loops.pop(0) if self.loops else None

    def loop_source_url(self, job_id):
        return f"http://s/api/worker/loops/{job_id}/source", {"Authorization": "Bearer t"}

    def put_loop(self, job_id, which, path):
        if self.gone_on_strip:
            raise JobGone("no longer wanted")
        self.calls.append(("put_loop", job_id, which, path.name))

    def finish_loop(self, job_id):
        self.calls.append(("finish_loop", job_id))

    def fail_loop(self, job_id, error, permanent):
        self.calls.append(("fail_loop", job_id, error, permanent))


def loop_tools(error=None):
    def cut(src, start_ms, end_ms, out, headers):
        if error:
            raise error
        out.mkdir(exist_ok=True)
        (out / "strip.jpg").write_bytes(b"strip")
        (out / "still.jpg").write_bytes(b"still")
        cut.args = (src, start_ms, end_ms, headers)
        return out / "strip.jpg", out / "still.jpg"

    return jobs.LoopTools(cut=cut)


def test_process_loop_uploads_strip_still_then_finishes(tmp_path):
    api = LoopApi()
    tools = loop_tools()
    assert jobs.process_loop({"id": 4, "start_ms": 1000, "end_ms": 7000}, api, tools, tmp_path) is True
    assert tools.cut.args == ("http://s/api/worker/loops/4/source", 1000, 7000, {"Authorization": "Bearer t"})
    assert api.calls == [
        ("put_loop", 4, "strip", "strip.jpg"),
        ("put_loop", 4, "still", "still.jpg"),
        ("finish_loop", 4),
    ]


def test_a_gone_loop_is_not_a_failure(tmp_path):
    api = LoopApi(gone_on_strip=True)
    assert jobs.process_loop({"id": 4, "start_ms": 0, "end_ms": 1000}, api, loop_tools(), tmp_path) is True
    assert not [c for c in api.calls if c[0] == "fail_loop"]


def test_a_loop_without_any_picture_fails_for_good(tmp_path):
    api = LoopApi()
    err = media.PermanentError("No picture in this section.")
    assert jobs.process_loop({"id": 4, "start_ms": 0, "end_ms": 1000}, api, loop_tools(err), tmp_path) is False
    assert api.calls[-1] == ("fail_loop", 4, "No picture in this section.", True)


def test_run_cuts_loops_after_timelines_and_stops_on_a_transient_failure():
    api = LoopApi(timelines=[{"id": 3}], loops=[{"id": 4, "start_ms": 0, "end_ms": 1000}, {"id": 5, "start_ms": 0, "end_ms": 1000}])
    n = jobs.run(
        api, tools(), timeline_tools=timeline_tools(duration=10.0, sounds=1), loop_tools=loop_tools(RuntimeError("net"))
    )
    kinds = [c[0] for c in api.calls]
    assert kinds.index("finish") < kinds.index("fail_loop")
    assert [c for c in api.calls if c[0] == "fail_loop"] == [("fail_loop", 4, "RuntimeError: net", False)]
    assert n == 2
