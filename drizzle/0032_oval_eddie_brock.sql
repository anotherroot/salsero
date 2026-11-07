CREATE TABLE `song_links` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`song_id` integer NOT NULL,
	`lesson_id` integer,
	`exercise_id` integer,
	`routine_id` integer,
	`note` text,
	`sort_order` integer NOT NULL,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`song_id`) REFERENCES `songs`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`lesson_id`) REFERENCES `lessons`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`exercise_id`) REFERENCES `exercises`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`routine_id`) REFERENCES `routines`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `song_links_song_idx` ON `song_links` (`song_id`);--> statement-breakpoint
CREATE UNIQUE INDEX `song_links_lesson_song_idx` ON `song_links` (`lesson_id`,`song_id`);--> statement-breakpoint
CREATE UNIQUE INDEX `song_links_exercise_song_idx` ON `song_links` (`exercise_id`,`song_id`);--> statement-breakpoint
CREATE UNIQUE INDEX `song_links_routine_song_idx` ON `song_links` (`routine_id`,`song_id`);