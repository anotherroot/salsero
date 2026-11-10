CREATE TABLE `feedback` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`user_id` text NOT NULL,
	`dance` text NOT NULL,
	`message` text NOT NULL,
	`page` text,
	`trail` text DEFAULT '[]' NOT NULL,
	`errors` text DEFAULT '[]' NOT NULL,
	`site_version` text,
	`app_version` integer,
	`app_channel` text,
	`user_agent` text,
	`viewport` text,
	`created_at` integer NOT NULL,
	`done_at` integer,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `feedback_dance_idx` ON `feedback` (`dance`,`done_at`);--> statement-breakpoint
CREATE TRIGGER feedback_id_mark AFTER INSERT ON feedback BEGIN
  INSERT OR IGNORE INTO id_marks (tbl, slot, hi) VALUES ('feedback', NEW.id >> 32, NEW.id);
  UPDATE id_marks SET hi = max(hi, NEW.id) WHERE tbl = 'feedback' AND slot = NEW.id >> 32;
END;
