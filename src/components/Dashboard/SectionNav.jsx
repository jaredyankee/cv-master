import { SECTIONS } from '../../lib/sections'
import './SectionNav.css'

// The glyph for each section; the list itself lives in lib/sections.
const GLYPHS = {
    applications: ApplicationsGlyph,
    listings:     ListingsGlyph,
    profile:      ProfileGlyph,
}

/**
 * The three sections, as a bar pinned to the bottom of the screen.
 *
 * Nothing is selected to begin with, and the dashboard shows its overview:
 * listings beside applications, the profile in its drawer. Choosing a section
 * gives it the whole screen; choosing it again goes back to the overview.
 * Toggles rather than tabs, because the overview is a view of its own rather
 * than one of the three.
 *
 * Props:
 *   section:  null | 'applications' | 'listings' | 'profile'
 *   onSelect(section)  — the section clicked, whether or not it is current
 *   counts:   { applications?: number, listings?: number }
 *   inert:    boolean — while the drawer is open
 */
export default function SectionNav({ section, onSelect, counts = {}, inert = false }) {
    return (
        <nav className="section-nav" aria-label="Sections" inert={inert}>
            {SECTIONS.map(({ id, label }) => {
                const Glyph = GLYPHS[id]
                const active = section === id
                return (
                    <button
                        key={id}
                        type="button"
                        className={`section-btn${active ? ' is-active' : ''}`}
                        aria-pressed={active}
                        onClick={() => onSelect(id)}
                        title={active ? 'Back to the overview' : undefined}
                    >
                        <Glyph />
                        <span className="section-text">
                            {label}
                            {counts[id] > 0 && <span className="count">{counts[id]}</span>}
                        </span>
                    </button>
                )
            })}
        </nav>
    )
}

// Drawn inline so they take the text colour in both themes.

function ApplicationsGlyph() {
    return (
        <svg className="section-glyph" width="18" height="18" viewBox="0 0 18 18" aria-hidden="true" focusable="false">
            <rect x="1.5" y="2.5" width="15" height="13" rx="2" fill="none" stroke="currentColor" strokeWidth="1.4" />
            <path d="M1.5 6.5h15M5.5 6.5v9" stroke="currentColor" strokeWidth="1.4" />
        </svg>
    )
}

function ListingsGlyph() {
    return (
        <svg className="section-glyph" width="18" height="18" viewBox="0 0 18 18" aria-hidden="true" focusable="false">
            <circle cx="7.5" cy="7.5" r="5" fill="none" stroke="currentColor" strokeWidth="1.4" />
            <path d="M11.2 11.2l4.8 4.8" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
        </svg>
    )
}

function ProfileGlyph() {
    return (
        <svg className="section-glyph" width="16" height="18" viewBox="0 0 18 20" aria-hidden="true" focusable="false">
            <rect x="1" y="1" width="16" height="18" rx="2.5" fill="none" stroke="currentColor" strokeWidth="1.5" />
            <path d="M5 6h8M5 9.5h8M5 13h5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
        </svg>
    )
}
