CREATE TABLE `device_slots` (
	`slot` integer PRIMARY KEY NOT NULL,
	`device_key` text NOT NULL,
	`user_id` text NOT NULL,
	`created_at` integer NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `device_slots_device_key_unique` ON `device_slots` (`device_key`);--> statement-breakpoint
CREATE TABLE `sync_landed` (
	`entry_id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`landed_at` integer NOT NULL
);
