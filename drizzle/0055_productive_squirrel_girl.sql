CREATE TABLE `video_loops` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`spot_id` integer NOT NULL,
	`start_ms` integer NOT NULL,
	`end_ms` integer NOT NULL,
	`status` text NOT NULL,
	`error` text,
	`attempts` integer DEFAULT 0 NOT NULL,
	`claimed_at` integer,
	`failed_at` integer,
	`ready_at` integer,
	`created_at` integer NOT NULL,
	CONSTRAINT "video_loops_status_ck" CHECK("video_loops"."status" in ('queued', 'ready', 'failed'))
);
--> statement-breakpoint
CREATE UNIQUE INDEX `video_loops_span_idx` ON `video_loops` (`spot_id`,`start_ms`,`end_ms`);--> statement-breakpoint
CREATE TRIGGER video_loops_id_mark AFTER INSERT ON video_loops BEGIN
  INSERT OR IGNORE INTO id_marks (tbl, slot, hi) VALUES ('video_loops', NEW.id >> 32, NEW.id);
  UPDATE id_marks SET hi = max(hi, NEW.id) WHERE tbl = 'video_loops' AND slot = NEW.id >> 32;
END;
