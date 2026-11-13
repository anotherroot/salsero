"""Picker preview (design round): today's figure pickers, the "now" beside the board's options.
Salsa: an own lesson's Add a figure, a routine's Add a slot, New figure's Move field. Bachata
(SHOTS_DANCE=bachata): group 7's lesson 38, where rows come from yours and the group's."""
from scenes import Scene


def _lesson(db, admin, dance):
    row = db.execute(
        "select l.id from lessons l where l.user_id = ? and l.dance = ? and l.archived_at is null "
        "and exists (select 1 from lesson_figures f where f.lesson_id = l.id) "
        "order by l.lesson_day desc, l.id desc limit 1",
        (admin, dance),
    ).fetchone()
    return row[0] if row else None


def _routine(db, admin, dance):
    row = db.execute(
        "select id from routines where user_id = ? and dance = ? and archived_at is null "
        "order by id desc limit 1",
        (admin, dance),
    ).fetchone()
    return row[0] if row else None


def placeholders(db, admin, dance):
    return {"pplesson": _lesson(db, admin, dance), "pproutine": _routine(db, admin, dance)}


def _search(page, text):
    box = page.get_by_role("dialog").get_by_role("searchbox").first
    if box.count() == 0:
        box = page.get_by_role("dialog").get_by_role("textbox").first
    box.fill(text)
    page.wait_for_timeout(400)


def _add_figure(page):
    page.get_by_role("button", name="Add a figure").first.click()
    page.wait_for_timeout(600)


def _add_figure_search(page):
    _add_figure(page)
    _search(page, "pa")


def _slot(page):
    page.get_by_role("button", name="Add a slot").first.evaluate("e => e.click()")
    page.wait_for_timeout(700)


def _new_figure(page):
    page.get_by_role("button", name="New figure").first.evaluate("e => e.click()")
    page.wait_for_timeout(600)


def _move_field(page):
    _new_figure(page)
    page.get_by_text("Choose or type a move…").first.click()
    page.wait_for_timeout(600)


SCENES = {
    "pp-lesson": Scene("/{dance}/lessons/{pplesson}", _add_figure),
    "pp-lesson-search": Scene("/{dance}/lessons/{pplesson}", _add_figure_search),
    "pp-slot": Scene("/{dance}/routines/{pproutine}", _slot),
    "pp-new-figure": Scene("/{dance}/figures", _new_figure),
    "pp-move-field": Scene("/{dance}/figures", _move_field),
    "pp-group-lesson": Scene("/{dance}/lessons/38", _add_figure),
}


# After the build: the sheet over the picker (S1), on a copy seeded with loops (see the plan's Task 10).
def _look(page):
    _add_figure(page)
    page.get_by_role("button", name="Preview Pa ti, pa mi · Basic").first.click()
    page.wait_for_timeout(1500)


def _look_short(page):
    _add_figure(page)
    page.get_by_role("button", name="Preview Adios · Con la prima").first.click()
    page.wait_for_timeout(1500)


def _move_look(page):
    _move_field(page)
    page.get_by_role("button", name="Preview Adios").first.click()
    page.wait_for_timeout(1500)


def _slot_look(page):
    _slot(page)
    page.get_by_role("button", name="Preview Enchufla · Basic").first.click()
    page.wait_for_timeout(1500)


SCENES["pp-look"] = Scene("/{dance}/lessons/{pplesson}", _look)
SCENES["pp-look-short"] = Scene("/{dance}/lessons/{pplesson}", _look_short)
SCENES["pp-move-look"] = Scene("/{dance}/figures", _move_look)
SCENES["pp-slot-look"] = Scene("/{dance}/routines/{pproutine}", _slot_look)
