CREATE TABLE `app_installs` (
	`user_id` text NOT NULL,
	`dance` text NOT NULL,
	`version_code` integer NOT NULL,
	`channel` text NOT NULL,
	`seen_at` integer NOT NULL,
	PRIMARY KEY(`user_id`, `dance`),
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
