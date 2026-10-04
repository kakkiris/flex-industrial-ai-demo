-- L2 operating-expense recovery (2026-06-06). A validation review flagged
-- that operating-expense recoveries are the single biggest L2
-- gap and the most billing-critical Yardi field. This column persists the
-- STATED recovery terms (type, base year, method, pro-rata share, categories,
-- cap, reconciliation basis, notes) as JSON; reconciliation math is out of
-- scope because the lease carries no budget data.
--
-- operating_expense_recovery: JSON OperatingExpenseRecovery, nullable so
-- abstracts committed before this column still read cleanly.

ALTER TABLE `lease_abstracts` ADD `operating_expense_recovery` text;
