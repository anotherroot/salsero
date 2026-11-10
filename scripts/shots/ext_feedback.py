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


# The Android app's SalsaShot bridge, faked: the page asks with "listen", and
# window.__shoot(url) hands it a screenshot as the app would.
BRIDGE = """
window.SalsaShot = {
  onmessage: null,
  postMessage(m) { if (m === 'listen') window.__listening = true; },
};
window.__shoot = (url) => window.SalsaShot.onmessage && window.SalsaShot.onmessage({ data: url });
"""


def _jpeg(page):
    import base64
    return "data:image/jpeg;base64," + base64.b64encode(page.screenshot(type="jpeg", quality=70)).decode()


def _offer(page):
    page.add_init_script(BRIDGE)
    page.reload()
    page.wait_for_function("window.__listening === true")
    page.evaluate("url => window.__shoot(url)", _jpeg(page))
    page.wait_for_selector("text=Something wrong here?")
    page.wait_for_timeout(500)


def _offer_sheet(page):
    _offer(page)
    page.get_by_role("button", name="Report").click()
    page.get_by_label("Your message").fill("The recording does not play after I scroll")
    page.wait_for_timeout(500)


def _offer_admin(page):
    _offer_sheet(page)
    page.locator("dialog[open]").get_by_role("button", name="Send").click()
    page.wait_for_selector("[role=status] >> text=Thank you! Sent.")
    page.goto(page.url.split("/salsa")[0] + "/admin")
    page.wait_for_selector("img[alt=Screenshot]")
    page.wait_for_timeout(500)


def _picked(page):
    import base64
    data = base64.b64decode(_jpeg(page).split(",", 1)[1])
    _to_sheet(page)
    page.locator("dialog[open] input[type=file]").set_input_files(
        files=[{"name": "shot.jpg", "mimeType": "image/jpeg", "buffer": data}]
    )
    page.wait_for_selector("dialog[open] img")
    page.wait_for_timeout(500)


SCENES.update({
    "feedback-offer": Scene("/{dance}/figures/{figure}", _offer),
    "feedback-offer-sheet": Scene("/{dance}/figures/{figure}", _offer_sheet),
    "feedback-offer-admin": Scene("/{dance}/figures/{figure}", _offer_admin),
    "feedback-picked": Scene("/{dance}/figures", _picked),
    "feedback-empty-tile": Scene("/{dance}/figures", _to_sheet),
})
