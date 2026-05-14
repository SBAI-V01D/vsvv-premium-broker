/**
 * ZENTRALE FINANZ-ENGINE – Provisionen & Courtagen
 * ================================================
 * EINZIGE WAHRHEITSQUELLE für alle Berechnungen.
 * Wird verwendet in: Formularen, Tabellen, KPIs, BI, Exporten, Auszahlungen.
 *
 * FORMEL: Beraterprovision = Erhaltene Gesellschaftscourtage × Berateranteil%
 * Jahresprämie = nur Referenzwert, NICHT Berechnungsgrundlage.
 */

// ─── Rundungslogik ────────────────────────────────────────────────────────────
// CHF-Rundung: kaufmännisch auf 2 Dezimalstellen (Rappen-genau)
export function roundCHF(value) {
  return Math.round((parseFloat(value) || 0) * 100) / 100
}

// Prozent: 4 Dezimalstellen intern, Anzeige 2
export function roundPct(value) {
  return Math.round((parseFloat(value) || 0) * 10000) / 10000
}

// ─── Kernberechnung ───────────────────────────────────────────────────────────
/**
 * Berechnet alle Provisionsfelder aus Rohdaten.
 * Gibt immer konsistente, gerundete Werte zurück.
 */
export function calcCommissionFields(data) {
  const premiumYearly   = roundCHF(data.premium_yearly)
  const receivedAmount  = roundCHF(data.received_amount)
  const commissionPct   = roundPct(data.commission_percentage)
  const commissionAmount = roundCHF((receivedAmount * commissionPct) / 100)

  return {
    ...data,
    premium_yearly:        premiumYearly,
    received_amount:       receivedAmount,
    commission_percentage: commissionPct,
    commission_amount:     commissionAmount,
  }
}

// ─── Formatierung ─────────────────────────────────────────────────────────────
export function formatCHF(amount) {
  return roundCHF(amount).toLocaleString('de-CH', { style: 'currency', currency: 'CHF' })
}

export function formatPct(value, decimals = 1) {
  return `${(parseFloat(value) || 0).toFixed(decimals)}%`
}

export function formatDate(dateStr) {
  if (!dateStr) return '–'
  return new Date(dateStr).toLocaleDateString('de-CH')
}

export function formatDateTime(dateStr) {
  if (!dateStr) return '–'
  return new Date(dateStr).toLocaleString('de-CH', { dateStyle: 'short', timeStyle: 'short' })
}

// ─── Aggregations-Engine ─────────────────────────────────────────────────────
/**
 * Berechnet alle KPIs für einen Datensatz.
 * Identisch verwendet in KPI-Bar, BI, Exporten.
 */
export function calcKPIs(entries) {
  const active    = entries.filter(e => !e.archived)
  const nonCancelled = active.filter(e => e.status !== 'cancelled')
  const cancelled = active.filter(e => e.status === 'cancelled')
  const paid      = active.filter(e => e.status === 'paid')
  const pending   = active.filter(e => e.status === 'pending')
  const received  = active.filter(e => e.status === 'received' || e.status === 'earned')
  const overdue   = active.filter(e => {
    if (e.status !== 'invoiced') return false
    if (!e.invoiced_date) return false
    const days = (Date.now() - new Date(e.invoiced_date).getTime()) / 86400000
    return days > 60
  })

  const totalExpected    = roundCHF(nonCancelled.reduce((s, e) => s + (e.commission_amount || 0), 0))
  const totalReceived    = roundCHF(active.reduce((s, e) => s + (e.received_amount || 0), 0))
  const totalPaid        = roundCHF(paid.reduce((s, e) => s + (e.commission_amount || 0), 0))
  const totalPending     = roundCHF(pending.reduce((s, e) => s + (e.commission_amount || 0), 0))
  const totalCancelled   = roundCHF(cancelled.reduce((s, e) => s + (e.commission_amount || 0), 0))
  const totalOverdue     = roundCHF(overdue.reduce((s, e) => s + (e.commission_amount || 0), 0))
  const openAmount       = roundCHF(totalExpected - totalPaid)
  const payoutRate       = totalExpected > 0 ? roundPct((totalPaid / totalExpected) * 100) : 0
  const stornoRate       = (nonCancelled.length + cancelled.length) > 0
    ? roundPct((cancelled.length / (nonCancelled.length + cancelled.length)) * 100)
    : 0

  return {
    count:          active.length,
    nonCancelledCount: nonCancelled.length,
    cancelledCount: cancelled.length,
    paidCount:      paid.length,
    pendingCount:   pending.length,
    overdueCount:   overdue.length,
    totalExpected,
    totalReceived,
    totalPaid,
    totalPending,
    totalCancelled,
    totalOverdue,
    openAmount,
    payoutRate,
    stornoRate,
  }
}

// ─── Storno-Analyse ───────────────────────────────────────────────────────────
export function calcStornoByDimension(entries, dimensionKey, nameKey) {
  const map = {}
  entries.filter(e => !e.archived).forEach(e => {
    const key = e[dimensionKey] || '–'
    if (!map[key]) map[key] = { key, name: e[nameKey] || key, total: 0, cancelled: 0, commissionLost: 0 }
    map[key].total += 1
    if (e.status === 'cancelled') {
      map[key].cancelled += 1
      map[key].commissionLost += e.commission_amount || 0
    }
  })
  return Object.values(map)
    .filter(d => d.total >= 2)
    .map(d => ({ ...d, rate: roundPct(d.total > 0 ? (d.cancelled / d.total) * 100 : 0) }))
    .sort((a, b) => b.rate - a.rate)
}

// ─── Monatstrend ─────────────────────────────────────────────────────────────
export function calcMonthlyTrend(entries, monthsBack = 12) {
  const active = entries.filter(e => !e.archived && e.status !== 'cancelled')
  const now = new Date()
  const months = []
  for (let i = monthsBack - 1; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1)
    const year  = d.getFullYear()
    const month = d.getMonth() + 1
    const label = d.toLocaleDateString('de-CH', { month: 'short', year: '2-digit' })
    const monthEntries = active.filter(e => {
      if (!e.entry_date) return false
      const ed = new Date(e.entry_date)
      return ed.getFullYear() === year && (ed.getMonth() + 1) === month
    })
    months.push({
      label,
      year,
      month,
      provision: roundCHF(monthEntries.reduce((s, e) => s + (e.commission_amount || 0), 0)),
      courtage:  roundCHF(monthEntries.reduce((s, e) => s + (e.received_amount || 0), 0)),
      count:     monthEntries.length,
    })
  }
  return months
}

// ─── Konsistenzprüfung ────────────────────────────────────────────────────────
/**
 * Prüft einen Eintrag auf Dateninkonsistenzen.
 * Gibt Array von Warnungen zurück (leer = konsistent).
 */
export function checkEntryConsistency(entry) {
  const warnings = []
  const calc = calcCommissionFields(entry)

  // Berechnungsabweichung (> 0.02 CHF = Fehler)
  if (Math.abs((entry.commission_amount || 0) - calc.commission_amount) > 0.02) {
    warnings.push(`Provisionsberechnung inkonsistent: gespeichert ${formatCHF(entry.commission_amount)} ≠ berechnet ${formatCHF(calc.commission_amount)}`)
  }

  // Courtage grösser als Jahresprämie
  if ((entry.received_amount || 0) > (entry.premium_yearly || 0) && (entry.premium_yearly || 0) > 0) {
    warnings.push(`Erhaltene Courtage (${formatCHF(entry.received_amount)}) > Jahresprämie (${formatCHF(entry.premium_yearly)})`)
  }

  // Provision > 100% der Courtage
  if ((entry.commission_percentage || 0) > 100) {
    warnings.push(`Berateranteil > 100% (${formatPct(entry.commission_percentage)})`)
  }

  // Paid aber kein paid_date
  if (entry.status === 'paid' && !entry.paid_date) {
    warnings.push('Status "Ausbezahlt" ohne Auszahlungsdatum')
  }

  // received_amount fehlt aber Status > invoiced
  const advancedStatuses = ['received', 'earned', 'paid']
  if (advancedStatuses.includes(entry.status) && !(entry.received_amount > 0)) {
    warnings.push('Keine erhaltene Courtage für fortgeschrittenen Status')
  }

  return warnings
}

// ─── Status-Workflow ──────────────────────────────────────────────────────────
export const STATUS_TRANSITIONS = {
  pending:   ['invoiced', 'cancelled'],
  invoiced:  ['received', 'cancelled'],
  received:  ['earned',   'cancelled'],
  earned:    ['paid',     'cancelled'],
  paid:      [],
  cancelled: [],
}

export const STATUS_META = {
  pending:   { label: 'Ausstehend',  color: 'bg-gray-100 text-gray-700' },
  invoiced:  { label: 'Eingereicht', color: 'bg-blue-100 text-blue-700' },
  received:  { label: 'Erhalten',    color: 'bg-yellow-100 text-yellow-700' },
  earned:    { label: 'Freigegeben', color: 'bg-indigo-100 text-indigo-700' },
  paid:      { label: 'Ausbezahlt',  color: 'bg-green-100 text-green-700' },
  cancelled: { label: 'Storniert',   color: 'bg-red-100 text-red-700' },
}

export function canTransitionTo(current, next) {
  return (STATUS_TRANSITIONS[current] || []).includes(next)
}

export function getStatusDates(newStatus) {
  const updates = { status: newStatus }
  const today = new Date().toISOString().split('T')[0]
  if (newStatus === 'invoiced') updates.invoiced_date = today
  if (newStatus === 'received') updates.received_date = today
  if (newStatus === 'earned')   updates.earned_date   = today
  if (newStatus === 'paid')     { updates.paid_date = today; updates.is_paid = true }
  return updates
}

// ─── Validierung ─────────────────────────────────────────────────────────────
export function validateCommissionForm(data) {
  const errors = {}
  if (!data.entry_date)       errors.entry_date       = 'Pflichtfeld'
  if (!data.insurer)          errors.insurer          = 'Pflichtfeld'
  if (!data.advisor_id)       errors.advisor_id       = 'Pflichtfeld'
  if (!data.organization_id)  errors.organization_id  = 'Pflichtfeld'
  if (!data.customer_name)    errors.customer_name    = 'Pflichtfeld'
  if (!data.product_category) errors.product_category = 'Pflichtfeld'

  const premium  = parseFloat(data.premium_yearly) || 0
  const received = parseFloat(data.received_amount) || 0
  const pct      = parseFloat(data.commission_percentage) || 0

  if (premium <= 0)   errors.premium_yearly       = 'Muss > 0 sein'
  if (received <= 0)  errors.received_amount       = 'Pflichtfeld – Berechnungsgrundlage'
  if (pct <= 0)       errors.commission_percentage = 'Muss > 0 sein'
  if (pct > 100)      errors.commission_percentage = 'Maximal 100%'
  if (received > 0 && premium > 0 && received > premium) {
    errors.received_amount = 'Erhaltene Courtage grösser als Jahresprämie – bitte prüfen'
  }

  return errors
}

// ─── Export-Engine ────────────────────────────────────────────────────────────
export function generateCSV(entries) {
  const headers = [
    'Datum', 'Gesellschaft', 'Berater', 'Kunde', 'Sparte', 'Policen-Nr.',
    'Jahresprämie CHF', 'Courtage erhalten CHF', 'Berateranteil %',
    'Beraterprovision CHF', 'Status', 'Eingereicht am', 'Erhalten am', 'Ausbezahlt am',
  ]
  const rows = entries.map(e => [
    e.entry_date || '',
    e.insurer || '',
    e.advisor_name || '',
    e.customer_name || '',
    e.product_category || '',
    e.policy_number || '',
    roundCHF(e.premium_yearly).toFixed(2),
    roundCHF(e.received_amount).toFixed(2),
    roundPct(e.commission_percentage).toFixed(4),
    roundCHF(e.commission_amount).toFixed(2),
    STATUS_META[e.status]?.label || e.status || '',
    e.invoiced_date || '',
    e.received_date || '',
    e.paid_date || '',
  ])
  return [headers, ...rows]
    .map(r => r.map(v => `"${String(v).replace(/"/g, '""')}"`).join(';'))
    .join('\n')
}

export function downloadCSV(content, filename) {
  const blob = new Blob(['\uFEFF' + content], { type: 'text/csv;charset=utf-8;' })
  const url  = URL.createObjectURL(blob)
  const a    = document.createElement('a')
  a.href = url; a.download = filename; a.click()
  URL.revokeObjectURL(url)
}