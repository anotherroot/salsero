CREATE TABLE `video_spots` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`recording_id` integer,
	`lesson_video_id` integer,
	`start_ms` integer NOT NULL,
	`end_ms` integer,
	`label` text,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`recording_id`) REFERENCES `recordings`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`lesson_video_id`) REFERENCES `lesson_videos`(`id`) ON UPDATE no action ON DELETE no action,
	CONSTRAINT "video_spots_owner_ck" CHECK(("video_spots"."recording_id" is not null) + ("video_spots"."lesson_video_id" is not null) = 1),
	CONSTRAINT "video_spots_span_ck" CHECK("video_spots"."start_ms" >= 0 and ("video_spots"."end_ms" is null or "video_spots"."end_ms" > "video_spots"."start_ms"))
);
--> statement-breakpoint
CREATE INDEX `video_spots_recording_idx` ON `video_spots` (`recording_id`);--> statement-breakpoint
CREATE INDEX `video_spots_lesson_video_idx` ON `video_spots` (`lesson_video_id`);