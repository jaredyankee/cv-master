-- Job leads, and the preferences a search is run from.
--
-- A lead is a listing someone found for you. It is not an application: it
-- holds a link and whatever could be read off the search result, and it stays
-- that way until you decide to act on it, at which point the normal
-- job_applications flow takes over — including the are-you-sure guard on a
-- poor fit. Search should never spend model tokens on your behalf.
--
-- Safe to run more than once.
--
-- users.id is a uuid (the Neon Auth user id), so every user_id here is too —
-- a foreign key between mismatched types is refused outright.

/* ── Search preferences ──────────────────────────────────────────
 *
 * resume_dumps.lookingFor already holds this as prose, which is right for a
 * model and useless for filtering — "around $130k, remote" cannot be compared
 * to a number. This is the same information, structured, seeded from that
 * text the first time and edited by hand afterwards.
 *
 * Its own table rather than another dump column on purpose: rebuilding a
 * profile empties the dump's fields, and "Start over" silently discarding
 * your search criteria would be a nasty surprise for something that has
 * nothing to do with the profile text.
 */
CREATE TABLE IF NOT EXISTS job_search_preferences (
    user_id     UUID PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,

    -- 'remote' | 'hybrid' | 'onsite' | 'any'. Plain text, not an enum: this
    -- one is a user preference rather than a state machine, and the set is
    -- likely to grow sideways.
    arrangement TEXT NOT NULL DEFAULT 'any',

    -- Acceptable places, if the arrangement needs them. Empty means anywhere.
    locations   JSONB NOT NULL DEFAULT '[]'::jsonb,

    -- Annual, in whatever currency the user thinks in. Null means unstated,
    -- which never rules a listing out.
    min_salary  INTEGER,

    -- What to search for, and companies to skip (a current employer).
    titles            JSONB NOT NULL DEFAULT '[]'::jsonb,
    seniority         TEXT,
    exclude_companies JSONB NOT NULL DEFAULT '[]'::jsonb,

    created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

/* ── Leads ───────────────────────────────────────────────────────
 *
 * Every column here is either copied verbatim from a search result or derived
 * from the URL by string handling. Nothing is written by a model, which is
 * what makes a lead safe to show as a fact.
 */
CREATE TABLE IF NOT EXISTS job_leads (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id     UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,

    -- Canonicalised: tracking parameters stripped, host lowercased, fragment
    -- dropped. This is the dedup key, so a re-run doesn't re-show a listing.
    url         TEXT NOT NULL,

    title       TEXT,
    snippet     TEXT,
    company     TEXT,          -- read off the board slug; null when the host doesn't carry it
    source      TEXT,          -- greenhouse | lever | ashby | workday | … | other
    posted_at   TEXT,          -- as the search reported it; formats vary too much to parse

    -- What the listing text stated, or null for "it didn't say". Null is not
    -- a conflict: see private/lib/leads.js.
    arrangement  TEXT,
    salary_floor INTEGER,

    -- Set when the lead conflicts with a stated preference. Kept rather than
    -- deleted so the filter can be seen, and caught when it is wrong.
    disqualified_for TEXT,

    -- Last time the link was checked, and what came back. A listing that has
    -- been filled should look different from one nobody has looked at.
    link_checked_at TIMESTAMPTZ,
    link_status     INTEGER,

    -- Set once the user promotes this lead into a real application.
    job_application_id UUID REFERENCES job_applications(id) ON DELETE SET NULL,

    -- The user's own disposition: hidden leads stay stored so a re-run
    -- doesn't resurface them.
    dismissed_at TIMESTAMPTZ,

    created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- One row per listing per user: the dedup rule, enforced rather than trusted.
CREATE UNIQUE INDEX IF NOT EXISTS job_leads_user_url_idx
    ON job_leads (user_id, url);

-- The dashboard reads newest-first, and only the leads still in play.
CREATE INDEX IF NOT EXISTS job_leads_user_created_idx
    ON job_leads (user_id, created_at DESC);

/* ── Run tracking ────────────────────────────────────────────────
 *
 * One slot, not a history — the same shape as resume_dumps.cached_dump, and
 * for the same reason: what matters is the run you are in or the one that
 * just failed, not every run you have ever done.
 *
 * It answers three questions the UI needs and one the server does. For the
 * UI: is a search running now, did the last one fail, and how many did it
 * find. For the server: has the automatic first run already happened, so
 * finishing onboarding twice — or reloading mid-run — doesn't start a second
 * search against the user's Perplexity credit.
 *
 * Separate columns rather than a runs table because a second concurrent run
 * is a bug, not a case to model.
 */
ALTER TABLE job_search_preferences
    ADD COLUMN IF NOT EXISTS last_run_started_at  TIMESTAMPTZ,
    ADD COLUMN IF NOT EXISTS last_run_finished_at TIMESTAMPTZ,
    ADD COLUMN IF NOT EXISTS last_run_error       TEXT,
    ADD COLUMN IF NOT EXISTS last_run_found       INTEGER,

    -- Set the first time a search is started for this user, automatically or
    -- by hand. Its presence is what stops the automatic run firing again.
    ADD COLUMN IF NOT EXISTS first_run_at         TIMESTAMPTZ;
