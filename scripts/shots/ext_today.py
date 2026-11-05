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


def _no_popup(page, where):
    # Sheets are <dialog> elements: none may stay open over the page.
    n = page.locator("dialog[open]").count()
    if n:
        raise RuntimeError(f"{n} dialog(s) still open {where}")


def _details(page):
    page.get_by_role("link", name="Details and settings").first.click()
    page.wait_for_url(re.compile(r"/exercises/\d+"))
    page.wait_for_load_state("networkidle")
    page.wait_for_timeout(400)


def _details_back(page):
    """Phone: + then Details › opens the exercise with no popup over it, and Back leaves no popup.
    (Back from there does not repaint Today: the sheet's leftover entry takes a second Back that
    aborts SvelteKit's navigation. Pre-desktop behaviour, measured on 5e93248; not this scene's.)"""
    _log_first(page)
    _details(page)
    _no_popup(page, "over the exercise page")
    page.go_back()
    page.wait_for_url(re.compile(r"/(salsa|bachata)$"))
    page.wait_for_load_state("networkidle")
    page.wait_for_timeout(600)
    _no_popup(page, "after Back")


def _session_details_return(page):
    """Phone: a session's popup, Details ›, then a link back to Today in the session: a fresh visit,
    whose pick-up opens the popup again at the current first row (the old page's onMount did)."""
    _start_session(page)
    first = page.locator("dialog[open]").first.get_attribute("aria-label")
    _details(page)
    _no_popup(page, "over the exercise page")
    path = re.sub(r"/exercises/.*", "", page.url.split("://", 1)[1].split("/", 1)[1])
    page.evaluate(
        """(href) => { const a = document.createElement('a'); a.href = href; a.id = 'shots-return';
        a.textContent = 'Today'; document.body.append(a); a.click(); }""",
        f"/{path}?session=1",
    )
    page.wait_for_url(re.compile(r"session=1"))
    page.locator("dialog[open]").first.wait_for()
    page.wait_for_load_state("networkidle")
    page.wait_for_timeout(600)
    again = page.locator("dialog[open]").first.get_attribute("aria-label")
    if again != first:
        raise RuntimeError(f"the popup came back at {again!r}, not {first!r}")


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
    # phone (Task 3 fix): the layout outlives the page, so leaving and coming back are by hand
    "today-details-back": Scene("/{dance}", _details_back),
    "today-session-return": Scene("/{dance}", _session_details_return),
    # desk only: from plan 2 Task 4 on, never in the phone baseline
    "pane-edit": Scene("/{dance}/exercises/{figex}", _edit, desk=True),
    "pane-logged": Scene("/{dance}/exercises/{drillex}", _logged, desk=True),
    "pane-session": Scene("/{dance}", _start_session, desk=True),
    "pane-skip": Scene("/{dance}", _skip, desk=True),
    # desk only (Task 3): the band's + beside an open exercise, and its refusal there
    "list-new": Scene("/{dance}/exercises/{drillex}", _new, desk=True),
    "list-new-refused": Scene("/{dance}/exercises/{drillex}", _new_refused, desk=True),
}
