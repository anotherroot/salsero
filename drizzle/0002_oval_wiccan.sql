ALTER TABLE `exercises` ADD `song_id` integer REFERENCES songs(id);--> statement-breakpoint
ALTER TABLE `exercises` ADD `count_bpm` integer;--> statement-breakpoint
ALTER TABLE `figures` ADD `call_text` text;--> statement-breakpoint
ALTER TABLE `sets` ADD `player_json` text;