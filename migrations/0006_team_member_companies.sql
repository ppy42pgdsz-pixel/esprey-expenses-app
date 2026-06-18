-- Migration: per-user company access list.
--
-- Each row grants user_email permission to pick company_name in their dropdowns.
-- Non-admin users with ZERO rows see only "Personal" (a hardcoded UI option, not
-- stored in the companies table). Admins are exempt and always see all companies.

CREATE TABLE team_member_companies (user_email TEXT NOT NULL, company_name TEXT NOT NULL, added_at INTEGER NOT NULL, PRIMARY KEY (user_email, company_name));

CREATE INDEX idx_team_member_companies_user ON team_member_companies (user_email);
