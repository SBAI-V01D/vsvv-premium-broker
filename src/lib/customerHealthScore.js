import { HEALTH_STATES } from '@/lib/healthScore'

/**
 * Berechnet Health Score für einen Kunden basierend auf Verträgen, Dokumenten, Tasks.
 * Returns: { state, score, factors }
 */
export function calculateCustomerHealthScore(customer, contracts, documents, tasks) {
  const activeContracts = contracts.filter(c => c.status === 'active')
  const contractCount = activeContracts.length
  const totalPremium = activeContracts.reduce((s, c) => s + (c.premium_yearly || (c.premium_monthly || 0) * 12), 0)

  // Renewal Risk (60 Tage)
  const today = new Date()
  const in60Time = today.getTime() + (60 * 24 * 60 * 60 * 1000)
  const expiringCount = activeContracts.filter(c => {
    if (!c.end_date) return false
    const endTime = new Date(c.end_date).getTime()
    return endTime >= today.getTime() && endTime <= in60Time && !c.end_date.startsWith('9999')
  }).length

  const docCount = documents.length
  const openUrgentTasks = tasks.filter(t =>
    (t.status === 'open' || t.status === 'in_progress') && t.priority === 'high'
  ).length

  let score = 50

  // Factor 1: Contracts
  if (contractCount === 0) score -= 30
  else if (contractCount === 1) score += 5
  else if (contractCount >= 2) score += 15
  else if (contractCount >= 4) score += 25

  // Factor 2: Premium
  if (totalPremium >= 10000) score += 15
  else if (totalPremium >= 5000) score += 10
  else if (totalPremium >= 1000) score += 5

  // Factor 3: Renewal Risk
  if (expiringCount > 0) score -= expiringCount * 10

  // Factor 4: Documents
  if (docCount >= 2) score += 10
  else if (docCount === 1) score += 5

  // Factor 5: Tasks
  if (openUrgentTasks > 0) score -= openUrgentTasks * 5

  // Factor 6: Mandate
  if (customer.mandate_status === 'valid') score += 5
  else if (customer.mandate_status === 'expired' || customer.mandate_status === 'invalid') score -= 10

  // Clamp
  score = Math.max(0, Math.min(100, score))

  // Classify
  let state
  if (totalPremium >= 10000 && score >= 60) state = HEALTH_STATES.VIP
  else if (score >= 75) state = HEALTH_STATES.HEALTHY
  else if (score >= 55) state = HEALTH_STATES.ATTENTION
  else if (score >= 35) state = HEALTH_STATES.HIGH_RISK
  else state = HEALTH_STATES.CHURN_RISK

  return {
    state,
    score,
    factors: { contractCount, totalPremium, expiringCount, docCount, openUrgentTasks },
  }
}