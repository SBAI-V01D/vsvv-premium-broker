/**
 * dossierCalc.js — Phase 3 — Zentrale Berechnungslogik für Beratungsdossiers
 *
 * ISOLIERT: Nur pure Funktionen, keine Seiteneffekte, kein CRM-Write.
 * Alle Berechnungen hier zentralisiert — keine verteilte Logik in UI-Komponenten.
 */

/**
 * Berechnet Monatsprämie aus Einträgen (grouped by person_name).
 * @param {Array} entries - ComparisonEntry[]
 * @param {boolean} currentOnly - Nur is_current=true Einträge
 * @returns {number} Summe CHF/Monat
 */
export function sumPraemieMonatlich(entries, currentOnly = false) {
  return entries
    .filter(e => !currentOnly || e.is_current)
    .filter(e => e.praemie_monatlich != null)
    .reduce((sum, e) => sum + Number(e.praemie_monatlich), 0);
}

/**
 * Berechnet Jahresprämie (Monat × 12).
 */
export function sumPraemieJaehrlich(entries, currentOnly = false) {
  return sumPraemieMonatlich(entries, currentOnly) * 12;
}

/**
 * Einsparung = Aktuell - Empfohlen (monatlich)
 * Positiv = Einsparung, Negativ = Mehrkosten.
 */
export function calcSavingsMonthly(entries) {
  const current   = sumPraemieMonatlich(entries, true);
  const recommended = sumPraemieMonatlich(entries.filter(e => e.is_recommended));
  if (current === 0 && recommended === 0) return null;
  return current - recommended;
}

export function calcSavingsYearly(entries) {
  const m = calcSavingsMonthly(entries);
  return m === null ? null : m * 12;
}

/**
 * Prozentuale Einsparung gegenüber aktuellem Stand.
 * @returns {number|null} z.B. -15.3 für 15.3% Einsparung
 */
export function calcSavingsPercent(entries) {
  const current     = sumPraemieMonatlich(entries, true);
  const recommended = sumPraemieMonatlich(entries.filter(e => e.is_recommended));
  if (current === 0) return null;
  return ((current - recommended) / current) * 100;
}

/**
 * Sortiert Einträge nach Prämie (günstigste zuerst).
 */
export function sortByPraemie(entries) {
  return [...entries].sort((a, b) => (a.praemie_monatlich ?? Infinity) - (b.praemie_monatlich ?? Infinity));
}

/**
 * Gruppiert Einträge nach person_name.
 * @returns {Object} { personName: Entry[] }
 */
export function groupByPerson(entries) {
  return entries.reduce((acc, e) => {
    const key = e.person_name || 'Unbekannt';
    if (!acc[key]) acc[key] = [];
    acc[key].push(e);
    return acc;
  }, {});
}

/**
 * Gruppiert nach section (grundversicherung / zusatzversicherung).
 */
export function groupBySection(entries) {
  return entries.reduce((acc, e) => {
    const key = e.section || 'grundversicherung';
    if (!acc[key]) acc[key] = [];
    acc[key].push(e);
    return acc;
  }, {});
}

/**
 * Leistungsbewertung: normalisiert Score 1–6 auf Klasse.
 */
export function scoreClass(score) {
  if (score == null) return null;
  if (score >= 5.5) return 'excellent';
  if (score >= 4.5) return 'good';
  if (score >= 3.5) return 'average';
  return 'poor';
}

export const SCORE_COLORS = {
  excellent: 'text-emerald-700 bg-emerald-50 border-emerald-200',
  good:      'text-blue-700 bg-blue-50 border-blue-200',
  average:   'text-amber-700 bg-amber-50 border-amber-200',
  poor:      'text-red-700 bg-red-50 border-red-200',
};

/**
 * Formatiert CHF-Betrag (de-CH Locale).
 */
export function fmtCHF(amount, decimals = 2) {
  if (amount == null || isNaN(amount)) return '—';
  return `CHF ${Number(amount).toLocaleString('de-CH', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  })}`;
}

/**
 * Gesamtübersicht für Dossier-Summary.
 */
export function calcDossierSummary(entries) {
  const currentMonthly    = sumPraemieMonatlich(entries, true);
  const recommendedEntries = entries.filter(e => e.is_recommended);
  const proposedMonthly   = sumPraemieMonatlich(recommendedEntries);
  const savingsMonthly    = currentMonthly > 0 || proposedMonthly > 0 ? currentMonthly - proposedMonthly : null;
  const savingsYearly     = savingsMonthly !== null ? savingsMonthly * 12 : null;
  const savingsPercent    = currentMonthly > 0 ? ((currentMonthly - proposedMonthly) / currentMonthly) * 100 : null;

  return {
    currentMonthly,
    currentYearly:   currentMonthly * 12,
    proposedMonthly,
    proposedYearly:  proposedMonthly * 12,
    savingsMonthly,
    savingsYearly,
    savingsPercent,
    hasRecommendation: recommendedEntries.length > 0,
    hasCurrent:        entries.some(e => e.is_current),
  };
}