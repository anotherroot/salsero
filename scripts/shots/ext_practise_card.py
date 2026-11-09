"""The Practise card (docs/superpowers/specs/2026-11-09-practise-card-design.md): one card on every
exercise type, a lesson's About in the player, and the strip when a video takes the sound.
See README "Scenes"."""
from scenes import Scene


def _first(db, sql, args=()):
    row = db.execute(sql, args).fetchone()
    return row[0] if row else None


def placeholders(db, admin, dance):
    live = "e.user_id = ? and e.dance = ? and e.archived_at is null"

    def of(source, extra=""):
        return _first(
            db,
            f"select e.id from exercises e where {live} and e.source = '{source}' {extra} order by e.id limit 1",
            (admin, dance),
        )

    return {
        "carddrill": of("custom"),
        "cardfigure": of("figure"),
        "cardroutine": of("routine"),
        # a lesson review whose lesson has notes, so it has an About
        "cardlesson": of(
            "lesson",
            "and exists (select 1 from lessons l where l.id = e.lesson_id and trim(coalesce(l.notes, '')) <> '')",
        ),
        # a figure exercise with a linked section to tap, practised on the count
        "cardclip": of(
            "figure",
            "and exists (select 1 from spot_links s where s.figure_id = e.figure_id)",
        ),
    }


def _about(page):
    page.get_by_role("button", name="About").first.click()
    page.wait_for_timeout(600)


def _paused(page):
    page.get_by_text("Count only", exact=True).click()
    page.get_by_role("button", name="Play", exact=True).click()
    page.get_by_role("button", name="Stop", exact=True).wait_for()
    page.wait_for_timeout(800)
    page.get_by_role("button", name="About").first.click()
    page.wait_for_timeout(400)
    page.locator("figure button[aria-pressed]").first.click()
    page.wait_for_timeout(600)


SCENES = {
    "card-drill": Scene("/{dance}/exercises/{carddrill}"),
    "card-figure": Scene("/{dance}/exercises/{cardfigure}"),
    "card-routine": Scene("/{dance}/exercises/{cardroutine}"),
    "card-lesson": Scene("/{dance}/exercises/{cardlesson}"),
    "about-lesson": Scene("/{dance}/player?exercise={cardlesson}&from=exercise", _about),
    "about-paused": Scene("/{dance}/player?exercise={cardclip}&from=exercise", _paused),
}
