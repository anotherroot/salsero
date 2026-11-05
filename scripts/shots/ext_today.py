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


def _group_drill(db, admin, dance):
    """A group's drill in a published lesson of a group the admin is in, with no entry of theirs."""
    return db.execute(
        "select e.id, le.lesson_id from exercises e join lesson_exercises le on le.exercise_id = e.id "
        "join lessons l on l.id = le.lesson_id join team_members m on m.team_id = e.team_id "
        "where e.team_id is not null and e.source = 'custom' and e.dance = ? and e.archived_at is null "
        "and l.archived_at is null and l.published_at is not null and m.user_id = ? "
        "and not exists (select 1 from exercises x where x.drill_id = e.id and x.user_id = ? "
        "and x.archived_at is null) order by e.id limit 1",
        (dance, admin, admin),
    ).fetchone()


def placeholders(db, admin, dance):
    group = _group_drill(db, admin, dance)
    return {
        "figex": _ex(db, admin, dance, "figure"),
        "drillex": _ex(db, admin, dance, "custom"),
        "routineex": _ex(db, admin, dance, "routine"),
        "lessonex": _ex(db, admin, dance, "lesson"),
        "groupdrill": group[0] if group else None,
        "groupdrilllesson": group[1] if group else None,
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
    page.locator("dialog[open]").first.wait_for()
    page.wait_for_timeout(500)
    before = page.evaluate("history.length")
    _details(page)
    _no_popup(page, "over the exercise page")
    # Details pushes one entry over the popup's; the popup closing must not push its own again
    # (a forward orphan: the layout closed it after the stack re-anchored, Task 3's version).
    after = page.evaluate("history.length")
    if after != before + 1:
        raise RuntimeError(f"history grew by {after - before} on Details, not 1")
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


def _open_group_drill(page):
    """From its lesson (the path's `#open=<id>`), a group's drill with no entry of the admin's."""
    target = page.url.split("#open=", 1)[1]
    page.locator(f'a[href$="/exercises/{target}"]').first.click()
    page.wait_for_url(re.compile(rf"/exercises/{target}$"))
    page.wait_for_load_state("networkidle")
    page.wait_for_timeout(600)
    if page.locator('form[id^="log-"]').count():
        raise RuntimeError("a log form beside an exercise that cannot be logged")


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
    # desk only (Task 4): an exercise that is no row of the list, opened from its lesson
    "pane-group-drill": Scene(
        "/{dance}/lessons/{groupdrilllesson}#open={groupdrill}", _open_group_drill, desk=True
    ),
    # desk only (Task 3): the band's + beside an open exercise, and its refusal there
    "list-new": Scene("/{dance}/exercises/{drillex}", _new, desk=True),
    "list-new-refused": Scene("/{dance}/exercises/{drillex}", _new_refused, desk=True),
}


# ---- desk checks (Task 4): a scene that raises is a failure; the shot is incidental ----

def _lit_band(page):
    """The band heading over the row marked open (aria-current) in the list column."""
    return page.locator('[data-list-column] a[aria-current="page"]').evaluate(
        "a => a.closest('section[aria-labelledby]')?.querySelector('h2')?.textContent?.trim() ?? null"
    )


def _logged_lit(page):
    """Log set in the pane: Logged, the set under History · Today, the row in Done today and still lit."""
    path = page.url
    _logged(page)
    page.get_by_role("button", name="Logged").first.wait_for()
    page.wait_for_load_state("networkidle")
    page.wait_for_timeout(400)
    if page.url != path:
        raise RuntimeError(f"logging moved the page to {page.url}")
    band = _lit_band(page)
    if not band or not band.startswith("Done today"):
        raise RuntimeError(f"the open row is lit under {band!r}, not Done today")
    if not page.get_by_role("heading", name="Today", exact=True).count():
        raise RuntimeError("no History · Today heading after the log")


def _archive_from_pane(page):
    """Archive the open drill from the pane: Today, no unsaved question, the row gone."""
    target = re.search(r"/exercises/(\d+)", page.url).group(1)
    _edit(page)
    page.get_by_role("button", name="Archive exercise").click()
    page.locator("dialog[open]").get_by_role("button", name="Archive", exact=True).click()
    try:
        page.wait_for_url(re.compile(r"/(salsa|bachata)$"), timeout=8000)
    except Exception:
        raise RuntimeError(f"archiving left the page at {page.url}, not Today")
    page.wait_for_load_state("networkidle")
    page.wait_for_timeout(600)
    _no_popup(page, "after archiving (an unsaved-changes question?)")
    if page.locator(f'a[href$="/exercises/{target}"]').count():
        raise RuntimeError("the archived drill's row is still in the list")


def _resize(page):
    """1440 → 800 → 1440 with an exercise open: one log form on the desktop, none at 800, the URL kept."""
    path = page.url

    def forms():
        page.wait_for_timeout(500)
        return page.locator('form[id^="log-"]').count()

    seen = [forms()]
    page.set_viewport_size({"width": 800, "height": 900})
    seen.append(forms())
    page.set_viewport_size({"width": 1440, "height": 900})
    seen.append(forms())
    if seen != [1, 0, 1]:
        raise RuntimeError(f"log forms at 1440, 800, 1440: {seen}")
    if page.url != path:
        raise RuntimeError(f"the URL changed to {page.url}")


SCENES.update({
    "pane-logged-lit": Scene("/{dance}/exercises/{drillex}", _logged_lit, desk=True),
    "pane-archive": Scene("/{dance}/exercises/{drillex}", _archive_from_pane, desk=True),
    "pane-resize": Scene("/{dance}/exercises/{figex}", _resize, desk=True),
})
