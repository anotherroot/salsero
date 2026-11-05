"""Plan 2's scenes (Today: popups, a session, editing) and the placeholders they need. See README "Scenes"."""
import os
import re
from datetime import datetime, timezone

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


def _quiet_day(db, admin, dance):
    """1 when Today has nothing to open: every active exercise of the admin has a set on the rig's day
    (instant.txt, in their zone), or none is active. Gates the scenes of the day so far."""
    with open(os.path.join(os.path.dirname(os.path.abspath(__file__)), "instant.txt")) as fh:
        now = datetime.strptime(fh.read().strip(), "%Y-%m-%d %H:%M:%S").replace(tzinfo=timezone.utc)
    tz = (db.execute("select timezone from users where id = ?", (admin,)).fetchone() or [None])[0]
    try:
        from zoneinfo import ZoneInfo
        local = now.astimezone(ZoneInfo(tz or "UTC"))
    except Exception:  # no tz database: the UTC day
        local = now
    start = int(local.replace(hour=0, minute=0, second=0, microsecond=0).timestamp() * 1000)
    left = db.execute(
        "select count(*) from exercises e where e.user_id = ? and e.dance = ? and e.active = 1 "
        "and e.archived_at is null and not exists (select 1 from sets s where s.exercise_id = e.id "
        "and s.done_at >= ?)",
        (admin, dance, start),
    ).fetchone()[0]
    return 1 if left == 0 else None


def placeholders(db, admin, dance):
    group = _group_drill(db, admin, dance)
    return {
        "quietday": _quiet_day(db, admin, dance),
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
    # ...which opens the next one by itself (Task 5)
    page.wait_for_url(re.compile(r"/exercises/\d+$"), timeout=8000)
    if page.url.endswith(f"/exercises/{target}"):
        raise RuntimeError("Today opened the archived drill again")
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


def _how_often(page):
    return page.locator("dt", has_text="How often").locator("xpath=following-sibling::dd").inner_text().strip()


def _edit_then_open_another(page):
    """Editing A's settings, open B from the list: the edit closes, and B's form starts from B's value."""
    a_value = _how_often(page)
    _edit(page)
    shown = page.locator("#everyDays-value").inner_text().strip()
    if shown != a_value:
        raise RuntimeError(f"A's form shows {shown!r}, its settings say {a_value!r}")
    rows = page.locator('[data-list-column] a[href*="/exercises/"]:not([aria-current])')
    target = None
    for i in range(rows.count()):
        row = rows.nth(i)
        meta = row.inner_text()
        if ("Every" in meta or "Daily" in meta or "Weekly" in meta) and a_value not in meta:
            target = row
            break
    if target is None:
        raise RuntimeError(f"no row with a frequency other than {a_value!r}")
    href = target.get_attribute("href")
    target.click()
    page.wait_for_url(re.compile(re.escape(href.split("?")[0]) + r"$"))
    page.wait_for_load_state("networkidle")
    page.wait_for_timeout(500)
    if page.locator("#exercise-settings").count():
        raise RuntimeError("A's edit is still open on B")
    b_value = _how_often(page)
    _edit(page)
    shown = page.locator("#everyDays-value").inner_text().strip()
    if shown != b_value or shown == a_value:
        raise RuntimeError(f"B's form shows {shown!r}; B's settings say {b_value!r}, A's {a_value!r}")


SCENES.update({
    "pane-edit-then-other": Scene("/{dance}/exercises/{drillex}", _edit_then_open_another, desk=True),
    "pane-logged-lit": Scene("/{dance}/exercises/{drillex}", _logged_lit, desk=True),
    "pane-archive": Scene("/{dance}/exercises/{drillex}", _archive_from_pane, desk=True),
    "pane-resize": Scene("/{dance}/exercises/{figex}", _resize, desk=True),
})


# ---- desk checks (Task 5): one always open ----

def _side_today(page):
    page.locator("nav[data-side] a", has_text="Today").first.click()


def _first_due_href(page):
    """The list's first row under Due (else under Not yet due): the one Today opens by itself."""
    for band in ("Due", "Not yet due"):
        rows = page.locator(
            f'[data-list-column] section[aria-labelledby]:has(h2:text-matches("^{band}")) a[href*="/exercises/"]'
        )
        if rows.count():
            return rows.first.get_attribute("href").split("?")[0]
    return None


def _swapped(page, where):
    """Landed on an exercise's URL with no ‹ in its pane, its row lit."""
    page.wait_for_url(re.compile(r"/exercises/\d+$"), timeout=8000)
    page.wait_for_load_state("networkidle")
    page.wait_for_timeout(500)
    want = _first_due_href(page)
    got = "/" + page.url.split("://", 1)[1].split("/", 1)[1]
    if want is None or got != want:
        raise RuntimeError(f"{where}: landed on {got}, the first due is {want}")
    backs = page.locator('a[aria-label^="Back"]:visible')
    if backs.count():
        raise RuntimeError(f"{where}: a ‹ in the pane ({backs.first.get_attribute('aria-label')!r})")
    lit = page.locator('[data-list-column] a[aria-current="page"]')
    if lit.count() != 1 or lit.first.get_attribute("href").split("?")[0] != want:
        raise RuntimeError(f"{where}: the open row is not the one lit")
    return got


def _default_open(page):
    """From Moves, the side's Today: one entry pushed (Today's own), replaced by the first due
    exercise; Back returns to Moves and stays there; a reload keeps the exercise."""
    start = page.url
    before = page.evaluate("history.length")
    _side_today(page)
    got = _swapped(page, "the side's Today")
    after = page.evaluate("history.length")
    if after != before + 1:
        raise RuntimeError(f"history grew by {after - before}, not 1 (the swap must replace)")
    page.reload(wait_until="networkidle")
    page.wait_for_timeout(500)
    if not page.url.endswith(got):
        raise RuntimeError(f"a reload moved the page to {page.url}")
    page.go_back()
    page.wait_for_url(start, timeout=8000)
    page.wait_for_timeout(1200)
    if page.url != start:
        raise RuntimeError(f"Back from the swapped page went on to {page.url}")
    page.go_forward()
    page.wait_for_url(re.compile(re.escape(got) + "$"), timeout=8000)
    page.wait_for_load_state("networkidle")
    page.wait_for_timeout(300)


def _today_again(page):
    """An exercise open, Today lit: its tap goes to /{dance}, which opens the default again."""
    before = page.evaluate("history.length")
    _side_today(page)
    _swapped(page, "Today tapped while lit")
    after = page.evaluate("history.length")
    if after != before + 1:
        raise RuntimeError(f"history grew by {after - before}, not 1")


def _day_so_far(page):
    """Nothing due, nothing not yet due: /{dance} stays, the pane holds the day so far."""
    page.wait_for_timeout(1200)
    if re.search(r"/exercises/", page.url):
        raise RuntimeError(f"swapped to {page.url} with nothing to open")
    if not page.get_by_role("heading", name="Today so far").count():
        raise RuntimeError("no Today so far heading in the pane")


SCENES.update({
    "today-open": Scene("/{dance}/figures", _default_open, desk=True),
    "today-again": Scene("/{dance}/exercises/{drillex}", _today_again, desk=True),
    "today-day-so-far": Scene("/{dance}#quiet{quietday}", _day_so_far, desk=True),
})


def _pane_loading(page):
    """The side's Today with the swapped exercise's data held: the list beside Today's pane skeleton
    (board today--a-loading's pane). The root's pending overlay is hidden: until plan 2 Task 7 it draws
    the generic pane skeleton over it after 100 ms."""
    _HELD.clear()
    page.route(re.compile(r"/exercises/\d+/__data\.json"), lambda r: _HELD.append(r))
    _side_today(page)
    page.wait_for_url(re.compile(r"/(salsa|bachata)$"), timeout=8000)
    page.wait_for_timeout(800)
    page.add_style_tag(content="body > div > div[aria-busy='true'].fixed, div.fixed[aria-busy='true'] { display: none !important }")
    if not page.locator('section[aria-label="Loading"][aria-busy="true"]:visible').count():
        raise RuntimeError("no pane skeleton while the exercise loads")


_HELD = []


def _release(page):
    """After the shot: answer the held requests, so closing the page cancels no route handler."""
    for r in _HELD:
        r.abort()
    _HELD.clear()


SCENES.update({
    "today-pane-loading": Scene("/{dance}/figures", _pane_loading, desk=True, after=_release),
})


def _open_from_elsewhere(page):
    """The default exercise opened earlier from Moves (a ‹ back to Moves), then the side's Today:
    the swap lands on it with no ‹ (its opener dropped)."""
    page.wait_for_url(re.compile(r"/exercises/\d+$"), timeout=8000)
    ex = "/" + page.url.split("://", 1)[1].split("/", 1)[1]
    page.locator("nav[data-side] a", has_text="Moves").first.click()
    page.wait_for_url(re.compile(r"/figures$"), timeout=8000)
    page.wait_for_load_state("networkidle")
    page.evaluate(
        """(href) => { const a = document.createElement('a'); a.href = href; a.id = 'shots-ex';
        a.textContent = 'exercise'; document.body.append(a); a.click(); }""",
        ex,
    )
    page.wait_for_url(re.compile(re.escape(ex) + "$"), timeout=8000)
    page.wait_for_load_state("networkidle")
    page.wait_for_timeout(500)
    if not page.locator('a[aria-label^="Back"]:visible').count():
        raise RuntimeError("opened from Moves, the exercise shows no ‹ (the check below would prove nothing)")
    _side_today(page)
    page.wait_for_timeout(300)
    _swapped(page, "Today after the exercise was opened from Moves")


SCENES.update({
    "today-open-dropped": Scene("/{dance}", _open_from_elsewhere, desk=True),
})


def _create_from_day_so_far(page):
    """Nothing to open, then Custom exercise → Add exercise: once the sheet's Back has landed, Today
    opens the new one in Today's own history slot (the replace never takes the sheet's entry), and one
    Back leaves Today."""
    start = page.url
    _side_today(page)
    page.wait_for_url(re.compile(r"/(salsa|bachata)$"), timeout=8000)
    page.wait_for_load_state("networkidle")
    page.wait_for_timeout(1200)
    if re.search(r"/exercises/", page.url):
        raise RuntimeError(f"swapped to {page.url} with nothing to open")
    slot = page.evaluate("history.state?.['sveltekit:history']")
    length = page.evaluate("history.length")
    _new(page)
    page.locator("#new-exercise-name").fill("Shots new drill")
    page.get_by_role("button", name="Add exercise").click()
    page.wait_for_url(re.compile(r"/exercises/\d+$"), timeout=8000)
    page.wait_for_load_state("networkidle")
    page.wait_for_timeout(800)
    _no_popup(page, "after Add exercise")
    if not page.get_by_role("heading", name="Shots new drill").count():
        raise RuntimeError(f"landed on {page.url}, not the new exercise")
    now = page.evaluate("history.state?.['sveltekit:history']")
    if now != slot:
        raise RuntimeError(f"the new exercise is in history slot {now}, Today's was {slot}")
    grew = page.evaluate("history.length") - length
    if grew > 1:  # the sheet's own entry may stay ahead as a forward entry, never more
        raise RuntimeError(f"history grew by {grew}")
    page.go_back()
    page.wait_for_url(start, timeout=8000)
    page.wait_for_timeout(1200)
    if page.url != start:
        raise RuntimeError(f"one Back from the new exercise went to {page.url}, not {start}")


SCENES.update({
    # Run it last or alone: it adds an exercise to the copy.
    "today-create-open": Scene("/{dance}/figures#quiet{quietday}", _create_from_day_so_far, desk=True),
})


# ---- desk checks (Task 6): the session walks the pane, Next after a log ----

def _path(page):
    return "/" + page.url.split("://", 1)[1].split("/", 1)[1]


def _settle(page, ms=500):
    page.wait_for_load_state("networkidle")
    page.wait_for_timeout(ms)


def _forms(page):
    return page.locator('form[id^="log-"]').count()


def _one_form_no_popup(page, where):
    n = _forms(page)
    if n != 1:
        raise RuntimeError(f"{where}: {n} log forms, not 1")
    _no_popup(page, where)


def _line(page):
    """The pane header's session line ("Session · 2 of 5 · 1 logged so far"), or None."""
    loc = page.locator("[data-below] p", has_text=re.compile(r"^Session · "))
    return loc.first.inner_text().strip() if loc.count() else None


def _want_line(page, i, n=None, logged=0, where=""):
    got = _line(page)
    m = re.match(r"^Session · (\d+) of (\d+)( · (\d+) logged so far)?$", got or "")
    if not m or int(m.group(1)) != i or (n is not None and int(m.group(2)) != n) or int(m.group(4) or 0) != logged:
        raise RuntimeError(f"{where}: the session line reads {got!r}, want {i} of {n or 'n'}, {logged} logged")
    return int(m.group(2))


def _sets(page):
    """Rows in the copy's sets table (the rig's temp db), read-only."""
    import sqlite3
    db = sqlite3.connect(f"file:{os.environ['SHOTS_TMP']}/salsa.db?mode=ro", uri=True)
    try:
        return db.execute("select count(*) from sets").fetchone()[0]
    finally:
        db.close()


def _desk_start(page):
    page.get_by_role("button", name=re.compile(r"Start session")).first.click()


def _pinned(page):
    return page.locator('section[aria-label="Log a set"] div.sticky')


def _skip_pane(page):
    before = _path(page)
    _pinned(page).get_by_role("button", name="Skip", exact=True).click()
    page.wait_for_url(lambda u: not u.endswith(before), timeout=8000)
    _settle(page)


def _log_pane(page):
    sets = _sets(page)
    form = page.locator('form[id^="log-pane-"]')
    if form.get_by_label("Minutes").count():
        form.get_by_label("Minutes").fill("5")
    _pinned(page).get_by_role("button", name="Log set", exact=True).click()
    # Logged, or at the session's last one the Session done card in its place
    _pinned(page).get_by_role("button", name="Logged").or_(
        page.locator('[role="status"]', has_text="Session done")
    ).first.wait_for(timeout=8000)
    _settle(page)
    if _sets(page) != sets + 1:
        raise RuntimeError(f"one Log set made {_sets(page) - sets} sets")


def _session_walk(page):
    """Start (a push) opens the first due one with ?session=1 in the pane, its row lit and Up next;
    Skip and Next replace; Log set says Logged + Next: and the line counts it; one Back leaves the
    session for the page before it, and stays there."""
    page.wait_for_url(re.compile(r"/exercises/\d+$"), timeout=8000)
    _settle(page)
    start = _path(page)
    first = _first_due_href(page)
    length = page.evaluate("history.length")
    _desk_start(page)
    page.wait_for_url(re.compile(r"/exercises/\d+\?session=1$"), timeout=8000)
    _settle(page)
    if _path(page) != f"{first}?session=1":
        raise RuntimeError(f"Start opened {_path(page)}, the first due is {first}")
    if page.evaluate("history.length") != length + 1:
        raise RuntimeError("Start session did not add one history entry")
    _one_form_no_popup(page, "after Start")
    n = _want_line(page, 1, where="after Start")
    lit = page.locator('[data-list-column] a[aria-current="page"]')
    if lit.count() != 1 or "Up next" not in lit.first.inner_text():
        raise RuntimeError("the open row is not the Up next one")
    pinned = _pinned(page)
    for name in ("Skip", "Log set"):
        if not pinned.get_by_role("button", name=name, exact=True).count():
            raise RuntimeError(f"no {name} pinned under the form")
    _skip_pane(page)
    if page.evaluate("history.length") != length + 1:
        raise RuntimeError("Skip added a history entry")
    if not page.url.endswith("?session=1"):
        raise RuntimeError(f"Skip left the session: {page.url}")
    _one_form_no_popup(page, "after Skip")
    _want_line(page, 2, n, where="after Skip")
    _log_pane(page)
    nxt = pinned.get_by_role("button", name=re.compile(r"^Next: "))
    if not nxt.count():
        raise RuntimeError("no Next: after Log set in the session")
    _want_line(page, 2, n, logged=1, where="after Log set")
    at = _path(page)
    nxt.click()
    page.wait_for_url(lambda u: not u.endswith(at), timeout=8000)
    _settle(page)
    if page.evaluate("history.length") != length + 1:
        raise RuntimeError("Next added a history entry")
    _want_line(page, 3, n, logged=1, where="after Next")
    _one_form_no_popup(page, "after Next")
    page.go_back()
    page.wait_for_url(re.compile(re.escape(start) + "$"), timeout=8000)
    page.wait_for_timeout(1200)
    if _path(page) != start:
        raise RuntimeError(f"one Back from the session went on to {_path(page)}, not {start}")
    if _line(page) is not None:
        raise RuntimeError("the session line is still shown after Back")


def _to_last(page):
    """Skip until the open one is the session's last (its line reads n of n)."""
    for _ in range(60):
        line = _line(page) or ""
        m = re.match(r"^Session · (\d+) of (\d+)", line)
        if not m:
            raise RuntimeError(f"no session line ({line!r}) at {page.url}")
        if m.group(1) == m.group(2):
            return
        _skip_pane(page)
    raise RuntimeError("never reached the last one")


def _session_done(page):
    """The last one logged: the Session done card at the top of the form, Finish pinned."""
    page.wait_for_url(re.compile(r"/exercises/\d+$"), timeout=8000)
    _settle(page)
    _desk_start(page)
    page.wait_for_url(re.compile(r"\?session=1$"), timeout=8000)
    _settle(page)
    _to_last(page)
    _log_pane(page)
    section = page.locator('section[aria-label="Log a set"]')
    if section.locator('[role="status"]', has_text="Session done").count() != 1:
        raise RuntimeError("no Session done card in the form's column")
    if not _pinned(page).get_by_role("button", name="Finish", exact=True).count():
        raise RuntimeError("no Finish pinned")
    _one_form_no_popup(page, "at Session done")


def _session_finish(page):
    """Finish lands on Today, which opens the next one (or the day so far); one Back leaves Today."""
    page.wait_for_url(re.compile(r"/exercises/\d+$"), timeout=8000)
    _settle(page)
    before = _path(page)
    _session_done(page)
    _pinned(page).get_by_role("button", name="Finish", exact=True).click()
    page.wait_for_url(lambda u: "session=1" not in u, timeout=8000)
    page.wait_for_timeout(1500)
    _settle(page)
    if _line(page) is not None:
        raise RuntimeError("the session line is still shown after Finish")
    _no_popup(page, "after Finish")
    page.go_back()
    page.wait_for_timeout(1500)
    if _path(page) != before:
        raise RuntimeError(f"one Back after Finish went to {_path(page)}, not {before}")


def _session_reload(page):
    """Review Focus 2: log one, Next, reload: Resume in the hero, Session · 1 of {remaining}, Skip
    and Log set still work, one set per Log set."""
    page.wait_for_url(re.compile(r"/exercises/\d+$"), timeout=8000)
    _settle(page)
    _desk_start(page)
    page.wait_for_url(re.compile(r"\?session=1$"), timeout=8000)
    _settle(page)
    sets = _sets(page)
    n = _want_line(page, 1, where="after Start")
    _log_pane(page)
    at = _path(page)
    _pinned(page).get_by_role("button", name=re.compile(r"^Next: ")).click()
    page.wait_for_url(lambda u: not u.endswith(at), timeout=8000)
    _settle(page)
    at = _path(page)
    page.reload(wait_until="networkidle")
    page.wait_for_timeout(800)
    if _path(page) != at:
        raise RuntimeError(f"the reload moved to {_path(page)}")
    if not page.locator('[data-list-column] button:visible', has_text="Resume session").count():
        raise RuntimeError("no Resume session in the hero after the reload")
    _want_line(page, 1, n - 1, where="after the reload")
    _one_form_no_popup(page, "after the reload")
    _skip_pane(page)
    _want_line(page, 2, n - 1, where="Skip after the reload")
    _log_pane(page)
    _want_line(page, 2, n - 1, logged=1, where="Log set after the reload")
    if _sets(page) != sets + 2:
        raise RuntimeError(f"two Log sets made {_sets(page) - sets} sets")


def _session_narrow(page):
    """Never two log forms: a desk session has the pane's alone; narrowed, the phone's popup takes
    the open exercise (Skip with it); widened again, the pane, at the same URL."""
    page.wait_for_url(re.compile(r"/exercises/\d+$"), timeout=8000)
    _settle(page)
    _desk_start(page)
    page.wait_for_url(re.compile(r"\?session=1$"), timeout=8000)
    _settle(page)
    at = _path(page)
    _one_form_no_popup(page, "a desk session")
    page.set_viewport_size({"width": 800, "height": 900})
    page.wait_for_timeout(800)
    if _forms(page) != 1:
        raise RuntimeError(f"narrowed: {_forms(page)} log forms, not 1")
    popup = page.locator("dialog[open]")
    if popup.count() != 1 or not popup.locator('form[id^="log-"]').count():
        raise RuntimeError("narrowed: the log form is not the phone's popup")
    if not popup.get_by_role("button", name=re.compile(r"^Skip")).count():
        raise RuntimeError("narrowed: the popup has no Skip")
    page.set_viewport_size({"width": 1440, "height": 900})
    page.wait_for_timeout(1200)
    _one_form_no_popup(page, "widened again")
    if _path(page) != at:
        raise RuntimeError(f"widened: the URL is {_path(page)}, not {at}")


def _next_push(page):
    """Outside a session: Log set, then Logged stays with Next: <first due> beside it; Next is a push
    to it (Back returns)."""
    _settle(page)
    at = _path(page)
    _log_pane(page)
    pinned = _pinned(page)
    page.wait_for_timeout(3000)  # Logged would have faded by now without a Next
    if not pinned.get_by_role("button", name="Logged").count():
        raise RuntimeError("Logged did not stay")
    nxt = pinned.get_by_role("button", name=re.compile(r"^Next: "))
    if not nxt.count():
        raise RuntimeError("no Next: after Log set")
    name = nxt.inner_text().strip()[len("Next: "):]
    want = _first_due_href(page)
    length = page.evaluate("history.length")
    nxt.click()
    page.wait_for_url(re.compile(re.escape(want) + "$"), timeout=8000)
    _settle(page)
    if page.evaluate("history.length") != length + 1:
        raise RuntimeError("Next was not a push")
    if not page.get_by_role("heading", name=name).count():
        raise RuntimeError(f"Next named {name!r}, the pane shows another")
    page.go_back()
    page.wait_for_url(re.compile(re.escape(at) + "$"), timeout=8000)
    _settle(page)


SCENES.update({
    "pane-session-walk": Scene("/{dance}", _session_walk, desk=True),
    "pane-session-done": Scene("/{dance}", _session_done, desk=True),
    "pane-session-finish": Scene("/{dance}", _session_finish, desk=True),
    "pane-session-reload": Scene("/{dance}", _session_reload, desk=True),
    "pane-session-narrow": Scene("/{dance}", _session_narrow, desk=True),
    "pane-next": Scene("/{dance}/exercises/{drillex}", _next_push, desk=True),
})


def _session_logged(page):
    """Board today--a-logged: a session, the first one logged (Logged + Next:, the line counts it)."""
    page.wait_for_url(re.compile(r"/exercises/\d+$"), timeout=8000)
    _settle(page)
    _desk_start(page)
    page.wait_for_url(re.compile(r"\?session=1$"), timeout=8000)
    _settle(page)
    _log_pane(page)
    _want_line(page, 1, logged=1, where="after Log set")


SCENES.update({
    "pane-session-logged": Scene("/{dance}", _session_logged, desk=True),
})
