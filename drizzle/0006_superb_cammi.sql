CREATE TABLE `figure_start_positions` (
	`figure_id` integer NOT NULL,
	`position_id` integer NOT NULL,
	`created_at` integer NOT NULL,
	PRIMARY KEY(`figure_id`, `position_id`),
	FOREIGN KEY (`figure_id`) REFERENCES `figures`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`position_id`) REFERENCES `positions`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `figure_start_positions_position_idx` ON `figure_start_positions` (`position_id`);--> statement-breakpoint
CREATE TABLE `positions` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`dance` text DEFAULT 'salsa' NOT NULL,
	`slug` text NOT NULL,
	`name` text NOT NULL,
	`neutral` integer DEFAULT false NOT NULL,
	`sort_order` integer DEFAULT 0 NOT NULL,
	`archived_at` integer,
	`created_at` integer NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `positions_dance_slug_idx` ON `positions` (`dance`,`slug`);--> statement-breakpoint
ALTER TABLE `figures` ADD `end_position_id` integer REFERENCES positions(id);--> statement-breakpoint
ALTER TABLE `figures` ADD `eights` integer DEFAULT 1 NOT NULL;