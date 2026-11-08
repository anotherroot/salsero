"""The routine run's scenes (Follow / Still, the full-screen routine), shot with the list showing. See README "Scenes"."""
from scenes import Scene


def _btn(page, name):
    return page.get_by_role("button", name=name, exact=True)


def _running(page):
    _btn(page, "Play").click()
    _btn(page, "Stop").wait_for()
    page.wait_for_timeout(6000)


def _full(page):
    _running(page)
    _btn(page, "Show the routine full screen").click()
    page.get_by_role("dialog", name="Routine").wait_for()
    page.wait_for_timeout(800)


def _full_still(page):
    _full(page)
    page.get_by_role("dialog", name="Routine").get_by_text("Still", exact=True).click()
    page.wait_for_timeout(500)


def _jump(page):
    _full(page)
    # The Still scene leaves this routine on Still (it is remembered per routine).
    page.get_by_role("dialog", name="Routine").get_by_text("Follow", exact=True).click()
    page.get_by_role("dialog", name="Routine").get_by_role("button", name="Start from 5,").click()
    page.wait_for_timeout(1500)


SCENES = {
    "routine-setup": Scene("/{dance}/player?routine={longroutine}"),
    "routine-running": Scene("/{dance}/player?routine={longroutine}", _running),
    "routine-full": Scene("/{dance}/player?routine={longroutine}", _full),
    "routine-full-still": Scene("/{dance}/player?routine={longroutine}", _full_still),
    "routine-jump": Scene("/{dance}/player?routine={longroutine}", _jump),
}


def _full_back(page):
    """Back closes the full-screen routine and leaves the run going: the shot is the run screen."""
    _full(page)
    page.go_back()
    page.get_by_role("dialog", name="Routine").wait_for(state="detached")
    _btn(page, "Stop").wait_for()
    page.wait_for_timeout(500)


SCENES["routine-full-back"] = Scene("/{dance}/player?routine={longroutine}", _full_back)
