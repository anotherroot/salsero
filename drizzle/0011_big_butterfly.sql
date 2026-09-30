ALTER TABLE `figures` ADD `parent_id` integer REFERENCES figures(id);--> statement-breakpoint
CREATE INDEX `figures_parent_idx` ON `figures` (`parent_id`);