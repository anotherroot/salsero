"""The figure page rework (2026-11-06): Recordings with + Add, the three rows' sheets, edit mode,
a recording whose file is gone, and an upload started from the add sheet. Works on a copy of the
backup without media: the scenes plant a recording row with no file. See README "Scenes"."""
import time

from scenes import Scene


def placeholders(db, admin, dance):
    # The admin's figure with a linked section and something before it in the graph.
    fig = db.execute(
        "select f.id from figures f join spot_links l on l.figure_id = f.id "
        "where f.user_id = ? and f.dance = ? and f.archived_at is null and f.team_id is null "
        "order by f.id limit 1",
        (admin, dance),
    ).fetchone()
    if not fig:
        return {"goneFigure": None, "goneTopFigure": None}
    db.execute("update users set first_name = 'Shots' where id = ? and first_name is null", (admin,))
    # A recording whose file is not in the data dir: its row must say so.
    db.execute(
        "insert into recordings (figure_id, file, mime, kind, size_bytes, created_at) values (?, 'shots-gone.mp4', 'video/mp4', 'video', 2400000, ?)",
        (fig[0], int(time.time() * 1000)),
    )
    # A figure with no section: its only recording is gone, so no top video may show.
    bare = db.execute(
        "select f.id from figures f where f.user_id = ? and f.dance = ? and f.archived_at is null "
        "and f.team_id is null and not exists (select 1 from spot_links l where l.figure_id = f.id) "
        "order by f.id limit 1",
        (admin, dance),
    ).fetchone()
    if bare:
        db.execute(
            "insert into recordings (figure_id, file, mime, kind, size_bytes, created_at) values (?, 'shots-gone-top.mp4', 'video/mp4', 'video', 2400000, ?)",
            (bare[0], int(time.time() * 1000)),
        )
    return {"goneFigure": fig[0], "goneTopFigure": bare[0] if bare else None}


def _missing(page):
    # The hidden probe learns the file is gone, then asks the server why.
    page.get_by_text("This file is missing").first.wait_for(timeout=5000)
    page.get_by_text("This file is missing").first.scroll_into_view_if_needed()


def _gone_top(page):
    # The row learns the file is gone; the top video then leaves the page.
    page.get_by_text("This file is missing").first.wait_for(timeout=5000)
    page.wait_for_timeout(300)
    if page.get_by_role("button", name="Play Recording").count() != 0:
        raise AssertionError("a missing recording is still the top video")


def _follows(page):
    page.get_by_role("button", name="Follows from").click()
    page.get_by_role("dialog").get_by_role("searchbox").fill("dile")
    page.wait_for_timeout(300)


def _routines(page):
    page.get_by_role("button", name="In routines").click()
    page.wait_for_timeout(300)


def _add(page):
    page.get_by_role("button", name="Add to Recordings").click()
    page.wait_for_timeout(300)


def _upload(page):
    page.get_by_role("button", name="Add to Recordings").click()
    with page.expect_file_chooser() as fc:
        page.get_by_role("dialog").get_by_role("button", name="Video from the phone").click()
    fc.value.set_files({"name": "shots.mp4", "mimeType": "video/mp4", "buffer": b"\0" * 200_000})
    # The sheet is gone and the page shows the new recording when the upload lands.
    page.get_by_role("dialog").wait_for(state="hidden", timeout=5000)
    page.get_by_text("Recordings · 3").wait_for(timeout=15000)


def _edit(page):
    page.get_by_role("button", name="Edit", exact=True).first.click()
    page.wait_for_timeout(300)
    page.get_by_role("button", name="Delete this recording").first.scroll_into_view_if_needed()


SCENES = {
    "figure-gone-top": Scene("/{dance}/figures/{goneTopFigure}", _gone_top),
    "figure-missing": Scene("/{dance}/figures/{goneFigure}", _missing),
    "figure-follows": Scene("/{dance}/figures/{goneFigure}", _follows),
    "figure-routines": Scene("/{dance}/figures/{goneFigure}", _routines),
    "figure-add": Scene("/{dance}/figures/{goneFigure}", _add),
    "figure-upload": Scene("/{dance}/figures/{goneFigure}", _upload),
    "figure-edit": Scene("/{dance}/figures/{goneFigure}", _edit),
}
