"""Plan 3 (run the day): the run's scenes. See README "Scenes"."""
import os
import re
from datetime import datetime, timedelta, timezone

from scenes import Scene

SCENES = {}


# ---- Task 7: on the desktop, the exercise Today opens by itself waits for a tap ----

_CLOCK = re.compile(r"\d+:\d\d$")


def _pane_subtitle(page):
    """The pane's band subtitle: the line under the open exercise's title ("Drill · 0:00")."""
    text = page.locator("header h1:visible").first.evaluate(
        "h => [...(h.closest('[data-band-title]')?.querySelectorAll(':scope > span') ?? [])]"
        ".filter(s => s.offsetParent !== null).map(s => s.textContent.trim()).pop() ?? null"
    )
    if not text or not _CLOCK.search(text):
        raise RuntimeError(f"no clock in the pane's band subtitle ({text!r})")
    return text


def _later(page, seconds):
    """The rig's browser clock is fixed (instant.txt): move it on, as the wall clock would."""
    now = page.evaluate("Date.now()")
    page.clock.set_fixed_time(datetime.fromtimestamp(now / 1000, tz=timezone.utc) + timedelta(seconds=seconds))


def _auto_idle(page):
    """/{dance} at 1440: Today opens the first due exercise by itself, and its clock waits at 0:00;
    a tap in the pane (its title) starts it."""
    page.wait_for_url(re.compile(r"/exercises/\d+$"), timeout=30000)
    page.wait_for_load_state("networkidle")
    page.wait_for_timeout(3000)
    _later(page, 5)
    page.wait_for_timeout(1500)
    sub = _pane_subtitle(page)
    if not sub.endswith("0:00"):
        raise RuntimeError(f"the exercise Today opened by itself counts before a tap: {sub!r}")
    page.locator("header h1:visible").first.click()
    _later(page, 5)
    page.wait_for_timeout(2000)
    sub = _pane_subtitle(page)
    if sub.endswith("0:00"):
        raise RuntimeError(f"a tap in the pane did not start the clock: {sub!r}")


SCENES.update({
    "desk-auto-idle": Scene("/{dance}", _auto_idle, desk=True),
})


# ---- Task 8: the run, step by step ----

_PLACE = re.compile(r"(\d+) of (\d+) ·")
FACES = re.compile("Still hard|Getting there|I've got it|Easy")


def _settle(page, ms=500):
    page.wait_for_load_state("networkidle")
    page.wait_for_timeout(ms)


def _prep(page, first="custom", fixed_first=False):
    """In the rig's temp db: two warm-ups (the first of source `first`, else any) and one every-day drill
    (the first warm-up itself when `fixed_first`, else a custom drill that is not a warm-up); reload."""
    import sqlite3
    db = sqlite3.connect(f"{os.environ['SHOTS_TMP']}/salsa.db")
    try:
        admin = db.execute("select user_id from sessions where id = 'shots'").fetchone()[0]
        dance = page.url.split("/")[3]
        left = (
            "select e.id from exercises e where e.user_id = ? and e.dance = ? and e.active = 1 "
            "and e.archived_at is null and e.source = ? and not exists (select 1 from sets s "
            "where s.exercise_id = e.id and s.done_at >= ?) order by e.id"
        )
        # the rig's day: instant.txt in UTC (the copy's admin zone is read by the app; the fixed clock is UTC)
        with open(os.path.join(os.path.dirname(os.path.abspath(__file__)), "instant.txt")) as fh:
            now = datetime.strptime(fh.read().strip(), "%Y-%m-%d %H:%M:%S").replace(tzinfo=timezone.utc)
        start = int(now.replace(hour=0, minute=0, second=0).timestamp() * 1000) - 14 * 3600 * 1000
        # the temp db is shared by the scenes of one run: start each from the same day
        ms = int(now.timestamp() * 1000)
        db.execute("delete from sets where done_at >= ?", (start,))
        db.execute("delete from today_picks where day >= ?", ("2026-11-05",))
        db.execute("update exercises set warmup = 0, comes_back = null where user_id = ? and dance = ?", (admin, dance))
        a = db.execute(left, (admin, dance, first, start)).fetchone()
        customs = [r[0] for r in db.execute(left, (admin, dance, "custom", start)).fetchall()]
        if not a:
            raise RuntimeError(f"no {first} exercise to make a warm-up")
        b = next((c for c in customs if c != a[0]), None)
        if b is None:
            b = db.execute(
                "select e.id from exercises e where e.user_id = ? and e.dance = ? and e.active = 1 "
                "and e.archived_at is null and e.id != ? order by e.id", (admin, dance, a[0])).fetchone()[0]
        db.execute("update exercises set warmup = 1, warmup_order = 0 where id = ?", (a[0],))
        db.execute("update exercises set warmup = 1, warmup_order = 1 where id = ?", (b,))
        every = a[0] if fixed_first else next((c for c in customs if c not in (a[0], b)), None)
        if every is None:
            raise RuntimeError("no drill to set to every day")
        db.execute("update exercises set comes_back = ? where id = ?", ('{"kind":"every","days":1}', every))
        db.commit()
    finally:
        db.close()
    page.reload(wait_until="networkidle")
    return a[0]


def _start(page):
    page.get_by_role("button", name="Start", exact=True).first.click()
    page.wait_for_url(re.compile(r"/exercises/\d+\?run=1(&skip=[\d,]+)?$"), timeout=30000)
    _settle(page)


def _place(page):
    m = _PLACE.search(page.locator("body").inner_text())
    return (int(m.group(1)), int(m.group(2))) if m else None


def _sheet(page):
    page.get_by_role("button", name=re.compile(r"^✓?\s*Done$")).first.click()
    page.get_by_text("How did it go?", exact=True).first.wait_for()
    page.wait_for_timeout(500)
    return page.locator("dialog[open]").first.inner_text()


def _face_and_on(page, face=FACES):
    """A face in the open sheet: the save goes on to the next page. Waits for the sheet to close
    (a click into the closing dialog was the old flake)."""
    before = page.url
    page.locator("dialog[open]").get_by_role("button", name=face).first.click()
    page.wait_for_function("(u) => location.href !== u", arg=before, timeout=30000)
    page.locator("dialog[open]").wait_for(state="detached", timeout=10000)
    _settle(page)


def _skip(page):
    before = page.url
    page.get_by_role("button", name="Skip", exact=True).click()
    page.wait_for_function("(u) => location.href !== u", arg=before, timeout=30000)
    page.locator("dialog[open]").wait_for(state="detached", timeout=10000)
    _settle(page)


def _run_start(page):
    _prep(page)
    _start(page)
    text = page.locator("body").inner_text()
    if not re.search(r"· 1 of \d+ ·", text):
        raise RuntimeError(f"no '1 of N' in the band: {text[:200]!r}")
    if "warm-up" not in text:
        raise RuntimeError("the first page is not a warm-up")


def _run_sheet(page):
    _prep(page)
    _start(page)
    if "Next:" not in _sheet(page):
        raise RuntimeError("the Done sheet has no Next:")


def _run_next(page):
    _prep(page)
    _start(page)
    _sheet(page)
    _face_and_on(page, re.compile("Getting there"))
    page.locator("[role=status]", has_text="Saved · back in").first.wait_for()
    if "run=1" not in page.url or _place(page)[0] != 2:
        raise RuntimeError(f"after a face: {page.url}, place {_place(page)}")


def _run_skip(page):
    _prep(page)
    _start(page)
    _skip(page)
    if "skip=" not in page.url or _place(page)[0] != 2:
        raise RuntimeError(f"after Skip: {page.url}, place {_place(page)}")


def _run_done(page):
    _prep(page)
    _start(page)
    for _ in range(40):
        green = page.get_by_role("button", name=re.compile("Done · next"))
        if green.count():  # a fixed rhythm saves at once and goes on
            before = page.url
            green.first.click()
            page.wait_for_function("(u) => location.href !== u", arg=before, timeout=30000)
            _settle(page)
            if page.url.endswith("/done"):
                break
            continue
        if "Next:" not in _sheet(page):
            page.locator("dialog[open]").get_by_role("button", name=FACES).first.click()
            page.wait_for_url(re.compile(r"/(salsa|bachata)/done$"), timeout=30000)
            page.locator("dialog[open]").wait_for(state="detached", timeout=10000)
            break
        _face_and_on(page)
    else:
        raise RuntimeError("the run never reached its last")
    _settle(page)
    page.get_by_role("heading", name="Done for today").first.wait_for()


def _run_done_next(page):
    """Skip every exercise to Done for today, then Next N: the new run starts at the walk's first
    (the skipped first warm-up), not at the first new pick."""
    first = _prep(page)
    _start(page)
    for _ in range(40):
        if page.url.endswith("/done"):
            break
        _skip(page)
    else:
        raise RuntimeError("Skip never reached Done for today")
    page.get_by_role("heading", name="Done for today").first.wait_for()
    before = page.url
    page.get_by_role("button", name=re.compile(r"^Next \d+$")).click()
    page.wait_for_function("(u) => location.href !== u", arg=before, timeout=30000)
    _settle(page)
    m = re.search(r"/exercises/(\d+)\?run=1$", page.url)
    if not m or int(m.group(1)) != first:
        raise RuntimeError(f"Next N started at {page.url}, not at the walk's first ({first})")


def _run_player_back(page):
    """A run's trip to the player and back is one visit: the band's time goes on, not from 0:00."""
    _prep(page, first="routine")
    _start(page)
    _later(page, 65)
    page.wait_for_timeout(1500)
    before = _pane_subtitle(page)
    print(f"run-player-back: before the player {before!r}", flush=True)
    page.get_by_role("link", name=re.compile("Practise in player")).first.click()
    page.wait_for_url(re.compile(r"/player"), timeout=30000)
    _settle(page, 800)
    _later(page, 10)
    # the band's back (the slim band's copy is inert, so the role query skips it)
    page.get_by_role("link", name=re.compile("^Back to")).click()
    page.wait_for_url(re.compile(r"/exercises/\d+\?run=1"), timeout=30000)
    _settle(page, 1500)
    after = _pane_subtitle(page)
    print(f"run-player-back: back from the player {after!r}", flush=True)
    if after.endswith(("0:00", "0:01", "0:02")):
        raise RuntimeError(f"the time started over after the player: {before!r} -> {after!r}")


def _desk_run(page):
    _prep(page, fixed_first=True)
    _start(page)
    if page.get_by_role("button", name="Skip", exact=True).count() != 1:
        raise RuntimeError("no Skip in the pane")
    page.get_by_role("button", name=re.compile("Done · next")).first.wait_for()


def _desk_detour_idle(page):
    """Desk: Today opens A by itself; a row opens B; B saved with a face steps history back to A,
    which still waits at 0:00 (nobody tapped it)."""
    import sqlite3
    _prep(page)
    db = sqlite3.connect(f"{os.environ['SHOTS_TMP']}/salsa.db")
    try:
        every = {r[0] for r in db.execute("select id from exercises where comes_back is not null")}
    finally:
        db.close()
    dance = page.url.split("/")[3]
    page.goto(page.url.split("/" + dance)[0] + "/" + dance)
    page.wait_for_url(re.compile(r"/exercises/\d+$"), timeout=30000)
    _settle(page, 2000)
    auto = page.url
    auto_id = int(auto.rsplit("/", 1)[1])
    rows = page.locator('a[data-focus^="today-row-"]:visible')
    b = None
    for i in range(rows.count()):
        rid = int(rows.nth(i).get_attribute("data-focus").rsplit("-", 1)[1])
        if rid != auto_id and rid not in every:
            b = rows.nth(i)
            break
    if b is None:
        raise RuntimeError("no other row to open")
    b.click()
    page.wait_for_function("(u) => location.href !== u", arg=auto, timeout=30000)
    _settle(page)
    _sheet(page)
    page.locator("dialog[open]").get_by_role("button", name=FACES).first.click()
    page.wait_for_url(auto, timeout=30000)
    page.locator("dialog[open]").wait_for(state="detached", timeout=10000)
    _settle(page, 1500)
    _later(page, 5)
    page.wait_for_timeout(1500)
    sub = _pane_subtitle(page)
    if not sub.endswith("0:00"):
        raise RuntimeError(f"back on the exercise Today opened by itself, it counts before a tap: {sub!r}")


def _desk_done_start(page):
    """Desk: a run skipped to Done for today, then Start from the hero beside it replaces /done
    (the run stays one history entry)."""
    _prep(page)
    _start(page)
    for _ in range(40):
        if page.url.endswith("/done"):
            break
        _skip(page)
    else:
        raise RuntimeError("Skip never reached Done for today")
    page.get_by_role("heading", name="Done for today").first.wait_for()
    depth = page.evaluate("history.length")
    before = page.url
    page.get_by_role("button", name="Start", exact=True).first.click()
    page.wait_for_function("(u) => location.href !== u", arg=before, timeout=30000)
    _settle(page)
    if "run=1" not in page.url:
        raise RuntimeError(f"Start from Done for today went to {page.url}")
    if page.evaluate("history.length") != depth:
        raise RuntimeError("Start from Done for today pushed a history entry")


def _flat(act):
    """The scene, then: the page does not scroll sideways (390 and 1440 alike)."""
    def run(page):
        act(page)
        over = page.evaluate("() => document.documentElement.scrollWidth - window.innerWidth")
        if over > 0:
            raise RuntimeError(f"OVERFLOW {over}px")
    return run


SCENES.update({
    "run-start": Scene("/{dance}", _flat(_run_start)),
    "run-sheet": Scene("/{dance}", _flat(_run_sheet)),
    "run-next": Scene("/{dance}", _flat(_run_next)),
    "run-skip": Scene("/{dance}", _flat(_run_skip)),
    "run-done": Scene("/{dance}", _flat(_run_done)),
    "run-done-next": Scene("/{dance}", _flat(_run_done_next)),
    "run-player-back": Scene("/{dance}", _flat(_run_player_back)),
    "desk-run": Scene("/{dance}", _flat(_desk_run), desk=True),
    "desk-done-start": Scene("/{dance}", _flat(_desk_done_start), desk=True),
    "desk-detour-idle": Scene("/{dance}", _flat(_desk_detour_idle), desk=True),
})


def _run_figure_player_back(page):
    """A figure in a run: Practise with → the player → Back; the band's time goes on."""
    page.wait_for_load_state("networkidle")
    _start(page)
    _later(page, 65)
    page.wait_for_timeout(1500)
    before = _pane_subtitle(page)
    print(f"run-figure-player-back: before the player {before!r} at {page.url}", flush=True)
    page.get_by_role("link", name=re.compile("Practise with")).first.click()
    page.wait_for_url(re.compile(r"/player"), timeout=30000)
    _settle(page, 800)
    _later(page, 10)
    page.get_by_role("link", name=re.compile("^Back to")).click()
    page.wait_for_url(re.compile(r"/exercises/\d+\?run=1"), timeout=30000)
    _settle(page, 1500)
    after = _pane_subtitle(page)
    print(f"run-figure-player-back: back from the player {after!r} at {page.url}", flush=True)
    if after.endswith(("0:00", "0:01", "0:02")):
        raise RuntimeError(f"the time started over after the player: {before!r} -> {after!r}")


SCENES.update({"run-figure-player-back": Scene("/{dance}", _flat(_run_figure_player_back))})


def _trip(page, how):
    page.wait_for_load_state("networkidle")
    _start(page)
    _later(page, 65)
    page.wait_for_timeout(1500)
    before = _pane_subtitle(page)
    if how == "play":
        page.get_by_role("link", name=re.compile("^Play$")).first.click()
    else:
        page.get_by_role("link", name=re.compile("Practise with")).first.click()
    page.wait_for_url(re.compile(r"/player"), timeout=30000)
    _settle(page, 2000)
    _later(page, 10)
    print(f"trip {how}: in the player {page.url}", flush=True)
    if how in ("history", "play"):
        page.go_back()
    elif how == "full":
        # a new version out: the way back loads the page whole
        page.goto(page.url.replace("/player?exercise=", "/exercises/").split("&")[0] + "?run=1")
    else:
        page.get_by_role("link", name=re.compile("^Back to")).click()
    page.wait_for_url(re.compile(r"/exercises/\d+\?run=1"), timeout=30000)
    _settle(page, 1500)
    after = _pane_subtitle(page)
    print(f"trip {how}: {before!r} -> {after!r}", flush=True)
    if after.endswith(("0:00", "0:01", "0:02")):
        raise RuntimeError(f"the time started over after the player ({how}): {before!r} -> {after!r}")


SCENES.update({
    "run-trip-history": Scene("/{dance}", lambda p: _trip(p, "history")),
    "run-trip-play": Scene("/{dance}", lambda p: _trip(p, "play")),
    "run-trip-full": Scene("/{dance}", lambda p: _trip(p, "full")),
})


def _run_bar(page):
    """The run's first exercise on the phone: Skip as wide as its word, Done · next the rest."""
    page.wait_for_load_state("networkidle")
    _start(page)


SCENES.update({"run-bar": Scene("/{dance}", _flat(_run_bar))})
