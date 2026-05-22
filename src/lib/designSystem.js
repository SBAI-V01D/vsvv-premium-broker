/**
 * ─────────────────────────────────────────────────────────────
 * DESIGN SYSTEM — Spatial Architecture
 * ─────────────────────────────────────────────────────────────
 * 
 * Zentrale Definition aller räumlichen Werte für konsistente
 * Materialität über die gesamte Plattform.
 * 
 * Ziel: Wealth/Advisory-Feeling, nicht SaaS-Dashboard.
 */

export const SPATIAL = {
  /**
   * ── CONTAINER WIDTHS ───────────────────────────────────────
   * Maximale Breiten für verschiedene Kontexte.
   */
  container: {
    narrow:   'max-w-2xl',    // 42rem — Forms, Dialogs
    standard: 'max-w-5xl',    // 64rem — Detail pages
    wide:     'max-w-7xl',    // 80rem — Dashboards
    full:     'max-w-full',   // 100% — Tables, Feeds
  },

  /**
   * ── VERTICAL RHYTHM — Section Spacing ─────────────────────
   * Einheitlicher Abstand zwischen Sections.
   */
  section: {
    tight:   'space-y-4',    // 1rem — Kompakte Listen
    standard:'space-y-6',    // 1.5rem — Normaler Content
    loose:   'space-y-8',    // 2rem — Dashboard Sections
    xl:      'space-y-12',   // 3rem — Major divisions
  },

  /**
   * ── CARD/PANEL SPACING ────────────────────────────────────
   * Abstände zwischen Cards innerhalb einer Section.
   */
  card: {
    tight:   'gap-3',        // 0.75rem — Dense grids
    standard:'gap-4',        // 1rem — Normal cards
    loose:   'gap-6',        // 1.5rem — Premium spacing
  },

  /**
   * ── PAGE PADDING ──────────────────────────────────────────
   * Innenabstände für Page-Container.
   */
  page: {
    tight:   'p-4',          // 1rem — Mobile/compact
    standard:'p-6',          // 1.5rem — Standard pages
    loose:   'p-8',          // 2rem — Premium pages
  },

  /**
   * ── STICKY OFFSETS ────────────────────────────────────────
   * Einheitliche Top-Offsets für sticky Elemente.
   */
  sticky: {
    header:  'top-0',        // App header (wenn vorhanden)
    subheader:'top-[52px]',  // Page header nach App header
    toolbar: 'top-[64px]',   // Toolbars nach subheader
  },

  /**
   * ── Z-INDEX HIERARCHIE ────────────────────────────────────
   * Konsistente Layer für Überlappungen.
   */
  z: {
    base:      'z-0',       // Normal content
    raised:    'z-10',      // Cards, surfaces
    sticky:    'z-20',      // Sticky headers
    overlay:   'z-30',      // Dropdowns, menus
    modal:     'z-40',      // Dialogs, modals
    toast:     'z-50',      // Toast notifications
  },

  /**
   * ── HEADER HEIGHTS ────────────────────────────────────────
   * Einheitliche Höhen für Header-Bereiche.
   */
  header: {
    app:     'h-[52px]',    // App-level header (wenn verwendet)
    page:    'h-auto min-h-[52px]', // Page header (flexibel)
    section: 'h-auto min-h-[44px]', // Section header
  },

  /**
   * ── SURFACE DEPTHS ────────────────────────────────────────
   * Schatten-Elevation für verschiedene Material-Ebenen.
   */
  elevation: {
    flat:    'shadow-none',           // Keine Elevation
    subtle:  'shadow-card',           // Minimale Tiefe (Cards)
    raised:  'shadow-raised',         // Deutliche Elevation
    overlay: 'shadow-overlay',        // Starke Elevation (Modals)
  },
}

/**
 * ─────────────────────────────────────────────────────────────
 * USAGE EXAMPLES
 * ─────────────────────────────────────────────────────────────
 * 
 * // Container Width
 * <div className={SPATIAL.container.standard}>...</div>
 * 
 * // Vertical Rhythm
 * <div className={SPATIAL.section.standard}>...</div>
 * 
 * // Card Grid
 * <div className={`grid grid-cols-1 md:grid-cols-2 ${SPATIAL.card.loose}`}>...</div>
 * 
 * // Page Layout
 * <div className={SPATIAL.page.loose}>...</div>
 * 
 * // Sticky Header
 * <div className={`sticky ${SPATIAL.sticky.subheader} ${SPATIAL.z.sticky}`}>...</div>
 */