-- The hiring manager's read of a built resume. Safe to run more than once.
--
-- { id, reviewedAt, signature, verdict, summary, strengths[], concerns[] }
-- or { id, error } when the review failed. `signature` fingerprints the
-- resume that was reviewed, so the UI can say when it has been edited since.
ALTER TABLE job_applications
    ADD COLUMN IF NOT EXISTS hm_review JSONB;
