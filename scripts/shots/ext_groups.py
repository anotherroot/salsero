"""Plan 4's placeholders (Lessons and Groups). No scenes. See README "Scenes"."""


def _first(db, sql, args=()):
    row = db.execute(sql, args).fetchone()
    return row[0] if row else None


def placeholders(db, admin, dance):
    own = _first(
        db,
        "select t.id from teams t join team_members m on m.team_id = t.id "
        "where m.user_id = ? and m.role in ('owner', 'editor') and t.dance = ? and t.deleted_at is null "
        "order by t.id limit 1",
        (admin, dance),
    )
    return {
        # the first live group the admin owns or edits
        "owngroup": own,
        # the first live published lesson of that group
        "grouplesson": _first(
            db,
            "select id from lessons where team_id = ? and dance = ? and archived_at is null and published_at is not null order by id limit 1",
            (own, dance),
        ),
    }
