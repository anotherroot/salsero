CREATE TABLE `device_tokens` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`user_id` text NOT NULL,
	`token_hash` text NOT NULL,
	`label` text NOT NULL,
	`created_at` integer NOT NULL,
	`last_used_at` integer,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `device_tokens_token_hash_unique` ON `device_tokens` (`token_hash`);--> statement-breakpoint
ALTER TABLE `users` ADD `reminder_minute` integer;--> statement-breakpoint
ALTER TABLE `users` ADD `video_short_side` integer DEFAULT 480 NOT NULL;