-- Migration: add a per-receipt rotation field for the in-app image viewer.
-- One statement — paste into Cloudflare D1 console.

ALTER TABLE receipts ADD COLUMN rotation INTEGER NOT NULL DEFAULT 0;
