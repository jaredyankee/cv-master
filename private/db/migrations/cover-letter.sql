-- Built cover letters.
--
-- The letter is assembled from a bank of paragraphs the user wrote, the same
-- way a resume is assembled from the dump. Safe to run more than once.

-- [{ key, label, text, angles[] }]
--
-- On resume_dumps but outside the dump itself: a rebuild re-extracts the
-- dump from source_text, and these paragraphs were never part of that text,
-- so cacheAndResetResumeDump deliberately leaves them alone.
ALTER TABLE resume_dumps
    ADD COLUMN IF NOT EXISTS letter_blocks JSONB NOT NULL DEFAULT '[]'::jsonb;

-- The latest review of the bank: { id, createdAt, revisions[], prompts[] }.
-- One slot. The client generates `id` and polls until this carries it.
ALTER TABLE resume_dumps
    ADD COLUMN IF NOT EXISTS letter_review JSONB;

-- The built letter for one application:
-- { id, builtAt, angle, angleRationale, paragraphs[], prompts[] }
-- Null until the user asks for one. `id` is client-generated, for polling.
ALTER TABLE job_applications
    ADD COLUMN IF NOT EXISTS cl_letter JSONB;
