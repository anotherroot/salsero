CREATE TABLE `lesson_adds` (
	`user_id` text NOT NULL,
	`lesson_id` integer NOT NULL,
	`added_at` integer NOT NULL,
	`seen_at` integer NOT NULL,
	PRIMARY KEY(`user_id`, `lesson_id`),
	FOREIGN KEY (`lesson_id`) REFERENCES `lessons`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `team_changes` (
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
	CONSTRAINT "team_changes_root_kind_ck" CHECK("team_changes"."root_kind" in ('lesson', 'figure', 'routine', 'drill', 'team')),
	CONSTRAINT "team_changes_verb_ck" CHECK("team_changes"."verb" in ('add', 'change', 'remove', 'archive', 'restore', 'publish'))
);
--> statement-breakpoint
CREATE INDEX `team_changes_root_idx` ON `team_changes` (`team_id`,`root_kind`,`root_id`,`at`);--> statement-breakpoint
CREATE TABLE `team_members` (
	`team_id` integer NOT NULL,
	`user_id` text NOT NULL,
	`role` text NOT NULL,
	`joined_at` integer NOT NULL,
	PRIMARY KEY(`team_id`, `user_id`),
	FOREIGN KEY (`team_id`) REFERENCES `teams`(`id`) ON UPDATE no action ON DELETE no action,
	CONSTRAINT "team_members_role_ck" CHECK("team_members"."role" in ('owner', 'editor', 'member'))
);
--> statement-breakpoint
CREATE UNIQUE INDEX `team_members_owner_idx` ON `team_members` (`team_id`) WHERE "team_members"."role" = 'owner';--> statement-breakpoint
CREATE INDEX `team_members_user_idx` ON `team_members` (`user_id`);--> statement-breakpoint
CREATE TABLE `team_trash` (
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
	CONSTRAINT "team_trash_kind_ck" CHECK("team_trash"."kind" in ('video', 'section', 'link', 'spot-link', 'recording'))
);
--> statement-breakpoint
CREATE INDEX `team_trash_team_idx` ON `team_trash` (`team_id`,`deleted_at`);--> statement-breakpoint
CREATE TABLE `teams` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`dance` text NOT NULL,
	`name` text NOT NULL,
	`code` text NOT NULL,
	`storage_limit_bytes` integer,
	`deleted_at` integer,
	`deleted_by` text,
	`purged_at` integer,
	`created_by` text NOT NULL,
	`created_at` integer NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `teams_code_unique` ON `teams` (`code`);--> statement-breakpoint
ALTER TABLE `exercises` ADD `team_id` integer;--> statement-breakpoint
ALTER TABLE `exercises` ADD `drill_id` integer REFERENCES exercises(id);--> statement-breakpoint
CREATE INDEX `exercises_team_idx` ON `exercises` (`team_id`,`dance`);--> statement-breakpoint
CREATE UNIQUE INDEX `exercises_entry_lesson_idx` ON `exercises` (`user_id`,`lesson_id`) WHERE "exercises"."lesson_id" is not null;--> statement-breakpoint
CREATE UNIQUE INDEX `exercises_entry_routine_idx` ON `exercises` (`user_id`,`routine_id`) WHERE "exercises"."routine_id" is not null;--> statement-breakpoint
CREATE UNIQUE INDEX `exercises_entry_figure_idx` ON `exercises` (`user_id`,`figure_id`) WHERE "exercises"."figure_id" is not null;--> statement-breakpoint
CREATE UNIQUE INDEX `exercises_entry_drill_idx` ON `exercises` (`user_id`,`drill_id`) WHERE "exercises"."drill_id" is not null;--> statement-breakpoint
ALTER TABLE `figure_groups` ADD `team_id` integer;--> statement-breakpoint
CREATE INDEX `figure_groups_team_idx` ON `figure_groups` (`team_id`,`dance`);--> statement-breakpoint
ALTER TABLE `figures` ADD `team_id` integer;--> statement-breakpoint
CREATE INDEX `figures_team_idx` ON `figures` (`team_id`,`dance`);--> statement-breakpoint
ALTER TABLE `lessons` ADD `team_id` integer;--> statement-breakpoint
ALTER TABLE `lessons` ADD `published_at` integer;--> statement-breakpoint
CREATE INDEX `lessons_team_idx` ON `lessons` (`team_id`,`dance`);--> statement-breakpoint
ALTER TABLE `routines` ADD `team_id` integer;--> statement-breakpoint
CREATE INDEX `routines_team_idx` ON `routines` (`team_id`,`dance`);--> statement-breakpoint
ALTER TABLE `storage_requests` ADD `team_id` integer;--> statement-breakpoint
ALTER TABLE `users` ADD `group_limit` integer;