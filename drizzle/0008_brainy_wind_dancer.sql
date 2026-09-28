CREATE TABLE `app_flags` (
	`key` text PRIMARY KEY NOT NULL,
	`done_at` integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE `links` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`lesson_id` integer,
	`figure_id` integer,
	`exercise_id` integer,
	`url` text NOT NULL,
	`title` text,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`lesson_id`) REFERENCES `lessons`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`figure_id`) REFERENCES `figures`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`exercise_id`) REFERENCES `exercises`(`id`) ON UPDATE no action ON DELETE no action,
	CONSTRAINT "links_owner_ck" CHECK(("links"."lesson_id" is not null) + ("links"."figure_id" is not null) + ("links"."exercise_id" is not null) = 1)
);
--> statement-breakpoint
CREATE INDEX `links_lesson_idx` ON `links` (`lesson_id`);--> statement-breakpoint
CREATE INDEX `links_figure_idx` ON `links` (`figure_id`);--> statement-breakpoint
CREATE INDEX `links_exercise_idx` ON `links` (`exercise_id`);--> statement-breakpoint
ALTER TABLE `exercises` ADD `practice_json` text;