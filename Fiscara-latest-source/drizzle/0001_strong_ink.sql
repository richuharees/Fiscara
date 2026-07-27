CREATE TABLE `accounts` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`user_email` text NOT NULL,
	`name` text NOT NULL,
	`institution` text DEFAULT 'Manual' NOT NULL,
	`type` text NOT NULL,
	`currency` text DEFAULT 'EUR' NOT NULL,
	`current_balance` real DEFAULT 0 NOT NULL,
	`last_four` text,
	`color` text DEFAULT '#42efb1' NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE INDEX `accounts_user_idx` ON `accounts` (`user_email`);--> statement-breakpoint
CREATE TABLE `savings_goals` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`user_email` text NOT NULL,
	`name` text NOT NULL,
	`target_amount` real NOT NULL,
	`current_amount` real DEFAULT 0 NOT NULL,
	`target_date` text,
	`color` text DEFAULT '#42efb1' NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE INDEX `savings_goals_user_idx` ON `savings_goals` (`user_email`);--> statement-breakpoint
ALTER TABLE `transactions` ADD `account_id` integer REFERENCES accounts(id);--> statement-breakpoint
ALTER TABLE `transactions` ADD `source` text DEFAULT 'manual' NOT NULL;--> statement-breakpoint
ALTER TABLE `transactions` ADD `fingerprint` text;--> statement-breakpoint
ALTER TABLE `transactions` ADD `original_description` text;--> statement-breakpoint
CREATE INDEX `transactions_user_idx` ON `transactions` (`user_email`);--> statement-breakpoint
CREATE INDEX `transactions_account_idx` ON `transactions` (`account_id`);--> statement-breakpoint
CREATE UNIQUE INDEX `transactions_user_fingerprint_uidx` ON `transactions` (`user_email`,`fingerprint`);