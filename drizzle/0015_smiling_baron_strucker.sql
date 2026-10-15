CREATE TABLE `spot_links` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`spot_id` integer NOT NULL,
	`figure_id` integer,
	`exercise_id` integer,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`spot_id`) REFERENCES `video_spots`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`figure_id`) REFERENCES `figures`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`exercise_id`) REFERENCES `exercises`(`id`) ON UPDATE no action ON DELETE no action,
	CONSTRAINT "spot_links_target_ck" CHECK(("spot_links"."figure_id" is not null) + ("spot_links"."exercise_id" is not null) = 1)
);
--> statement-breakpoint
CREATE UNIQUE INDEX `spot_links_spot_figure_idx` ON `spot_links` (`spot_id`,`figure_id`);--> statement-breakpoint
CREATE UNIQUE INDEX `spot_links_spot_exercise_idx` ON `spot_links` (`spot_id`,`exercise_id`);--> statement-breakpoint
CREATE INDEX `spot_links_figure_idx` ON `spot_links` (`figure_id`);--> statement-breakpoint
CREATE INDEX `spot_links_exercise_idx` ON `spot_links` (`exercise_id`);