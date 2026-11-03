CREATE TABLE `song_drops` (
	`exercise_id` integer NOT NULL,
	`song_id` integer NOT NULL,
	`dropped_at` integer NOT NULL,
	PRIMARY KEY(`exercise_id`, `song_id`)
);
--> statement-breakpoint
ALTER TABLE `songs` ADD `team_id` integer REFERENCES teams(id);--> statement-breakpoint
ALTER TABLE `songs` ADD `shared_at` integer;--> statement-breakpoint
CREATE INDEX `songs_team_idx` ON `songs` (`team_id`,`dance`);