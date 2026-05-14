/**
 * ZENTRALE FINANZ-ENGINE – Courtagen & Provisionen
 * =================================================
 * FACHLICHE TRENNUNG:
 *   COURTAGE  = Vergütung Gesellschaft → Firma → Berater
 *   PROVISION = Einmalige Vergütung Gesellschaft → Firma → Berater
 *
 * STORNORESERVE-LOGIK:
 *   Brutto Beratercourtage  - Stornoreserve (%)  = Netto Auszahlung Courtage
 *   Brutto Beraterprovision - Stornoreserve (%)  = Netto Auszahlung Provision
 *
 * FORMELN:
 *   Beratercourtage (Brutto) = Gesellschaftscourtage  × Beratercourtage-% / 100
 *   Courtage Stornoreserve   = Beratercourtage (Brutto) × Storno-% / 100
 *   Courtage Netto Payout    = Beratercourtage (Brutto) - Courtage Stornoreserve
 *
 *   Beraterprovision (Brutto) = Gesellschaftsprovision × Beraterprovision-% / 100
 *   Provision Stornoreserve   = Beraterprovision (Brutto) × Storno-% / 100
 *   Provision Netto Payout    = Beraterprovision (Brutto) - Provision Stornoreserve
 *
 * DEFAULT STORNO %: 10
 * 
 * 🔴 CRITICAL 2026-05-14: Financial Period Logic
 * ALL aggregations use financial period dates:
 * - courtage_received_date (primary)
 * - courtage_invoiced_date (fallback)
 * - entry_date (fallback for pending)
 * NEVER use created_at!
 */

export const DEFAULT_STORNO_PCT = 10

// ─── Rundungslogik ────────────────────────────────────────────────────────────
export function roundCHF(value) {
  return Math.round((parseFloat(value) || 0) * 100) / 100
}
export function roundPct(value) {
  return Math.round((parseFloat(value) || 0) * 10000) / 10000
}

// ─── Migration: Legacy → neue Felder ─────────────────────────────────────────
export function normalizeLegacyEntry(entry) {
  const e = { ...entry }

  // Courtage-Migration von Legacy
  if (!e.company_courtage_amount && e.received_amount) e.company_courtage_amount = e.received_amount
  if (!e.advisor_courtage_percentage && e.commission_percentage) e.advisor_courtage_percentage = e.commission_percentage
  if (!e.advisor_courtage_amount && e.commission_amount) e.advisor_courtage_amount = e.commission_amount
  if (!e.courtage_status && e.status) e.courtage_status = e.status
  if (!e.courtage_received_date && e.received_date) e.courtage_received_date = e.received_date
  if (!e.courtage_invoiced_date && e.invoiced_date) e.courtage_invoiced_date = e.invoiced_date
  if (!e.courtage_earned_date && e.earned_date) e.courtage_earned_date = e.earned_date
  if (!e.courtage_paid_date && e.paid_date) e.courtage_paid_date = e.paid_date

  // Stornoreserve-Migration: wenn kein Wert gesetzt → Standard 10%
  if (e.courtage_storno_percentage === undefined || e.courtage_storno_percentage === null) {
    e.courtage_storno_percentage = DEFAULT_STORNO_PCT
  }
  if (e.provision_storno_percentage === undefined || e.provision_storno_percentage === null) {
    e.provision_storno_percentage = DEFAULT_STORNO_PCT
  }

  // Storno-Beträge berechnen falls nicht gesetzt
  const brutto_c = roundCHF(e.advisor_courtage_amount)
  const storno_c_pct = roundPct(e.courtage_storno_percentage)
  if (!e.courtage_storno_amount && brutto_c > 0) {
    e.courtage_storno_amount = roundCHF((brutto_c * storno_c_pct) / 100)
  }
  if (!e.courtage_payout_amount && brutto_c > 0) {
    e.courtage_payout_amount = roundCHF(brutto_c - (e.courtage_storno_amount || 0))
  }

  const brutto_p = roundCHF(e.advisor_provision_amount)
  const storno_p_pct = roundPct(e.provision_storno_percentage)
  if (!e.provision_storno_amount && brutto_p > 0) {
    e.provision_storno_amount = roundCHF((brutto_p * storno_p_pct) / 100)
  }
  if (!e.provision_payout_amount && brutto_p > 0) {
    e.provision_payout_amount = roundCHF(brutto_p - (e.provision_storno_amount || 0))
  }

  return e
}

// ─── Kernberechnungen ─────────────────────────────────────────────────────────
/**
 * Berechnet alle Courtage-Felder inkl. Stornoreserve.
 * Brutto → Reserve → Netto
 */
export function calcCourtageFields(data) {
  const companyCourtage      = roundCHF(data.company_courtage_amount)
  const advisorCourtagePct   = roundPct(data.advisor_courtage_percentage)
  const advisorCourtage      = roundCHF((companyCourtage * advisorCourtagePct) / 100)       // BRUTTO

  const stornoPct = roundPct(
    data.courtage_storno_percentage !== undefined && data.courtage_storno_percentage !== null
      ? data.courtage_storno_percentage
      : DEFAULT_STORNO_PCT
  )
  const stornoAmt  = roundCHF((advisorCourtage * stornoPct) / 100)                          // RESERVE
  const payoutAmt  = roundCHF(advisorCourtage - stornoAmt)                                   // NETTO

  return {
    ...data,
    company_courtage_amount:      companyCourtage,
    advisor_courtage_percentage:  advisorCourtagePct,
    advisor_courtage_amount:      advisorCourtage,      // Brutto
    courtage_storno_percentage:   stornoPct,
    courtage_storno_amount:       stornoAmt,            // Einbehalt
    courtage_payout_amount:       payoutAmt,            // Netto auszahlbar
    // Legacy-Sync
    received_amount:       companyCourtage,
    commission_percentage: advisorCourtagePct,
    commission_amount:     advisorCourtage,
  }
}

/**
 * Berechnet alle Provisions-Felder inkl. Stornoreserve.
 */
export function calcProvisionFields(data) {
  const companyProvision      = roundCHF(data.company_provision_amount)
  const advisorProvisionPct   = roundPct(data.advisor_provision_percentage)
  const advisorProvision      = roundCHF((companyProvision * advisorProvisionPct) / 100)    // BRUTTO

  const stornoPct = roundPct(
    data.provision_storno_percentage !== undefined && data.provision_storno_percentage !== null
      ? data.provision_storno_percentage
      : DEFAULT_STORNO_PCT
  )
  const stornoAmt  = roundCHF((advisorProvision * stornoPct) / 100)                         // RESERVE
  const payoutAmt  = roundCHF(advisorProvision - stornoAmt)                                  // NETTO

  return {
    ...data,
    company_provision_amount:      companyProvision,
    advisor_provision_percentage:  advisorProvisionPct,
    advisor_provision_amount:      advisorProvision,    // Brutto
    provision_storno_percentage:   stornoPct,
    provision_storno_amount:       stornoAmt,           // Einbehalt
    provision_payout_amount:       payoutAmt,           // Netto auszahlbar
  }
}

/**
 * Berechnet ALLE Felder (Courtage + Provision + Stornoreserven).
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
 * 🔴 CRITICAL: Get financial period date (NEVER created_at!)
 * Priority: courtage_received_date > courtage_invoiced_date > entry_date
 */
export function getFinancialPeriodDate(entry) {
  const e = normalizeLegacyEntry(entry)
  return e.courtage_received_date || e.courtage_invoiced_date || e.entry_date
}

/**
 * Calculate KPIs for ALL entries (global aggregate)
 */
export function calcKPIs(entries) {
  return calcKPIsForPeriod(entries, null, null)
}

/**
 * 🔴 CRITICAL: Calculate KPIs for specific financial period
 * @param entries - Commission entries
 * @param periodStart - Date (inclusive) or null for all
 * @param periodEnd - Date (inclusive) or null for all
 * 
 * Uses financial period dates ONLY, never created_at
 */
export function calcKPIsForPeriod(entries, periodStart = null, periodEnd = null) {
  const normalized = entries.map(normalizeLegacyEntry)
  
  // Filter by financial period (if specified)
  let filtered = normalized.filter(e => !e.archived)
  
  if (periodStart && periodEnd) {
    filtered = filtered.filter(e => {
      const financialDate = getFinancialPeriodDate(e)
      if (!financialDate) return false
      const d = new Date(financialDate)
      return d >= periodStart && d <= periodEnd
    })
  }
  
  const active = filtered
  
  // ENTERPRISE: Consistency check log (non-blocking)
  const inconsistencies = active
    .map((e, i) => ({ index: i, warnings: checkEntryConsistency(e) }))
    .filter(x => x.warnings.length > 0)
  if (inconsistencies.length > 0) {
    console.warn(`[calcKPIs] ⚠️ ${inconsistencies.length} entries with consistency warnings`)
  }
  
  const nonCancCourtage  = active.filter(e => {
    if ((e.courtage_status || e.status) === 'cancelled') return false
    return true
  })
  const nonCancProvision = active.filter(e => {
    if ((e.provision_status || 'pending') === 'cancelled') return false
    return true
  })
  const cancelled        = active.filter(e => (e.courtage_status || e.status) === 'cancelled')

  const overdueCourtage = active.filter(e => {
    if ((e.courtage_status || e.status) !== 'invoiced') return false
    const date = e.courtage_invoiced_date || e.invoiced_date
    if (!date) return false
    return (Date.now() - new Date(date).getTime()) / 86400000 > 60
  })

  // ── COURTAGE KPIs (Brutto / Reserve / Netto) ──────────────────────────────
  const totalCourtageReceived    = roundCHF(active.reduce((s, e) => s + (e.company_courtage_amount || 0), 0))
  const totalAdvisorCourtage     = roundCHF(nonCancCourtage.reduce((s, e) => s + (e.advisor_courtage_amount || 0), 0))  // Brutto
  const totalCourtageReserve     = roundCHF(nonCancCourtage.reduce((s, e) => s + (e.courtage_storno_amount || 0), 0))   // Reserve
  const totalCourtagePayout      = roundCHF(nonCancCourtage.reduce((s, e) => s + (e.courtage_payout_amount || 0), 0))  // Netto
  const totalCourtagePaid        = roundCHF(active.filter(e => (e.courtage_status || e.status) === 'paid')
    .reduce((s, e) => s + (e.courtage_payout_amount || e.advisor_courtage_amount || 0), 0))
  const totalCourtagePending     = roundCHF(active.filter(e => (e.courtage_status || e.status) === 'pending')
    .reduce((s, e) => s + (e.company_courtage_amount || 0), 0))
  const openCourtage             = roundCHF(totalCourtagePayout - totalCourtagePaid)
  const totalOverdueCourtage     = roundCHF(overdueCourtage.reduce((s, e) => s + (e.advisor_courtage_amount || 0), 0))

  // ── PROVISION KPIs (Brutto / Reserve / Netto) ─────────────────────────────
  const totalProvisionReceived   = roundCHF(active.reduce((s, e) => s + (e.company_provision_amount || 0), 0))
  const totalAdvisorProvision    = roundCHF(nonCancProvision.reduce((s, e) => s + (e.advisor_provision_amount || 0), 0))  // Brutto
  const totalProvisionReserve    = roundCHF(nonCancProvision.reduce((s, e) => s + (e.provision_storno_amount || 0), 0))   // Reserve
  const totalProvisionPayout     = roundCHF(nonCancProvision.reduce((s, e) => s + (e.provision_payout_amount || 0), 0))  // Netto
  const totalProvisionPaid       = roundCHF(active.filter(e => (e.provision_status || 'pending') === 'paid')
    .reduce((s, e) => s + (e.provision_payout_amount || e.advisor_provision_amount || 0), 0))
  const openProvision            = roundCHF(totalProvisionPayout - totalProvisionPaid)

  // ── Gesamt-Reserve ────────────────────────────────────────────────────────
  const totalReserveOpen = roundCHF(totalCourtageReserve + totalProvisionReserve)

  // ── Storno / Quoten ───────────────────────────────────────────────────────
  const stornoRate = (nonCancCourtage.length + cancelled.length) > 0
    ? roundPct((cancelled.length / (nonCancCourtage.length + cancelled.length)) * 100) : 0
  const courtagePayout = totalCourtagePayout > 0
    ? roundPct((totalCourtagePaid / totalCourtagePayout) * 100) : 0

  return {
    count: active.length,
    cancelledCount: cancelled.length,
    nonCancelledCount: nonCancCourtage.length,
    overdueCount: overdueCourtage.length,
    pendingCount: active.filter(e => (e.courtage_status || e.status) === 'pending').length,

    // COURTAGE
    totalCourtageReceived,
    totalAdvisorCourtage,     // Brutto Beratercourtage
    totalCourtageReserve,     // Stornoreserve Courtage
    totalCourtagePayout,      // Netto Courtage
    totalCourtagePaid,
    totalCourtagePending,
    openCourtage,
    totalOverdueCourtage,
    courtagePayout,

    // PROVISION
    totalProvisionReceived,
    totalAdvisorProvision,    // Brutto Beraterprovision
    totalProvisionReserve,    // Stornoreserve Provision
    totalProvisionPayout,     // Netto Provision
    totalProvisionPaid,
    openProvision,

    // GESAMT-RESERVE
    totalReserveOpen,

    // Legacy
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
    if (!map[key]) map[key] = { key, name: ne[nameKey] || key, total: 0, cancelled: 0, commissionLost: 0, reserveTotal: 0 }
    map[key].total += 1
    map[key].reserveTotal += (ne.courtage_storno_amount || 0) + (ne.provision_storno_amount || 0)
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
    const periodStart = d
    const periodEnd = new Date(d.getFullYear(), d.getMonth() + 1, 0)
    
    const me = active.filter(e => {
      const courtageDate = e.courtage_received_date || e.courtage_invoiced_date || e.entry_date
      if (courtageDate) {
        const cd = new Date(courtageDate)
        if (cd >= periodStart && cd <= periodEnd) return true
      }
      
      const provisionDate = e.provision_received_date || e.provision_invoiced_date || e.entry_date
      if (provisionDate) {
        const pd = new Date(provisionDate)
        if (pd >= periodStart && pd <= periodEnd) return true
      }
      
      return false
    })
    months.push({
      label, year, month,
      courtage:         roundCHF(me.reduce((s, e) => s + (e.company_courtage_amount || 0), 0)),
      advisorCourtage:  roundCHF(me.reduce((s, e) => s + (e.advisor_courtage_amount || 0), 0)),   // Brutto
      courtageNetto:    roundCHF(me.reduce((s, e) => s + (e.courtage_payout_amount || 0), 0)),    // Netto
      courtageReserve:  roundCHF(me.reduce((s, e) => s + (e.courtage_storno_amount || 0), 0)),
      provision:        roundCHF(me.reduce((s, e) => s + (e.company_provision_amount || 0), 0)),
      advisorProvision: roundCHF(me.reduce((s, e) => s + (e.advisor_provision_amount || 0), 0)),  // Brutto
      provisionNetto:   roundCHF(me.reduce((s, e) => s + (e.provision_payout_amount || 0), 0)),   // Netto
      provisionReserve: roundCHF(me.reduce((s, e) => s + (e.provision_storno_amount || 0), 0)),
      count:            me.length,
    })
  }
  return months
}

// ─── Konsistenzprüfung ────────────────────────────────────────────────────────
export function checkEntryConsistency(entry) {
  const e = normalizeLegacyEntry(entry)
  const warnings = []

  if ((e.company_courtage_amount || 0) > 0 && (e.advisor_courtage_percentage || 0) > 0) {
    const expectedBrutto = roundCHF((e.company_courtage_amount * e.advisor_courtage_percentage) / 100)
    if (Math.abs((e.advisor_courtage_amount || 0) - expectedBrutto) > 0.02) {
      warnings.push(`Beratercourtage (Brutto) inkonsistent: ${formatCHF(e.advisor_courtage_amount)} ≠ ${formatCHF(expectedBrutto)}`)
    }
    const expectedPayout = roundCHF(expectedBrutto - ((expectedBrutto * (e.courtage_storno_percentage || DEFAULT_STORNO_PCT)) / 100))
    if (Math.abs((e.courtage_payout_amount || 0) - expectedPayout) > 0.02) {
      warnings.push(`Courtage-Netto inkonsistent: ${formatCHF(e.courtage_payout_amount)} ≠ ${formatCHF(expectedPayout)}`)
    }
  }

  if ((e.company_provision_amount || 0) > 0 && (e.advisor_provision_percentage || 0) > 0) {
    const expectedBrutto = roundCHF((e.company_provision_amount * e.advisor_provision_percentage) / 100)
    if (Math.abs((e.advisor_provision_amount || 0) - expectedBrutto) > 0.02) {
      warnings.push(`Beraterprovision (Brutto) inkonsistent: ${formatCHF(e.advisor_provision_amount)} ≠ ${formatCHF(expectedBrutto)}`)
    }
  }

  if ((e.advisor_courtage_percentage || 0) > 100) warnings.push(`Beratercourtage-% > 100 (${formatPct(e.advisor_courtage_percentage)})`)
  if ((e.advisor_provision_percentage || 0) > 100) warnings.push(`Beraterprovision-% > 100 (${formatPct(e.advisor_provision_percentage)})`)
  if ((e.courtage_storno_percentage || 0) > 50) warnings.push(`Stornoabzug Courtage > 50% – bitte prüfen`)
  if ((e.provision_storno_percentage || 0) > 50) warnings.push(`Stornoabzug Provision > 50% – bitte prüfen`)
  if ((e.courtage_payout_amount || 0) > (e.advisor_courtage_amount || 0)) warnings.push(`Courtage-Netto > Brutto – Fehler`)
  if ((e.provision_payout_amount || 0) > (e.advisor_provision_amount || 0)) warnings.push(`Provisions-Netto > Brutto – Fehler`)
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

  const hasCourtage  = (parseFloat(data.company_courtage_amount) || 0) > 0
  const hasProvision = (parseFloat(data.company_provision_amount) || 0) > 0
  if (!hasCourtage && !hasProvision) {
    errors.company_courtage_amount = 'Mindestens Courtage oder Provision muss angegeben werden'
  }

  if (hasCourtage) {
    const pct = parseFloat(data.advisor_courtage_percentage) || 0
    if (pct <= 0)  errors.advisor_courtage_percentage = 'Muss > 0 sein'
    if (pct > 100) errors.advisor_courtage_percentage = 'Maximal 100%'
    const sp = parseFloat(data.courtage_storno_percentage)
    if (!isNaN(sp) && (sp < 0 || sp > 100)) errors.courtage_storno_percentage = '0–100%'
  }

  if (hasProvision) {
    const pct = parseFloat(data.advisor_provision_percentage) || 0
    if (pct <= 0)  errors.advisor_provision_percentage = 'Muss > 0 sein'
    if (pct > 100) errors.advisor_provision_percentage = 'Maximal 100%'
    const sp = parseFloat(data.provision_storno_percentage)
    if (!isNaN(sp) && (sp < 0 || sp > 100)) errors.provision_storno_percentage = '0–100%'
  }

  return errors
}

// ─── Export-Engine ────────────────────────────────────────────────────────────
export function generateCSV(entries) {
  const headers = [
    'Datum', 'Gesellschaft', 'Berater', 'Kunde', 'Sparte', 'Policen-Nr.', 'Jahresprämie CHF',
    // COURTAGE
    'Ges.courtage CHF', 'Beratercourtage % (Brutto)', 'Beratercourtage CHF (Brutto)',
    'Storno-% Courtage', 'Stornoreserve CHF Courtage', 'Netto Courtage CHF',
    'Courtage Status', 'Courtage eingereicht', 'Courtage erhalten', 'Courtage ausbezahlt',
    // PROVISION
    'Ges.provision CHF', 'Beraterprovision % (Brutto)', 'Beraterprovision CHF (Brutto)',
    'Storno-% Provision', 'Stornoreserve CHF Provision', 'Netto Provision CHF',
    'Provision Status', 'Provision eingereicht', 'Provision erhalten', 'Provision ausbezahlt',
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
      // COURTAGE
      roundCHF(ne.company_courtage_amount).toFixed(2),
      roundPct(ne.advisor_courtage_percentage).toFixed(4),
      roundCHF(ne.advisor_courtage_amount).toFixed(2),
      roundPct(ne.courtage_storno_percentage).toFixed(2),
      roundCHF(ne.courtage_storno_amount).toFixed(2),
      roundCHF(ne.courtage_payout_amount).toFixed(2),
      STATUS_META[ne.courtage_status || ne.status]?.label || ne.status || '',
      ne.courtage_invoiced_date || ne.invoiced_date || '',
      ne.courtage_received_date || ne.received_date || '',
      ne.courtage_paid_date || ne.paid_date || '',
      // PROVISION
      roundCHF(ne.company_provision_amount).toFixed(2),
      roundPct(ne.advisor_provision_percentage).toFixed(4),
      roundCHF(ne.advisor_provision_amount).toFixed(2),
      roundPct(ne.provision_storno_percentage).toFixed(2),
      roundCHF(ne.provision_storno_amount).toFixed(2),
      roundCHF(ne.provision_payout_amount).toFixed(2),
      STATUS_META[ne.provision_status || 'pending']?.label || '',
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