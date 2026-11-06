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
