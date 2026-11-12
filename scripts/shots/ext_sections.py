"""Routine sections (spec 2026-11-12): the seeded routine "Gnezdo" (seed-class.ts) holds an
unnamed section at slot 2, and that one another inside it.

    scripts/shots/shots.sh <seeded db> <out> 390x844 --pages /dev/null --level all \\
        --scenes sections-closed,sections-open,sections-tap
"""
from scenes import Scene

PATH = "/salsa/routines/{gnezdo}"


def placeholders(db, admin, dance):
    row = db.execute(
        "select id from routines where user_id = ? and dance = ? and name = 'Gnezdo' and archived_at is null "
        "order by id limit 1",
        (admin, dance),
    ).fetchone()
    out = {"gnezdo": row[0] if row else None}
    step = db.execute(
        "select id, child_routine_id from routine_steps where routine_id = ? and child_routine_id is not null limit 1",
        (out["gnezdo"],),
    ).fetchone() if row else None
    out["gstep"] = step[0] if step else None
    out["gsec"] = step[1] if step else None
    return out


def _closed(p):
    p.wait_for_timeout(300)


def _open(p):
    p.locator("[data-slot] button[aria-expanded]").first.click()
    p.wait_for_timeout(300)
    p.locator("[role=group] button[aria-expanded]").first.click()
    p.wait_for_timeout(300)


def _tap(p):
    _open(p)
    p.locator("[role=group] [role=button]").nth(1).click()
    p.wait_for_timeout(300)


SCENES = {
    "sections-page": Scene("/salsa/routines/{gsec}?from={gstep}", act=_closed),
    "sections-closed": Scene(PATH, act=_closed),
    "sections-open": Scene(PATH, act=_open),
    "sections-tap": Scene(PATH, act=_tap),
}
