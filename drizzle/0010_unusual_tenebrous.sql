ALTER TABLE `figures` ADD `start_count` integer;--> statement-breakpoint
ALTER TABLE `figures` ADD `length_counts` integer;--> statement-breakpoint
UPDATE `figures` SET `length_counts` = `eights` * 8;
