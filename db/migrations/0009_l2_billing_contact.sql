-- L2 Yardi-fit (2026-05-31). L2 narrates the five-step single-lease Yardi
-- sequence (create lease, attach billing contact, add unit, build charge
-- schedules, activate) but the abstract carried no billing contact and modeled
-- only the Rent charge line, not the EstUtil/recoveries line modified-gross
-- leases need. These two columns close that gap.
--
-- billing_contact: JSON for the Yardi CommContacts Role=Billing row (step 2),
-- shape { firstName, lastName, company, phone, email } with every field
-- nullable so a lease without a clear contact does not fail. Mirrors A5's
-- RentRollBillingContact.
-- estimated_recovery_psf: annual estimated recovery $/sqft for the EstUtil
-- charge-schedule line on modified-gross leases (step 4, second charge line).

ALTER TABLE `lease_abstracts` ADD `billing_contact` text;--> statement-breakpoint
ALTER TABLE `lease_abstracts` ADD `estimated_recovery_psf` real;
