-- Migration 0016: record WHEN the photo was actually taken, so we can catch
-- receipts whose OCR-read date lands in the wrong month.
--
-- The problem (Carl, 2026-09-16): most till receipts print only a day and
-- month, so OCR occasionally reads "03/08" as 3 August when the photo was
-- taken on 3 September. The receipt then silently files itself into a month
-- that has already been reported — and is missed entirely.
--
-- captured_at        ms epoch of the photo itself. Best source available:
--                      'exif'   EXIF DateTimeOriginal from the original JPEG
--                               (read client-side BEFORE the canvas re-encode
--                               in Capture.tsx strips it)
--                      'file'   the picked file's lastModified
--                      'email'  the Date header of the email that carried it
--                      'upload' server clock at upload (last resort)
-- captured_at_source which of the four above it came from. The UI says
--                    "approximate" for anything weaker than exif/file/email.
--
-- date_mismatch_acknowledged  0/1 — same audit-trail pattern as
--                    duplicate_acknowledged (0010) and policy_acknowledged
--                    (0009). The user confirms "yes, I photographed this
--                    weeks later / yes it really is last month's receipt"
--                    and the flag clears without editing the date.
--
-- Rows predating this migration have captured_at NULL; the client falls back
-- to uploaded_at and marks the finding approximate.

ALTER TABLE receipts ADD COLUMN captured_at INTEGER;
ALTER TABLE receipts ADD COLUMN captured_at_source TEXT;
ALTER TABLE receipts ADD COLUMN date_mismatch_acknowledged INTEGER NOT NULL DEFAULT 0;
