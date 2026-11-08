"""Plan 2, Task 9: every practice opens the exercise page and a face brings you back where you were.
A figure's Practise (a class's figure, read as a member) and a lesson's review row. See README "Scenes"."""
import re

from scenes import Scene


def _first(db, sql, args):
    row = db.execute(sql, args).fetchone()
    return row[0] if row else None


def placeholders(db, admin, dance):
    member = (
        "select t.id from teams t join team_members m on m.team_id = t.id "
        "where m.user_id = ? and m.role = 'member' and t.dance = ? and t.deleted_at is null"
    )
    # a figure of a class the admin only reads (its page draws the pinned Edit / Practise)
    figure = _first(
        db,
        "select f.id from figures f where f.team_id in (" + member + ") and f.dance = ? "
        "and f.archived_at is null order by f.id limit 1",
        (admin, dance, dance),
    )
    return {"classfigure": figure}


def _face_and_back(page, where):
    """On an exercise page: Done, a face, then back on `where` with the saved toast."""
    page.wait_for_url(re.compile(r"/exercises/\d+"))
    page.get_by_role("button", name=re.compile("Done")).first.click()
    page.get_by_role("button", name=re.compile("Still hard|Getting there|I've got it|Easy")).first.click()
    page.wait_for_url(re.compile(where))
    page.wait_for_selector("[role=status] >> text=Saved")


def _figure(page):
    page.locator("a:has-text(\"Practise\"), button:has-text(\"Practise\")").first.click()
    _face_and_back(page, r"/figures/\d+")


def _lesson(page):
    page.get_by_role("link", name=re.compile("Go over this lesson")).first.click()
    _face_and_back(page, r"/lessons/\d+")


SCENES = {
    "flow-figure": Scene("/{dance}/figures/{classfigure}", _figure),
    "flow-lesson": Scene("/{dance}/lessons/{classlesson}", _lesson),
}
