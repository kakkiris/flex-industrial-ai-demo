-- L1 form-backend reframe (2026-05-31). The conversational chat widget is
-- retired; leads now arrive from a structured qualification form. Each form
-- lead carries the units the matcher found in current vacant inventory so the
-- leasing team sees the strongest matches attached to the enriched lead.
-- Stored as JSON text: [{ propertyName, submarket, suite, sizeSqft, leaseType }].

ALTER TABLE `leads` ADD `matched_units` text;
