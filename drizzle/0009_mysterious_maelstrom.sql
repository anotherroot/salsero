CREATE TABLE `lesson_routines` (
	`lesson_id` integer NOT NULL,
	`routine_id` integer NOT NULL,
	`created_at` integer NOT NULL,
	PRIMARY KEY(`lesson_id`, `routine_id`),
	FOREIGN KEY (`lesson_id`) REFERENCES `lessons`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`routine_id`) REFERENCES `routines`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `lesson_routines_routine_idx` ON `lesson_routines` (`routine_id`);