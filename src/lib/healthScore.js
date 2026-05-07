/**
 * ENTERPRISE CUSTOMER HEALTH SCORE ENGINE
 * Single source of truth for customer health classification.
 * Produces structured scoring for dashboards, analytics, and AI layers.
 */

export const HEALTH_STATES = {
  VIP:             'vip',
  HEALTHY:         'healthy',
  ATTENTION:       'attention',
  HIGH_RISK:       'high_risk',
  CHURN_RISK:      'churn_risk',
}

export const HEALTH_LABELS = {
  vip:        'VIP',
  healthy:    'Gesund',
  attention:  'Achtung',
  high_risk:  'Hochrisiko',
  churn_risk: 'Abwanderungsgefahr',
}

export const HEALTH_COLORS = {
  vip:        { bg: 'bg-yellow-50',  text: 'text-yellow-700', border: 'border-yellow-300', dot: 'bg-yellow-500',  badge: 'bg-yellow-100 text-yellow-800 border-yellow-300' },
  healthy:    { bg: 'bg-emerald-50', text: 'text-emerald-700',border: 'border-emerald-300',dot: 'bg-emerald-500', badge: 'bg-emerald-100 text-emerald-800 border-emerald-300' },
  attention:  { bg: 'bg-amber-50',   text: 'text-amber-700',  border: 'border-amber-300',  dot: 'bg-amber-500',   badge: 'bg-amber-100 text-amber-800 border-amber-300' },
  high_risk:  { bg: 'bg-orange-50',  text: 'text-orange-700', border: 'border-orange-300', dot: 'bg-orange-500',  badge: 'bg-orange-100 text-orange-800 border-orange-300' },
  churn_risk: { bg: 'bg-red-50',     text: 'text-red-700',    border: 'border-red-300',    dot: 'bg-red-500',     badge: 'bg-red-100 text-red-800 border-red-300' },
}

/**
 * Compute health score for a single customer.
 * @param {object} customer  - Customer entity
 * @param {array}  contracts - All contracts (filtered to this customer elsewhere)
 * @param {array}  documents - All documents
 * @param {array}  tasks     - All tasks
 * @returns {{ score: number, state: string, factors: object }}
 */
export function computeHealthScore(customer, contracts, documents, tasks) {
  let score = 50 // baseline

  const customerContracts = contracts.filter(
    c => c.customer_id === customer.id || c.primary_customer_id === customer.id
  )
  const activeContracts = customerContracts.filter(c => c.status === 'active')
  const customerDocs    = documents.filter(d => d.customer_id === customer.id || d.primary_customer_id === customer.id)
  const customerTasks   = tasks.filter(t => t.customer_id === customer.id)

  // ── Factor 1: Active contracts (max +25)
  const contractCount = activeContracts.length
  if (contractCount === 0) score -= 30
  else if (contractCount === 1) score += 5
  else if (contractCount >= 2) score += 15
  else if (contractCount >= 4) score += 25

  // ── Factor 2: Annual premium (max +15)
  const totalPremium = activeContracts.reduce((s, c) => s + (c.premium_yearly || (c.premium_monthly || 0) * 12), 0)
  if (totalPremium >= 10000) score += 15
  else if (totalPremium >= 5000) score += 10
  else if (totalPremium >= 1000) score += 5

  // ── Factor 3: Renewal risk (max -20)
  const today = new Date()
  const in60  = new Date(today); in60.setDate(today.getDate() + 60)
  const expiringContracts = activeContracts.filter(c => {
    if (!c.end_date) return false
    const end = new Date(c.end_date)
    return end >= today && end <= in60
  })
  if (expiringContracts.length > 0) score -= expiringContracts.length * 10

  // ── Factor 4: Document completeness (+10)
  if (customerDocs.length >= 2) score += 10
  else if (customerDocs.length === 1) score += 5

  // ── Factor 5: Open high-priority tasks (-10)
  const openUrgentTasks = customerTasks.filter(t =>
    (t.status === 'open' || t.status === 'in_progress') && t.priority === 'high'
  )
  if (openUrgentTasks.length > 0) score -= openUrgentTasks.length * 5

  // ── Factor 6: Mandate status
  if (customer.mandate_status === 'valid') score += 5
  else if (customer.mandate_status === 'expired' || customer.mandate_status === 'invalid') score -= 10

  // ── Factor 7: Portal activity (engagement signal)
  if (customer.portal_last_login) {
    const daysSinceLogin = Math.floor((new Date() - new Date(customer.portal_last_login)) / 86400000)
    if (daysSinceLogin <= 30) score += 5
    else if (daysSinceLogin > 180) score -= 5
  }

  // Clamp to 0-100
  score = Math.max(0, Math.min(100, score))

  // ── Classify state
  let state
  // VIP override: high premium or special lifecycle
  if (totalPremium >= 10000 && score >= 60) state = HEALTH_STATES.VIP
  else if (score >= 75) state = HEALTH_STATES.HEALTHY
  else if (score >= 55) state = HEALTH_STATES.ATTENTION
  else if (score >= 35) state = HEALTH_STATES.HIGH_RISK
  else state = HEALTH_STATES.CHURN_RISK

  return {
    score,
    state,
    factors: {
      contractCount,
      totalPremium,
      expiringCount: expiringContracts.length,
      docCount: customerDocs.length,
      openUrgentTasks: openUrgentTasks.length,
    },
  }
}

/**
 * Build a health map { customerId → { score, state, factors } } for all customers.
 */
export function buildHealthMap(customers, contracts, documents, tasks) {
  const map = {}
  customers.forEach(c => {
    map[c.id] = computeHealthScore(c, contracts, documents, tasks)
  })
  return map
}