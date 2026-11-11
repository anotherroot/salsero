-- A slot's options written at once (every copy path) tied on created_at, and the
-- server's rowid decided which was the main figure. A phone never sees rowid: its
-- copy holds the rows in key order, so a group's copy could show its alternative
-- as the main figure ("your copies differ", with nothing to sync). Each option of
-- a slot with a tie moves up by its place in the slot (created_at, then rowid),
-- so created_at alone keeps today's order. The change-log trigger sends the rows
-- on; a phone pulls everything after a migration anyway. `insertOptions` writes
-- new ones a millisecond apart.
CREATE TEMP TABLE option_order AS
SELECT rowid AS rid,
       row_number() OVER (PARTITION BY step_id ORDER BY created_at, rowid) - 1 AS k
FROM routine_step_options
WHERE step_id IN (
  SELECT step_id FROM routine_step_options GROUP BY step_id, created_at HAVING count(*) > 1
);
--> statement-breakpoint
UPDATE routine_step_options
SET created_at = created_at + (SELECT k FROM option_order WHERE rid = routine_step_options.rowid)
WHERE rowid IN (SELECT rid FROM option_order WHERE k > 0);
--> statement-breakpoint
DROP TABLE option_order;
