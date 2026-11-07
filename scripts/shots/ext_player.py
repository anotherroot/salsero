"""The video player's polish (2026-11-05): Mute beside Mirror, the inline row, a section's top bar.
Needs a db copy with a video recording and its file (`<db>.data/`), and for the inline row a lesson
video with its file. See README "Scenes". Since the figure page rework (2026-11-06) a figure's
recordings are rows that open the full-screen player, so the inline row is shot on a lesson."""
import re
import time

from scenes import Scene


def placeholders(db, admin, dance):
    # An old dev db's admin may have no name, which sends every page to /welcome.
    db.execute("update users set first_name = 'Shots' where id = ? and first_name is null", (admin,))
    lesson = db.execute(
        "select v.lesson_id from lesson_videos v join lessons l on l.id = v.lesson_id "
        "where l.user_id = ? and l.dance = ? and l.archived_at is null "
        "order by (v.file like '5a170000-%') desc, v.id limit 1",
        (admin, dance),
    ).fetchone()
    rec = db.execute(
        "select r.id, r.figure_id from recordings r join figures f on f.id = r.figure_id "
        "where f.user_id = ? and f.dance = ? and f.archived_at is null and r.kind = 'video' "
        "order by f.id, r.id limit 1",
        (admin, dance),
    ).fetchone()
    if not rec:
        return {"secfigure": None, "inlinelesson": lesson[0] if lesson else None}
    # A section to open, linked to the figure so its page lists it: the copy is throwaway.
    now = int(time.time() * 1000)
    spot = db.execute(
        "insert into video_spots (recording_id, start_ms, end_ms, label, created_at) values (?, 1000, 4000, 'Shots section', ?)",
        (rec[0], now),
    ).lastrowid
    db.execute("insert into spot_links (spot_id, figure_id, created_at) values (?, ?, ?)", (spot, rec[1], now))
    return {"secfigure": rec[1], "inlinelesson": lesson[0] if lesson else None}


def _inline(page):
    # The row under the picture: Mirror and Mute, no words beside them.
    page.get_by_role("button", name="Mute", exact=True).first.scroll_into_view_if_needed()
    page.mouse.wheel(0, 200)
    page.wait_for_timeout(300)


def _full(page):
    # A recording's row opens the full-screen player.
    page.get_by_role("button", name=re.compile(r"^Play the recording from ")).first.click()
    page.wait_for_timeout(800)


def _section(page):
    # The section's row in Recordings: the player opens on the section, looping.
    page.get_by_role("button", name=re.compile(r"^Shots section")).first.click()
    page.wait_for_timeout(800)


def _muted_section(page):
    _section(page)
    page.get_by_role("dialog").get_by_role("button", name="Mute", exact=True).click()
    page.wait_for_timeout(300)


SCENES = {
    "player-inline": Scene("/{dance}/lessons/{inlinelesson}", _inline),
    "player-full": Scene("/{dance}/figures/{secfigure}", _full),
    "player-section": Scene("/{dance}/figures/{secfigure}", _section),
    "player-section-muted": Scene("/{dance}/figures/{secfigure}", _muted_section),
}
