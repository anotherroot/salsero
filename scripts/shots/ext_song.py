"""The song page's Edit (spec 2026-11-08): the Grid and Song tabs, the beat menu, the section
sheet. Shot on a db copy whose song {songedit} has beats, 1s and sections (set them in the copy
first, see README "Scenes"). See README "Scenes"."""
from scenes import Scene

SONG = "/{dance}/songs/{songedit}"


def placeholders(db, admin, dance):
    # The admin's ready song with the most sections, then the most 1s.
    row = db.execute(
        "select id from songs where user_id = ? and dance = ? and status = 'ready' and archived_at is null"
        " order by length(sections_json) desc, length(anchors_json) desc, id limit 1",
        (admin, dance),
    ).fetchone()
    return {"songedit": row[0] if row else None}


def _edit(page):
    page.get_by_role("button", name="Edit the song").first.click()
    page.wait_for_selector("text=Editing · saves as you go")


def _song_tab(page):
    _edit(page)
    page.get_by_text("Song", exact=True).last.click()
    page.wait_for_selector("text=Music starts")


def _tempo_ask(page):
    _song_tab(page)
    page.get_by_text("×2", exact=True).click()
    page.wait_for_selector("text=Change count speed?")


def _grid(page):
    _edit(page)
    page.locator("[data-beat]").nth(60).click()
    page.wait_for_timeout(400)


def _before(page):
    _edit(page)
    page.get_by_role("button", name="Before the music").click()
    page.wait_for_timeout(200)


SCENES = {
    "song-edit-song": Scene(SONG, _song_tab),
    "song-tempo-ask": Scene(SONG, _tempo_ask),
    "song-edit-grid": Scene(SONG, _grid),
    "song-edit-before": Scene(SONG, _before),
}
