CREATE TABLE `invites` (
	`id` text PRIMARY KEY NOT NULL,
	`code_hash` text NOT NULL,
	`created_by` text NOT NULL,
	`created_at` integer NOT NULL,
	`expires_at` integer NOT NULL,
	`used_at` integer,
	`used_by` text
);
--> statement-breakpoint
CREATE UNIQUE INDEX `invites_code_hash_unique` ON `invites` (`code_hash`);--> statement-breakpoint
CREATE TABLE `storage_requests` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`user_id` text NOT NULL,
	`note` text,
	`created_at` integer NOT NULL,
	`resolved_at` integer,
	`outcome` text,
	`granted_limit_bytes` integer
);
--> statement-breakpoint
CREATE INDEX `storage_requests_user_idx` ON `storage_requests` (`user_id`,`resolved_at`);--> statement-breakpoint
DROP INDEX `count_takes_slot_idx`;--> statement-breakpoint
ALTER TABLE `count_takes` ADD `user_id` text;--> statement-breakpoint
CREATE UNIQUE INDEX `count_takes_user_slot_idx` ON `count_takes` (`user_id`,`pattern`,`bpm`,`phrase`);--> statement-breakpoint
CREATE INDEX `count_takes_user_idx` ON `count_takes` (`user_id`);--> statement-breakpoint
ALTER TABLE `exercises` ADD `user_id` text;--> statement-breakpoint
CREATE INDEX `exercises_user_idx` ON `exercises` (`user_id`,`dance`);--> statement-breakpoint
ALTER TABLE `figure_groups` ADD `user_id` text;--> statement-breakpoint
CREATE INDEX `figure_groups_user_idx` ON `figure_groups` (`user_id`,`dance`);--> statement-breakpoint
ALTER TABLE `figures` ADD `user_id` text;--> statement-breakpoint
CREATE INDEX `figures_user_idx` ON `figures` (`user_id`,`dance`);--> statement-breakpoint
ALTER TABLE `lessons` ADD `user_id` text;--> statement-breakpoint
CREATE INDEX `lessons_user_idx` ON `lessons` (`user_id`,`dance`);--> statement-breakpoint
ALTER TABLE `routines` ADD `user_id` text;--> statement-breakpoint
CREATE INDEX `routines_user_idx` ON `routines` (`user_id`,`dance`);--> statement-breakpoint
ALTER TABLE `songs` ADD `user_id` text;--> statement-breakpoint
ALTER TABLE `songs` ADD `size_bytes` integer;--> statement-breakpoint
CREATE INDEX `songs_user_idx` ON `songs` (`user_id`,`dance`);--> statement-breakpoint
ALTER TABLE `users` ADD `is_admin` integer DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE `users` ADD `storage_limit_bytes` integer;--> statement-breakpoint
UPDATE `figure_groups` SET `user_id` = (SELECT `id` FROM `users` ORDER BY rowid LIMIT 1) WHERE `user_id` IS NULL;--> statement-breakpoint
UPDATE `figures` SET `user_id` = (SELECT `id` FROM `users` ORDER BY rowid LIMIT 1) WHERE `user_id` IS NULL;--> statement-breakpoint
UPDATE `songs` SET `user_id` = (SELECT `id` FROM `users` ORDER BY rowid LIMIT 1) WHERE `user_id` IS NULL;--> statement-breakpoint
UPDATE `exercises` SET `user_id` = (SELECT `id` FROM `users` ORDER BY rowid LIMIT 1) WHERE `user_id` IS NULL;--> statement-breakpoint
UPDATE `lessons` SET `user_id` = (SELECT `id` FROM `users` ORDER BY rowid LIMIT 1) WHERE `user_id` IS NULL;--> statement-breakpoint
UPDATE `routines` SET `user_id` = (SELECT `id` FROM `users` ORDER BY rowid LIMIT 1) WHERE `user_id` IS NULL;--> statement-breakpoint
UPDATE `count_takes` SET `user_id` = (SELECT `id` FROM `users` ORDER BY rowid LIMIT 1) WHERE `user_id` IS NULL;--> statement-breakpoint
UPDATE `users` SET `is_admin` = 1 WHERE rowid = (SELECT min(rowid) FROM `users`);
