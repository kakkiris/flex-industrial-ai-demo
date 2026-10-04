-- Functional fix pass 2026-05-27: consolidated schema additions for L1
-- qualification verdict, L2 review workflow, and A3 per-task notifications +
-- inbox monitoring. See docs/reference/audit-findings-2026-05-27.md.

-- L1: qualification verdict on leads
ALTER TABLE `leads` ADD `verdict` text;--> statement-breakpoint
ALTER TABLE `leads` ADD `confidence_score` integer;--> statement-breakpoint
ALTER TABLE `leads` ADD `reasoning` text;--> statement-breakpoint

-- L2: review workflow on lease abstracts
ALTER TABLE `lease_abstracts` ADD `source` text;--> statement-breakpoint
ALTER TABLE `lease_abstracts` ADD `status` text;--> statement-breakpoint
ALTER TABLE `lease_abstracts` ADD `pushed_to_yardi_at` integer;--> statement-breakpoint

-- A3: per-task payload + blocked-since timestamp
ALTER TABLE `onboarding_tasks` ADD `amount` real;--> statement-breakpoint
ALTER TABLE `onboarding_tasks` ADD `payload` text;--> statement-breakpoint
ALTER TABLE `onboarding_tasks` ADD `blocked_since` integer;--> statement-breakpoint

-- A3: per-task linkage on notifications
ALTER TABLE `notifications` ADD `task_id` text;--> statement-breakpoint
ALTER TABLE `notifications` ADD `team` text;--> statement-breakpoint
ALTER TABLE `notifications` ADD `event` text;--> statement-breakpoint

-- A3: simulated inbox events (visual-only; no real email integration)
CREATE TABLE `inbox_events` (
  `id` text PRIMARY KEY NOT NULL,
  `deal_id` text,
  `task_id` text,
  `direction` text,
  `channel` text,
  `subject` text,
  `body` text,
  `from_address` text,
  `to_address` text,
  `occurred_at` integer,
  FOREIGN KEY (`deal_id`) REFERENCES `deals`(`id`) ON UPDATE no action ON DELETE no action
);
