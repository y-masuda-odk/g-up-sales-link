CREATE TABLE `audit_events` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`actor_id` integer,
	`kind` text NOT NULL,
	`target_type` text NOT NULL,
	`target_id` integer,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	FOREIGN KEY (`actor_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `case_products` (
	`case_id` integer NOT NULL,
	`product_id` integer NOT NULL,
	`stage` text NOT NULL,
	FOREIGN KEY (`case_id`) REFERENCES `sales_cases`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`product_id`) REFERENCES `catalog_products`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `idx_case_products_pair` ON `case_products` (`case_id`,`product_id`);--> statement-breakpoint
CREATE TABLE `catalog_products` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`team_id` integer NOT NULL,
	`creator_id` integer NOT NULL,
	`name` text NOT NULL,
	`description` text,
	`target_customer` text,
	`outcome` text,
	`contact` text,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	FOREIGN KEY (`team_id`) REFERENCES `teams`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`creator_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `idx_catalog_products_team` ON `catalog_products` (`team_id`);--> statement-breakpoint
CREATE TABLE `companies` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`name` text NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE TABLE `consultation_recipients` (
	`consultation_id` integer NOT NULL,
	`team_id` integer NOT NULL,
	`handled` integer DEFAULT false NOT NULL,
	FOREIGN KEY (`consultation_id`) REFERENCES `consultations`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`team_id`) REFERENCES `teams`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `idx_consultation_recipients_pair` ON `consultation_recipients` (`consultation_id`,`team_id`);--> statement-breakpoint
CREATE INDEX `idx_consultation_recipients_team` ON `consultation_recipients` (`team_id`);--> statement-breakpoint
CREATE TABLE `consultations` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`case_id` integer NOT NULL,
	`sender_id` integer NOT NULL,
	`account_name` text,
	`department` text,
	`issue_summary` text,
	`product_summary` text,
	`note` text,
	`withdrawn_at` text,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	FOREIGN KEY (`case_id`) REFERENCES `sales_cases`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`sender_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `idx_consultations_sender` ON `consultations` (`sender_id`);--> statement-breakpoint
CREATE TABLE `invitations` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`email` text NOT NULL,
	`role` text NOT NULL,
	`team_id` integer,
	`token_hash` text NOT NULL,
	`expires_at` text NOT NULL,
	`used_at` text,
	`created_by` integer NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	FOREIGN KEY (`team_id`) REFERENCES `teams`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`created_by`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `idx_invitations_token` ON `invitations` (`token_hash`);--> statement-breakpoint
CREATE INDEX `idx_invitations_email` ON `invitations` (`email`);--> statement-breakpoint
CREATE TABLE `sales_cases` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`creator_id` integer NOT NULL,
	`team_id` integer NOT NULL,
	`account_kind` text NOT NULL,
	`account_name` text NOT NULL,
	`department` text,
	`issue_summary` text,
	`status` text,
	`next_action` text,
	`is_draft` integer DEFAULT true NOT NULL,
	`list_visible` integer DEFAULT true NOT NULL,
	`show_department` integer DEFAULT true NOT NULL,
	`show_issue` integer DEFAULT true NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	FOREIGN KEY (`creator_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`team_id`) REFERENCES `teams`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `idx_sales_cases_team` ON `sales_cases` (`team_id`);--> statement-breakpoint
CREATE INDEX `idx_sales_cases_creator` ON `sales_cases` (`creator_id`);--> statement-breakpoint
CREATE TABLE `sessions` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`user_id` integer NOT NULL,
	`token_hash` text NOT NULL,
	`expires_at` text NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `idx_sessions_token` ON `sessions` (`token_hash`);--> statement-breakpoint
CREATE INDEX `idx_sessions_user` ON `sessions` (`user_id`);--> statement-breakpoint
CREATE TABLE `team_shares` (
	`from_team_id` integer NOT NULL,
	`to_team_id` integer NOT NULL,
	`enabled` integer DEFAULT true NOT NULL,
	FOREIGN KEY (`from_team_id`) REFERENCES `teams`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`to_team_id`) REFERENCES `teams`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `idx_team_shares_pair` ON `team_shares` (`from_team_id`,`to_team_id`);--> statement-breakpoint
CREATE TABLE `teams` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`company_id` integer NOT NULL,
	`name` text NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	FOREIGN KEY (`company_id`) REFERENCES `companies`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `idx_teams_company` ON `teams` (`company_id`);--> statement-breakpoint
CREATE TABLE `users` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`email` text NOT NULL,
	`name` text NOT NULL,
	`password_hash` text NOT NULL,
	`role` text NOT NULL,
	`team_id` integer,
	`disabled` integer DEFAULT false NOT NULL,
	`failed_logins` integer DEFAULT 0 NOT NULL,
	`locked_until` text,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	FOREIGN KEY (`team_id`) REFERENCES `teams`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `idx_users_email` ON `users` (`email`);--> statement-breakpoint
CREATE INDEX `idx_users_team` ON `users` (`team_id`);