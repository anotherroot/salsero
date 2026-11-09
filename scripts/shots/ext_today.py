"""Today: the exercise page per type, the Done sheet, the toast, the run, and the desk checks of Today's pane. See README "Scenes"."""
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


def _day_start(db, admin):
    """The rig's day (instant.txt) in the admin's zone: its start, epoch ms."""
    with open(os.path.join(os.path.dirname(os.path.abspath(__file__)), "instant.txt")) as fh:
        now = datetime.strptime(fh.read().strip(), "%Y-%m-%d %H:%M:%S").replace(tzinfo=timezone.utc)
    tz = (db.execute("select timezone from users where id = ?", (admin,)).fetchone() or [None])[0]
    try:
        from zoneinfo import ZoneInfo
        local = now.astimezone(ZoneInfo(tz or "UTC"))
    except Exception:  # no tz database: the UTC day
        local = now
    return int(local.replace(hour=0, minute=0, second=0, microsecond=0).timestamp() * 1000)


def _quiet_day(db, admin, dance):
    """1 when Today has nothing to open: every active exercise of the admin has a set on the rig's day
    (instant.txt, in their zone), or none is active. Gates the scenes of the day so far."""
    start = _day_start(db, admin)
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


def _start_run(page):
    """Start (the hero's play): the walk's first page, with ?run=1."""
    page.get_by_role("button", name="Start", exact=True).first.click()
    # Long enough for a cold dev server compiling the exercise route on a busy machine.
    page.wait_for_url(re.compile(r"/exercises/\d+\?run=1$"), timeout=30000)
    _settle(page)


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


# ---- plan 2: the exercise page per type, the Done sheet, the toast, the run ----

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
    """A past day: Add an exercise to this day, pick the first exercise: the Done sheet with no time."""
    page.locator('[data-focus="past-add"]').click()
    page.locator("dialog[open]").first.wait_for()
    page.wait_for_timeout(600)
    rows = page.locator("dialog[open] button").filter(has_text=re.compile(r"\w{3}"))
    rows.filter(has_not_text=re.compile("^(Close|Cancel|Back)$")).nth(1).click()
    page.get_by_text("How did it go?", exact=True).first.wait_for()
    page.wait_for_timeout(500)


def _warm_up_last(page):
    """Make the admin's last exercise not done on the rig's day a warm-up, in the rig's temp db; reload.
    Returns its id: the run walks the warm-ups first, so Start opens it."""
    import sqlite3
    db = sqlite3.connect(f"{os.environ['SHOTS_TMP']}/salsa.db")
    try:
        admin = db.execute("select user_id from sessions where id = 'shots'").fetchone()[0]
        dance = page.url.split("/")[3]
        start = _day_start(db, admin)
        row = db.execute(
            "select e.id from exercises e where e.user_id = ? and e.dance = ? and e.active = 1 "
            "and e.archived_at is null and not exists (select 1 from sets s where s.exercise_id = e.id "
            "and s.done_at >= ?) order by e.id desc limit 1",
            (admin, dance, start),
        ).fetchone()
        if not row:
            raise RuntimeError("no exercise to make a warm-up")
        db.execute("update exercises set warmup = 1, warmup_order = 0 where id = ?", (row[0],))
        db.commit()
    finally:
        db.close()
    page.reload(wait_until="networkidle")
    return row[0]


def _run_back(page):
    """Start opens the first warm-up's page with ?run=1; one Back returns to Today."""
    warm = _warm_up_last(page)
    today = page.url
    _start_run(page)
    if not re.search(rf"/exercises/{warm}\?run=1$", page.url):
        raise RuntimeError(f"Start opened {page.url}, not the warm-up {warm}")
    page.go_back()
    page.wait_for_url(today, timeout=8000)
    _settle(page)


SCENES.update({
    "today-run": Scene("/{dance}", _start_run),
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
    "today-run-back": Scene("/{dance}", _run_back),
    # desk only
    "pane-edit": Scene("/{dance}/exercises/{figex}", _edit, desk=True),
    "pane-run": Scene("/{dance}", _start_run, desk=True),
    "pane-group-drill": Scene(
        "/{dance}/lessons/{groupdrilllesson}#open={groupdrill}", _open_group_drill, desk=True
    ),
    "list-new": Scene("/{dance}/exercises/{drillex}", _new, desk=True),
    "list-new-refused": Scene("/{dance}/exercises/{drillex}", _new_refused, desk=True),
    "pane-archive": Scene("/{dance}/exercises/{drillex}", _archive_from_pane, desk=True),
})


def _done_button_count(page):
    return page.get_by_role("button", name=re.compile(r"^✓?\s*Done( today)?$")).count()


# ---- restored after plan 2 (their locators followed the app: "Loading…", and no "Done today" section) ----

_HELD = []


def _pane_loading(page):
    """The side's Today with the swapped exercise's data held: the list beside Today's pane skeleton
    (board today--a-loading's pane). The root's pending overlay is hidden: it draws the generic pane
    skeleton over it after 100 ms."""
    _HELD.clear()
    page.route(re.compile(r"/exercises/\d+/__data\.json"), lambda r: _HELD.append(r))
    _side_today(page)
    page.wait_for_url(re.compile(r"/(salsa|bachata)$"), timeout=8000)
    page.wait_for_timeout(800)
    page.add_style_tag(content="body > div > div[aria-busy='true'].fixed, div.fixed[aria-busy='true'] { display: none !important }")
    if not page.locator('section[aria-busy="true"][aria-label^="Loading"]:visible').count():
        raise RuntimeError("no pane skeleton while the exercise loads")


def _release(page):
    """After the shot: answer the held requests, so closing the page cancels no route handler."""
    for r in _HELD:
        r.abort()
    _HELD.clear()


def _add_set_elsewhere(exercise_id):
    """A set logged behind the app's back (another device), at the rig's instant less a minute,
    written straight into the rig's temp copy of the db."""
    import sqlite3
    with open(os.path.join(os.path.dirname(os.path.abspath(__file__)), "instant.txt")) as fh:
        now = datetime.strptime(fh.read().strip(), "%Y-%m-%d %H:%M:%S").replace(tzinfo=timezone.utc)
    at = int(now.timestamp() * 1000) - 60_000
    db = sqlite3.connect(f"{os.environ['SHOTS_TMP']}/salsa.db")
    try:
        db.execute(
            "insert into sets (exercise_id, done_at, duration_s, created_at) values (?, ?, 300, ?)",
            (exercise_id, at, at),
        )
        db.commit()
    finally:
        db.close()


def _back_refetch(page):
    """Phone: open the first row's page, a set of it saved elsewhere meanwhile, Back: the list loads
    again and the row is a done row (its meta in the done tone; done rows sit at the top of Practice)."""
    href = _first_due_href(page)
    if href is None:
        raise RuntimeError("no row to open")
    page.locator(f'[data-list-column] a[href^="{href}"]').first.click()
    page.wait_for_url(re.compile(re.escape(href) + r"(\?.*)?$"), timeout=8000)
    _settle(page)
    _add_set_elsewhere(int(href.rsplit("/", 1)[1]))
    page.go_back()
    page.wait_for_url(re.compile(r"/(salsa|bachata)$"), timeout=8000)
    _settle(page, 800)
    row = page.locator(f'[data-list-column] a[href^="{href}"]')
    if not row.locator("span.text-done").count():
        raise RuntimeError(f"after Back the row {href}, saved elsewhere, is not drawn as done")


SCENES.update({
    "today-pane-loading": Scene("/{dance}/figures", _pane_loading, desk=True, after=_release),
    "today-back-refetch": Scene("/{dance}", _back_refetch),
})


# ---- plan 3 Task 4: the run on the exercise page ----

_PLACE = re.compile(r"(\d+) of (\d+) · \d+:\d\d")


def _place(page):
    """The band's "3 of 7", as (3, 7); None when it shows no place."""
    m = _PLACE.search(page.locator("body").inner_text())
    return (int(m.group(1)), int(m.group(2))) if m else None


def _step_shot(page, name):
    """With SHOTS_STEPS set, a shot of each step of the walk (the scene's own shot is the last)."""
    out = os.environ.get("SHOTS_STEPS")
    if out:
        os.makedirs(out, exist_ok=True)
        page.screenshot(path=os.path.join(out, f"{name}.png"))


def _run_url(page):
    return re.search(r"/exercises/\d+\?run=1(&skip=[\d,]+)?$", page.url) is not None


def _player_links_in_run(page):
    """In a run every link to the player carries the run (from=run), so its Back comes back here."""
    for href in page.locator('a[href*="/player?"]').evaluate_all("as => as.map(a => a.getAttribute('href'))"):
        if "from=run" not in href:
            raise RuntimeError(f"a player link without the run: {href}")


def _moved_on(page, before):
    page.wait_for_function("(u) => location.href !== u", arg=before, timeout=30000)
    _settle(page)


def _run_walk(page):
    """Start, then the run's steps: a warm-up's place, Skip, a fixed rhythm's green Done · next, the
    sheet's Next: (closing it saves nothing and stays), Not today going on, Skip to the last, whose
    face goes to Done for today (/<dance>/done)."""
    _warm_up_last(page)
    _start_run(page)
    place = _place(page)
    if not place or place[0] != 1 or "warm-up · 1 of" not in page.locator("body").inner_text():
        raise RuntimeError(f"the warm-up's band says {place}, not warm-up · 1 of N")
    if page.get_by_role("button", name="Skip", exact=True).count() != 1:
        raise RuntimeError("no Skip beside Done in a run")
    _step_shot(page, "1-warmup")
    # Skip: on to the next, the warm-up in skip=, the place one on.
    before = page.url
    page.get_by_role("button", name="Skip", exact=True).click()
    _moved_on(page, before)
    if not _run_url(page) or "skip=" not in page.url or _place(page) != (2, place[1]):
        raise RuntimeError(f"Skip went to {page.url}, place {_place(page)}")
    _step_shot(page, "2-skipped")
    # A fixed rhythm: the green Done · next saves at once and goes on, the toast on the next page.
    _set_comes_back(page, '{"kind":"every","days":1}')
    green = page.get_by_role("button", name=re.compile(r"Done · next"))
    green.wait_for()
    if "bg-done" not in (green.get_attribute("class") or "").split():
        raise RuntimeError("Done · next is not the done green")
    _step_shot(page, "3-fixed")
    before = page.url
    # Saves once: taps on the old page's Done while the next one loads post nothing.
    posts = []
    page.on("request", lambda r: posts.append(r.url) if r.method == "POST" and "?/done" in r.url else None)
    green.click()
    for _ in range(60):
        if page.url != before:
            break
        try:
            page.locator('[data-focus="exercise-done"]').first.click(force=True, no_wait_after=True, timeout=200)
        except Exception:
            pass
        page.wait_for_timeout(50)
    _moved_on(page, before)
    # A hammered click that landed after the navigation opened the new page's Done sheet: close it.
    page.wait_for_timeout(300)
    if page.locator("dialog[open]").count():
        page.keyboard.press("Escape")
        page.locator("dialog[open]").wait_for(state="detached", timeout=10000)
    if len(posts) != 1:
        raise RuntimeError(f"Done · next posted {len(posts)} saves")
    page.locator("[role=status]", has_text="Saved · back tomorrow").first.wait_for()
    if not _run_url(page) or _place(page) != (3, place[1]):
        raise RuntimeError(f"Done · next went to {page.url}, place {_place(page)}")
    _step_shot(page, "4-after-fixed")
    # The sheet names the next; closing it saves nothing and stays.
    stay = page.url
    _open_sheet(page)
    sheet = page.locator("dialog[open]").first.inner_text()
    _step_shot(page, "5-sheet")
    page.keyboard.press("Escape")
    page.locator("dialog[open]").wait_for(state="detached", timeout=10000)
    page.wait_for_timeout(300)
    _no_popup(page, "after closing the Done sheet")
    if page.url != stay:
        raise RuntimeError(f"closing the sheet left for {page.url}")
    if "Next: " in sheet and page.get_by_role("button", name="Not today").count():
        # Not today goes on too; the layout's Undo toast stays up across the replace.
        before = page.url
        page.get_by_role("button", name="Not today").click()
        _moved_on(page, before)
        toast = page.locator("[role=status]", has_text=re.compile("Not today|Undo")).first
        toast.wait_for()
        if not _run_url(page):
            raise RuntimeError(f"Not today went to {page.url}")
        # Above the pinned bar: its Undo never on the next Done.
        page.wait_for_timeout(400)
        t_box = toast.bounding_box()
        d_box = page.locator('[data-focus="exercise-done"]').first.bounding_box()
        if t_box and d_box and t_box["y"] + t_box["height"] > d_box["y"]:
            raise RuntimeError(f"the Not today toast covers Done: {t_box} over {d_box}")
        _step_shot(page, "6-not-today")
    # Skip on to the last (its sheet has no Next:), then a face: Done for today.
    for _ in range(40):
        _player_links_in_run(page)
        _open_sheet(page)
        if "Next: " not in page.locator("dialog[open]").first.inner_text():
            break
        page.keyboard.press("Escape")
        page.locator("dialog[open]").wait_for(state="detached", timeout=10000)
        before = page.url
        page.get_by_role("button", name="Skip", exact=True).click()
        _moved_on(page, before)
    else:
        raise RuntimeError("the run never reached its last")
    _step_shot(page, "7-last-sheet")
    page.locator("dialog[open]").get_by_role("button", name=FACES).first.click()
    page.wait_for_url(re.compile(r"/(salsa|bachata)/done$"), timeout=30000)
    _settle(page)
    # Done for today: its title, and the last save's toast came along.
    page.get_by_role("heading", name="Done for today").first.wait_for()
    page.locator("[role=status]", has_text="Saved").first.wait_for()
    if page.get_by_role("checkbox").count():
        raise RuntimeError("Done for today has a checkbox")


def _done_back(page):
    """One Back from Done for today lands on Today (the run was one history entry)."""
    page.get_by_role("button", name="Back to Today").last.click()
    page.wait_for_url(re.compile(r"/(salsa|bachata)(/exercises/\d+)?$"), timeout=30000)
    _settle(page)
    if "/done" in page.url or "run=1" in page.url:
        raise RuntimeError(f"Back to Today went to {page.url}")


SCENES.update({
    "today-run-walk": Scene("/{dance}", _run_walk, after=_done_back),
})
