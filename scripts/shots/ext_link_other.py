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


def _card_copied(page):
    _figures_card(page)
    page.get_by_role("button", name="Copy and link").click()
    page.wait_for_timeout(2500)


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
    "lo-copied": Scene("/{dance}/lessons/38", _card_copied),
    "lo-popup": Scene("/{dance}/lessons/38", _popup),
    "lo-popup-cradle": Scene("/{dance}/lessons/38", _popup_cradle),
}


def _drag(page, x, y0, y1, steps=12):
    """A finger drag (CDP touch events; shoot with SHOTS_TOUCH=1)."""
    cdp = page.context.new_cdp_session(page)
    cdp.send("Input.dispatchTouchEvent", {"type": "touchStart", "touchPoints": [{"x": x, "y": y0}]})
    for i in range(1, steps + 1):
        y = y0 + (y1 - y0) * i / steps
        cdp.send("Input.dispatchTouchEvent", {"type": "touchMove", "touchPoints": [{"x": x, "y": y}]})
        page.wait_for_timeout(16)
    cdp.send("Input.dispatchTouchEvent", {"type": "touchEnd", "touchPoints": []})
    page.wait_for_timeout(600)


def _only_list_scrolls(page):
    """Check: a finger drag on a picker scrolls its list; the sheet body (the search) stays put.
    Prints PASS or FAIL. Lesson 37 is Sreda 17:30's, whose list is long enough to scroll."""
    _figures(page)
    page.wait_for_timeout(700)
    _drag(page, 195, 700, 350)
    got = page.evaluate("""() => {
        const list = [...document.querySelectorAll('.overscroll-contain')].at(-1);
        return { list: list.scrollTop, body: list.closest('.body').scrollTop };
    }""")
    print("ONLYLIST", "PASS" if got["list"] > 0 and got["body"] == 0 else "FAIL", got, flush=True)


SCENES["lo-only-list"] = Scene("/{dance}/lessons/37", _only_list_scrolls)
