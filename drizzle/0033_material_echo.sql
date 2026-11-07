DROP INDEX `users_email_unique`;--> statement-breakpoint
ALTER TABLE `users` ADD `dance` text;--> statement-breakpoint
CREATE UNIQUE INDEX `users_dance_email_idx` ON `users` (`dance`,`email`);--> statement-breakpoint
ALTER TABLE `invites` ADD `dance` text;