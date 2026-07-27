CREATE TABLE `budget_items` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`user_email` text NOT NULL,
	`month_key` text NOT NULL,
	`name` text NOT NULL,
	`category` text NOT NULL,
	`amount` real NOT NULL,
	`note` text,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE INDEX `budget_items_user_month_idx` ON `budget_items` (`user_email`,`month_key`);--> statement-breakpoint
CREATE TABLE `budget_settings` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`user_email` text NOT NULL,
	`month_key` text NOT NULL,
	`monthly_target` real DEFAULT 0 NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `budget_settings_user_month_uidx` ON `budget_settings` (`user_email`,`month_key`);