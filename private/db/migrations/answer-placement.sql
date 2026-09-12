-- Answers to the review's probe questions.
--
-- Until now they existed only in React state: typed at the review, rendered on
-- the dashboard until the next reload, then gone. Nothing was ever sent to the
-- server. This gives them somewhere to live.
--
-- Safe to run more than once.

-- [{ question, reference, answer, target, placed }]
--
--   target  {section, entry} | null — where the answer belongs, set by the
--           model when it asks. Null means the answer maps to no section.
--   placed  true once the answer has been merged into that section, so the
--           dashboard doesn't show it a second time as a loose note.
--
-- An answer with no target is context, in the same sense as an entry carrying
-- excludeFromResume: the model reads it when judging fit, and it never reaches
-- a built resume.
ALTER TABLE resume_dumps
    ADD COLUMN IF NOT EXISTS answers JSONB NOT NULL DEFAULT '[]'::jsonb;
