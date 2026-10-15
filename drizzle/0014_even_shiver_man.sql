CREATE TABLE `video_downloads` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`link_id` integer NOT NULL,
	`figure_id` integer,
	`lesson_id` integer,
	`url` text NOT NULL,
	`status` text NOT NULL,
	`error` text,
	`attempts` integer DEFAULT 0 NOT NULL,
	`claimed_at` integer,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`link_id`) REFERENCES `links`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`figure_id`) REFERENCES `figures`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`lesson_id`) REFERENCES `lessons`(`id`) ON UPDATE no action ON DELETE no action,
	CONSTRAINT "video_downloads_owner_ck" CHECK(("video_downloads"."figure_id" is not null) + ("video_downloads"."lesson_id" is not null) = 1),
	CONSTRAINT "video_downloads_status_ck" CHECK("video_downloads"."status" in ('queued', 'failed'))
);
--> statement-breakpoint
CREATE UNIQUE INDEX `video_downloads_link_id_unique` ON `video_downloads` (`link_id`);--> statement-breakpoint
CREATE INDEX `video_downloads_status_idx` ON `video_downloads` (`status`,`created_at`);--> statement-breakpoint
ALTER TABLE `lesson_videos` ADD `source_url` text;--> statement-breakpoint
ALTER TABLE `recordings` ADD `source_url` text;