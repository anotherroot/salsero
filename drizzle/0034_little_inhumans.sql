CREATE TABLE `clone_marks` (
	`kind` text NOT NULL,
	`row_id` integer NOT NULL,
	`fields_json` text NOT NULL,
	`at` integer NOT NULL,
	PRIMARY KEY(`kind`, `row_id`)
);
--> statement-breakpoint
CREATE TABLE `clone_sync` (
	`kind` text NOT NULL,
	`row_id` integer NOT NULL,
	`on` integer NOT NULL,
	`names` integer NOT NULL,
	`small` integer NOT NULL,
	`sections` integer NOT NULL,
	`media` integer NOT NULL,
	`at` integer NOT NULL,
	PRIMARY KEY(`kind`, `row_id`)
);
