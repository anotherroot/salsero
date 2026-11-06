"""The versions-and-menu plan's scenes (spec 2026-11-06): the Versions list and the ⋯ menu open
on a position with three versions. Shoot with SHOTS_DANCE=bachata against a copy of a production
backup (the admin's "Open, two hands"); see README "Scenes"."""
from scenes import Scene


def _versions(p):
    p.get_by_role("button", name="Your version").first.click()
    p.wait_for_timeout(400)


def _menu(p):
    p.get_by_role("button", name="Position menu").click()
    p.wait_for_timeout(400)


SCENES = {
    "versions-list": Scene("/bachata/positions/11", act=_versions),
    "item-menu": Scene("/bachata/positions/11", act=_menu),
}
