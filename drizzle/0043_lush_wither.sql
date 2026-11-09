CREATE TABLE `oauth_clients` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`client_id` text NOT NULL,
	`client_name` text,
	`redirect_uris` text NOT NULL,
	`created_at` integer NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `oauth_clients_client_id_unique` ON `oauth_clients` (`client_id`);--> statement-breakpoint
CREATE TABLE `oauth_codes` (
	`hash` text PRIMARY KEY NOT NULL,
	`grant_id` integer NOT NULL,
	`code_challenge` text NOT NULL,
	`redirect_uri` text NOT NULL,
	`expires_at` integer NOT NULL,
	`used_at` integer,
	FOREIGN KEY (`grant_id`) REFERENCES `oauth_grants`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `oauth_grants` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`user_id` text NOT NULL,
	`client_id` text NOT NULL,
	`client_name` text,
	`redirect_uri` text NOT NULL,
	`created_at` integer NOT NULL,
	`last_used_at` integer,
	`revoked_at` integer,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `oauth_grants_user_idx` ON `oauth_grants` (`user_id`);--> statement-breakpoint
CREATE TABLE `oauth_tokens` (
	`hash` text PRIMARY KEY NOT NULL,
	`grant_id` integer NOT NULL,
	`kind` text NOT NULL,
	`expires_at` integer NOT NULL,
	`replaced_at` integer,
	FOREIGN KEY (`grant_id`) REFERENCES `oauth_grants`(`id`) ON UPDATE no action ON DELETE cascade,
	CONSTRAINT "oauth_tokens_kind_ck" CHECK("oauth_tokens"."kind" in ('access', 'refresh'))
);
--> statement-breakpoint
CREATE INDEX `oauth_tokens_grant_idx` ON `oauth_tokens` (`grant_id`);--> statement-breakpoint
CREATE TRIGGER oauth_clients_id_mark AFTER INSERT ON oauth_clients BEGIN
  INSERT OR IGNORE INTO id_marks (tbl, slot, hi) VALUES ('oauth_clients', NEW.id >> 32, NEW.id);
  UPDATE id_marks SET hi = max(hi, NEW.id) WHERE tbl = 'oauth_clients' AND slot = NEW.id >> 32;
END;
--> statement-breakpoint
CREATE TRIGGER oauth_grants_id_mark AFTER INSERT ON oauth_grants BEGIN
  INSERT OR IGNORE INTO id_marks (tbl, slot, hi) VALUES ('oauth_grants', NEW.id >> 32, NEW.id);
  UPDATE id_marks SET hi = max(hi, NEW.id) WHERE tbl = 'oauth_grants' AND slot = NEW.id >> 32;
END;
