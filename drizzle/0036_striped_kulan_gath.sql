ALTER TABLE `exercises` ADD `comes_back` text;--> statement-breakpoint
ALTER TABLE `exercises` ADD `warmup` integer DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE `exercises` ADD `warmup_order` integer;