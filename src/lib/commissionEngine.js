/**
 * ZENTRALE FINANZ-ENGINE – Courtagen & Provisionen
 * =================================================
 * FACHLICHE TRENNUNG:
 *   COURTAGE  = Vergütung Gesellschaft → Firma → Berater  (KVG/VVG-Courtage)
 *   PROVISION = Einmalige Vergütung Gesellschaft → Firma → Berater  (z.B. Abschlussprovision)
 *
 * FORMELN:
 *   Beratercourtage  = Gesellschaftscourtage  × Beratercourtage-%  / 100
 *   Beraterprovision = Gesellschaftsprovision × Beraterprovision-% / 100
 *
 * RÜCKWÄRTSKOMPATIBILITÄT:
 *   Legacy-Felder (received_amount, commission_percentage, commission_amount)
 *   werden auf die neuen Courtage-Felder gemappt.
 */

// ─── Rundungslogik ────────────────────────────────────────────────────────────
export function roundCHF(value) {
  return Math.round((parseFloat(value) || 0) * 100) / 100
}
export function roundPct(value) {
  return Math.round((parseFloat(value) || 0) * 10000) / 10000
}

// ─── Migration: Legacy → neue Felder ─────────────────────────────────────────
/**
 * Normalisiert einen Eintrag: liest Legacy-Felder und befüllt neue Felder,
 * wenn die neuen leer sind. Keine bestehenden Daten werden überschrieben.
 */
export function normalizeLegacyEntry(entry) {
  const e = { ...entry }
  // Courtage-Migration
  if (!e.company_courtage_amount && e.received_amount) {
    e.company_courtage_amount = e.received_amount
  }
  if (!e.advisor_courtage_percentage && e.commission_percentage) {
    e.advisor_courtage_percentage = e.commission_percentage
  }
  if (!e.advisor_courtage_amount && e.commission_amount) {
    e.advisor_courtage_amount = e.commission_amount
  }
  if (!e.courtage_status && e.status) {
    e.courtage_status = e.status
  }
  if (!e.courtage_received_date && e.received_date) {
    e.courtage_received_date = e.received_date
  }
  if (!e.courtage_invoiced_date && e.invoiced_date) {
    e.courtage_invoiced_date = e.invoiced_date
  }
  if (!e.courtage_earned_date && e.earned_date) {
    e.courtage_earned_date = e.earned_date
  }
  if (!e.courtage_paid_date && e.paid_date) {
    e.courtage_paid_date = e.paid_date
  }
  return e
}

// ─── Kernberechnungen ─────────────────────────────────────────────────────────
/**
 * Berechnet Courtage-Felder.
 * Beratercourtage = Gesellschaftscourtage × Beratercourtage-% / 100
 */
export function calcCourtageFields(data) {
  const companyCourtage   = roundCHF(data.company_courtage_amount)
  const advisorCourtagePct = roundPct(data.advisor_courtage_percentage)
  const advisorCourtage   = roundCHF((companyCourtage * advisorCourtagePct) / 100)
  return {
    ...data,
    company_courtage_amount:    companyCourtage,
    advisor_courtage_percentage: advisorCourtagePct,
    advisor_courtage_amount:    advisorCourtage,
    // Legacy-Sync (Rückwärtskompatibilität)
    received_amount:       companyCourtage,
    commission_percentage: advisorCourtagePct,
    commission_amount:     advisorCourtage,
  }
}

/**
 * Berechnet Provisions-Felder.
 * Beraterprovision = Gesellschaftsprovision × Beraterprovision-% / 100
 */
export function calcProvisionFields(data) {
  const companyProvision   = roundCHF(data.company_provision_amount)
  const advisorProvisionPct = roundPct(data.advisor_provision_percentage)
  const advisorProvision   = roundCHF((companyProvision * advisorProvisionPct) / 100)
  return {
    ...data,
    company_provision_amount:    companyProvision,
    advisor_provision_percentage: advisorProvisionPct,
    advisor_provision_amount:    advisorProvision,
  }
}

/**
 * Berechnet ALLE Felder (Courtage + Provision).
 * Zentrale Funktion für Speichern/Update.
 */
export function calcCommissionFields(data) {
  const withCourtage  = calcCourtageFields(data)
  const withProvision = calcProvisionFields(withCourtage)
  return {
    ...withProvision,
    premium_yearly: roundCHF(data.premium_yearly),
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

// ─── KPI-Engine ───────────────────────────────────────────────────────────────
/**
 * Getrennte KPIs für Courtage und Provision.
 */
export function calcKPIs(entries) {
  const normalized = entries.map(normalizeLegacyEntry)
  const active     = normalized.filter(e => !e.archived)
  const nonCancCourtage  = active.filter(e => (e.courtage_status || e.status) !== 'cancelled')
  const nonCancProvision = active.filter(e => (e.provision_status || 'pending') !== 'cancelled')
  const cancelled  = active.filter(e => (e.courtage_status || e.status) === 'cancelled')

  const overdueCourtage = active.filter(e => {
    if ((e.courtage_status || e.status) !== 'invoiced') return false
    const date = e.courtage_invoiced_date || e.invoiced_date
    if (!date) return false
    return (Date.now() - new Date(date).getTime()) / 86400000 > 60
  })

  // COURTAGE KPIs
  const totalCourtageReceived = roundCHF(active.reduce((s, e) => s + (e.company_courtage_amount || 0), 0))
  const totalAdvisorCourtage  = roundCHF(nonCancCourtage.reduce((s, e) => s + (e.advisor_courtage_amount || 0), 0))
  const totalCourtagePaid     = roundCHF(active.filter(e => (e.courtage_status || e.status) === 'paid')
    .reduce((s, e) => s + (e.advisor_courtage_amount || 0), 0))
  const totalCourtagePending  = roundCHF(active.filter(e => (e.courtage_status || e.status) === 'pending')
    .reduce((s, e) => s + (e.company_courtage_amount || 0), 0))
  const openCourtage          = roundCHF(totalAdvisorCourtage - totalCourtagePaid)
  const totalOverdueCourtage  = roundCHF(overdueCourtage.reduce((s, e) => s + (e.advisor_courtage_amount || 0), 0))

  // PROVISION KPIs
  const totalProvisionReceived = roundCHF(active.reduce((s, e) => s + (e.company_provision_amount || 0), 0))
  const totalAdvisorProvision  = roundCHF(nonCancProvision.reduce((s, e) => s + (e.advisor_provision_amount || 0), 0))
  const totalProvisionPaid     = roundCHF(active.filter(e => (e.provision_status || 'pending') === 'paid')
    .reduce((s, e) => s + (e.advisor_provision_amount || 0), 0))
  const openProvision          = roundCHF(totalAdvisorProvision - totalProvisionPaid)

  // Storno / Gemeinsam
  const stornoRate = (nonCancCourtage.length + cancelled.length) > 0
    ? roundPct((cancelled.length / (nonCancCourtage.length + cancelled.length)) * 100) : 0
  const courtagePayout = totalAdvisorCourtage > 0
    ? roundPct((totalCourtagePaid / totalAdvisorCourtage) * 100) : 0

  return {
    count: active.length,
    cancelledCount: cancelled.length,
    nonCancelledCount: nonCancCourtage.length,
    overdueCount: overdueCourtage.length,
    pendingCount: active.filter(e => (e.courtage_status || e.status) === 'pending').length,

    // COURTAGE
    totalCourtageReceived,
    totalAdvisorCourtage,
    totalCourtagePaid,
    totalCourtagePending,
    openCourtage,
    totalOverdueCourtage,
    courtagePayout,

    // PROVISION
    totalProvisionReceived,
    totalAdvisorProvision,
    totalProvisionPaid,
    openProvision,

    // Legacy (für bestehende Komponenten)
    totalExpected:  totalAdvisorCourtage,
    totalReceived:  totalCourtageReceived,
    totalPaid:      totalCourtagePaid,
    totalPending:   totalCourtagePending,
    openAmount:     openCourtage,
    totalOverdue:   totalOverdueCourtage,
    payoutRate:     courtagePayout,
    stornoRate,
  }
}

// ─── Storno-Analyse ───────────────────────────────────────────────────────────
export function calcStornoByDimension(entries, dimensionKey, nameKey) {
  const map = {}
  entries.filter(e => !e.archived).forEach(e => {
    const ne = normalizeLegacyEntry(e)
    const key = ne[dimensionKey] || '–'
    if (!map[key]) map[key] = { key, name: ne[nameKey] || key, total: 0, cancelled: 0, commissionLost: 0 }
    map[key].total += 1
    if ((ne.courtage_status || ne.status) === 'cancelled') {
      map[key].cancelled += 1
      map[key].commissionLost += ne.advisor_courtage_amount || ne.commission_amount || 0
    }
  })
  return Object.values(map)
    .filter(d => d.total >= 2)
    .map(d => ({ ...d, rate: roundPct(d.total > 0 ? (d.cancelled / d.total) * 100 : 0) }))
    .sort((a, b) => b.rate - a.rate)
}

// ─── Monatstrend ─────────────────────────────────────────────────────────────
export function calcMonthlyTrend(entries, monthsBack = 12) {
  const normalized = entries.map(normalizeLegacyEntry)
  const active = normalized.filter(e => !e.archived && (e.courtage_status || e.status) !== 'cancelled')
  const now = new Date()
  const months = []
  for (let i = monthsBack - 1; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1)
    const year  = d.getFullYear()
    const month = d.getMonth() + 1
    const label = d.toLocaleDateString('de-CH', { month: 'short', year: '2-digit' })
    const me = active.filter(e => {
      if (!e.entry_date) return false
      const ed = new Date(e.entry_date)
      return ed.getFullYear() === year && (ed.getMonth() + 1) === month
    })
    months.push({
      label, year, month,
      courtage:          roundCHF(me.reduce((s, e) => s + (e.company_courtage_amount || 0), 0)),
      advisorCourtage:   roundCHF(me.reduce((s, e) => s + (e.advisor_courtage_amount || 0), 0)),
      provision:         roundCHF(me.reduce((s, e) => s + (e.company_provision_amount || 0), 0)),
      advisorProvision:  roundCHF(me.reduce((s, e) => s + (e.advisor_provision_amount || 0), 0)),
      count:             me.length,
    })
  }
  return months
}

// ─── Konsistenzprüfung ────────────────────────────────────────────────────────
export function checkEntryConsistency(entry) {
  const e = normalizeLegacyEntry(entry)
  const warnings = []

  // Courtage-Berechnung prüfen
  if ((e.company_courtage_amount || 0) > 0 && (e.advisor_courtage_percentage || 0) > 0) {
    const expected = roundCHF((e.company_courtage_amount * e.advisor_courtage_percentage) / 100)
    if (Math.abs((e.advisor_courtage_amount || 0) - expected) > 0.02) {
      warnings.push(`Beratercourtage inkonsistent: gespeichert ${formatCHF(e.advisor_courtage_amount)} ≠ berechnet ${formatCHF(expected)}`)
    }
  }

  // Provision-Berechnung prüfen
  if ((e.company_provision_amount || 0) > 0 && (e.advisor_provision_percentage || 0) > 0) {
    const expected = roundCHF((e.company_provision_amount * e.advisor_provision_percentage) / 100)
    if (Math.abs((e.advisor_provision_amount || 0) - expected) > 0.02) {
      warnings.push(`Beraterprovision inkonsistent: gespeichert ${formatCHF(e.advisor_provision_amount)} ≠ berechnet ${formatCHF(expected)}`)
    }
  }

  if ((e.advisor_courtage_percentage || 0) > 100) {
    warnings.push(`Beratercourtage-% > 100 (${formatPct(e.advisor_courtage_percentage)})`)
  }
  if ((e.advisor_provision_percentage || 0) > 100) {
    warnings.push(`Beraterprovision-% > 100 (${formatPct(e.advisor_provision_percentage)})`)
  }
  if ((e.courtage_status || e.status) === 'paid' && !(e.courtage_paid_date || e.paid_date)) {
    warnings.push('Courtage "Ausbezahlt" ohne Auszahlungsdatum')
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

export function getStatusDates(newStatus, type = 'courtage') {
  const today = new Date().toISOString().split('T')[0]
  if (type === 'courtage') {
    const updates = { courtage_status: newStatus, status: newStatus }
    if (newStatus === 'invoiced') { updates.courtage_invoiced_date = today; updates.invoiced_date = today }
    if (newStatus === 'received') { updates.courtage_received_date = today; updates.received_date = today }
    if (newStatus === 'earned')   { updates.courtage_earned_date   = today; updates.earned_date   = today }
    if (newStatus === 'paid')     { updates.courtage_paid_date = today; updates.paid_date = today; updates.is_paid = true }
    return updates
  } else {
    const updates = { provision_status: newStatus }
    if (newStatus === 'invoiced') updates.provision_invoiced_date = today
    if (newStatus === 'received') updates.provision_received_date = today
    if (newStatus === 'earned')   updates.provision_earned_date   = today
    if (newStatus === 'paid')     updates.provision_paid_date     = today
    return updates
  }
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

  const premium = parseFloat(data.premium_yearly) || 0
  if (premium <= 0) errors.premium_yearly = 'Muss > 0 sein'

  // Mindestens Courtage ODER Provision muss angegeben sein
  const hasCourtage  = (parseFloat(data.company_courtage_amount) || 0) > 0
  const hasProvision = (parseFloat(data.company_provision_amount) || 0) > 0

  if (!hasCourtage && !hasProvision) {
    errors.company_courtage_amount = 'Mindestens Courtage oder Provision muss angegeben werden'
  }

  if (hasCourtage) {
    const pct = parseFloat(data.advisor_courtage_percentage) || 0
    if (pct <= 0)  errors.advisor_courtage_percentage = 'Muss > 0 sein'
    if (pct > 100) errors.advisor_courtage_percentage = 'Maximal 100%'
    const courtage = parseFloat(data.company_courtage_amount) || 0
    if (courtage > premium && premium > 0) {
      errors.company_courtage_amount = 'Courtage > Jahresprämie – bitte prüfen'
    }
  }

  if (hasProvision) {
    const pct = parseFloat(data.advisor_provision_percentage) || 0
    if (pct <= 0)  errors.advisor_provision_percentage = 'Muss > 0 sein'
    if (pct > 100) errors.advisor_provision_percentage = 'Maximal 100%'
  }

  return errors
}

// ─── Export-Engine ────────────────────────────────────────────────────────────
export function generateCSV(entries) {
  const headers = [
    'Datum', 'Gesellschaft', 'Berater', 'Kunde', 'Sparte', 'Policen-Nr.',
    'Jahresprämie CHF',
    'Gesellschaftscourtage CHF', 'Beratercourtage % ', 'Beratercourtage CHF', 'Courtage Status',
    'Gesellschaftsprovision CHF', 'Beraterprovision %', 'Beraterprovision CHF', 'Provisions Status',
    'Courtage eingereicht', 'Courtage erhalten', 'Courtage ausbezahlt',
    'Provision eingereicht', 'Provision erhalten', 'Provision ausbezahlt',
  ]
  const rows = entries.map(e => {
    const ne = normalizeLegacyEntry(e)
    return [
      ne.entry_date || '',
      ne.insurer || '',
      ne.advisor_name || '',
      ne.customer_name || '',
      ne.product_category || '',
      ne.policy_number || '',
      roundCHF(ne.premium_yearly).toFixed(2),
      roundCHF(ne.company_courtage_amount).toFixed(2),
      roundPct(ne.advisor_courtage_percentage).toFixed(4),
      roundCHF(ne.advisor_courtage_amount).toFixed(2),
      STATUS_META[ne.courtage_status || ne.status]?.label || ne.status || '',
      roundCHF(ne.company_provision_amount).toFixed(2),
      roundPct(ne.advisor_provision_percentage).toFixed(4),
      roundCHF(ne.advisor_provision_amount).toFixed(2),
      STATUS_META[ne.provision_status || 'pending']?.label || '',
      ne.courtage_invoiced_date || ne.invoiced_date || '',
      ne.courtage_received_date || ne.received_date || '',
      ne.courtage_paid_date || ne.paid_date || '',
      ne.provision_invoiced_date || '',
      ne.provision_received_date || '',
      ne.provision_paid_date || '',
    ]
  })
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