"""One player (docs/superpowers/specs/2026-11-08-one-player-design.md): the band that fills, the rows,
the layers, and the exercise page's Practise with. See README "Scenes"."""
import re

from scenes import Scene


def _first(db, sql, args=()):
    row = db.execute(sql, args).fetchone()
    return row[0] if row else None


def placeholders(db, admin, dance):
    live = "e.user_id = ? and e.dance = ? and e.archived_at is null"
    return {
        # a drill with a description
        "opdrill": _first(
            db,
            f"select e.id from exercises e where {live} and e.source = 'custom' "
            "and trim(coalesce(e.notes, '')) <> '' order by length(e.notes), e.id limit 1",
            (admin, dance),
        ),
        # a drill that is only a title: no description, no links, no sections
        "opbare": _first(
            db,
            f"select e.id from exercises e where {live} and e.source = 'custom' "
            "and trim(coalesce(e.notes, '')) = '' "
            "and not exists (select 1 from links l where l.exercise_id = e.id) "
            "and not exists (select 1 from spot_links s where s.exercise_id = e.id) order by e.id limit 1",
            (admin, dance),
        ),
        # a drill with the longest description (a list)
        "oplong": _first(
            db,
            f"select e.id from exercises e where {live} and e.source = 'custom' "
            "order by length(coalesce(e.notes, '')) desc, e.id limit 1",
            (admin, dance),
        ),
        # a figure exercise whose figure has notes or a linked section
        "opfig": _first(
            db,
            f"select e.id from exercises e join figures f on f.id = e.figure_id where {live} "
            "and e.source = 'figure' and (trim(coalesce(f.notes, '')) <> '' "
            "or exists (select 1 from spot_links s where s.figure_id = f.id)) order by e.id limit 1",
            (admin, dance),
        ),
    }


def _btn(page, name):
    return page.get_by_role("button", name=name, exact=True)


def _run(page):
    _btn(page, "Play").click()
    _btn(page, "Stop").wait_for()
    page.wait_for_timeout(2500)


def _row(name):
    def act(page):
        _run(page)
        page.get_by_role("button", name=re.compile(rf"^{name}")).first.click()
        page.get_by_role("dialog").first.wait_for()
        page.wait_for_timeout(600)

    return act


def _setup_about(page):
    page.get_by_role("button", name=re.compile(r"^About")).first.click()
    page.get_by_role("dialog").first.wait_for()
    page.wait_for_timeout(600)


def _setup_about_back(page):
    _setup_about(page)
    page.go_back()
    page.wait_for_timeout(600)


def _still(page):
    _run(page)
    page.get_by_role("button", name=re.compile(r"^Routine")).first.click()
    page.get_by_role("dialog").get_by_text("Still", exact=True).click()
    page.wait_for_timeout(300)
    page.get_by_role("button", name="Close the full-screen routine").click()
    page.wait_for_timeout(600)


def _setup_back(page):
    _run(page)
    page.get_by_role("button", name=re.compile(r"^Voice")).first.click()
    page.get_by_role("dialog").first.wait_for()
    page.go_back()
    page.wait_for_timeout(600)


def _info(page):
    _row("Routine")(page)
    page.get_by_role("dialog").get_by_role("button", name=re.compile(r"^About ")).nth(1).click()
    page.wait_for_timeout(800)


def _still_tap(page):
    _row("Routine")(page)
    page.get_by_role("dialog").get_by_text("Still", exact=True).click()
    page.wait_for_timeout(300)
    page.get_by_role("dialog").get_by_role("button", name=re.compile(r"^About ")).nth(2).click()
    page.wait_for_timeout(800)


def _info_back(page):
    _info(page)
    page.go_back()
    page.wait_for_timeout(600)


SCENES = {
    "op-drill": Scene("/{dance}/player?exercise={opdrill}", _run),
    "op-bare": Scene("/{dance}/player?exercise={opbare}", _run),
    "op-long-about": Scene("/{dance}/player?exercise={oplong}", _setup_about),
    "op-setup": Scene("/{dance}/player?exercise={opdrill}"),
    "op-setup-bare": Scene("/{dance}/player?exercise={opbare}"),
    "op-setup-about-back": Scene("/{dance}/player?exercise={opdrill}", _setup_about_back),
    "op-fig": Scene("/{dance}/player?exercise={opfig}", _run),
    "op-fig-about": Scene("/{dance}/player?exercise={opfig}", _row("About")),
    "op-voice": Scene("/{dance}/player?exercise={opdrill}", _row("Voice")),
    # The Voice layer of a count-only run with no exercise: any db has it (Sound delay, 2026-11-10).
    "op-voice-plain": Scene("/{dance}/player", _row("Voice")),
    "op-voice-back": Scene("/{dance}/player?exercise={opdrill}", _setup_back),
    "op-routine": Scene("/{dance}/player?routine={longroutine}", _run),
    "op-routine-layer": Scene("/{dance}/player?routine={longroutine}", _row("Routine")),
    "op-routine-still": Scene("/{dance}/player?routine={longroutine}", _still),
    "op-routine-info": Scene("/{dance}/player?routine={longroutine}", _info),
    "op-routine-still-tap": Scene("/{dance}/player?routine={longroutine}", _still_tap),
    "op-routine-info-back": Scene("/{dance}/player?routine={longroutine}", _info_back),
    "op-count": Scene("/{dance}/player?bpm=180", _run),
    "op-card": Scene("/{dance}/exercises/{opdrill}"),
}
