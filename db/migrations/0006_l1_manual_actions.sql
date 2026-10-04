-- L1 inbox manual actions (2026-05-27 follow-up pass). Adds the fields
-- needed for leasing staff to override the AI verdict, schedule a visit,
-- and call the prospect back.

ALTER TABLE `leads` ADD `phone` text;--> statement-breakpoint
ALTER TABLE `leads` ADD `manual_verdict` text;--> statement-breakpoint
ALTER TABLE `leads` ADD `scheduled_visit_at` integer;--> statement-breakpoint
ALTER TABLE `leads` ADD `actioned_at` integer;--> statement-breakpoint
ALTER TABLE `leads` ADD `actioned_by` text;
