CREATE TABLE `songs` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`title` text DEFAULT '' NOT NULL,
	`artist` text,
	`style` text DEFAULT 'salsa' NOT NULL,
	`source_url` text,
	`status` text NOT NULL,
	`error` text,
	`attempts` integer DEFAULT 0 NOT NULL,
	`claimed_at` integer,
	`audio_file` text,
	`mime` text,
	`duration_s` real,
	`bpm` real,
	`beats_json` text,
	`downbeats_json` text,
	`anchors_json` text DEFAULT '[]' NOT NULL,
	`tempo_factor` real DEFAULT 1 NOT NULL,
	`archived_at` integer,
	`created_at` integer NOT NULL,
	CONSTRAINT "songs_tempo_ck" CHECK("songs"."tempo_factor" in (0.5, 1, 2)),
	CONSTRAINT "songs_source_ck" CHECK("songs"."source_url" is not null or "songs"."audio_file" is not null)
);
--> statement-breakpoint
CREATE UNIQUE INDEX `songs_audio_file_unique` ON `songs` (`audio_file`);--> statement-breakpoint
CREATE INDEX `songs_status_idx` ON `songs` (`status`,`created_at`);