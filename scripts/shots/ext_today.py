"""Plan 2's scenes (Today: popups, a session, editing) and the placeholders they need. See README "Scenes"."""
import re

from scenes import Scene


def _ex(db, admin, dance, source):
    row = db.execute(
        "select id from exercises where user_id = ? and dance = ? and source = ? and active = 1 "
        "and archived_at is null order by id limit 1",
        (admin, dance, source),
    ).fetchone()
    return row[0] if row else None


def placeholders(db, admin, dance):
    return {
        "figex": _ex(db, admin, dance, "figure"),
        "drillex": _ex(db, admin, dance, "custom"),
        "routineex": _ex(db, admin, dance, "routine"),
        "lessonex": _ex(db, admin, dance, "lesson"),
    }


def _log_first(page):
    page.locator('button[aria-label^="Log a set of "]').first.click()


def _start_session(page):
    page.get_by_role("button", name=re.compile(r"Start session")).first.click()


def _new(page):
    page.get_by_role("button", name=re.compile(r"Custom exercise")).first.click()


def _edit(page):
    page.get_by_role("button", name="Edit settings").first.click()


def _logged(page):
    page.get_by_label("Minutes").fill("5")
    page.get_by_role("button", name="Log set", exact=True).first.click()


def _skip(page):
    _start_session(page)
    page.get_by_role("button", name=re.compile(r"^Skip")).first.click()


def _new_refused(page):
    """New exercise from the band's + beside an open exercise, a blank name: the refusal in the dialog."""
    _new(page)
    page.locator("#new-exercise-name").fill("   ")
    page.get_by_role("button", name="Add exercise").click()
    page.locator("#new-exercise-error").wait_for()


def _session_then(act):
    def go(page):
        _start_session(page)
        act(page)
    return go


SCENES = {
    "today-popup": Scene("/{dance}", _log_first),
    "today-session": Scene("/{dance}", _start_session),
    "today-new": Scene("/{dance}", _new),
    "exercise-popup-figure": Scene("/{dance}/exercises/{figex}?log=1"),
    "exercise-popup-drill": Scene("/{dance}/exercises/{drillex}?log=1"),
    "exercise-popup-routine": Scene("/{dance}/exercises/{routineex}?log=1"),
    "exercise-popup-lesson": Scene("/{dance}/exercises/{lessonex}?log=1"),
    "exercise-edit": Scene("/{dance}/exercises/{drillex}", _edit),
    # desk only: from plan 2 Task 4 on, never in the phone baseline
    "pane-edit": Scene("/{dance}/exercises/{figex}", _edit, desk=True),
    "pane-logged": Scene("/{dance}/exercises/{drillex}", _logged, desk=True),
    "pane-session": Scene("/{dance}", _start_session, desk=True),
    "pane-skip": Scene("/{dance}", _skip, desk=True),
    # desk only (Task 3): the band's + beside an open exercise, and its refusal there
    "list-new": Scene("/{dance}/exercises/{drillex}", _new, desk=True),
    "list-new-refused": Scene("/{dance}/exercises/{drillex}", _new_refused, desk=True),
}
