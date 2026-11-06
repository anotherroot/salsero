"""Lesson links plan's scenes: the lesson page's "+ Add" sheets. See README "Scenes"."""
from scenes import Scene


def _ownlesson(db, admin, dance):
    row = db.execute(
        "select id from lessons where user_id = ? and dance = ? and archived_at is null "
        "order by lesson_day desc, id desc limit 1",
        (admin, dance),
    ).fetchone()
    return row[0] if row else None


def placeholders(db, admin, dance):
    return {"ownlesson": _ownlesson(db, admin, dance)}


def _add_link(page):
    page.get_by_role("button", name="Add a link").first.click()
    field = page.get_by_label("Link", exact=True)
    field.fill("https://youtu.be/dQw4w9WgXcQ")
    page.wait_for_timeout(400)


def _add_position(page):
    page.get_by_role("button", name="Add a position").first.click()
    page.wait_for_timeout(400)


SCENES = {
    "lesson-add-link": Scene("/{dance}/lessons/{ownlesson}", _add_link),
    "lesson-add-position": Scene("/{dance}/lessons/{ownlesson}", _add_position),
}


def _new_lesson(page):
    page.get_by_role("button", name="New lesson").first.click()
    page.wait_for_timeout(400)


SCENES["share-new-lesson"] = Scene(
    "/{dance}/share?key=00000000-0000-4000-8000-000000000000", _new_lesson
)


def _add_song(page, title, note=None):
    page.get_by_role("button", name="Add a song").first.click()
    page.wait_for_timeout(300)
    page.get_by_role("dialog").get_by_role("button", name=title).first.click()
    page.wait_for_timeout(300)
    if note:
        page.get_by_label("Note").fill(note)
    page.get_by_role("button", name="Add to Music").click()
    page.wait_for_timeout(800)


def _music(page):
    _add_song(page, "Casa Mía", "Slow one — good for the cross-body lead.")
    _add_song(page, "Dale Timbal Live", "Listen for the clave in the bridge, then count it.")
    page.get_by_role("heading", name="Music · 2").scroll_into_view_if_needed()


def _music_sheet(page):
    # After music-lesson: the scenes of one run share the database.
    page.get_by_role("button", name="Casa Mía").first.click()
    page.wait_for_timeout(400)


def _music_note(page):
    page.get_by_role("button", name="Add a song").first.click()
    page.wait_for_timeout(300)
    page.get_by_role("dialog").get_by_role("button", name="Suavemente").first.click()
    page.wait_for_timeout(400)


SCENES["music-lesson"] = Scene("/{dance}/lessons/{ownlesson}", _music)
SCENES["music-lesson-sheet"] = Scene("/{dance}/lessons/{ownlesson}", _music_sheet)
SCENES["music-lesson-note"] = Scene("/{dance}/lessons/{ownlesson}", _music_note)
SCENES["music-routine"] = Scene("/{dance}/routines/{routine}", _music)
SCENES["music-drill"] = Scene("/{dance}/exercises/{drill}", _music)


def _drill(db, admin, dance):
    row = db.execute(
        "select id from exercises where user_id = ? and dance = ? and source = 'custom' "
        "and archived_at is null order by id limit 1",
        (admin, dance),
    ).fetchone()
    return row[0] if row else None


_base_placeholders = placeholders


def placeholders(db, admin, dance):  # noqa: F811
    return {**_base_placeholders(db, admin, dance), "drill": _drill(db, admin, dance)}
