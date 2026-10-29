CREATE TABLE `default_styles` (
	`user_id` text NOT NULL,
	`dance` text NOT NULL,
	`style` text NOT NULL,
	PRIMARY KEY(`user_id`, `dance`),
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
