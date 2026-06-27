-- Migration: per-category spending limit + per-receipt acknowledgement.
--
-- categories.spending_limit: optional decimal limit (TEXT to allow precision
-- without locale weirdness). NULL means no limit for that category.
--
-- receipts.policy_acknowledged: separate from override_acknowledged because
-- they're conceptually different. Acknowledging one shouldn't auto-clear
-- the other. 0/1 boolean as INTEGER.
--
-- Paste each statement into the D1 console one at a time.

ALTER TABLE categories ADD COLUMN spending_limit TEXT;

ALTER TABLE receipts   ADD COLUMN policy_acknowledged INTEGER NOT NULL DEFAULT 0;
