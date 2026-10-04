-- A1 data model expansion aligned with the 54-column KFP rent roll
-- structure from Portfolio_Rent_Roll_Data_Structure.xlsx. Adds property-level
-- filter columns, unit-level legacy vs KFP split, UW comparison placeholders,
-- and lease-term recovery / deposit tracking.

-- Property-level additions
ALTER TABLE `properties` ADD `geography` text;--> statement-breakpoint
ALTER TABLE `properties` ADD `zip_code` text;--> statement-breakpoint
ALTER TABLE `properties` ADD `county` text;--> statement-breakpoint
ALTER TABLE `properties` ADD `has_office` integer;--> statement-breakpoint
ALTER TABLE `properties` ADD `clear_height_ft` real;--> statement-breakpoint
ALTER TABLE `properties` ADD `market_rent_yn` integer;--> statement-breakpoint
ALTER TABLE `properties` ADD `acquisition_date` integer;--> statement-breakpoint

-- Unit-level additions
ALTER TABLE `units` ADD `annual_rent` real;--> statement-breakpoint
ALTER TABLE `units` ADD `term_years` real;--> statement-breakpoint
ALTER TABLE `units` ADD `tenant_category` text;--> statement-breakpoint
ALTER TABLE `units` ADD `proportionate_share_rsf` real;--> statement-breakpoint
ALTER TABLE `units` ADD `legacy_rent` real;--> statement-breakpoint
ALTER TABLE `units` ADD `kfp_rent` real;--> statement-breakpoint
ALTER TABLE `units` ADD `legacy_term_years` real;--> statement-breakpoint
ALTER TABLE `units` ADD `kfp_term_years` real;--> statement-breakpoint
ALTER TABLE `units` ADD `legacy_sf` integer;--> statement-breakpoint
ALTER TABLE `units` ADD `kfp_sf` integer;--> statement-breakpoint
ALTER TABLE `units` ADD `rent_uw` real;--> statement-breakpoint
ALTER TABLE `units` ADD `trended_rent_at_lease` real;--> statement-breakpoint
ALTER TABLE `units` ADD `performance_to_uw` real;--> statement-breakpoint
ALTER TABLE `units` ADD `leased_impact_uw` real;--> statement-breakpoint
ALTER TABLE `units` ADD `vacancy_impact_uw` real;--> statement-breakpoint
ALTER TABLE `units` ADD `combined_impact_uw` real;--> statement-breakpoint
ALTER TABLE `units` ADD `annual_recovery_psf` real;--> statement-breakpoint
ALTER TABLE `units` ADD `security_deposit` real;
