/**
 * dossierCalc.js — Phase 3/5 (Hardening)
 *
 * ISOLIERT: Nur pure Funktionen, keine Seiteneffekte, kein CRM-Write.
 * Alle Berechnungen hier zentralisiert — keine verteilte Logik in UI-Komponenten.
 *
 * Hardening-Änderungen:
 * - Vollständiger null/undefined/NaN-Schutz in allen Funktionen
 * - Defensive Array-Behandlung (leere Eingaben nie crashen)
 * - Explizite Typen-Koerzierung mit Fallback
 */

/**
 * Normalisiert einen Prämien-Wert sicher auf number|null.
 * @param {*} v
 * @returns {number|null}
 */
function safePraemie(v) {
  if (v == null) return null;
  const n = Number(v);
  return isFinite(n) ? n : null;
}

/**
 * Normalisiert einen Array sicher (null/undefined → []).
 */
function safeArray(arr) {
  return Array.isArray(arr) ? arr : [];
}

/**
 * Berechnet Monatsprämie aus Einträgen.
 * @param {Array} entries - ComparisonEntry[]
 * @param {boolean} currentOnly - Nur is_current=true Einträge
 * @returns {number} Summe CHF/Monat (immer eine Zahl, nie null)
 */
export function sumPraemieMonatlich(entries, currentOnly = false) {
  return safeArray(entries)
    .filter(e => e != null)
    .filter(e => !currentOnly || e.is_current)
    .reduce((sum, e) => {
      const p = safePraemie(e.praemie_monatlich);
      return p !== null ? sum + p : sum;
    }, 0);
}

/**
 * Berechnet Jahresprämie (Monat × 12).
 */
export function sumPraemieJaehrlich(entries, currentOnly = false) {
  return sumPraemieMonatlich(entries, currentOnly) * 12;
}

/**
 * Einsparung = Aktuell - Empfohlen (monatlich).
 * Gibt null zurück wenn keine verwertbaren Daten vorhanden.
 */
export function calcSavingsMonthly(entries) {
  const arr = safeArray(entries);
  const current      = sumPraemieMonatlich(arr, true);
  const recommended  = sumPraemieMonatlich(arr.filter(e => e?.is_recommended));
  if (current === 0 && recommended === 0) return null;
  return current - recommended;
}

export function calcSavingsYearly(entries) {
  const m = calcSavingsMonthly(entries);
  return m === null ? null : m * 12;
}

/**
 * Prozentuale Einsparung gegenüber aktuellem Stand.
 * @returns {number|null}
 */
export function calcSavingsPercent(entries) {
  const arr          = safeArray(entries);
  const current      = sumPraemieMonatlich(arr, true);
  const recommended  = sumPraemieMonatlich(arr.filter(e => e?.is_recommended));
  if (current <= 0) return null;
  return ((current - recommended) / current) * 100;
}

/**
 * Sortiert Einträge nach Prämie (günstigste zuerst, null-Prämien ans Ende).
 */
export function sortByPraemie(entries) {
  return [...safeArray(entries)].sort((a, b) => {
    const pa = safePraemie(a?.praemie_monatlich) ?? Infinity;
    const pb = safePraemie(b?.praemie_monatlich) ?? Infinity;
    return pa - pb;
  });
}

/**
 * Gruppiert Einträge nach person_name.
 * @returns {Object} { personName: Entry[] }
 */
export function groupByPerson(entries) {
  return safeArray(entries).reduce((acc, e) => {
    const key = e?.person_name || 'Unbekannt';
    if (!acc[key]) acc[key] = [];
    acc[key].push(e);
    return acc;
  }, {});
}

/**
 * Gruppiert nach section (grundversicherung / zusatzversicherung).
 */
export function groupBySection(entries) {
  return safeArray(entries).reduce((acc, e) => {
    const key = e?.section || 'grundversicherung';
    if (!acc[key]) acc[key] = [];
    acc[key].push(e);
    return acc;
  }, {});
}

/**
 * Leistungsbewertung: normalisiert Score 1–6 auf Klasse.
 * @returns {'excellent'|'good'|'average'|'poor'|null}
 */
export function scoreClass(score) {
  const n = Number(score);
  if (!isFinite(n)) return null;
  if (n >= 5.5) return 'excellent';
  if (n >= 4.5) return 'good';
  if (n >= 3.5) return 'average';
  return 'poor';
}

export const SCORE_COLORS = {
  excellent: 'text-emerald-700 bg-emerald-50 border-emerald-200',
  good:      'text-blue-700 bg-blue-50 border-blue-200',
  average:   'text-amber-700 bg-amber-50 border-amber-200',
  poor:      'text-red-700 bg-red-50 border-red-200',
};

/**
 * Formatiert ein Datum sicher für de-CH.
 * @param {string|Date|null} date
 * @returns {string}
 */
export function fmtDate(date) {
  if (!date) return '—';
  const d = new Date(date);
  if (isNaN(d.getTime())) return '—';
  return d.toLocaleDateString('de-CH');
}

/**
 * Formatiert CHF-Betrag sicher (de-CH Locale).
 * @param {*} amount
 * @param {number} decimals
 * @returns {string} formatierter Betrag oder '—'
 */
export function fmtCHF(amount, decimals = 2) {
  const n = Number(amount);
  if (amount == null || !isFinite(n)) return '—';
  return `CHF ${n.toLocaleString('de-CH', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  })}`;
}

// Prioritätsreihenfolge für die "proposed"-Gruppe in der Summary
const PROPOSED_GRUPPE_PRIORITY = ['optimiert', 'angebot_1', 'angebot_2', 'angebot_3', 'angebot_4', 'angebot_5', 'manuell'];

/**
 * Bestimmt die Gruppe, die als "Optimierte / Vorgeschlagene Lösung" in der Summary verwendet wird.
 *
 * Priorität:
 *   1. Gruppe mit is_recommended=true Einträgen
 *   2. 'optimiert' (falls vorhanden)
 *   3. Erste vorhandene Angebots-Gruppe in PROPOSED_GRUPPE_PRIORITY
 *
 * @param {Array} entries - ComparisonEntry[]
 * @returns {string|null} Gruppenname oder null wenn keine Nicht-Aktuelle-Lösung vorhanden
 */
export function resolveProposedGruppe(entries) {
  const arr = safeArray(entries).filter(e => e?.gruppe !== 'aktuelle_loesung');
  if (arr.length === 0) return null;

  // 1. Explizit empfohlene Gruppe
  const recommendedEntry = arr.find(e => e?.is_recommended);
  if (recommendedEntry?.gruppe) return recommendedEntry.gruppe;

  // 2. Nach Prioritätsliste: erste vorhandene Gruppe
  const presentGruppen = new Set(arr.map(e => e?.gruppe).filter(Boolean));
  for (const g of PROPOSED_GRUPPE_PRIORITY) {
    if (presentGruppen.has(g)) return g;
  }

  return null;
}

/**
 * Gesamtübersicht für Dossier-Summary.
 * Alle Felder sind immer definiert (null für "keine Daten", nie undefined).
 *
 * Priorität für "proposed":
 *   1. Gruppe mit is_recommended=true Einträgen
 *   2. gruppe='optimiert' (falls vorhanden)
 *   3. Erste vorhandene Angebots-Gruppe (angebot_1, angebot_2, …)
 *
 * Gibt zusätzlich `proposedGruppe` zurück, damit Summary und Print
 * dieselbe Datenquelle verwenden.
 */
export function calcDossierSummary(entries) {
  const arr = safeArray(entries);

  // Aktuelle Lösung: gruppe='aktuelle_loesung' ODER is_current=true (Legacy)
  const currentEntries = arr.filter(e => e?.gruppe === 'aktuelle_loesung' || e?.is_current);
  const currentMonthly = currentEntries.reduce((sum, e) => {
    const p = safePraemie(e?.praemie_monatlich);
    return p !== null ? sum + p : sum;
  }, 0);

  // Empfohlene / vorgeschlagene Gruppe automatisch bestimmen
  const proposedGruppe  = resolveProposedGruppe(arr);
  const proposedEntries = proposedGruppe
    ? arr.filter(e => e?.gruppe === proposedGruppe || (proposedGruppe === 'optimiert' && e?.is_recommended && e?.gruppe !== 'aktuelle_loesung'))
    : [];
  const proposedMonthly = proposedEntries.reduce((sum, e) => {
    const p = safePraemie(e?.praemie_monatlich);
    return p !== null ? sum + p : sum;
  }, 0);

  const hasCurrent        = currentEntries.some(e => safePraemie(e?.praemie_monatlich) !== null);
  const hasRecommendation = proposedEntries.some(e => safePraemie(e?.praemie_monatlich) !== null);
  const savingsMonthly    = hasCurrent || hasRecommendation ? currentMonthly - proposedMonthly : null;
  const savingsYearly     = savingsMonthly !== null ? savingsMonthly * 12 : null;
  const savingsPercent    = hasCurrent && currentMonthly > 0
    ? ((currentMonthly - proposedMonthly) / currentMonthly) * 100
    : null;

  return {
    currentMonthly,
    currentYearly:      currentMonthly * 12,
    proposedMonthly,
    proposedYearly:     proposedMonthly * 12,
    savingsMonthly,
    savingsYearly,
    savingsPercent,
    hasRecommendation:  proposedEntries.length > 0,
    hasCurrent:         currentEntries.length > 0,
    proposedGruppe,     // welche Gruppe als "Optimiert" verwendet wurde
  };
}