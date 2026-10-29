CREATE TABLE `figure_groups` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`dance` text NOT NULL,
	`name` text NOT NULL,
	`archived_at` integer,
	`created_at` integer NOT NULL
);
--> statement-breakpoint
CREATE INDEX `figure_groups_dance_idx` ON `figure_groups` (`dance`);--> statement-breakpoint
ALTER TABLE `figures` ADD `group_id` integer REFERENCES figure_groups(id);--> statement-breakpoint
CREATE INDEX `figures_group_idx` ON `figures` (`group_id`);
--> statement-breakpoint
INSERT INTO figure_groups (id, dance, name, archived_at, created_at)
  SELECT f.id, f.dance, f.name,
    CASE WHEN EXISTS (SELECT 1 FROM figures v WHERE v.parent_id = f.id AND v.archived_at IS NULL)
         THEN NULL ELSE f.archived_at END,
    f.created_at
  FROM figures f WHERE f.parent_id IS NULL;
--> statement-breakpoint
UPDATE figures SET group_id = coalesce(parent_id, id);
--> statement-breakpoint
INSERT INTO figure_start_positions (figure_id, position_id, created_at)
  SELECT v.id, p.position_id, p.created_at FROM figures v
  JOIN figure_start_positions p ON p.figure_id = v.parent_id
  WHERE v.parent_id IS NOT NULL
    AND NOT EXISTS (SELECT 1 FROM figure_start_positions s WHERE s.figure_id = v.id);
--> statement-breakpoint
UPDATE figures SET
  end_position_id = coalesce(end_position_id, (SELECT p.end_position_id FROM figures p WHERE p.id = figures.parent_id)),
  start_count     = coalesce(start_count,     (SELECT p.start_count     FROM figures p WHERE p.id = figures.parent_id)),
  length_counts   = coalesce(length_counts,   (SELECT p.length_counts   FROM figures p WHERE p.id = figures.parent_id)),
  partner         = (SELECT p.partner   FROM figures p WHERE p.id = figures.parent_id),
  style_tag       = (SELECT p.style_tag FROM figures p WHERE p.id = figures.parent_id)
WHERE parent_id IS NOT NULL;
--> statement-breakpoint
UPDATE figure_groups SET name = trim(name) || ' ' || (
    SELECT r.n FROM (SELECT id, row_number() OVER (PARTITION BY dance, lower(trim(name)) ORDER BY id) AS n
                     FROM figure_groups WHERE archived_at IS NULL) r WHERE r.id = figure_groups.id)
  WHERE id IN (SELECT id FROM (SELECT id, row_number() OVER (PARTITION BY dance, lower(trim(name)) ORDER BY id) AS n
                               FROM figure_groups WHERE archived_at IS NULL) WHERE n > 1);
--> statement-breakpoint
UPDATE figures SET name = CASE
    WHEN EXISTS (SELECT 1 FROM figures v WHERE v.parent_id = figures.id AND v.archived_at IS NULL
                 AND lower(trim(v.name)) = 'basic') THEN 'Original' ELSE 'Basic' END
  WHERE parent_id IS NULL;
--> statement-breakpoint
UPDATE exercises SET name = (SELECT g.name || ' · ' || f.name FROM figures f
    JOIN figure_groups g ON g.id = f.group_id WHERE f.id = exercises.figure_id)
  WHERE source = 'figure';
