CREATE TABLE `exercises` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`name` text NOT NULL,
	`source` text NOT NULL,
	`figure_id` integer,
	`practice_mode` text DEFAULT 'none' NOT NULL,
	`every_days` real DEFAULT 3 NOT NULL,
	`active` integer DEFAULT true NOT NULL,
	`archived_at` integer,
	`notes` text,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`figure_id`) REFERENCES `figures`(`id`) ON UPDATE no action ON DELETE no action,
	CONSTRAINT "exercises_every_days_ck" CHECK("exercises"."every_days" > 0),
	CONSTRAINT "exercises_source_ck" CHECK(("exercises"."source" = 'figure') = ("exercises"."figure_id" is not null))
);
--> statement-breakpoint
CREATE INDEX `exercises_figure_idx` ON `exercises` (`figure_id`);--> statement-breakpoint
CREATE TABLE `figures` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`name` text NOT NULL,
	`notes` text,
	`partner` text DEFAULT 'partner' NOT NULL,
	`style` text DEFAULT 'salsa' NOT NULL,
	`callable` integer DEFAULT true NOT NULL,
	`archived_at` integer,
	`created_at` integer NOT NULL,
	CONSTRAINT "figures_partner_ck" CHECK("figures"."partner" in ('partner', 'solo')),
	CONSTRAINT "figures_style_ck" CHECK("figures"."style" in ('salsa', 'son', 'other'))
);
--> statement-breakpoint
CREATE TABLE `login_attempts` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`key` text NOT NULL,
	`attempted_at` integer NOT NULL
);
--> statement-breakpoint
CREATE INDEX `login_attempts_key_time_idx` ON `login_attempts` (`key`,`attempted_at`);--> statement-breakpoint
CREATE TABLE `recordings` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`figure_id` integer NOT NULL,
	`file` text NOT NULL,
	`mime` text NOT NULL,
	`kind` text NOT NULL,
	`size_bytes` integer NOT NULL,
	`note` text,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`figure_id`) REFERENCES `figures`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `recordings_file_unique` ON `recordings` (`file`);--> statement-breakpoint
CREATE INDEX `recordings_figure_idx` ON `recordings` (`figure_id`);--> statement-breakpoint
CREATE TABLE `sessions` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`expires_at` integer NOT NULL,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `sets` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`exercise_id` integer NOT NULL,
	`done_at` integer NOT NULL,
	`duration_s` integer,
	`reps` integer,
	`rating` integer,
	`note` text,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`exercise_id`) REFERENCES `exercises`(`id`) ON UPDATE no action ON DELETE no action,
	CONSTRAINT "sets_rating_ck" CHECK("sets"."rating" is null or "sets"."rating" between 1 and 5)
);
--> statement-breakpoint
CREATE INDEX `sets_exercise_time_idx` ON `sets` (`exercise_id`,`done_at`);--> statement-breakpoint
CREATE INDEX `sets_time_idx` ON `sets` (`done_at`);--> statement-breakpoint
CREATE TABLE `users` (
	`id` text PRIMARY KEY NOT NULL,
	`email` text NOT NULL,
	`password_hash` text NOT NULL,
	`timezone` text DEFAULT 'Europe/Ljubljana' NOT NULL,
	`created_at` integer NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `users_email_unique` ON `users` (`email`);