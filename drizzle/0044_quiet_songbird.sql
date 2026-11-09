CREATE TABLE `ai_actions` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`user_id` text NOT NULL,
	`dance` text NOT NULL,
	`group_id` integer NOT NULL,
	`sort` integer NOT NULL,
	`title` text NOT NULL,
	`grant_id` integer,
	`needs` text DEFAULT '[]' NOT NULL,
	`version` integer DEFAULT 1 NOT NULL,
	`previous` text,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`group_id`) REFERENCES `ai_groups`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`grant_id`) REFERENCES `oauth_grants`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE INDEX `ai_actions_user_idx` ON `ai_actions` (`user_id`,`dance`);--> statement-breakpoint
CREATE TABLE `ai_groups` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`user_id` text NOT NULL,
	`dance` text NOT NULL,
	`title` text NOT NULL,
	`sort` integer NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `ai_groups_user_idx` ON `ai_groups` (`user_id`,`dance`);--> statement-breakpoint
CREATE TABLE `ai_lines` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`action_id` integer NOT NULL,
	`sort` integer NOT NULL,
	`kind` text NOT NULL,
	`payload` text NOT NULL,
	`before` text,
	`status` text DEFAULT 'pending' NOT NULL,
	`refusal` text,
	`result` text,
	`ran_at` integer,
	`undone_at` integer,
	FOREIGN KEY (`action_id`) REFERENCES `ai_actions`(`id`) ON UPDATE no action ON DELETE cascade,
	CONSTRAINT "ai_lines_status_ck" CHECK("ai_lines"."status" in ('pending', 'left_out', 'done', 'dropped', 'withdrawn', 'undone'))
);
--> statement-breakpoint
CREATE INDEX `ai_lines_action_idx` ON `ai_lines` (`action_id`);--> statement-breakpoint
CREATE TRIGGER ai_groups_id_mark AFTER INSERT ON ai_groups BEGIN
  INSERT OR IGNORE INTO id_marks (tbl, slot, hi) VALUES ('ai_groups', NEW.id >> 32, NEW.id);
  UPDATE id_marks SET hi = max(hi, NEW.id) WHERE tbl = 'ai_groups' AND slot = NEW.id >> 32;
END;
--> statement-breakpoint
CREATE TRIGGER ai_actions_id_mark AFTER INSERT ON ai_actions BEGIN
  INSERT OR IGNORE INTO id_marks (tbl, slot, hi) VALUES ('ai_actions', NEW.id >> 32, NEW.id);
  UPDATE id_marks SET hi = max(hi, NEW.id) WHERE tbl = 'ai_actions' AND slot = NEW.id >> 32;
END;
--> statement-breakpoint
CREATE TRIGGER ai_lines_id_mark AFTER INSERT ON ai_lines BEGIN
  INSERT OR IGNORE INTO id_marks (tbl, slot, hi) VALUES ('ai_lines', NEW.id >> 32, NEW.id);
  UPDATE id_marks SET hi = max(hi, NEW.id) WHERE tbl = 'ai_lines' AND slot = NEW.id >> 32;
END;
