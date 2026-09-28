CREATE TABLE `sales_accounts` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`team_id` integer NOT NULL,
	`creator_id` integer NOT NULL,
	`kind` text NOT NULL,
	`name` text NOT NULL,
	`priority` text DEFAULT 'medium' NOT NULL,
	`scale` text DEFAULT 'medium' NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	FOREIGN KEY (`team_id`) REFERENCES `teams`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`creator_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `idx_sales_accounts_team_name` ON `sales_accounts` (`team_id`,`name`);--> statement-breakpoint
CREATE INDEX `idx_sales_accounts_team_priority` ON `sales_accounts` (`team_id`,`priority`);--> statement-breakpoint
CREATE TABLE `sales_targets` (
	`team_id` integer NOT NULL,
	`period` text NOT NULL,
	`revenue_target` integer DEFAULT 0 NOT NULL,
	`case_target` integer DEFAULT 0 NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	FOREIGN KEY (`team_id`) REFERENCES `teams`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `idx_sales_targets_team_period` ON `sales_targets` (`team_id`,`period`);--> statement-breakpoint
ALTER TABLE `sales_cases` ADD `amount` integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE `sales_cases` ADD `revenue_period` text DEFAULT 'current' NOT NULL;