PRAGMA foreign_keys=OFF;--> statement-breakpoint
CREATE TABLE `__new_clone_pairs` (
	`kind` text NOT NULL,
	`a_id` integer NOT NULL,
	`b_id` integer NOT NULL,
	`base_json` text NOT NULL,
	`at` integer NOT NULL,
	PRIMARY KEY(`kind`, `a_id`, `b_id`),
	CONSTRAINT "clone_pairs_order_ck" CHECK("__new_clone_pairs"."a_id" < "__new_clone_pairs"."b_id"),
	CONSTRAINT "clone_pairs_kind_ck" CHECK("__new_clone_pairs"."kind" in ('figure', 'routine', 'drill', 'song', 'lesson', 'position'))
);
--> statement-breakpoint
INSERT INTO `__new_clone_pairs`("kind", "a_id", "b_id", "base_json", "at") SELECT "kind", "a_id", "b_id", "base_json", "at" FROM `clone_pairs`;--> statement-breakpoint
DROP TABLE `clone_pairs`;--> statement-breakpoint
ALTER TABLE `__new_clone_pairs` RENAME TO `clone_pairs`;--> statement-breakpoint
PRAGMA foreign_keys=ON;--> statement-breakpoint
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
	CONSTRAINT "team_changes_root_kind_ck" CHECK("__new_team_changes"."root_kind" in ('lesson', 'figure', 'routine', 'drill', 'song', 'team', 'position')),
	CONSTRAINT "team_changes_verb_ck" CHECK("__new_team_changes"."verb" in ('add', 'change', 'remove', 'archive', 'restore', 'publish', 'share', 'unshare', 'delete', 'edit'))
);
--> statement-breakpoint
INSERT INTO `__new_team_changes`("id", "team_id", "root_kind", "root_id", "actor_id", "at", "verb", "subject", "subject_id", "before_json", "after_json", "trash_id") SELECT "id", "team_id", "root_kind", "root_id", "actor_id", "at", "verb", "subject", "subject_id", "before_json", "after_json", "trash_id" FROM `team_changes`;--> statement-breakpoint
DROP TABLE `team_changes`;--> statement-breakpoint
ALTER TABLE `__new_team_changes` RENAME TO `team_changes`;--> statement-breakpoint
CREATE INDEX `team_changes_root_idx` ON `team_changes` (`team_id`,`root_kind`,`root_id`,`at`);--> statement-breakpoint
CREATE TABLE `__new_team_trash` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`team_id` integer NOT NULL,
	`kind` text NOT NULL,
	`label` text NOT NULL,
	`root_kind` text NOT NULL,
	`root_id` integer NOT NULL,
	`rows_json` text NOT NULL,
	`files_json` text DEFAULT '[]' NOT NULL,
	`size_bytes` integer DEFAULT 0 NOT NULL,
	`deleted_by` text NOT NULL,
	`deleted_at` integer NOT NULL,
	`restored_at` integer,
	`purged_at` integer,
	CONSTRAINT "team_trash_kind_ck" CHECK("__new_team_trash"."kind" in ('video', 'section', 'link', 'spot-link', 'recording', 'position-link'))
);
--> statement-breakpoint
INSERT INTO `__new_team_trash`("id", "team_id", "kind", "label", "root_kind", "root_id", "rows_json", "files_json", "size_bytes", "deleted_by", "deleted_at", "restored_at", "purged_at") SELECT "id", "team_id", "kind", "label", "root_kind", "root_id", "rows_json", "files_json", "size_bytes", "deleted_by", "deleted_at", "restored_at", "purged_at" FROM `team_trash`;--> statement-breakpoint
DROP TABLE `team_trash`;--> statement-breakpoint
ALTER TABLE `__new_team_trash` RENAME TO `team_trash`;--> statement-breakpoint
CREATE INDEX `team_trash_team_idx` ON `team_trash` (`team_id`,`deleted_at`);--> statement-breakpoint
CREATE TABLE `__new_twins` (
	`user_id` text NOT NULL,
	`kind` text NOT NULL,
	`set_id` text NOT NULL,
	`item_id` integer NOT NULL,
	`created_at` integer NOT NULL,
	PRIMARY KEY(`user_id`, `kind`, `item_id`),
	CONSTRAINT "twins_kind_ck" CHECK("__new_twins"."kind" in ('figure', 'routine', 'lesson', 'song', 'position'))
);
--> statement-breakpoint
INSERT INTO `__new_twins`("user_id", "kind", "set_id", "item_id", "created_at") SELECT "user_id", "kind", "set_id", "item_id", "created_at" FROM `twins`;--> statement-breakpoint
DROP TABLE `twins`;--> statement-breakpoint
ALTER TABLE `__new_twins` RENAME TO `twins`;--> statement-breakpoint
CREATE INDEX `twins_set_idx` ON `twins` (`user_id`,`set_id`);