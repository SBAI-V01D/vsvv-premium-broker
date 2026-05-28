/**
 * Zentrale Relevanz-Logik für Vertragsabläufe.
 * EINE Quelle der Wahrheit — verwendet in Vertragsablaeufe, Dashboard, KPIs, Alerts.
 */

export const daysUntil = (d) =>
  d ? Math.ceil((new Date(d + 'T00:00:00') - new Date()) / 86400000) : null

/**
 * Berechnet alle relevanten Aktionen für einen Vertrag.
 * Gibt ein sortiertes Array von { type, severity, days } zurück.
 */
export function analyzeContract(contract) {
  const endDays    = daysUntil(contract.end_date)
  const cancelDays = daysUntil(contract.cancellation_deadline)
  const actions = []

  const isPlaceholderEnd    = contract.end_date?.startsWith('9999')
  const isPlaceholderCancel = contract.cancellation_deadline?.startsWith('9999')
  if (isPlaceholderEnd || isPlaceholderCancel || contract.requires_review) {
    actions.push({ type: 'review_required', severity: 'review_required', days: null })
    return actions
  }

  if (contract.status === 'expired' || (endDays !== null && endDays < 0)) {
    actions.push({ type: 'expired', label: 'Abgelaufen', severity: 'expired', days: endDays ?? -1 })
  }
  if (cancelDays !== null && cancelDays <= 365) {
    const sev = cancelDays < 0 ? 'expired' : cancelDays <= 30 ? 'critical' : cancelDays <= 60 ? 'urgent' : cancelDays <= 90 ? 'warning' : cancelDays <= 150 ? 'process' : 'early'
    actions.push({ type: 'kuendigung', severity: sev, days: cancelDays })
  }
  if (endDays !== null && endDays <= 365) {
    const sev = endDays < 0 ? 'expired' : endDays <= 30 ? 'critical' : endDays <= 60 ? 'urgent' : endDays <= 90 ? 'warning' : endDays <= 150 ? 'process' : 'early'
    actions.push({ type: 'ablauf', severity: sev, days: endDays })
  }

  const order = { critical: 0, urgent: 1, warning: 2, expired: 3, process: 4, early: 5, review_required: 6 }
  actions.sort((a, b) => (order[a.severity] ?? 9) - (order[b.severity] ?? 9))
  return actions
}

/**
 * Ob ein Vertrag operativ relevant ist (innerhalb 365 Tage, abgelaufen, Prüfung ausstehend).
 * Diese Funktion gilt systemweit — Cockpit, Vertragsabläufe, KPIs, Alerts verwenden sie alle.
 */
export function isContractActionable(contract) {
  if (contract.archived) return false
  if (['cancelled', 'archived'].includes(contract.status)) return false

  // Platzhalter-Daten oder manuelles Review-Flag → immer anzeigen
  if (
    contract.requires_review ||
    contract.end_date?.startsWith('9999') ||
    contract.cancellation_deadline?.startsWith('9999')
  ) return true

  if (contract.status === 'expired') return true

  const endDays    = daysUntil(contract.end_date)
  const cancelDays = daysUntil(contract.cancellation_deadline)
  if (endDays    !== null && endDays    <= 365) return true
  if (cancelDays !== null && cancelDays <= 365) return true

  return false
}