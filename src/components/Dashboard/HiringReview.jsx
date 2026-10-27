import Progress from '../common/Progress'
import { VERDICT_META, WARN_ON_FIT } from '../../schemas/jobApplication'
import { signature } from '../../lib/signature'
import './HiringReview.css'

const has = v => Array.isArray(v) ? v.length > 0 : Boolean(v && String(v).trim())

const PHRASES = [
    'Reading the posting',
    'Skimming your resume like a hiring manager',
    'Weighing it against the requirements',
    'Writing up the call',
]

/**
 * The hiring manager's read of the built resume: a verdict, what works, and
 * what doesn't, each tied to the posting. Concerns end in a question for you,
 * not a rewrite — what changes on the resume is yours to decide.
 *
 * Runs on its own after the analysis, except for long shots (rule 5), where
 * it waits to be asked. Says so when the resume has been edited since.
 *
 * Props:
 *   application — Application; reads hmReview, reviewPending, reviewError
 *   onReview()  — run (or re-run) the review; omit for read-only
 */
export default function HiringReview({ application, onReview }) {
    const review = application.hmReview
    const ja = application.response?.job_application
    const level = application.response?.fit_criteria?.level
    const pending = application.reviewPending
    const error = application.reviewError ?? review?.error ?? null
    const done = has(review?.verdict)
    const stale = done && ja && review.signature && review.signature !== signature(ja)

    const button = onReview && (
        <button type="button" className="link-btn" onClick={onReview} disabled={Boolean(pending)}>
            {done ? 'Review again' : 'Get a review'}
        </button>
    )

    return (
        <section className="block hm">
            <div className="block-head">
                <p className="section-label">Hiring manager&rsquo;s read</p>
                {!pending && button}
            </div>

            {pending && <Progress variant="inline" phrases={PHRASES} startedAt={pending.startedAt} />}

            {!pending && error && (
                <div className="alert alert-error" role="alert"><strong>The review didn&rsquo;t finish.</strong> {error}</div>
            )}

            {!pending && !done && !error && (
                <p className="hm-empty">
                    {WARN_ON_FIT.has(level)
                        ? 'Skipped for long shots to save tokens. Ask for one if you plan to apply anyway.'
                        : 'How this resume reads to the person hiring for the role, judged against the posting alone.'}
                </p>
            )}

            {done && (
                <>
                    {stale && !pending && (
                        <p className="hm-stale">You&rsquo;ve edited the resume since this review.</p>
                    )}
                    <div className="hm-verdict">
                        <span className="fit-badge" style={{ '--fit': VERDICT_META[review.verdict]?.cssVar }}>
                            {review.verdict}
                        </span>
                    </div>
                    {has(review.summary) && <p className="prose hm-summary">{review.summary}</p>}

                    {review.strengths?.map((s, i) => (
                        <article key={`s${i}`} className="intent intent-qualification">
                            <header className="intent-head"><span className="intent-category">Works</span></header>
                            <p className="prose">{s.point}</p>
                            {has(s.requirement) && <p className="hm-req">{s.requirement}</p>}
                        </article>
                    ))}

                    {review.concerns?.map((c, i) => (
                        <article key={`c${i}`} className="intent intent-gap">
                            <header className="intent-head"><span className="intent-category">Concern</span></header>
                            <p className="prose">{c.point}</p>
                            {has(c.requirement) && <p className="hm-req">{c.requirement}</p>}
                            {has(c.question) && <p className="intent-blurb">{c.question}</p>}
                        </article>
                    ))}
                </>
            )}
        </section>
    )
}
