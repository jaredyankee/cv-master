/**
 * Cover letter shapes. Mirrors LETTER_REVIEW_TOOL and COVER_LETTER_TOOL in
 * private/registry/schema.js, and what private/objects/cover-letter.js stores.
 */

/**
 * One paragraph in the user's bank, written in their own voice.
 *
 * @typedef {Object} LetterBlock
 * @property {string} key    - stable id, derived from the label on first save
 * @property {string} label  - the user's name for it
 * @property {string} text   - may contain [company] / [role] placeholders
 * @property {string[]} angles - kinds of role it suits; fixed list + custom
 */

/**
 * @typedef {'typo' | 'run_on' | 'structure' | 'clarity'} LetterRevisionKind
 */

/**
 * A mechanical problem in one paragraph. Never style or word choice.
 *
 * @typedef {Object} LetterRevision
 * @property {string} key             - the paragraph it is in
 * @property {LetterRevisionKind} kind
 * @property {string} original        - verbatim text from that paragraph
 * @property {string} note
 * @property {string} suggested_edit  - the smallest fix; editable before accepting
 */

/**
 * Something worth writing a new paragraph about. Never drafted text.
 *
 * @typedef {Object} LetterPrompt
 * @property {string} prompt
 * @property {string} angle   - "" when none fits
 * @property {string} reason
 */

/**
 * @typedef {Object} LetterReview
 * @property {string} id         - client-generated, for polling
 * @property {string} createdAt
 * @property {LetterRevision[]} revisions
 * @property {LetterPrompt[]} prompts
 * @property {string} [error]    - set when the review failed
 */

/**
 * One paragraph of a built letter.
 *   block   — a bank paragraph; `text` differs from `source` by tense at most
 *   missing — a slot the bank couldn't fill; rendered as "<-- Add something here -->"
 *   written — a missing slot the user filled in on the letter itself
 *
 * @typedef {Object} LetterParagraph
 * @property {'block' | 'missing' | 'written'} kind
 * @property {string} [key]
 * @property {string} [label]
 * @property {string} [text]
 * @property {string} [source]   - the bank text at build time, placeholders filled
 * @property {string[]} [edits]  - tense changes, e.g. "built -> build"
 * @property {boolean} [reverted] - the model changed more than tense; source used
 * @property {string} [prompt]   - kind=missing: what to write there
 */

/**
 * @typedef {Object} BuiltCoverLetter
 * @property {string} id         - client-generated build id, for polling
 * @property {string} builtAt
 * @property {string} angle
 * @property {string} angleRationale
 * @property {LetterParagraph[]} paragraphs
 * @property {LetterPrompt[]} prompts
 * @property {string} [error]    - set when the latest build failed; the previous letter is kept
 */

export {}
