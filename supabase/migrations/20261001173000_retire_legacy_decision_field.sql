-- Authorized retirement of the legacy automatic execution module.
-- Preserve analytical history; active consumers must be deployed first.
ALTER TABLE public.daily_syntheses DROP COLUMN IF EXISTS operator_action;
