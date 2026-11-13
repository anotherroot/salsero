"""Hearing rounds (spec 2026-11-10-hearing-drills-design.md, phases 1 and 1b): the listening page's
setup with the clave card, the tap delay check, a dropped-in drop being tapped, a spot starting over,
Skip, a drop's colours, result B, a replay, and a tap-along round's result. Shot on a db copy whose song
{listensong} has a count a person set (anchors) and a long enough audio file; set one in the copy
first (README "Scenes"). The taps come from the rig's clock, so the scores are whatever they are."""
from scenes import Scene

LISTEN = "/{dance}/songs/{listensong}/listen"


def placeholders(db, admin, dance):
    # A ready song with audio the admin reaches whose count a person set: their own or a shared group song.
    row = db.execute(
        "select s.id from songs s where s.dance = ? and s.status = 'ready' and s.audio_file is not null"
        " and s.archived_at is null and s.anchors_json != '[]'"
        " and (s.user_id = ? or s.team_id in (select team_id from team_members where user_id = ?))"
        " order by length(s.sections_json) desc, s.id limit 1",
        (dance, admin, admin),
    ).fetchone()
    return {"listensong": row[0] if row else None}


def _ready(page):
    page.evaluate("localStorage.setItem('hearing.tapDelayMs', '70')")
    page.reload()
    # 70 ms shows only once the page runs (read in onMount): a click before it is lost.
    page.wait_for_selector("text=70 ms")


def _pick(page, *chips):
    for chip in chips:
        page.get_by_text(chip, exact=True).first.click()


def _start(page):
    page.get_by_role("button", name="Start").click()
    page.get_by_text("anywhere here", exact=True).first.wait_for(timeout=10000)
    page.wait_for_timeout(300)


def _pad(page):
    return page.get_by_role("button").filter(has=page.get_by_text("anywhere here", exact=True)).first


def _taps(page, n, gap=500):
    pad = _pad(page)
    for _ in range(n):
        pad.dispatch_event("pointerdown")
        page.wait_for_timeout(gap)


def _setup_clave(page):
    _ready(page)
    _pick(page, "Dropped in", "The clave")
    page.get_by_text("2-3 clave: two hits, then three", exact=True).wait_for()


def _drop_tapping(page):
    _setup_clave(page)
    _start(page)
    _taps(page, 3, 450)


def _restart(page):
    _ready(page)
    _pick(page, "Dropped in", "The 1")
    _start(page)
    page.get_by_text("No tap in four eights: from the start of the spot again", exact=True).wait_for(timeout=30000)
    page.wait_for_timeout(1500)
    # One start-over is one: Skip waits for the third (a paused player once kept restarting every frame).
    if page.get_by_role("button", name="Skip").count():
        raise AssertionError("Skip after a single start-over")


def _skip(page):
    _ready(page)
    _pick(page, "Dropped in", "The 1")
    _start(page)
    for _ in range(3):
        page.locator("button", has_text="↺").first.click()
        page.wait_for_timeout(700)
    page.get_by_role("button", name="Skip").wait_for()
    page.wait_for_timeout(500)


def _reveal(page):
    _ready(page)
    _pick(page, "Dropped in", "The 1")
    _start(page)
    _taps(page, 1)
    page.get_by_text("next spot coming", exact=True).wait_for(timeout=20000)
    page.wait_for_timeout(400)


def _result(page):
    _reveal(page)
    page.wait_for_selector("text=Drop 2 of", timeout=10000)
    page.get_by_role("button", name="Stop").click()
    page.wait_for_selector("text=Score")


def _replay(page):
    _result(page)
    page.get_by_role("button", name="Replay drop 1").click()
    page.get_by_text("The count is on", exact=True).wait_for()
    page.wait_for_timeout(1200)


def _result_tap(page):
    _ready(page)
    _pick(page, "Tap along", "Every beat", "Verse")
    _start(page)
    _taps(page, 14, 480)
    page.get_by_role("button", name="Stop").click()
    page.wait_for_selector("text=Score")


# ---- phase 2: a hearing drill (Run these last or alone: they add an exercise to the copy.) ----

def _new_sheet(page):
    page.get_by_role("radio", name="Hearing").wait_for()
    page.get_by_label("Name").fill("Kje je ena?")
    page.wait_for_timeout(400)


def _make_drill(page):
    """A hearing drill of the listening song, made through Today's sheet as Naredi vajo opens it."""
    page.get_by_role("radio", name="Hearing").wait_for()
    page.get_by_label("Name").fill("Kje je ena?")
    page.get_by_text("5 spots", exact=True).click()
    page.get_by_role("button", name="Add exercise").click()
    page.get_by_text("You listen", exact=True).wait_for(timeout=15000)
    page.wait_for_timeout(400)


def _drill_done(page):
    _make_drill(page)
    page.evaluate("localStorage.setItem('hearing.tapDelayMs', '70')")
    page.get_by_role("link", name="Start").click()
    page.get_by_role("button", name="Start").click()
    page.get_by_text("anywhere here", exact=True).first.wait_for(timeout=10000)
    page.wait_for_timeout(300)
    _taps(page, 1)
    page.get_by_text("next spot coming", exact=True).wait_for(timeout=20000)
    page.wait_for_selector("text=Drop 2 of", timeout=10000)
    page.get_by_role("button", name="Stop").click()
    page.wait_for_selector("text=Score")
    page.get_by_role("button", name="Done").click()
    page.get_by_text("suggests", exact=False).first.wait_for(timeout=10000)
    page.wait_for_timeout(600)


def _change_start(page):
    """Change → another target → Start with these: the round opens, no unsaved-changes dialog (review)."""
    _make_drill(page)
    page.get_by_role("button", name="Change").click()
    page.get_by_text("Every beat", exact=True).click()
    page.get_by_role("link", name="Start with these").click()
    page.wait_for_url("**/hearing/**target=every**", timeout=10000)
    page.get_by_role("button", name="Start").wait_for(timeout=10000)
    page.wait_for_timeout(400)


SCENES = {
    "listen-setup-clave": Scene(LISTEN, _setup_clave),
    "listen-drop-tapping": Scene(LISTEN, _drop_tapping),
    "listen-restart": Scene(LISTEN, _restart),
    "listen-skip": Scene(LISTEN, _skip),
    "listen-reveal": Scene(LISTEN, _reveal),
    "listen-result": Scene(LISTEN, _result),
    "listen-replay": Scene(LISTEN, _replay),
    "listen-result-tap": Scene(LISTEN, _result_tap),
    "hearing-new": Scene("/{dance}?new=hearing&song={listensong}", _new_sheet),
    "hearing-page": Scene("/{dance}?new=hearing&song={listensong}", _make_drill),
    "hearing-done": Scene("/{dance}?new=hearing&song={listensong}", _drill_done),
    "hearing-change-start": Scene("/{dance}?new=hearing&song={listensong}", _change_start),
}
