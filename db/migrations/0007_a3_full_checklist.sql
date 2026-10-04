-- A3 onboarding aligned to the KFP acquisition onboarding checklist.
-- Adds property-detail columns + team JSON on deals, plus the full set of
-- per-task fields needed to render the Acquisitions / Leasing / Accounting
-- groups: party involved, order date, delivery date, named internal lead,
-- status notes, file path, source classification (psa, om, template, manual).

ALTER TABLE `deals` ADD `purchase_price` real;--> statement-breakpoint
ALTER TABLE `deals` ADD `initial_deposit` real;--> statement-breakpoint
ALTER TABLE `deals` ADD `second_deposit` real;--> statement-breakpoint
ALTER TABLE `deals` ADD `second_deposit_due_at` integer;--> statement-breakpoint
ALTER TABLE `deals` ADD `leasable_sqft` integer;--> statement-breakpoint
ALTER TABLE `deals` ADD `unit_count` integer;--> statement-breakpoint
ALTER TABLE `deals` ADD `tenant_count` integer;--> statement-breakpoint
ALTER TABLE `deals` ADD `opportunity_zone` integer;--> statement-breakpoint
ALTER TABLE `deals` ADD `address` text;--> statement-breakpoint
ALTER TABLE `deals` ADD `county` text;--> statement-breakpoint
ALTER TABLE `deals` ADD `parcel_number` text;--> statement-breakpoint
ALTER TABLE `deals` ADD `suggested_entity_name` text;--> statement-breakpoint
ALTER TABLE `deals` ADD `team` text;--> statement-breakpoint

ALTER TABLE `onboarding_tasks` ADD `category` text;--> statement-breakpoint
ALTER TABLE `onboarding_tasks` ADD `subcategory` text;--> statement-breakpoint
ALTER TABLE `onboarding_tasks` ADD `title` text;--> statement-breakpoint
ALTER TABLE `onboarding_tasks` ADD `party_involved` text;--> statement-breakpoint
ALTER TABLE `onboarding_tasks` ADD `order_date` integer;--> statement-breakpoint
ALTER TABLE `onboarding_tasks` ADD `delivery_date` integer;--> statement-breakpoint
ALTER TABLE `onboarding_tasks` ADD `assigned_to_name` text;--> statement-breakpoint
ALTER TABLE `onboarding_tasks` ADD `status_notes` text;--> statement-breakpoint
ALTER TABLE `onboarding_tasks` ADD `file_path` text;--> statement-breakpoint
ALTER TABLE `onboarding_tasks` ADD `source` text;
