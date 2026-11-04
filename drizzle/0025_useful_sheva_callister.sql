PRAGMA foreign_keys=OFF;--> statement-breakpoint
CREATE TABLE `__new_team_changes` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`team_id` integer NOT NULL,
	`root_kind` text NOT NULL,
	`root_id` integer NOT NULL,
	`actor_id` text NOT NULL,
	`at` integer NOT NULL,
	`verb` text NOT NULL,
	`subject` text NOT NULL,
	`subject_id` integer,
	`before_json` text,
	`after_json` text,
	`trash_id` integer,
	CONSTRAINT "team_changes_root_kind_ck" CHECK("__new_team_changes"."root_kind" in ('lesson', 'figure', 'routine', 'drill', 'song', 'team')),
	CONSTRAINT "team_changes_verb_ck" CHECK("__new_team_changes"."verb" in ('add', 'change', 'remove', 'archive', 'restore', 'publish', 'share', 'unshare', 'delete', 'edit'))
);
--> statement-breakpoint
INSERT INTO `__new_team_changes`("id", "team_id", "root_kind", "root_id", "actor_id", "at", "verb", "subject", "subject_id", "before_json", "after_json", "trash_id") SELECT "id", "team_id", "root_kind", "root_id", "actor_id", "at", "verb", "subject", "subject_id", "before_json", "after_json", "trash_id" FROM `team_changes`;--> statement-breakpoint
DROP TABLE `team_changes`;--> statement-breakpoint
ALTER TABLE `__new_team_changes` RENAME TO `team_changes`;--> statement-breakpoint
PRAGMA foreign_keys=ON;--> statement-breakpoint
CREATE INDEX `team_changes_root_idx` ON `team_changes` (`team_id`,`root_kind`,`root_id`,`at`);