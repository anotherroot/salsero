-- Alternatives are gone (spec 2026-11-12, routine sections): a slot holds one
-- figure. Each slot keeps its MAIN figure, its first option by created_at then
-- rowid (the order every path writes and reads, `MAIN_FIRST`); the others go.
-- The change-log trigger sends the deletes on; a phone pulls after a migration.
DELETE FROM routine_step_options
WHERE rowid NOT IN (
  SELECT (
    SELECT o.rowid FROM routine_step_options o
    WHERE o.step_id = s.step_id
    ORDER BY o.created_at, o.rowid
    LIMIT 1
  )
  FROM (SELECT DISTINCT step_id FROM routine_step_options) s
);
