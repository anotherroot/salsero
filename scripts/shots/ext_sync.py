"""Scenes for keeping copies in step (spec 2026-11-07, "The look"): on `{mergefig}` (ext_merge.py's
placeholder), the notice under the version row, the Sync sheet, and Keep in step's level over the
Versions list. Make the copies differ in the db copy first (the brief's recipe: notes appended on
the admin's own figure, `length_counts = 16` on one group copy), or there is no notice to shoot."""
from scenes import Scene


def _sheet_up(p):
    p.wait_for_selector("dialog[open]")
    # The Sync sheet fetches its rows when it opens: wait for the spinner to go.
    p.wait_for_timeout(1500)


def _notice(p):
    p.get_by_role("region", name="Your copies don’t agree").wait_for()
    p.wait_for_timeout(300)


def _sync(p):
    _notice(p)
    p.get_by_role("region", name="Your copies don’t agree").get_by_role("button", name="Sync").click()
    _sheet_up(p)


def _sync_end(p):
    _sync(p)
    # The sheet's body scrolls: show its end, Sync to above the button.
    p.locator("dialog[open]").evaluate(
        "d => d.querySelectorAll('*').forEach(e => { if (e.scrollHeight > e.clientHeight + 4) e.scrollTop = e.scrollHeight })"
    )
    p.wait_for_timeout(300)


def _keep(p):
    p.get_by_role("button", name="Your version").first.click()
    p.wait_for_selector("dialog[open]")
    p.wait_for_timeout(400)
    p.locator("dialog[open]").get_by_role("button", name="Keeps in step").click()
    p.wait_for_timeout(600)


def _sync_done(p):
    # Press Sync: the sheet closes and the page refreshes (what is left is what was not ticked).
    _sync(p)
    p.locator("dialog[open]").get_by_role("button", name="Sync 3 copies").click()
    p.wait_for_selector("dialog[open]", state="detached")
    p.wait_for_timeout(1500)


def _keep_toggled(p):
    # Turn Sections and points on, then Back: the line under the list follows.
    _keep(p)
    p.locator("dialog[open]").last.get_by_role("switch", name="Sections and points").click(force=True)
    p.wait_for_timeout(800)
    p.keyboard.press("Escape")
    p.wait_for_timeout(1500)


def _versions(p):
    p.get_by_role("button", name="Your version").first.click()
    p.wait_for_timeout(500)


SCENES = {
    "sync-notice": Scene("/{dance}/figures/{mergefig}", act=_notice),
    "sync-sheet": Scene("/{dance}/figures/{mergefig}", act=_sync),
    "sync-sheet-end": Scene("/{dance}/figures/{mergefig}", act=_sync_end),
    # Not shot for the look: these press the buttons, so run them alone, each on a fresh db copy.
    "sync-done": Scene("/{dance}/figures/{mergefig}", act=_sync_done),
    "sync-keep-toggled": Scene("/{dance}/figures/{mergefig}", act=_keep_toggled),
    "sync-versions": Scene("/{dance}/figures/{mergefig}", act=_versions),
    "sync-keep": Scene("/{dance}/figures/{mergefig}", act=_keep),
}
