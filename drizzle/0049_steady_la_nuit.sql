ALTER TABLE `device_slots` ADD `label` text;--> statement-breakpoint
ALTER TABLE `lesson_videos` ADD `server_copy` integer DEFAULT true NOT NULL;--> statement-breakpoint
ALTER TABLE `lesson_videos` ADD `origin_slot` integer;--> statement-breakpoint
ALTER TABLE `lesson_videos` ADD `origin_bytes` integer;--> statement-breakpoint
ALTER TABLE `recordings` ADD `server_copy` integer DEFAULT true NOT NULL;--> statement-breakpoint
ALTER TABLE `recordings` ADD `origin_slot` integer;--> statement-breakpoint
ALTER TABLE `recordings` ADD `origin_bytes` integer;