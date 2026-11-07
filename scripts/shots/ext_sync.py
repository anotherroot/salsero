"""Scenes for keeping copies in step (spec 2026-11-07): the figure page's Versions list and Compare
on `{mergefig}` (ext_merge.py's placeholder). Make the copies differ in the db copy first."""
from scenes import Scene


def _versions(p):
    p.get_by_role("button", name="Your version").first.click()
    p.wait_for_timeout(500)


SCENES = {
    "sync-versions": Scene("/{dance}/figures/{mergefig}", act=_versions),
}
