"""A figure's switcher on a merged move. See README "Scenes".

`{mergedswitch}` is a group's live figure whose move has the name of one of the admin's own live
moves (trimmed, case-blind), from a lesson the admin added: its switcher lists the admin's figures
of that move and the group's, each group figure marked. `{groupcopy}` is a group's live copy (same
gene) of one of the admin's own live figures: its switcher shows the one row the list shows for both,
lit, with its copies; `switcher-copy-mine` opens the admin's own (`{mergefig}`, ext_merge.py).
"""
from scenes import Scene


def placeholders(db, admin, dance):
    row = db.execute(
        "select f.id from figures f join figure_groups g on g.id = f.group_id "
        "join figure_groups mine on lower(trim(mine.name)) = lower(trim(g.name)) "
        "and mine.user_id = ? and mine.dance = g.dance and mine.archived_at is null "
        "where f.team_id is not null and f.dance = ? and f.archived_at is null "
        "and g.archived_at is null and exists (select 1 from lesson_adds a join lessons l "
        "on l.id = a.lesson_id where a.user_id = ? and l.team_id = f.team_id) "
        "order by f.id limit 1",
        (admin, dance, admin),
    ).fetchone()
    copy = db.execute(
        "select g.id from figures g join figures f on f.gene_id = g.gene_id and f.id != g.id "
        "where f.user_id = ? and f.dance = ? and f.archived_at is null "
        "and g.team_id is not null and g.archived_at is null order by f.id limit 1",
        (admin, dance),
    ).fetchone()
    return {"mergedswitch": row[0] if row else None, "groupcopy": copy[0] if copy else None}


def _open(page):
    page.locator("nav button[aria-haspopup=dialog]").last.click()
    page.wait_for_selector("dialog[open]")
    page.wait_for_timeout(400)


SCENES = {
    "switcher-merged": Scene("/{dance}/figures/{mergedswitch}", _open),
    "switcher-copy-mine": Scene("/{dance}/figures/{mergefig}", _open),
    "switcher-copy-theirs": Scene("/{dance}/figures/{groupcopy}", _open),
}
