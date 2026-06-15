-- Migration: support multiple email aliases per team member.
-- A team member has one "primary" email (their row in team_members) plus zero
-- or more alias emails that all map back to that primary. Signing in with any
-- alias is treated as signing in as the primary user — same receipts, same
-- reports, same profile.
--
-- Paste each statement into the D1 console one at a time.

CREATE TABLE team_member_aliases (alias_email TEXT PRIMARY KEY, primary_email TEXT NOT NULL, added_at INTEGER NOT NULL, added_by TEXT);

CREATE INDEX idx_team_aliases_primary ON team_member_aliases (primary_email);
