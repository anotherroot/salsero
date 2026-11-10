"""Hearing rounds, phase 1 (spec 2026-11-10-hearing-drills-design.md): the listening page's setup,
the tap delay check, a tap-along round and its result, a dropped-in drop. Shot on a db copy whose
song {listensong} has a count a person set (anchors) and audio; set one in the copy first (README
"Scenes"). The rounds tap with the mouse; the clock is the rig's, so scores are whatever they are."""
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


def _skip_check(page):
    page.evaluate("localStorage.setItem('hearing.tapDelayMs', '70')")
    page.reload()
    # 70 ms shows only once the page runs (read in onMount): a click before it is lost.
    page.wait_for_selector("text=70 ms")


def _check(page):
    page.get_by_role("button", name="Check my tap delay").click()
    page.wait_for_selector("text=Your tap delay")


def _round(page, kind):
    _skip_check(page)
    page.get_by_text(kind, exact=True).first.click()
    page.get_by_role("button", name="Start").click()
    page.wait_for_selector("text=anywhere here")


def _tap_along(page):
    _round(page, "Tap along")
    page.wait_for_timeout(1500)
    pad = page.get_by_role("button", name="Tap on the 1")
    for _ in range(4):
        pad.dispatch_event("pointerdown")
        page.wait_for_timeout(500)


def _result(page):
    _skip_check(page)
    page.get_by_text("Every beat", exact=True).click()
    page.get_by_text("Verse", exact=True).click()
    page.get_by_role("button", name="Start").click()
    page.wait_for_selector("text=anywhere here")
    page.wait_for_timeout(1500)
    pad = page.get_by_role("button", name="Tap every beat").first
    for _ in range(12):
        pad.dispatch_event("pointerdown")
        page.wait_for_timeout(480)
    page.get_by_role("button", name="Stop").click()
    page.wait_for_selector("text=How close you were")


def _dropped(page):
    _round(page, "Dropped in")
    page.wait_for_timeout(1500)
    page.get_by_role("button", name="Tap the next 1").dispatch_event("pointerdown")
    page.wait_for_timeout(300)


SCENES = {
    "listen-setup": Scene(LISTEN, _skip_check),
    "listen-check": Scene(LISTEN, _check),
    "listen-run": Scene(LISTEN, _tap_along),
    "listen-result": Scene(LISTEN, _result),
    "listen-drop": Scene(LISTEN, _dropped),
}






