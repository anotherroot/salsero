CREATE TABLE `song_imports` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`user_id` text,
	`team_id` integer,
	`dance` text NOT NULL,
	`url` text NOT NULL,
	`kind` text NOT NULL,
	`name` text,
	`status` text NOT NULL,
	`error` text,
	`attempts` integer DEFAULT 0 NOT NULL,
	`claimed_at` integer,
	`items_json` text,
	`truncated` integer DEFAULT 0 NOT NULL,
	`created_at` integer NOT NULL,
	`added_at` integer,
	`dismissed_at` integer,
	FOREIGN KEY (`team_id`) REFERENCES `teams`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `song_imports_status_idx` ON `song_imports` (`status`,`created_at`);--> statement-breakpoint
CREATE INDEX `song_imports_user_idx` ON `song_imports` (`user_id`,`dance`);--> statement-breakpoint
CREATE INDEX `song_imports_team_idx` ON `song_imports` (`team_id`,`dance`);--> statement-breakpoint
CREATE TRIGGER song_imports_id_mark AFTER INSERT ON song_imports BEGIN
  INSERT OR IGNORE INTO id_marks (tbl, slot, hi) VALUES ('song_imports', NEW.id >> 32, NEW.id);
  UPDATE id_marks SET hi = max(hi, NEW.id) WHERE tbl = 'song_imports' AND slot = NEW.id >> 32;
END;
