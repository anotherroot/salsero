CREATE TABLE `opens` (
	`user_id` text NOT NULL,
	`kind` text NOT NULL,
	`item_id` integer NOT NULL,
	`opened_at` integer NOT NULL,
	PRIMARY KEY(`user_id`, `kind`, `item_id`)
);
