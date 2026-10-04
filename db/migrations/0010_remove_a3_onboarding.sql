-- Remove the A3 Onboarding demo (descoped after a validation review).
-- Drop the four A3 tables (children first so the deals
-- foreign-key references unwind cleanly) and the three A3-only notification
-- columns (task_id, team, event), leaving the visibility notifications that
-- back L1 / L2 / A5 intact.

DROP TABLE `inbox_events`;--> statement-breakpoint
DROP TABLE `rfp_drafts`;--> statement-breakpoint
DROP TABLE `onboarding_tasks`;--> statement-breakpoint
DROP TABLE `deals`;--> statement-breakpoint

ALTER TABLE `notifications` DROP COLUMN `task_id`;--> statement-breakpoint
ALTER TABLE `notifications` DROP COLUMN `team`;--> statement-breakpoint
ALTER TABLE `notifications` DROP COLUMN `event`;
