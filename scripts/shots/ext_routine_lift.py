"""The routine-lift scenes (spec 2026-11-11, routine lift): an open slot (T3) and the long-press
selection (S6–S8) on the admin's routine "Dolga" (seed-class.ts: six slots). Every act that opens,
closes or selects checks the card under the finger did not move on screen ("Nothing jumps"), and
fails the scene when it did — unless the page was already scrolled as far as it goes.

    scripts/shots/shots.sh <seeded db> <out> 390x844 --pages /dev/null --level all --locale sl \\
        --scenes lift-open,lift-open-switch,lift-press,lift-run,lift-run-seam,lift-apart,lift-select-empty,lift-press-bottom
"""
import re

from scenes import Scene

PATH = "/salsa/routines/{dolga}"


def placeholders(db, admin, dance):
    row = db.execute(
        "select id from routines where user_id = ? and dance = ? and name = 'Dolga' and archived_at is null "
        "order by id limit 1",
        (admin, dance),
    ).fetchone()
    return {"dolga": row[0] if row else None}


def _card(p, n):
    """Slot n's tap target (1-based)."""
    return p.locator("[data-slot]").nth(n - 1).locator("[role=button]").first


def _at_edge(p):
    """Scrolled as far as it goes, up or down: the page cannot make up a move past it."""
    return p.evaluate(
        "window.scrollY <= 0 || Math.ceil(window.scrollY + innerHeight) >= document.documentElement.scrollHeight"
    )


def _still(p, n, act):
    """Runs `act` on slot n and fails if its card moved on screen by more than a pixel."""
    card = _card(p, n)
    card.evaluate("e => e.scrollIntoView({ block: 'center' })")
    p.wait_for_timeout(150)
    before = card.bounding_box()["y"]
    act(card)
    p.wait_for_timeout(450)
    after = card.bounding_box()["y"]
    if abs(after - before) > 1 and not _at_edge(p):
        raise AssertionError(f"slot {n} jumped {after - before:+.1f}px")


def _tap(card):
    card.click()


def _press(card):
    box = card.bounding_box()
    page = card.page
    page.mouse.move(box["x"] + box["width"] / 2, box["y"] + box["height"] / 2)
    page.mouse.down()
    page.wait_for_timeout(700)
    page.mouse.up()


def _open(p):
    _still(p, 3, _tap)


def _open_switch(p):
    _card(p, 2).click()
    p.wait_for_timeout(300)
    _still(p, 4, _tap)


def _select(p):
    _still(p, 3, _press)


def _run(p):
    _still(p, 3, _press)
    _still(p, 4, _tap)


def _run_seam(p):
    # The first slot with a seam under it, and the one after it.
    rows = p.locator("[data-slot]")
    first = next((i for i in range(rows.count()) if rows.nth(i).locator(".border-warn").count()), None)
    if first is None or first + 2 > rows.count():
        return
    _still(p, first + 1, _press)
    _still(p, first + 2, _tap)


def _apart(p):
    _still(p, 2, _press)
    _still(p, 5, _tap)


def _empty(p):
    # The band's buttons move with its scroll-linked fold: Playwright never finds them stable.
    p.locator('[data-focus="item-menu"]:visible').first.evaluate("e => e.click()")
    p.wait_for_timeout(400)
    # Both languages: the word map would name the sheet's title (Izberite mesta), not the item.
    p.get_by_text(re.compile(r"^(Select slots|Izberi mesta)$")).first.click()
    p.wait_for_timeout(500)
    p.get_by_role("button", name="Add above").evaluate("e => e.click()")
    p.wait_for_timeout(300)


def _bottom(p):
    p.evaluate("window.scrollTo(0, document.documentElement.scrollHeight)")
    p.wait_for_timeout(300)
    _still(p, p.locator("[data-slot]").count(), _press)


SCENES = {
    "lift-open": Scene(PATH, act=_open),
    "lift-open-switch": Scene(PATH, act=_open_switch),
    "lift-press": Scene(PATH, act=_select),
    "lift-run": Scene(PATH, act=_run),
    "lift-run-seam": Scene(PATH, act=_run_seam),
    "lift-apart": Scene(PATH, act=_apart),
    "lift-select-empty": Scene(PATH, act=_empty),
    "lift-press-bottom": Scene(PATH, act=_bottom),
}
