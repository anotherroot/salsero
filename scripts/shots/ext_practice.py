"""Plan 5's scenes (Practice, Settings, Music, Admin) and the placeholders they need. See README "Scenes"."""
import re

from scenes import Scene

SHAREKEY = "00000000-0000-4000-8000-000000000000"


def _first(db, sql, args=()):
    row = db.execute(sql, args).fetchone()
    return row[0] if row else None


def placeholders(db, admin, dance):
    return {
        "sharekey": SHAREKEY,
        # the admin's live routine with the most steps
        "longroutine": _first(
            db,
            "select r.id from routines r left join routine_steps s on s.routine_id = r.id "
            "where r.user_id = ? and r.dance = ? and r.archived_at is null group by r.id order by count(s.id) desc, r.id limit 1",
            (admin, dance),
        ),
        # a shared, live song of a group the admin is only a member of
        "classsong": _first(
            db,
            "select s.id from songs s join team_members m on m.team_id = s.team_id "
            "where m.user_id = ? and m.role = 'member' and s.dance = ? and s.archived_at is null and s.shared_at is not null "
            "order by s.id limit 1",
            (admin, dance),
        ),
        # a ready draft song of a group the admin owns or edits
        "draftsong": _first(
            db,
            "select s.id from songs s join team_members m on m.team_id = s.team_id "
            "where m.user_id = ? and m.role in ('owner', 'editor') and s.dance = ? and s.archived_at is null "
            "and s.shared_at is null and s.status = 'ready' order by s.id limit 1",
            (admin, dance),
        ),
        # the admin's first live figure that has a recording (None: the player-keys scene skips)
        "recfigure": _first(
            db,
            "select f.id from figures f where f.user_id = ? and f.dance = ? and f.archived_at is null "
            "and exists (select 1 from recordings r where r.figure_id = f.id) order by f.id limit 1",
            (admin, dance),
        ),
    }


def _btn(page, name):
    return page.get_by_role("button", name=name, exact=True)


def _setup_song(page):
    page.get_by_text("A song", exact=True).click()


def _song_picker(page):
    _setup_song(page)
    page.locator("button[aria-haspopup=dialog][id$=-field]").first.click()


def _running(page):
    _btn(page, "Play").click()
    _btn(page, "Stop").wait_for()
    page.wait_for_timeout(2500)


def _paused(page):
    _running(page)
    _btn(page, "Pause").click()


def _save(page):
    _running(page)
    _btn(page, "Stop").click()
    page.get_by_text("Save this run", exact=True).first.wait_for()


def _run_masks(page):
    return [
        page.get_by_role("img", name=re.compile(r"^Count")),
        page.locator(".run-call"),
        page.locator(".run-head span.tabular-nums"),
        page.locator('ol[aria-label="Routine"]'),
        page.locator('[role=slider][aria-label="Song position"]'),
    ]


def _player_keys(page):
    # A recording's row opens the full-screen player (figure page rework, 2026-11-06).
    page.get_by_role("button", name=re.compile(r"^Play the recording from ")).first.click()
    page.wait_for_timeout(500)
    page.keyboard.press("?")


def _my_count(page):
    page.get_by_role("button", name=re.compile(r"^(Record|Redo) \d+ BPM$")).first.click()
    _btn(page, "Start").click()
    page.locator("span.bg-danger-soft", has_text="Recording").wait_for()


def _admin_person(page):
    page.locator("span:text-is('People') + div button").first.click()


SCENES = {
    "share": Scene("/{dance}/share?key={sharekey}"),
    "practice-setup-song": Scene("/{dance}/player?routine={routine}", _setup_song),
    "practice-song-picker": Scene("/{dance}/player?routine={routine}", _song_picker),
    "practice-running": Scene("/{dance}/player?routine={routine}", _running, _run_masks),
    "practice-running-long": Scene("/{dance}/player?routine={longroutine}", _running, _run_masks),
    "practice-paused": Scene("/{dance}/player?routine={routine}", _paused, _run_masks),
    "practice-save": Scene("/{dance}/player?routine={routine}", _save, _run_masks),
    "player-keys": Scene("/{dance}/figures/{recfigure}", _player_keys),
    "my-count-recording": Scene("/voice", _my_count),
    "admin-person": Scene("/admin", _admin_person),
    "song-class": Scene("/{dance}/songs/{classsong}"),
    "song-make-mine": Scene("/{dance}/songs/{classsong}", lambda p: _btn(p, "Edit song").click()),
    "song-draft": Scene("/{dance}/songs/{draftsong}"),
}
