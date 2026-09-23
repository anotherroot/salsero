CREATE TABLE `count_takes` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`pattern` text NOT NULL,
	`bpm` integer NOT NULL,
	`phrase` text NOT NULL,
	`file` text NOT NULL,
	`sample_rate` integer NOT NULL,
	`pre_roll_s` real NOT NULL,
	`length_s` real NOT NULL,
	`duration_s` real NOT NULL,
	`size_bytes` integer NOT NULL,
	`created_at` integer NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `count_takes_file_unique` ON `count_takes` (`file`);--> statement-breakpoint
CREATE UNIQUE INDEX `count_takes_slot_idx` ON `count_takes` (`pattern`,`bpm`,`phrase`);