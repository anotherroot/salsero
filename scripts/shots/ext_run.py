"""Plan 3 (run the day): the run's scenes. See README "Scenes"."""
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
