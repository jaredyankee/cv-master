-- Dump regeneration.
--
-- Lets a user rebuild their resume dump without losing the profile they
-- already have. Safe to run more than once.
--
-- Nothing here touches job_applications: resume_dumps is upserted on user_id,
-- so the row's id never changes and job_applications.resume_dump_id keeps
-- pointing at it through a regenerate.

-- Where the user is in the dump lifecycle.
--   READY  — there is a live dump; the dashboard is normal.
--   NEW    — the user chose "Start over". The live dump is cleared and the
--            onboarding form opens empty.
--   REVISE — the user chose "Revise full dump". The live dump is cleared and
--            the onboarding form opens pre-filled with source_text.
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'dump_state') THEN
        CREATE TYPE dump_state AS ENUM ('NEW', 'REVISE', 'READY');
    END IF;
END
$$;

ALTER TABLE resume_dumps
    -- What the user actually typed, so "Revise full dump" can hand back their
    -- own words rather than the model's paraphrase. Null for dumps created
    -- before this migration; the UI falls back to rendering the structured
    -- profile as text.
    ADD COLUMN IF NOT EXISTS source_text  TEXT,

    -- The previous profile, kept whole so it can be previewed and recovered.
    -- One slot, not a history: this is a safety net for the regenerate you
    -- just started, not a version log.
    ADD COLUMN IF NOT EXISTS cached_dump  JSONB,
    ADD COLUMN IF NOT EXISTS cached_at    TIMESTAMPTZ,

    ADD COLUMN IF NOT EXISTS dump_state   dump_state NOT NULL DEFAULT 'READY';

-- Existing rows are finished profiles, which the DEFAULT already covers. This
-- is here for a re-run against rows added between the ALTER and now.
UPDATE resume_dumps SET dump_state = 'READY' WHERE dump_state IS NULL;
