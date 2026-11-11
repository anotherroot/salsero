"""The slot-end scenes (spec 2026-11-11, slot end) on the admin's routine "Dolga" (seed-class.ts:
slot 2 ends in a chosen hold, slot 4's figure has two ends and none chosen). `{dolga}` comes from
ext_routine_lift.py.

    scripts/shots/shots.sh <seeded db> <out> 390x844 --pages /dev/null --level all --locale sl \\
        --scenes end-line,end-open,end-sheet,end-ask
"""
import re

from scenes import Scene

PATH = "/salsa/routines/{dolga}"

# The chips' names for a screen reader, in both languages (the word map would not find them).
CHOSEN = re.compile(r"^(Ends in |Konča v: )")
ASK = re.compile(r"^(Choose where it ends|Izberite, kje konča)$")


def _slot(p, n):
    return p.locator("[data-slot]").nth(n - 1)


def _show(p, n):
    _slot(p, n).evaluate("e => e.scrollIntoView({ block: 'center' })")
    p.wait_for_timeout(300)


def _line(p):
    _show(p, 2)


def _open(p):
    _show(p, 2)
    _slot(p, 2).locator("[role=button] p").first.click()
    p.wait_for_timeout(450)


def _sheet(p):
    _show(p, 2)
    _slot(p, 2).get_by_role("button", name=CHOSEN).first.click()
    p.wait_for_timeout(500)


def _ask(p):
    _show(p, 4)
    _slot(p, 4).get_by_role("button", name=ASK).first.click()
    p.wait_for_timeout(500)


SCENES = {
    "end-line": Scene(PATH, act=_line),
    "end-open": Scene(PATH, act=_open),
    "end-sheet": Scene(PATH, act=_sheet),
    "end-ask": Scene(PATH, act=_ask),
}
