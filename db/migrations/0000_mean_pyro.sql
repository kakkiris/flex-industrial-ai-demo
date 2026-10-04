CREATE TABLE `call_outcomes` (
	`id` text PRIMARY KEY NOT NULL,
	`target_id` text,
	`duration_seconds` integer,
	`outcome` text,
	`transcript` text,
	`hot_lead_flag` integer,
	`notified_at` integer,
	FOREIGN KEY (`target_id`) REFERENCES `call_targets`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `call_targets` (
	`id` text PRIMARY KEY NOT NULL,
	`property_id` text,
	`owner_name` text,
	`owner_phone` text,
	`status` text,
	`outcome` text,
	`transcript` text,
	`hot_lead_flag` integer,
	`called_at` integer,
	FOREIGN KEY (`property_id`) REFERENCES `properties`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `chat_sessions` (
	`id` text PRIMARY KEY NOT NULL,
	`lead_id` text,
	`started_at` integer,
	`ended_at` integer,
	`transcript` text,
	FOREIGN KEY (`lead_id`) REFERENCES `leads`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `comp_confidence` (
	`id` text PRIMARY KEY NOT NULL,
	`unit_id` text,
	`rent_confidence` text,
	`source_type` text,
	`raw_quote` text,
	`extracted_from_page` integer,
	FOREIGN KEY (`unit_id`) REFERENCES `units`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `deals` (
	`id` text PRIMARY KEY NOT NULL,
	`property_name` text,
	`psa_path` text,
	`psa_signed_at` integer,
	`deposit_due_at` integer,
	`dd_end_at` integer,
	`closing_at` integer,
	`status` text,
	`extracted_summary` text
);
--> statement-breakpoint
CREATE TABLE `leads` (
	`id` text PRIMARY KEY NOT NULL,
	`source` text,
	`business_type` text,
	`space_size_sqft` integer,
	`location` text,
	`timeline` text,
	`budget_range` text,
	`callback_preferred` integer,
	`raw_transcript` text,
	`created_at` integer
);
--> statement-breakpoint
CREATE TABLE `lease_abstracts` (
	`id` text PRIMARY KEY NOT NULL,
	`lease_id` text,
	`tenant_name` text,
	`landlord_name` text,
	`property_address` text,
	`suite` text,
	`lease_start` integer,
	`lease_end` integer,
	`base_rent_schedule` text,
	`escalations` text,
	`renewal_options` text,
	`ti_allowance` real,
	`free_rent_months` integer,
	`security_deposit` real,
	`cam_terms` text,
	`use_clause` text,
	`special_provisions` text,
	`extraction_confidence` text,
	`raw_sections` text,
	`extracted_at` integer,
	FOREIGN KEY (`lease_id`) REFERENCES `leases`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `leases` (
	`id` text PRIMARY KEY NOT NULL,
	`unit_id` text,
	`pdf_path` text,
	`ingested_at` integer,
	FOREIGN KEY (`unit_id`) REFERENCES `units`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `notifications` (
	`id` text PRIMARY KEY NOT NULL,
	`kind` text,
	`title` text,
	`body` text,
	`link` text,
	`created_at` integer,
	`read_at` integer
);
--> statement-breakpoint
CREATE TABLE `onboarding_tasks` (
	`id` text PRIMARY KEY NOT NULL,
	`deal_id` text,
	`task_type` text,
	`assignee` text,
	`due_at` integer,
	`status` text,
	`blocker` text,
	FOREIGN KEY (`deal_id`) REFERENCES `deals`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `properties` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`address` text,
	`submarket` text,
	`state` text,
	`total_sqft` integer,
	`asset_type` text,
	`year_built` integer,
	`source` text,
	`source_doc_id` text,
	`ingested_at` integer
);
--> statement-breakpoint
CREATE TABLE `query_log` (
	`id` text PRIMARY KEY NOT NULL,
	`query` text,
	`response` text,
	`citations` text,
	`response_time_ms` integer,
	`timestamp` integer
);
--> statement-breakpoint
CREATE TABLE `rfp_drafts` (
	`id` text PRIMARY KEY NOT NULL,
	`deal_id` text,
	`vendor_type` text,
	`subject` text,
	`content` text,
	`generated_at` integer,
	`sent_at` integer,
	FOREIGN KEY (`deal_id`) REFERENCES `deals`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `source_documents` (
	`id` text PRIMARY KEY NOT NULL,
	`type` text,
	`filename` text,
	`pdf_path` text,
	`ingested_at` integer
);
--> statement-breakpoint
CREATE TABLE `units` (
	`id` text PRIMARY KEY NOT NULL,
	`property_id` text,
	`suite` text,
	`size_sqft` integer,
	`lease_type` text,
	`has_private_bathroom` integer,
	`current_rent` real,
	`rent_per_sqft` real,
	`lease_start` integer,
	`lease_end` integer,
	`tenant_name` text,
	FOREIGN KEY (`property_id`) REFERENCES `properties`(`id`) ON UPDATE no action ON DELETE no action
);
