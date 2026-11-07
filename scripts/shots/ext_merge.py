"""Scenes for the merge sheets (Compare, Send mine) and the two update bubbles. See README "Scenes".

The merge scenes need a figure with a copy in a group that differs from it: `{mergefig}` is the
admin's first live figure with a live group copy (same gene). Make the copies differ in the db
copy before shooting, or the sheets say there is nothing to do. The update bar needs a release
beside the db (`<db>.data/releases/<dance>/current.json` and its APK) newer than the agent below.
"""
from scenes import Scene

APP_UA = "Mozilla/5.0 (Linux; Android 14) SalsaApp/5 ({dance}; direct)"


def _first(db, sql, args=()):
    row = db.execute(sql, args).fetchone()
    return row[0] if row else None


def placeholders(db, admin, dance):
    return {
        "mergefig": _first(
            db,
            "select f.id from figures f join figures g on g.gene_id = f.gene_id and g.id != f.id "
            "where f.user_id = ? and f.dance = ? and f.archived_at is null "
            "and g.team_id is not null and g.archived_at is null order by f.id limit 1",
            (admin, dance),
        ),
    }


def _sheet_up(page):
    page.wait_for_selector("dialog[open]")
    # the comparison is fetched when the sheet opens; wait for the spinner to go
    page.wait_for_timeout(1500)


def _compare(page):
    page.get_by_role("button", name="Compare", exact=True).first.click()
    _sheet_up(page)


def _compare_all_yours(page):
    _compare(page)
    page.locator("dialog[open]").get_by_role("button", name="Yours").first.click()
    page.wait_for_timeout(300)


def _send(page):
    page.get_by_role("button", name="Send mine…").first.click()
    _sheet_up(page)


def _send_rename(page):
    _send(page)
    page.locator("dialog[open]").get_by_role("checkbox", name="Rename their copies").click()
    page.wait_for_timeout(300)


def _app_update(page):
    dance = page.url.split("/")[3]
    page.set_extra_http_headers({"user-agent": APP_UA.format(dance=dance)})
    page.reload()
    page.wait_for_load_state("networkidle")
    page.wait_for_timeout(500)


def _stale(page, words=None):
    # something typed keeps the page from reloading by itself, so the bar shows
    search = page.get_by_role("searchbox").first
    search.fill("Basic")
    page.evaluate(
        "window.dispatchEvent(new CustomEvent('salsa:stale', {detail: {url: location.href}, cancelable: true}))"
    )
    page.wait_for_selector("[role=status] >> text=Reload")
    if words:
        # The dev server never reports a new build (SvelteKit's `updated` is off in dev), so
        # "New version" is shot as the same toast with its own words put in: its title, and the
        # line `reloadWhy` gives for this page (something typed).
        page.evaluate(
            """w => { const b = [...document.querySelectorAll('[role=status]')].find(e => e.textContent.includes('Reload'));
                     const [t, l] = b.querySelectorAll('span.flex-col > span'); t.textContent = w[0]; l.textContent = w[1]; }""",
            words,
        )
    page.wait_for_timeout(300)


SCENES = {
    "merge-compare": Scene("/{dance}/figures/{mergefig}", _compare),
    "merge-compare-all-yours": Scene("/{dance}/figures/{mergefig}", _compare_all_yours),
    "merge-send": Scene("/{dance}/figures/{mergefig}", _send),
    "merge-send-rename": Scene("/{dance}/figures/{mergefig}", _send_rename),
    "update-available": Scene("/{dance}", _app_update),
    "update-reload": Scene("/{dance}/figures", lambda p: _stale(p, ["The app was updated", "Kept so nothing unsaved is lost."])),
    "update-stale": Scene("/{dance}/figures", _stale),
}
