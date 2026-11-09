import subprocess
from pathlib import Path

import pytest

from salsa_worker import media

SHORT_SIDE_480 = "scale='if(gt(iw,ih),-2,min(480,iw))':'if(gt(iw,ih),min(480,ih),-2)'"


def fake_run(returncode=0, stdout="", stderr="", make=None):
    calls = []

    def run(cmd, **kwargs):
        calls.append(cmd)
        if make:
            make.write_bytes(b"m4a")
        return subprocess.CompletedProcess(cmd, returncode, stdout, stderr)

    run.calls = calls
    return run


def test_fetch_reads_title_and_duration(tmp_path: Path):
    run = fake_run(stdout="Vivir Mi Vida\t327\n", make=tmp_path / "audio.m4a")
    got = media.fetch("https://youtu.be/x", tmp_path, run=run)
    assert got == media.Fetched(tmp_path / "audio.m4a", "Vivir Mi Vida", 327.0, "https://youtu.be/x")
    cmd = run.calls[0]
    # --print implies --simulate unless told otherwise: without this nothing downloads.
    assert "--no-simulate" in cmd
    assert "duration <= 900" in cmd


def test_fetch_filtered_out_is_permanent(tmp_path: Path):
    with pytest.raises(media.PermanentError, match="15 minutes"):
        media.fetch("https://youtu.be/x", tmp_path, run=fake_run(stdout=""))


@pytest.mark.parametrize(
    "stderr, permanent",
    [
        ("ERROR: [youtube] x: Video unavailable", True),
        ("ERROR: [youtube] x: Private video. Sign in", True),
        ("ERROR: Unsupported URL: https://example.com", True),
        ("ERROR: Unable to download webpage: <urlopen error timed out>", False),
        ("ERROR: [youtube] x: Sign in to confirm you're not a bot", False),
    ],
)
def test_fetch_classifies_errors(tmp_path: Path, stderr, permanent):
    kind = media.PermanentError if permanent else RuntimeError
    with pytest.raises(kind) as e:
        media.fetch("https://youtu.be/x", tmp_path, run=fake_run(returncode=1, stderr=stderr))
    assert type(e.value) is kind
    assert stderr.splitlines()[-1] in str(e.value)


def test_duration_of_parses_ffprobe(tmp_path: Path):
    assert media.duration_of(tmp_path / "a.wav", run=fake_run(stdout="12.5\n")) == 12.5


def test_fetch_video_asks_for_at_most_480p_and_an_hour(tmp_path: Path):
    run = fake_run(make=tmp_path / "video.mkv")
    assert media.fetch_video("https://youtu.be/x", tmp_path, run=run) == tmp_path / "video.mkv"
    cmd = run.calls[0]
    assert cmd[cmd.index("-f") + 1] == "bv*+ba/b"
    # res is the SHORTER side: a vertical Short at 480x854 is 480p, not 854p.
    assert cmd[cmd.index("-S") + 1] == "res:480"
    assert "duration <= 3600" in cmd
    assert "--no-playlist" in cmd


def test_fetch_video_errors(tmp_path: Path):
    with pytest.raises(media.PermanentError):
        media.fetch_video("u", tmp_path, run=fake_run(1, stderr="ERROR: Private video"))
    with pytest.raises(RuntimeError) as e:
        media.fetch_video("u", tmp_path, run=fake_run(1, stderr="ERROR: HTTP Error 503"))
    assert not isinstance(e.value, media.PermanentError)
    # The duration filter skips silently: exit 0, nothing written.
    with pytest.raises(media.PermanentError, match="60 minutes"):
        media.fetch_video("u", tmp_path, run=fake_run(0))


def test_to_mp4_is_small_h264_that_streams(tmp_path: Path):
    run = fake_run()
    media.to_mp4(tmp_path / "video.mkv", tmp_path / "out.mp4", run=run)
    cmd = run.calls[0]
    assert cmd[cmd.index("-c:v") + 1] == "libx264"
    assert cmd[cmd.index("-crf") + 1] == "28"
    assert cmd[cmd.index("-movflags") + 1] == "+faststart"
    # The shorter side becomes at most 480, whichever way up the video is.
    assert cmd[cmd.index("-vf") + 1] == SHORT_SIDE_480
    assert cmd[-1] == str(tmp_path / "out.mp4")
    with pytest.raises(media.PermanentError):
        media.to_mp4(tmp_path / "a", tmp_path / "b", run=fake_run(1, stderr="Invalid data"))


def test_search_youtube_lists_candidates():
    out = (
        '{"entries": ['
        '{"url": "https://www.youtube.com/watch?v=a1", "title": "Cali Pachanguero", "channel": "Grupo Niche - Topic", "duration": 313},'
        '{"webpage_url": "https://www.youtube.com/watch?v=b2", "title": "Live", "uploader": "Fan", "duration": null}'
        ']}'
    )
    run = fake_run(stdout=out)
    got = media.search_youtube("Grupo Niche Cali Pachanguero", run=run)
    assert run.calls[0] == [
        "yt-dlp", "--flat-playlist", "--dump-single-json", "--no-warnings",
        "ytsearch8:Grupo Niche Cali Pachanguero",
    ]
    assert got == [
        media.Candidate("https://www.youtube.com/watch?v=a1", "Cali Pachanguero", "Grupo Niche - Topic", 313.0),
        media.Candidate("https://www.youtube.com/watch?v=b2", "Live", "Fan", None),
    ]


def test_a_failed_search_is_transient():
    with pytest.raises(RuntimeError):
        media.search_youtube("x", run=fake_run(returncode=1, stderr="ERROR: HTTP Error 429"))


FLAT = Path(__file__).parent / "fixtures" / "yt-flat-playlist.json"


def test_read_youtube_list_reads_the_flat_playlist():
    run = fake_run(stdout=FLAT.read_text())
    lst = media.read_youtube_list("https://www.youtube.com/playlist?list=PL1", run=run)
    assert run.calls[0] == [
        "yt-dlp", "--flat-playlist", "--dump-single-json", "--no-warnings", "--playlist-end", "201",
        "https://www.youtube.com/playlist?list=PL1",
    ]
    assert lst.name == "Salsa clásica"
    assert [(i.title, i.artist, i.duration_s, i.url) for i in lst.items] == [
        ("Grupo Niche - Cali Pachanguero", None, 312.0, "https://www.youtube.com/watch?v=aaaaaaaaaa1"),
        ("Idilio", None, None, "https://www.youtube.com/watch?v=bbbbbbbbbb2"),
        ("Pedro Navaja", None, 441.0, "https://www.youtube.com/watch?v=ccccccccc3"),
    ]
    assert lst.truncated is False


def test_a_youtube_list_longer_than_200_is_cut():
    import json

    entries = [{"id": f"id{n:09d}", "title": f"S{n}", "duration": 200} for n in range(201)]
    lst = media.read_youtube_list("u", run=fake_run(stdout=json.dumps({"title": "Long", "entries": entries})))
    assert len(lst.items) == 200
    assert lst.truncated is True


@pytest.mark.parametrize("stderr", ["ERROR: The playlist does not exist.", "ERROR: This playlist is private"])
def test_a_missing_or_private_youtube_list_fails_for_good(stderr):
    with pytest.raises(media.PermanentError):
        media.read_youtube_list("u", run=fake_run(returncode=1, stderr=stderr))


def test_another_youtube_list_error_is_tried_again():
    with pytest.raises(RuntimeError):
        media.read_youtube_list("u", run=fake_run(returncode=1, stderr="ERROR: HTTP Error 429"))


def test_music_start_finds_where_the_music_rises_and_stays():
    # 18 s of silence, 12 s very quiet, then the song (median -18 dB).
    levels = [-120.0] * 36 + [-55.0] * 24 + [-18.0] * 400
    assert media.music_start(levels) == 30.0


def test_music_start_ignores_a_short_dip_later():
    levels = [-120.0] * 4 + [-18.0] * 100 + [-60.0] * 2 + [-18.0] * 100
    assert media.music_start(levels) == 2.0


def test_music_start_is_zero_when_loud_from_the_start_or_all_silence():
    assert media.music_start([-18.0] * 100) == 0.0
    assert media.music_start([-120.0] * 100) == 0.0
    assert media.music_start([]) == 0.0


def test_music_start_needs_the_rise_to_hold():
    # A 1 s blip (2 windows) at 2 s, the music from 10 s.
    levels = [-120.0] * 4 + [-18.0] * 2 + [-120.0] * 14 + [-18.0] * 100
    assert media.music_start(levels) == 10.0


def test_loudness_windows_reads_astats_per_half_second(tmp_path: Path):
    out = (
        "frame:0    pts:0       pts_time:0\n"
        "lavfi.astats.Overall.RMS_level=-inf\n"
        "frame:1    pts:11025   pts_time:0.5\n"
        "lavfi.astats.Overall.RMS_level=-20.50\n"
    )
    run = fake_run(stdout=out)
    assert media.loudness_windows(tmp_path / "a.wav", run=run) == [-120.0, -20.5]
    (cmd,) = run.calls
    assert cmd[0] == "ffmpeg"
    assert any("asetnsamples=11025" in part and "astats" in part for part in cmd)


def test_a_youtube_list_leaves_out_private_and_deleted_videos():
    import json

    entries = [
        {"id": "aaaaaaaaaa1", "title": "[Private video]", "duration": None},
        {"id": "aaaaaaaaaa2", "title": "[Deleted video]", "duration": None},
        {"id": "aaaaaaaaaa3", "title": "Idilio", "duration": 342},
    ]
    lst = media.read_youtube_list("u", run=fake_run(stdout=json.dumps({"title": "L", "entries": entries})))
    assert [i.title for i in lst.items] == ["Idilio"]


def test_timeline_frames_command_and_times(tmp_path: Path):
    out = tmp_path / "frames"

    def run(cmd, **kwargs):
        run.cmd = cmd
        out.mkdir(exist_ok=True)
        for n in (2, 1):
            (out / f"f{n:05d}.jpg").write_bytes(b"jpg")
        return subprocess.CompletedProcess(cmd, 0, "", "")

    got = media.timeline_frames(tmp_path / "v.mp4", out, run=run)
    assert got == [(0, out / "f00001.jpg"), (2000, out / "f00002.jpg")]
    # round=up: frame n shows (n - 1) * 2 s; the default (near) showed ~1 s later (measured on testsrc).
    assert "fps=1/2:round=up,scale=384:-2" in run.cmd
    assert run.cmd[run.cmd.index("-q:v") + 1] == "6"


def test_timeline_frames_failure_is_permanent(tmp_path: Path):
    with pytest.raises(media.PermanentError, match="Could not read the video"):
        media.timeline_frames(tmp_path / "v.mp4", tmp_path / "f", run=fake_run(returncode=1, stderr="moov atom not found"))


def test_timeline_sound_pieces_in_order(tmp_path: Path):
    out = tmp_path / "sound"

    def run(cmd, **kwargs):
        run.cmd = cmd
        out.mkdir(exist_ok=True)
        for n in (1, 0):
            (out / f"a{n:04d}.mp3").write_bytes(b"mp3")
        return subprocess.CompletedProcess(cmd, 0, "", "")

    assert media.timeline_sound(tmp_path / "v.mp4", out, run=run) == [out / "a0000.mp3", out / "a0001.mp3"]
    assert run.cmd[run.cmd.index("-segment_time") + 1] == "60"
    assert run.cmd[run.cmd.index("-b:a") + 1] == "24k"


def test_timeline_sound_none_on_failure(tmp_path: Path):
    got = media.timeline_sound(tmp_path / "v.mp4", tmp_path / "s", run=fake_run(returncode=1, stderr="does not contain any stream"))
    assert got == []


def test_timeline_duration_from_the_header(tmp_path: Path):
    assert media.timeline_duration(tmp_path / "v.mp4", run=fake_run(stdout="70.040000\n")) == 70.04


def test_timeline_duration_of_a_webm_without_one_is_decoded(tmp_path: Path):
    # MediaRecorder's WebM often has no duration in its header: ffprobe says N/A.
    answers = [
        subprocess.CompletedProcess([], 0, "N/A\n", ""),
        subprocess.CompletedProcess([], 0, "", "frame=  10 time=00:00:41.20 bitrate=N/A\nframe=  20 time=00:01:02.48 bitrate=N/A speed=9x\n"),
    ]
    calls = []

    def run(cmd, **kwargs):
        calls.append(cmd)
        return answers.pop(0)

    assert media.timeline_duration(tmp_path / "v.webm", run=run) == 62.48
    assert calls[1][:2] == ["ffmpeg", "-nostdin"]
    assert calls[1][-3:] == ["-f", "null", "-"]


def test_timeline_duration_unknown_is_permanent(tmp_path: Path):
    answers = [subprocess.CompletedProcess([], 0, "N/A\n", ""), subprocess.CompletedProcess([], 1, "", "Invalid data")]
    with pytest.raises(media.PermanentError, match="length"):
        media.timeline_duration(tmp_path / "v.webm", run=lambda cmd, **kw: answers.pop(0))
