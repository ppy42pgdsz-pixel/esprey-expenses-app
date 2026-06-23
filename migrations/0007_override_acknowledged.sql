-- Migration: track whether a user has explicitly acknowledged that their
-- manually-edited values differ from what OCR originally extracted.
--
-- A receipt is flagged as an "OCR mismatch issue" when:
--   - ocr_status = 'success' (OCR worked) AND
--   - amount / currency / receipt_date differs from what's in ocr_raw AND
--   - override_acknowledged = 0
--
-- The receipt detail page shows the comparison + an "Acknowledge override"
-- button that flips this column to 1, clearing the flag.

ALTER TABLE receipts ADD COLUMN override_acknowledged INTEGER NOT NULL DEFAULT 0;
