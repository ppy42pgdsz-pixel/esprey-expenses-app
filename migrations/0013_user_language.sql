-- 0013: Per-user language preference (#49). 'en' (default when NULL) or 'fr'
-- for now. Drives the app UI language and the language Claude writes receipt
-- notes in. Report output language is chosen separately at generation time.

ALTER TABLE user_profile ADD COLUMN language TEXT;
