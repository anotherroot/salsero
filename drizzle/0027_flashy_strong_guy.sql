CREATE TABLE `clone_pairs` (
	`kind` text NOT NULL,
	`a_id` integer NOT NULL,
	`b_id` integer NOT NULL,
	`base_json` text NOT NULL,
	`at` integer NOT NULL,
	PRIMARY KEY(`kind`, `a_id`, `b_id`),
	CONSTRAINT "clone_pairs_order_ck" CHECK("clone_pairs"."a_id" < "clone_pairs"."b_id"),
	CONSTRAINT "clone_pairs_kind_ck" CHECK("clone_pairs"."kind" in ('figure', 'routine', 'drill', 'song', 'lesson'))
);
--> statement-breakpoint
CREATE TABLE `twins` (
	`user_id` text NOT NULL,
	`kind` text NOT NULL,
	`set_id` text NOT NULL,
	`item_id` integer NOT NULL,
	`created_at` integer NOT NULL,
	PRIMARY KEY(`user_id`, `kind`, `item_id`),
	CONSTRAINT "twins_kind_ck" CHECK("twins"."kind" in ('figure', 'routine', 'lesson', 'song'))
);
--> statement-breakpoint
CREATE INDEX `twins_set_idx` ON `twins` (`user_id`,`set_id`);--> statement-breakpoint
ALTER TABLE `exercises` ADD `gene_id` text;--> statement-breakpoint
ALTER TABLE `exercises` ADD `cloned_from` integer;--> statement-breakpoint
CREATE UNIQUE INDEX `exercises_gene_user_idx` ON `exercises` (`gene_id`,`user_id`) WHERE "exercises"."gene_id" is not null;--> statement-breakpoint
CREATE UNIQUE INDEX `exercises_gene_team_idx` ON `exercises` (`gene_id`,`team_id`) WHERE "exercises"."gene_id" is not null;--> statement-breakpoint
ALTER TABLE `figures` ADD `gene_id` text;--> statement-breakpoint
ALTER TABLE `figures` ADD `cloned_from` integer;--> statement-breakpoint
CREATE UNIQUE INDEX `figures_gene_user_idx` ON `figures` (`gene_id`,`user_id`) WHERE "figures"."gene_id" is not null;--> statement-breakpoint
CREATE UNIQUE INDEX `figures_gene_team_idx` ON `figures` (`gene_id`,`team_id`) WHERE "figures"."gene_id" is not null;--> statement-breakpoint
ALTER TABLE `lesson_videos` ADD `gene_id` text;--> statement-breakpoint
ALTER TABLE `lesson_videos` ADD `cloned_from` integer;--> statement-breakpoint
CREATE INDEX `lesson_videos_gene_idx` ON `lesson_videos` (`gene_id`);--> statement-breakpoint
ALTER TABLE `lessons` ADD `gene_id` text;--> statement-breakpoint
ALTER TABLE `lessons` ADD `cloned_from` integer;--> statement-breakpoint
CREATE UNIQUE INDEX `lessons_gene_user_idx` ON `lessons` (`gene_id`,`user_id`) WHERE "lessons"."gene_id" is not null;--> statement-breakpoint
CREATE UNIQUE INDEX `lessons_gene_team_idx` ON `lessons` (`gene_id`,`team_id`) WHERE "lessons"."gene_id" is not null;--> statement-breakpoint
ALTER TABLE `recordings` ADD `gene_id` text;--> statement-breakpoint
ALTER TABLE `recordings` ADD `cloned_from` integer;--> statement-breakpoint
CREATE INDEX `recordings_gene_idx` ON `recordings` (`gene_id`);--> statement-breakpoint
ALTER TABLE `routines` ADD `gene_id` text;--> statement-breakpoint
ALTER TABLE `routines` ADD `cloned_from` integer;--> statement-breakpoint
CREATE UNIQUE INDEX `routines_gene_user_idx` ON `routines` (`gene_id`,`user_id`) WHERE "routines"."gene_id" is not null;--> statement-breakpoint
CREATE UNIQUE INDEX `routines_gene_team_idx` ON `routines` (`gene_id`,`team_id`) WHERE "routines"."gene_id" is not null;--> statement-breakpoint
ALTER TABLE `songs` ADD `gene_id` text;--> statement-breakpoint
ALTER TABLE `songs` ADD `cloned_from` integer;--> statement-breakpoint
CREATE UNIQUE INDEX `songs_gene_user_idx` ON `songs` (`gene_id`,`user_id`) WHERE "songs"."gene_id" is not null;--> statement-breakpoint
CREATE UNIQUE INDEX `songs_gene_team_idx` ON `songs` (`gene_id`,`team_id`) WHERE "songs"."gene_id" is not null;--> statement-breakpoint
ALTER TABLE `video_spots` ADD `gene_id` text;--> statement-breakpoint
ALTER TABLE `video_spots` ADD `cloned_from` integer;--> statement-breakpoint
CREATE INDEX `video_spots_gene_idx` ON `video_spots` (`gene_id`);