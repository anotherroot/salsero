"""The video player's polish (2026-11-05): Mute beside Mirror, the inline row, a section's top bar.
Needs a db copy with a video recording and its file (`<db>.data/`). See README "Scenes"."""
import time

from scenes import Scene


def placeholders(db, admin, dance):
    rec = db.execute(
        "select r.id, r.figure_id from recordings r join figures f on f.id = r.figure_id "
        "where f.user_id = ? and f.dance = ? and f.archived_at is null and r.kind = 'video' "
        "order by f.id, r.id limit 1",
        (admin, dance),
    ).fetchone()
    if not rec:
        return {"secfigure": None}
    # An old dev db's admin may have no name, which sends every page to /welcome.
    db.execute("update users set first_name = 'Shots' where id = ? and first_name is null", (admin,))
    # A section to open: the copy is throwaway, so the scene may add one.
    db.execute(
        "insert into video_spots (recording_id, start_ms, end_ms, label, created_at) values (?, 1000, 4000, 'Shots section', ?)",
        (rec[0], int(time.time() * 1000)),
    )
    return {"secfigure": rec[1]}


def _inline(page):
    # The row under the picture: Mirror and Mute, no words beside them.
    page.get_by_role("button", name="Mute", exact=True).first.scroll_into_view_if_needed()
    page.mouse.wheel(0, 200)
    page.wait_for_timeout(300)


def _full(page):
    page.get_by_role("button", name="Full screen").first.click()
    page.wait_for_timeout(800)


def _section(page):
    # The recording's Sections row: the player opens on the section, looping.
    page.get_by_role("button", name="Play Shots section").first.click()
    page.wait_for_timeout(800)


def _muted_section(page):
    _section(page)
    page.get_by_role("dialog").get_by_role("button", name="Mute", exact=True).click()
    page.wait_for_timeout(300)


SCENES = {
    "player-inline": Scene("/{dance}/figures/{secfigure}", _inline),
    "player-section": Scene("/{dance}/figures/{secfigure}", _section),
    "player-section-muted": Scene("/{dance}/figures/{secfigure}", _muted_section),
}
