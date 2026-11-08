"""Follow my class (the Slovenian plan, 2026-11-07): what a class member sees, in either language.
Shot on a db seeded by `seed.sh` (README "A class"), with `--level follow` and `--locale sl` or `en`.
The locators name both languages, so the same scene runs in each; `pages-follow.txt` uses the
placeholders below. See README "Scenes"."""
import re

from scenes import Scene


def _first(db, sql, args=()):
    row = db.execute(sql, args).fetchone()
    return row[0] if row else None


def placeholders(db, admin, dance):
    member = (
        "select t.id from teams t join team_members m on m.team_id = t.id "
        "where m.user_id = ? and m.role = 'member' and t.dance = ? and t.deleted_at is null"
    )
    lesson = _first(
        db,
        f"select id from lessons where team_id in ({member}) and published_at is not null "
        "and archived_at is null order by lesson_day desc, id desc limit 1",
        (admin, dance),
    )

    def entry(sql):
        return _first(
            db,
            "select e.id from exercises e where e.user_id = ? and e.dance = ? and e.archived_at is null "
            f"and {sql} order by e.id limit 1",
            (admin, dance),
        )

    routine = _first(
        db,
        "select e.id || ':' || e.routine_id from exercises e where e.user_id = ? and e.dance = ? "
        "and e.archived_at is null and e.source = 'routine' and e.routine_id in "
        f"(select id from routines where team_id in ({member})) order by e.id limit 1",
        (admin, dance, admin, dance),
    )
    return {
        # the newest published lesson of a class the admin is a member of
        "classlesson": lesson,
        # the admin's entries: a drill with sets, a drill with a section, the lesson's own, a routine
        "classdrill": entry("e.source = 'added' and exists (select 1 from sets s where s.exercise_id = e.id)"),
        "classsection": entry(
            "e.source = 'added' and e.drill_id in (select exercise_id from spot_links where exercise_id is not null)"
        ),
        "classreview": entry("e.source = 'lesson'"),
        "classroutine": routine.split(":")[0] if routine else None,
        "classroutineid": routine.split(":")[1] if routine else None,
    }


def _name(*words):
    """A role name in either language: `^(en|sl)`."""
    return re.compile("^(" + "|".join(re.escape(w) for w in words) + ")")


def _done_sheet(page):
    # the exercise page's pinned Done opens the sheet: four faces and no note at Follow my class
    page.get_by_role("button", name=_name("Done", "Opravljeno")).first.click()
    page.locator("dialog[open]").first.wait_for()
    page.wait_for_timeout(500)


def _comments(page):
    page.get_by_role("button", name=_name("Comments", "Komentarji")).first.click()
    page.locator("dialog[open]").first.wait_for()
    page.wait_for_timeout(400)


def _video_full(page):
    page.get_by_role("button", name=_name("Full screen", "Čez cel zaslon")).first.click()
    page.wait_for_timeout(800)


def _section(page):
    # the section card on its drill's page: its own looping view
    page.get_by_role("button", name=_name("Obrat")).first.click()
    page.wait_for_timeout(800)


def _btn(page, *words):
    return page.get_by_role("button", name=re.compile("^(" + "|".join(re.escape(w) for w in words) + ")$"))


def _running(page):
    _btn(page, "Play", "Predvajaj").first.click()
    _btn(page, "Stop", "Ustavi").first.wait_for()
    page.wait_for_timeout(2500)


def _save(page):
    _running(page)
    _btn(page, "Stop", "Ustavi").first.click()
    page.locator("dialog[open]").first.wait_for()
    page.wait_for_timeout(400)


def _run_masks(page):
    # what moves with the clock while running (as ext_practice's)
    return [
        page.get_by_role("img", name=_name("Count", "Štetje")),
        page.locator(".run-call"),
        page.locator(".run-head span.tabular-nums"),
        page.locator('[role=slider]'),
    ]


PLAYER = "/{dance}/player?routine={classroutineid}&exercise={classroutine}&from=today"

SCENES = {
    "follow-done-drill": Scene("/{dance}/exercises/{classdrill}", _done_sheet),
    "follow-done-section": Scene("/{dance}/exercises/{classsection}", _done_sheet),
    "follow-done-review": Scene("/{dance}/exercises/{classreview}", _done_sheet),
    "follow-done-routine": Scene("/{dance}/exercises/{classroutine}", _done_sheet),
    "follow-comments": Scene("/{dance}/lessons/{classlesson}", _comments),
    "follow-video-full": Scene("/{dance}/lessons/{classlesson}", _video_full),
    "follow-video-section": Scene("/{dance}/exercises/{classsection}", _section),
    "follow-practice-setup": Scene(PLAYER),
    "follow-practice-running": Scene(PLAYER, _running, _run_masks),
    "follow-practice-save": Scene(PLAYER, _save, _run_masks),
}
