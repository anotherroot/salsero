ALTER TABLE `songs` ADD `sections_json` text DEFAULT '[]' NOT NULL;--> statement-breakpoint
ALTER TABLE `songs` ADD `start_found_s` real;--> statement-breakpoint
ALTER TABLE `songs` ADD `start_s` real;