"""Send feedback: the row on You, its sheet, the toast, and what the admin page shows after.
Each scene goes Moves → You by the tab bar, so the message carries a page before You. See README "Scenes"."""
from scenes import Scene

MESSAGE = "I tapped Done on the exercise and the page went blank."


def _to_sheet(page):
    page.locator("nav a[href$=\"/groups\"]:visible").first.click()
    page.wait_for_url("**/groups")
    page.get_by_role("button", name="Send feedback").first.click()
    page.get_by_label("Your message").fill(MESSAGE)
    page.wait_for_timeout(400)


def _send(page):
    _to_sheet(page)
    page.locator("dialog[open]").get_by_role("button", name="Send").click()
    page.wait_for_selector("[role=status] >> text=Thank you! Sent.")
    page.wait_for_timeout(300)


def _admin(page):
    _send(page)
    page.goto(page.url.split("/salsa")[0] + "/admin")
    page.wait_for_selector("text=" + MESSAGE)
    page.wait_for_timeout(300)


SCENES = {
    "feedback-sheet": Scene("/{dance}/figures", _to_sheet),
    "feedback-sent": Scene("/{dance}/figures", _send),
    "feedback-admin": Scene("/{dance}/figures", _admin),
}
