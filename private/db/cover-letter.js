import { sql } from "./db.js"

/**
 * The cover-letter paragraph bank and the built letters. Columns are added by
 * migrations/cover-letter.sql.
 *
 * The bank lives on resume_dumps (one row per user) but is not part of the
 * dump: nothing in resume-dump.js reads or clears these columns, so a
 * rebuild leaves the user's paragraphs where they are.
 */

/**
 * The bank and its latest review, plus looking_for, which the review reads
 * to suggest angles. Null when the user has no dump row.
 */
export const getLetterBank = async (user_id) => {
    const [row] = await sql`
        SELECT letter_blocks, letter_review, looking_for
        FROM resume_dumps
        WHERE user_id = ${user_id}
        LIMIT 1
    `
    return row ?? null
}

/** Overwrites the bank. Returns null when the user has no dump row. */
export const updateLetterBlocks = async (user_id, blocks) => {
    const [row] = await sql`
        UPDATE resume_dumps
        SET letter_blocks = ${JSON.stringify(blocks ?? [])}::jsonb
        WHERE user_id = ${user_id}
        RETURNING letter_blocks, letter_review
    `
    return row ?? null
}

/** Replaces the review slot. */
export const updateLetterReview = async (user_id, review) => {
    const [row] = await sql`
        UPDATE resume_dumps
        SET letter_review = ${JSON.stringify(review)}::jsonb
        WHERE user_id = ${user_id}
        RETURNING letter_blocks, letter_review
    `
    return row ?? null
}

/**
 * Writes the built (or user-edited) letter for one application. Nothing else
 * on the row is touched. Scoped to the owner; null when it isn't theirs.
 */
export const updateCoverLetter = async (user_id, id, letter) => {
    const [row] = await sql`
        UPDATE job_applications SET
            cl_letter  = ${JSON.stringify(letter)}::jsonb,
            updated_at = now()
        WHERE id = ${id} AND user_id = ${user_id}
        RETURNING *
    `
    return row ?? null
}
