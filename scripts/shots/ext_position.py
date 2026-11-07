"""The position page in the figure page's order (2026-11-07): the three rows' sheets, the ⋯ menu
and Recordings' + Add. Works on a copy of the backup without media. See README "Scenes"."""
from scenes import Scene


def placeholders(db, admin, dance):
    # The admin's live position that the most figures leave: its sheet has something to search.
    row = db.execute(
        "select p.id from positions p left join figure_start_positions s on s.position_id = p.id "
        "where p.user_id = ? and p.dance = ? and p.archived_at is null and p.team_id is null "
        "group by p.id order by count(s.position_id) desc, p.id limit 1",
        (admin, dance),
    ).fetchone()
    return {"busyPosition": row[0] if row else None}


def _from(page):
    page.get_by_role("button", name="Figures from here").click()
    page.get_by_role("dialog").get_by_role("searchbox").fill("bas")
    page.wait_for_timeout(300)


def _routines(page):
    page.get_by_role("button", name="In routines").click()
    page.wait_for_timeout(300)


def _menu(page):
    page.get_by_role("button", name="Position menu").first.click()
    page.wait_for_timeout(300)


def _add(page):
    page.get_by_role("button", name="Add a section or point to Recordings").click()
    page.wait_for_timeout(300)


SCENES = {
    "position-from": Scene("/{dance}/positions/{busyPosition}", _from),
    "position-routines": Scene("/{dance}/positions/{busyPosition}", _routines),
    "position-menu": Scene("/{dance}/positions/{busyPosition}", _menu),
    "position-add": Scene("/{dance}/positions/{busyPosition}", _add),
}
