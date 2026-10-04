-- Drop budget_range and add Tier 2 / Tier 3 fields per the L1 three-tier
-- qualifier framework introduced 2026-05-27. Budget is explicitly removed from
-- the qualifier per the stated leasing criteria.
ALTER TABLE `leads` DROP COLUMN `budget_range`;--> statement-breakpoint
ALTER TABLE `leads` ADD `business_name` text;--> statement-breakpoint
ALTER TABLE `leads` ADD `lease_term_years` real;--> statement-breakpoint
ALTER TABLE `leads` ADD `existing_locations` text;--> statement-breakpoint
ALTER TABLE `leads` ADD `motivation` text;--> statement-breakpoint
ALTER TABLE `leads` ADD `loading_needs` text;--> statement-breakpoint
ALTER TABLE `leads` ADD `tier_map` text;
