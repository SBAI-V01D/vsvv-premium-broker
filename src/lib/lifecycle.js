/**
 * Enterprise Customer Lifecycle Engine
 * Single source of truth for lifecycle state derivation.
 * Reads from existing DB fields — does NOT modify schemas.
 */

export const LIFECYCLE_STATES = {
  LEAD:              'lead',
  QUALIFIED_LEAD:    'qualified_lead',
  CONSULTATION:      'consultation',
  OFFER_SENT:        'offer_sent',
  CONTRACT_PENDING:  'contract_pending',
  ACTIVE_CUSTOMER:   'active_customer',
  VIP_CUSTOMER:      'vip_customer',
  RENEWAL:           'renewal',
  INACTIVE:          'inactive',
  ARCHIVED:          'archived',
}

export const LIFECYCLE_LABELS = {
  lead:             'Lead',
  qualified_lead:   'Qualifizierter Lead',
  consultation:     'Beratung',
  offer_sent:       'Angebot gesendet',
  contract_pending: 'Vertrag pendent',
  active_customer:  'Aktiver Kunde',
  vip_customer:     'VIP Kunde',
  renewal:          'Verlängerung fällig',
  inactive:         'Inaktiv',
  archived:         'Archiviert',
}

export const LIFECYCLE_COLORS = {
  lead:             { bg: 'bg-slate-100',  text: 'text-slate-700',  border: 'border-slate-300',  dot: 'bg-slate-400' },
  qualified_lead:   { bg: 'bg-blue-100',   text: 'text-blue-700',   border: 'border-blue-300',   dot: 'bg-blue-500' },
  consultation:     { bg: 'bg-violet-100', text: 'text-violet-700', border: 'border-violet-300', dot: 'bg-violet-500' },
  offer_sent:       { bg: 'bg-amber-100',  text: 'text-amber-700',  border: 'border-amber-300',  dot: 'bg-amber-500' },
  contract_pending: { bg: 'bg-orange-100', text: 'text-orange-700', border: 'border-orange-300', dot: 'bg-orange-500' },
  active_customer:  { bg: 'bg-emerald-100',text: 'text-emerald-700',border: 'border-emerald-300',dot: 'bg-emerald-500' },
  vip_customer:     { bg: 'bg-yellow-100', text: 'text-yellow-800', border: 'border-yellow-300', dot: 'bg-yellow-500' },
  renewal:          { bg: 'bg-red-100',    text: 'text-red-700',    border: 'border-red-300',    dot: 'bg-red-500' },
  inactive:         { bg: 'bg-gray-100',   text: 'text-gray-500',   border: 'border-gray-200',   dot: 'bg-gray-400' },
  archived:         { bg: 'bg-gray-50',    text: 'text-gray-400',   border: 'border-gray-100',   dot: 'bg-gray-300' },
}

/**
 * Derives the lifecycle state for a customer from existing data.
 * Priority order: contracts → lead status → customer status
 *
 * @param {Object} customer  - Customer entity
 * @param {Array}  contracts - All contracts (filtered to this customer externally for perf)
 * @param {Object} lead      - Lead entity (if exists, matched by email or customer_id)
 * @returns {string} lifecycle state key
 */
export function deriveLifecycleState(customer, customerContracts = [], lead = null) {
  const activeContracts = customerContracts.filter(c => c.status === 'active')
  const pendingContracts = customerContracts.filter(c => c.status === 'draft' || c.status === 'pending_change')

  // Check for renewal due
  if (activeContracts.length > 0) {
    const today = new Date()
    const in60 = new Date(today); in60.setDate(today.getDate() + 60)
    const hasRenewalDue = activeContracts.some(c => {
      if (!c.end_date) return false
      const end = new Date(c.end_date)
      return end >= today && end <= in60
    })
    if (hasRenewalDue) return LIFECYCLE_STATES.RENEWAL

    // VIP = total yearly premium > 10000
    const totalYearly = activeContracts.reduce((s, c) => s + (c.premium_yearly || (c.premium_monthly || 0) * 12), 0)
    if (totalYearly >= 10000) return LIFECYCLE_STATES.VIP_CUSTOMER

    return LIFECYCLE_STATES.ACTIVE_CUSTOMER
  }

  if (pendingContracts.length > 0) return LIFECYCLE_STATES.CONTRACT_PENDING

  if (customer.status === 'inactive') return LIFECYCLE_STATES.INACTIVE

  // Derive from lead status
  if (lead) {
    if (lead.offer_status === 'sent' || lead.offer_status === 'accepted') return LIFECYCLE_STATES.OFFER_SENT
    if (lead.status === 'qualified') return LIFECYCLE_STATES.QUALIFIED_LEAD
    if (lead.status === 'contacted') return LIFECYCLE_STATES.CONSULTATION
    if (lead.status === 'new') return LIFECYCLE_STATES.LEAD
    if (lead.status === 'converted') return LIFECYCLE_STATES.ACTIVE_CUSTOMER
  }

  return LIFECYCLE_STATES.LEAD
}

/**
 * Builds a full lifecycle map: customer.id → lifecycle state
 * Optimized for dashboard-level computation (single pass).
 */
export function buildLifecycleMap(customers, contracts, leads = []) {
  // Index contracts by customer_id for O(1) lookup
  const contractsByCustomer = {}
  contracts.forEach(c => {
    if (c.customer_id) {
      if (!contractsByCustomer[c.customer_id]) contractsByCustomer[c.customer_id] = []
      contractsByCustomer[c.customer_id].push(c)
    }
  })

  // Index leads by email
  const leadByEmail = {}
  leads.forEach(l => { if (l.email) leadByEmail[l.email.toLowerCase()] = l })

  const map = {}
  customers.forEach(c => {
    const customerContracts = contractsByCustomer[c.id] || []
    const lead = leadByEmail[c.email?.toLowerCase()] || null
    map[c.id] = deriveLifecycleState(c, customerContracts, lead)
  })
  return map
}

/**
 * Returns only pipeline-stage leads (not active customers).
 * The strict separation rule: no active-contract customers in lead funnel.
 */
export function filterTruePipelineLeads(leads, contracts) {
  const activeContractCustomerIds = new Set(
    contracts
      .filter(c => c.status === 'active')
      .map(c => c.customer_id)
      .filter(Boolean)
  )
  return leads.filter(l => {
    if (l.status === 'converted' && l.customer_id && activeContractCustomerIds.has(l.customer_id)) return false
    if (l.status === 'lost') return false  // lost = separate view
    return true
  })
}

/** Coverage gap analysis for a single customer */
export const REQUIRED_COVERAGE = ['kvg', 'haftpflicht_privat']
export const OPTIONAL_COVERAGE = ['vvg_zusatz', 'hausrat', 'motorfahrzeug', 'rechtsschutz_privat', 'unfall_privat', 'leben_3a', 'bvg']

export function analyzeCoverage(customer, customerContracts) {
  const active = customerContracts.filter(c => c.status === 'active')
  const covered = new Set(active.map(c => c.sparte || c.insurance_type).filter(Boolean))
  const criticalGaps = REQUIRED_COVERAGE.filter(s => !covered.has(s))
  const upsellGaps = OPTIONAL_COVERAGE.filter(s => !covered.has(s))
  const totalPremium = active.reduce((s, c) => s + (c.premium_yearly || (c.premium_monthly || 0) * 12), 0)
  const score = Math.round(
    ((REQUIRED_COVERAGE.length - criticalGaps.length) / REQUIRED_COVERAGE.length) * 60 +
    ((OPTIONAL_COVERAGE.length - upsellGaps.length) / OPTIONAL_COVERAGE.length) * 40
  )
  return { covered, criticalGaps, upsellGaps, totalPremium, score, contractCount: active.length }
}