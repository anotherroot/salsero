CREATE TABLE `routine_step_options` (
	`step_id` integer NOT NULL,
	`figure_id` integer NOT NULL,
	`created_at` integer NOT NULL,
	PRIMARY KEY(`step_id`, `figure_id`),
	FOREIGN KEY (`step_id`) REFERENCES `routine_steps`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`figure_id`) REFERENCES `figures`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `routine_step_options_figure_idx` ON `routine_step_options` (`figure_id`);--> statement-breakpoint
CREATE TABLE `routine_steps` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`routine_id` integer NOT NULL,
	`position` integer NOT NULL,
	`child_routine_id` integer,
	`note` text,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`routine_id`) REFERENCES `routines`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`child_routine_id`) REFERENCES `routines`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `routine_steps_slot_idx` ON `routine_steps` (`routine_id`,`position`);--> statement-breakpoint
CREATE INDEX `routine_steps_child_idx` ON `routine_steps` (`child_routine_id`);--> statement-breakpoint
CREATE TABLE `routines` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`dance` text DEFAULT 'salsa' NOT NULL,
	`name` text NOT NULL,
	`notes` text,
	`archived_at` integer,
	`created_at` integer NOT NULL
);
--> statement-breakpoint
CREATE INDEX `routines_dance_idx` ON `routines` (`dance`,`archived_at`);--> statement-breakpoint
ALTER TABLE `exercises` ADD `routine_id` integer REFERENCES routines(id);