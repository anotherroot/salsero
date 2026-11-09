CREATE TABLE `ai_timelines` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`lesson_video_id` integer,
	`recording_id` integer,
	`status` text NOT NULL,
	`error` text,
	`attempts` integer DEFAULT 0 NOT NULL,
	`claimed_at` integer,
	`failed_at` integer,
	`pieces` integer,
	`duration_ms` integer,
	`ready_at` integer,
	`used_at` integer,
	`created_at` integer NOT NULL,
	CONSTRAINT "ai_timelines_owner_ck" CHECK(("ai_timelines"."lesson_video_id" is not null) + ("ai_timelines"."recording_id" is not null) = 1),
	CONSTRAINT "ai_timelines_status_ck" CHECK("ai_timelines"."status" in ('queued', 'ready', 'failed'))
);
--> statement-breakpoint
CREATE UNIQUE INDEX `ai_timelines_lesson_video_idx` ON `ai_timelines` (`lesson_video_id`);--> statement-breakpoint
CREATE UNIQUE INDEX `ai_timelines_recording_idx` ON `ai_timelines` (`recording_id`);--> statement-breakpoint
CREATE TRIGGER ai_timelines_id_mark AFTER INSERT ON ai_timelines BEGIN
  INSERT OR IGNORE INTO id_marks (tbl, slot, hi) VALUES ('ai_timelines', NEW.id >> 32, NEW.id);
  UPDATE id_marks SET hi = max(hi, NEW.id) WHERE tbl = 'ai_timelines' AND slot = NEW.id >> 32;
END;
