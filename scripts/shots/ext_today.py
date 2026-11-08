"""Today: the exercise page per type, the Done sheet, the toast, a session of pages, and the desk checks of Today's pane. See README "Scenes"."""
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


def _start_session(page):
    page.get_by_role("button", name=re.compile(r"Start session")).first.click()


def _new(page):
    page.get_by_role("button", name=re.compile(r"New exercise")).first.click()


def _edit(page):
    page.get_by_role("button", name="Edit settings").first.click()


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


def _open_group_drill(page):
    """From its lesson (the path's `#open=<id>`), a group's drill with no entry of the admin's."""
    target = page.url.split("#open=", 1)[1]
    page.locator(f'a[href$="/exercises/{target}"]').first.click()
    page.wait_for_url(re.compile(rf"/exercises/{target}$"))
    page.wait_for_load_state("networkidle")
    page.wait_for_timeout(600)
    if _done_button_count(page):
        raise RuntimeError("a Done button on an exercise that cannot be saved")


SCENES = {}


# ---- desk checks (Task 4): a scene that raises is a failure; the shot is incidental ----

def _lit_band(page):
    """The band heading over the row marked open (aria-current) in the list column."""
    return page.locator('[data-list-column] a[aria-current="page"]').evaluate(
        "a => a.closest('section[aria-labelledby]')?.querySelector('h2')?.textContent?.trim() ?? null"
    )


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


# ---- desk checks (Task 5): one always open ----

def _side_today(page):
    page.locator("nav[data-side] a", has_text="Today").first.click()


def _first_due_href(page):
    """The list's first row under Warm-up, Practice or Due (else Not yet due): the one Today opens by itself."""
    for band in ("Warm-up", "Practice", "Due", "Not yet due"):
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
    """Nothing to open, then New exercise → Add exercise: once the sheet's Back has landed, Today
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


def _path(page):
    return "/" + page.url.split("://", 1)[1].split("/", 1)[1]


def _settle(page, ms=500):
    page.wait_for_load_state("networkidle")
    page.wait_for_timeout(ms)


# ---- plan 2: the exercise page per type, the Done sheet, the toast, a session of pages ----

FACES = re.compile("Still hard|Getting there|I've got it|Easy")


def _done_button(page):
    return page.get_by_role("button", name=re.compile(r"^✓?\s*Done( today)?$")).first


def _open_sheet(page):
    _done_button(page).click()
    page.get_by_text("How did it go?", exact=True).first.wait_for()
    page.wait_for_timeout(500)


def _set_comes_back(page, value):
    """Set the open drill's Comes back straight in the rig's temp db, then load the page again."""
    import sqlite3
    ex = int(re.search(r"/exercises/(\d+)", page.url).group(1))
    db = sqlite3.connect(f"{os.environ['SHOTS_TMP']}/salsa.db")
    try:
        db.execute("update exercises set comes_back = ? where id = ?", (value, ex))
        db.commit()
    finally:
        db.close()
    page.reload(wait_until="networkidle")


def _learning_sheet(page):
    _set_comes_back(page, '{"kind":"until","good":3,"since":0}')
    _open_sheet(page)


def _fixed_rhythm(page):
    """A fixed-rhythm drill: Done saves at once, no sheet, and the toast shows."""
    _set_comes_back(page, '{"kind":"every","days":2}')
    _done_button(page).click()
    page.locator("[role=status]", has_text="Saved").first.wait_for()
    if page.locator("dialog[open]").count():
        raise RuntimeError("a fixed-rhythm Done opened a sheet")


def _save_face(page):
    _open_sheet(page)
    page.locator("dialog[open]").get_by_role("button", name=FACES).first.click()
    page.locator("[role=status]", has_text="Saved").first.wait_for()
    _settle(page, 400)


def _done_today(page):
    """After a save, the same exercise's page: the pinned button reads Done today."""
    path = re.search(r"/exercises/\d+", page.url).group(0)
    _save_face(page)
    page.evaluate(
        """(href) => { const a = document.createElement('a'); a.href = href; a.textContent = 'again';
        document.body.append(a); a.click(); }""",
        f"/{page.url.split('/')[3]}{path}",
    )
    page.wait_for_url(re.compile(re.escape(path) + "$"), timeout=8000)
    _settle(page)
    page.get_by_role("button", name=re.compile("Done today")).first.wait_for()


def _past_day_sheet(page):
    """A past day: Forgot to log something, pick the first exercise: the Done sheet with no time."""
    page.locator("#past-forgot").click()
    page.locator("dialog[open]").first.wait_for()
    page.wait_for_timeout(600)
    rows = page.locator("dialog[open] button").filter(has_text=re.compile(r"\w{3}"))
    rows.filter(has_not_text=re.compile("^(Close|Cancel|Back)$")).nth(1).click()
    page.get_by_text("How did it go?", exact=True).first.wait_for()
    page.wait_for_timeout(500)


def _session_pages(page):
    """Start, a face: the next page's URL carries ?session=1."""
    _start_session(page)
    page.wait_for_url(re.compile(r"/exercises/\d+\?.*session=1|/exercises/\d+.*session=1"), timeout=8000)
    _settle(page)
    first = page.url
    _save_face(page)
    page.wait_for_url(lambda u: u != first and "session=1" in u, timeout=8000)
    _settle(page)
    if "/exercises/" not in page.url:
        raise RuntimeError(f"the session went to {page.url}, not a next page")


SCENES.update({
    "today-session": Scene("/{dance}", _start_session),
    "today-new": Scene("/{dance}", _new),
    "exercise-page-figure": Scene("/{dance}/exercises/{figex}"),
    "exercise-page-drill": Scene("/{dance}/exercises/{drillex}"),
    "exercise-page-routine": Scene("/{dance}/exercises/{routineex}"),
    "exercise-page-lesson": Scene("/{dance}/exercises/{lessonex}"),
    "exercise-edit": Scene("/{dance}/exercises/{drillex}", _edit),
    "done-sheet-drill": Scene("/{dance}/exercises/{drillex}", _open_sheet),
    "done-sheet-learning": Scene("/{dance}/exercises/{drillex}", _learning_sheet),
    "done-fixed-rhythm": Scene("/{dance}/exercises/{drillex}", _fixed_rhythm),
    "done-toast": Scene("/{dance}/exercises/{lessonex}", _save_face),
    "done-today": Scene("/{dance}/exercises/{routineex}", _done_today),
    "done-past-day": Scene("/{dance}?day={yesterday}", _past_day_sheet),
    "today-session-pages": Scene("/{dance}", _session_pages),
    # desk only
    "pane-edit": Scene("/{dance}/exercises/{figex}", _edit, desk=True),
    "pane-session": Scene("/{dance}", _start_session, desk=True),
    "pane-group-drill": Scene(
        "/{dance}/lessons/{groupdrilllesson}#open={groupdrill}", _open_group_drill, desk=True
    ),
    "list-new": Scene("/{dance}/exercises/{drillex}", _new, desk=True),
    "list-new-refused": Scene("/{dance}/exercises/{drillex}", _new_refused, desk=True),
    "pane-archive": Scene("/{dance}/exercises/{drillex}", _archive_from_pane, desk=True),
})


def _done_button_count(page):
    return page.get_by_role("button", name=re.compile(r"^✓?\s*Done( today)?$")).count()
