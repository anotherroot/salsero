CREATE TABLE `figure_end_positions` (
	`figure_id` integer NOT NULL,
	`position_id` integer NOT NULL,
	`created_at` integer NOT NULL,
	PRIMARY KEY(`figure_id`, `position_id`),
	FOREIGN KEY (`figure_id`) REFERENCES `figures`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`position_id`) REFERENCES `positions`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `figure_end_positions_position_idx` ON `figure_end_positions` (`position_id`);--> statement-breakpoint
CREATE TABLE `lesson_positions` (
	`lesson_id` integer NOT NULL,
	`position_id` integer NOT NULL,
	`created_at` integer NOT NULL,
	PRIMARY KEY(`lesson_id`, `position_id`),
	FOREIGN KEY (`lesson_id`) REFERENCES `lessons`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`position_id`) REFERENCES `positions`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `lesson_positions_position_idx` ON `lesson_positions` (`position_id`);--> statement-breakpoint
CREATE TABLE `spot_position_links` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`spot_id` integer NOT NULL,
	`position_id` integer NOT NULL,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`spot_id`) REFERENCES `video_spots`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`position_id`) REFERENCES `positions`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `spot_position_links_unique_idx` ON `spot_position_links` (`spot_id`,`position_id`);--> statement-breakpoint
CREATE INDEX `spot_position_links_position_idx` ON `spot_position_links` (`position_id`);--> statement-breakpoint
DROP INDEX `positions_dance_slug_idx`;--> statement-breakpoint
ALTER TABLE `positions` ADD `user_id` text;--> statement-breakpoint
ALTER TABLE `positions` ADD `team_id` integer;--> statement-breakpoint
ALTER TABLE `positions` ADD `gene_id` text;--> statement-breakpoint
ALTER TABLE `positions` ADD `cloned_from` integer;--> statement-breakpoint
ALTER TABLE `positions` ADD `style_tag` text;--> statement-breakpoint
ALTER TABLE `positions` ADD `hands` text;--> statement-breakpoint
ALTER TABLE `positions` ADD `crossed` integer;--> statement-breakpoint
ALTER TABLE `positions` ADD `facing` text;--> statement-breakpoint
ALTER TABLE `positions` ADD `frame` text;--> statement-breakpoint
ALTER TABLE `positions` ADD `notes` text;--> statement-breakpoint
ALTER TABLE `positions` ADD `picture_spot_id` integer;--> statement-breakpoint
CREATE INDEX `positions_user_idx` ON `positions` (`user_id`,`dance`);--> statement-breakpoint
CREATE INDEX `positions_team_idx` ON `positions` (`team_id`,`dance`);--> statement-breakpoint
CREATE UNIQUE INDEX `positions_gene_user_idx` ON `positions` (`gene_id`,`user_id`) WHERE "positions"."gene_id" is not null;--> statement-breakpoint
CREATE UNIQUE INDEX `positions_gene_team_idx` ON `positions` (`gene_id`,`team_id`) WHERE "positions"."gene_id" is not null;