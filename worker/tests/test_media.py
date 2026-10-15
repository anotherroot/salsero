import subprocess
from pathlib import Path

import pytest

from salsa_worker import media


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
    assert got == media.Fetched(tmp_path / "audio.m4a", "Vivir Mi Vida", 327.0)
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
    assert cmd[cmd.index("-f") + 1] == "bv*[height<=480]+ba/b[height<=480]/b"
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
    assert cmd[cmd.index("-vf") + 1] == "scale=-2:'min(480,ih)'"
    assert cmd[-1] == str(tmp_path / "out.mp4")
    with pytest.raises(media.PermanentError):
        media.to_mp4(tmp_path / "a", tmp_path / "b", run=fake_run(1, stderr="Invalid data"))
