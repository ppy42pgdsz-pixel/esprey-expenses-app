-- Migration: track whether the user has explicitly acknowledged that a
-- receipt flagged as a possible duplicate is in fact a separate, legitimate
-- expense.
--
-- A receipt is flagged as a "duplicate issue" when:
--   - it shares vendor + amount + receipt_date with at least one other
--     receipt belonging to the same user AND
--   - duplicate_acknowledged = 0 on the receipts that haven't been confirmed
--
-- The receipt detail page surfaces sibling matches with an
-- "Acknowledge — this is a separate expense" button. Clicking it flips this
-- column to 1, creating an audit trail that the user knowingly submitted what
-- looks like a duplicate (so we can't be accused of inviting double-claims by
-- letting them just edit the amount to hide the match).
--
-- The flag is per-receipt, not per-group: acknowledging A removes A from the
-- duplicate-detection grouping but leaves B and C still grouped (and still
-- flagged) unless they're acknowledged too.

ALTER TABLE receipts ADD COLUMN duplicate_acknowledged INTEGER NOT NULL DEFAULT 0;
