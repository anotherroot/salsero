ALTER TABLE `exercises` ADD `dance` text DEFAULT 'salsa' NOT NULL;--> statement-breakpoint
ALTER TABLE `figures` ADD `dance` text DEFAULT 'salsa' NOT NULL;--> statement-breakpoint
ALTER TABLE `figures` ADD `style_tag` text;--> statement-breakpoint
ALTER TABLE `lessons` ADD `dance` text DEFAULT 'salsa' NOT NULL;--> statement-breakpoint
ALTER TABLE `songs` ADD `dance` text DEFAULT 'salsa' NOT NULL;--> statement-breakpoint
UPDATE `figures` SET `style_tag` = `style`;