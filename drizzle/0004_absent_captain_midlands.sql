CREATE TABLE `lesson_exercises` (
	`lesson_id` integer NOT NULL,
	`exercise_id` integer NOT NULL,
	`created_at` integer NOT NULL,
	PRIMARY KEY(`lesson_id`, `exercise_id`),
	FOREIGN KEY (`lesson_id`) REFERENCES `lessons`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`exercise_id`) REFERENCES `exercises`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `lesson_exercises_exercise_idx` ON `lesson_exercises` (`exercise_id`);--> statement-breakpoint
CREATE TABLE `lesson_figures` (
	`lesson_id` integer NOT NULL,
	`figure_id` integer NOT NULL,
	`created_at` integer NOT NULL,
	PRIMARY KEY(`lesson_id`, `figure_id`),
	FOREIGN KEY (`lesson_id`) REFERENCES `lessons`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`figure_id`) REFERENCES `figures`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `lesson_figures_figure_idx` ON `lesson_figures` (`figure_id`);--> statement-breakpoint
CREATE TABLE `lesson_videos` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`lesson_id` integer NOT NULL,
	`file` text NOT NULL,
	`mime` text NOT NULL,
	`size_bytes` integer NOT NULL,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`lesson_id`) REFERENCES `lessons`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `lesson_videos_file_unique` ON `lesson_videos` (`file`);--> statement-breakpoint
CREATE INDEX `lesson_videos_lesson_idx` ON `lesson_videos` (`lesson_id`);--> statement-breakpoint
CREATE TABLE `lessons` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`lesson_day` text NOT NULL,
	`title` text NOT NULL,
	`notes` text,
	`archived_at` integer,
	`created_at` integer NOT NULL,
	CONSTRAINT "lessons_day_ck" CHECK("lessons"."lesson_day" glob '[0-9][0-9][0-9][0-9]-[0-9][0-9]-[0-9][0-9]')
);
--> statement-breakpoint
CREATE INDEX `lessons_day_idx` ON `lessons` (`lesson_day`);--> statement-breakpoint
ALTER TABLE `exercises` ADD `lesson_id` integer REFERENCES lessons(id);