-- The dance split, production, once: delete the account 1d8846e7-… (the user
-- asked, 2026-11-06: it joined a bachata group from the salsa app; they will
-- invite the person again into bachata). Run on the box with the unit stopped,
-- right after `sudo systemctl start salsa-backup`:
--
--   sudo systemctl stop salsa
--   sudo -u salsa sqlite3 /var/lib/salsa/salsa.db < delete-1d8846.sql
--   sudo systemctl start salsa
--
-- Rehearsed on a copy of the 2026-11-06 backup first: it held 1 app install,
-- 2 sessions and 1 group membership, and nothing else of the person. The used
-- invite stays, as history (`invites.used_by` has no foreign key). Every person
-- column is covered, zero rows or not, so a row added since is not left behind.
PRAGMA foreign_keys = ON;
BEGIN;
DELETE FROM today_picks WHERE user_id = '1d8846e7-3d7b-428e-ac72-035a83980882';
DELETE FROM default_styles WHERE user_id = '1d8846e7-3d7b-428e-ac72-035a83980882';
DELETE FROM device_tokens WHERE user_id = '1d8846e7-3d7b-428e-ac72-035a83980882';
DELETE FROM app_installs WHERE user_id = '1d8846e7-3d7b-428e-ac72-035a83980882';
DELETE FROM sessions WHERE user_id = '1d8846e7-3d7b-428e-ac72-035a83980882';
DELETE FROM count_takes WHERE user_id = '1d8846e7-3d7b-428e-ac72-035a83980882';
DELETE FROM storage_requests WHERE user_id = '1d8846e7-3d7b-428e-ac72-035a83980882';
DELETE FROM team_members WHERE user_id = '1d8846e7-3d7b-428e-ac72-035a83980882';
DELETE FROM lesson_adds WHERE user_id = '1d8846e7-3d7b-428e-ac72-035a83980882';
DELETE FROM opens WHERE user_id = '1d8846e7-3d7b-428e-ac72-035a83980882';
DELETE FROM twins WHERE user_id = '1d8846e7-3d7b-428e-ac72-035a83980882';
DELETE FROM lesson_comment_hearts WHERE user_id = '1d8846e7-3d7b-428e-ac72-035a83980882';
-- Owned content: none in the backup. If any appeared since, stop: the SELECT
-- below returns a row and the COMMIT must not be run by hand past it.
SELECT 'STOP: owned rows exist', t, n FROM (
  SELECT 'figures' t, count(*) n FROM figures WHERE user_id = '1d8846e7-3d7b-428e-ac72-035a83980882'
  UNION ALL SELECT 'figure_groups', count(*) FROM figure_groups WHERE user_id = '1d8846e7-3d7b-428e-ac72-035a83980882'
  UNION ALL SELECT 'positions', count(*) FROM positions WHERE user_id = '1d8846e7-3d7b-428e-ac72-035a83980882'
  UNION ALL SELECT 'routines', count(*) FROM routines WHERE user_id = '1d8846e7-3d7b-428e-ac72-035a83980882'
  UNION ALL SELECT 'songs', count(*) FROM songs WHERE user_id = '1d8846e7-3d7b-428e-ac72-035a83980882'
  UNION ALL SELECT 'exercises', count(*) FROM exercises WHERE user_id = '1d8846e7-3d7b-428e-ac72-035a83980882'
  UNION ALL SELECT 'lessons', count(*) FROM lessons WHERE user_id = '1d8846e7-3d7b-428e-ac72-035a83980882'
  UNION ALL SELECT 'lesson_comments', count(*) FROM lesson_comments WHERE author_id = '1d8846e7-3d7b-428e-ac72-035a83980882'
  UNION ALL SELECT 'team_changes', count(*) FROM team_changes WHERE actor_id = '1d8846e7-3d7b-428e-ac72-035a83980882'
  UNION ALL SELECT 'teams', count(*) FROM teams WHERE created_by = '1d8846e7-3d7b-428e-ac72-035a83980882'
) WHERE n > 0;
DELETE FROM users WHERE id = '1d8846e7-3d7b-428e-ac72-035a83980882'
  AND NOT EXISTS (SELECT 1 FROM figures WHERE user_id = '1d8846e7-3d7b-428e-ac72-035a83980882')
  AND NOT EXISTS (SELECT 1 FROM exercises WHERE user_id = '1d8846e7-3d7b-428e-ac72-035a83980882')
  AND NOT EXISTS (SELECT 1 FROM lessons WHERE user_id = '1d8846e7-3d7b-428e-ac72-035a83980882')
  AND NOT EXISTS (SELECT 1 FROM songs WHERE user_id = '1d8846e7-3d7b-428e-ac72-035a83980882')
  AND NOT EXISTS (SELECT 1 FROM routines WHERE user_id = '1d8846e7-3d7b-428e-ac72-035a83980882')
  AND NOT EXISTS (SELECT 1 FROM teams WHERE created_by = '1d8846e7-3d7b-428e-ac72-035a83980882');
SELECT 'users left with this id', count(*) FROM users WHERE id = '1d8846e7-3d7b-428e-ac72-035a83980882';
COMMIT;
