"""Field pickers that search other places too (link from other places, amended 2026-11-12): in a
group, New figure's Move field, a group figure's Starts in and a group routine's slot picker also
find the person's own app and other groups while searching. Shot on the salsa backup of 6 Nov with
`--group 1` (Kubanska Salsa 2: figure 72, routine 15; it has no positions and no Enchufla)."""
import re

from scenes import Scene


def _search(page, text):
    box = page.get_by_role("dialog").last.get_by_role("searchbox").first
    if box.count() == 0:
        box = page.get_by_role("dialog").last.get_by_role("textbox").first
    box.fill(text)
    page.wait_for_timeout(900)


def _move(page):
    page.get_by_role("button", name=re.compile(r"^Move")).first.click()
    page.wait_for_timeout(500)
    _search(page, "enchu")


def _move_picked(page):
    _move(page)
    page.get_by_role("button", name=re.compile(r"^Enchufla")).first.click()
    page.wait_for_timeout(600)


def _starts(page):
    page.get_by_role("button", name=re.compile(r"^Starts in")).first.click()
    page.wait_for_timeout(500)
    _search(page, "setenta")


def _starts_card(page):
    _starts(page)
    page.get_by_role("button", name=re.compile(r"^Setenta")).first.click()
    page.wait_for_timeout(1200)


def _starts_copied(page):
    _starts_card(page)
    page.get_by_role("button", name="Copy and use").click()
    page.wait_for_timeout(2500)


def _slot(page):
    page.get_by_role("button", name=re.compile(r"^Add a (figure|slot)")).first.click()
    page.wait_for_timeout(500)
    _search(page, "enchu")


def _slot_card(page):
    _slot(page)
    page.get_by_role("dialog").last.get_by_role("button", name=re.compile(r"^Basic")).first.click()
    page.wait_for_timeout(1200)


def _slot_copied(page):
    _slot_card(page)
    page.get_by_role("button", name="Copy and use").click()
    page.wait_for_timeout(3000)


SCENES = {
    "po-move": Scene("/{dance}/figures?new=1&in=1", _move),
    "po-move-picked": Scene("/{dance}/figures?new=1&in=1", _move_picked),
    "po-starts": Scene("/{dance}/figures/72?edit=1", _starts),
    "po-starts-card": Scene("/{dance}/figures/72?edit=1", _starts_card),
    "po-starts-copied": Scene("/{dance}/figures/72?edit=1", _starts_copied),
    "po-slot": Scene("/{dance}/routines/15", _slot),
    "po-slot-card": Scene("/{dance}/routines/15", _slot_card),
    "po-slot-copied": Scene("/{dance}/routines/15", _slot_copied),
}
