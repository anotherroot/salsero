"""Link other places' figures: a group lesson's Figures picker and Link popup, searching for a
figure the group lacks. Shot on the bachata backup (group 7, Intenziuci; lessons 38 and 39)."""
import re

from scenes import Scene


def _search(page, text):
    box = page.get_by_role("dialog").get_by_role("searchbox").first
    if box.count() == 0:
        box = page.get_by_role("dialog").get_by_role("textbox").first
    box.fill(text)
    page.wait_for_timeout(400)


def _figures(page):
    page.get_by_role("button", name="Add a figure").first.click()
    page.wait_for_timeout(400)


def _figures_cradle(page):
    _figures(page)
    _search(page, "cradle")


def _figures_card(page):
    _figures_cradle(page)
    page.wait_for_timeout(600)
    page.get_by_role("button", name=re.compile(r"^Cradle entry")).first.click()
    page.wait_for_timeout(900)


def _popup(page):
    page.get_by_role("button", name=re.compile(r"^Link (?!a )")).first.click()
    page.wait_for_timeout(500)


def _popup_cradle(page):
    _popup(page)
    _search(page, "cradle")


SCENES = {
    "lo-figures": Scene("/{dance}/lessons/38", _figures),
    "lo-figures-cradle": Scene("/{dance}/lessons/38", _figures_cradle),
    "lo-card": Scene("/{dance}/lessons/38", _figures_card),
    "lo-popup": Scene("/{dance}/lessons/38", _popup),
    "lo-popup-cradle": Scene("/{dance}/lessons/38", _popup_cradle),
}
