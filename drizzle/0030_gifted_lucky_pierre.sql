CREATE TABLE `today_picks` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`user_id` text NOT NULL,
	`exercise_id` integer NOT NULL,
	`day` text NOT NULL,
	`kind` text NOT NULL,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`exercise_id`) REFERENCES `exercises`(`id`) ON UPDATE no action ON DELETE no action,
	CONSTRAINT "today_picks_kind_ck" CHECK("today_picks"."kind" in ('next', 'add', 'skip'))
);
--> statement-breakpoint
CREATE INDEX `today_picks_user_day_idx` ON `today_picks` (`user_id`,`day`);--> statement-breakpoint
ALTER TABLE `users` ADD `daily_count` integer;