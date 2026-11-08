CREATE TABLE `change_log` (
	`seq` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`tbl` text NOT NULL,
	`key` text NOT NULL,
	`op` text NOT NULL,
	`at` integer NOT NULL
);
