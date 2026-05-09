/**
 * Commission Data Synchronization
 * Ensures commission data from applications stays synced with CommissionEntry records
 * and dashboard calculations remain accurate.
 */

/**
 * Calculates expected commission from an application
 * @param {Object} application - Application entity
 * @returns {number} Calculated commission amount
 */
export function calculateApplicationCommission(application) {
  if (!application) return 0
  
  const yearlyPremium = application.estimated_premium_yearly || 
                       (application.estimated_premium_monthly ? application.estimated_premium_monthly * 12 : 0)
  const commissionRate = application.commission_rate || 0
  
  return Math.round((yearlyPremium * (commissionRate / 100)) * 100) / 100
}

/**
 * Validates commission entry has all required links
 * @param {Object} entry - CommissionEntry record
 * @returns {Object} Validation result with status and issues
 */
export function validateCommissionEntry(entry) {
  const issues = []
  
  if (!entry.policy_id && !entry.policy_number) {
    issues.push('Missing policy reference')
  }
  if (!entry.advisor_id) {
    issues.push('Missing advisor assignment')
  }
  if (!entry.organization_id) {
    issues.push('Missing organization reference')
  }
  if (!entry.customer_id) {
    issues.push('Missing customer reference')
  }
  if (!entry.commission_amount || entry.commission_amount === 0) {
    issues.push('Invalid commission amount')
  }
  
  return {
    isValid: issues.length === 0,
    issues,
  }
}

/**
 * Gets commission entries for a specific application
 * @param {Object} application - Application entity
 * @param {Array} commissionEntries - All commission entries
 * @returns {Array} Related commission entries
 */
export function getApplicationCommissions(application, commissionEntries) {
  if (!application || !commissionEntries) return []
  
  return commissionEntries.filter(ce => 
    ce.policy_id === application.linked_contract_id ||
    (application.policy_number && ce.policy_number === application.policy_number) ||
    (application.customer_id && ce.customer_id === application.customer_id &&
     application.insurer && ce.insurer === application.insurer)
  )
}

/**
 * Calculates total commission for filtered dataset
 * Handles both commission_amount (new) and gross_commission (legacy) fields
 * @param {Array} commissionEntries - Commission entries
 * @returns {number} Total commission
 */
export function calculateTotalCommission(commissionEntries) {
  if (!Array.isArray(commissionEntries)) return 0
  
  return commissionEntries.reduce((sum, entry) => {
    if (entry.status === 'cancelled' || entry.is_storno) return sum
    const amount = entry.commission_amount || entry.gross_commission || 0
    return sum + Math.max(0, amount)
  }, 0)
}

/**
 * Calculates pending (not yet received) commissions
 * @param {Array} commissionEntries - Commission entries
 * @returns {number} Total pending commission
 */
export function calculatePendingCommission(commissionEntries) {
  if (!Array.isArray(commissionEntries)) return 0
  
  return commissionEntries
    .filter(ce => !['paid', 'received', 'earned'].includes(ce.status) && !ce.is_storno)
    .reduce((sum, ce) => sum + (ce.commission_amount || ce.gross_commission || 0), 0)
}

/**
 * Calculates received (paid out) commissions
 * @param {Array} commissionEntries - Commission entries
 * @returns {number} Total received commission
 */
export function calculateReceivedCommission(commissionEntries) {
  if (!Array.isArray(commissionEntries)) return 0
  
  return commissionEntries
    .filter(ce => ['paid', 'received', 'earned'].includes(ce.status) && !ce.is_storno)
    .reduce((sum, ce) => sum + (ce.commission_amount || ce.gross_commission || 0), 0)
}

/**
 * Detects potential duplicate commissions for the same policy
 * @param {Array} commissionEntries - All commission entries
 * @returns {Array} Array of duplicate groups
 */
export function detectDuplicateCommissions(commissionEntries) {
  const policyMap = {}
  const duplicates = []
  
  commissionEntries.forEach(ce => {
    if (!ce.policy_id) return
    
    if (!policyMap[ce.policy_id]) {
      policyMap[ce.policy_id] = []
    }
    policyMap[ce.policy_id].push(ce)
  })
  
  Object.values(policyMap).forEach(group => {
    if (group.length > 1 && !group.some(g => g.is_storno)) {
      duplicates.push({
        policy_id: group[0].policy_id,
        count: group.length,
        entries: group,
        totalAmount: group.reduce((s, ce) => s + (ce.commission_amount || 0), 0),
      })
    }
  })
  
  return duplicates
}

/**
 * Synchronizes application commission estimate with commissions
 * Detects if CommissionEntry records exist and are up-to-date
 * @param {Object} application - Application entity
 * @param {Array} allCommissions - All commission entries
 * @returns {Object} Sync status
 */
export function syncApplicationCommission(application, allCommissions) {
  if (!application) return { synced: false, status: 'no_application' }
  
  const relatedCommissions = getApplicationCommissions(application, allCommissions)
  const appCommissionAmount = calculateApplicationCommission(application)
  
  // If no commissions yet, that's OK (application might be draft)
  if (relatedCommissions.length === 0) {
    return {
      synced: application.status === 'draft' || application.status === 'submitted',
      status: 'no_commissions',
      expected: appCommissionAmount,
      actual: 0,
    }
  }
  
  // Sum existing commissions (excluding stornos and cancelled)
  const actualAmount = relatedCommissions
    .filter(c => !c.is_storno && c.status !== 'cancelled')
    .reduce((s, c) => s + (c.commission_amount || c.gross_commission || 0), 0)
  
  // Allow 2% variance due to rounding
  const variance = Math.abs(actualAmount - appCommissionAmount) / (appCommissionAmount || 1)
  const synced = variance < 0.02
  
  return {
    synced,
    status: synced ? 'synced' : 'mismatched',
    expected: appCommissionAmount,
    actual: actualAmount,
    variance: (variance * 100).toFixed(1),
    recordCount: relatedCommissions.length,
    entries: relatedCommissions,
  }
}

/**
 * Recalculates all dashboard commission metrics from raw data
 * @param {Array} commissionEntries - All commission entries
 * @param {Array} activeContracts - Active contracts
 * @returns {Object} Comprehensive commission metrics
 */
export function recalculateDashboardCommissions(commissionEntries, activeContracts = []) {
  const total = calculateTotalCommission(commissionEntries)
  const pending = calculatePendingCommission(commissionEntries)
  const received = calculateReceivedCommission(commissionEntries)
  
  // Monthly breakdown
  const now = new Date()
  const currentMonth = now.toISOString().slice(0, 7)
  const mtd = commissionEntries
    .filter(ce => (ce.entry_date || ce.settlement_date || '').slice(0, 7) === currentMonth &&
                  !['cancelled', 'failed'].includes(ce.status))
    .reduce((s, ce) => s + (ce.commission_amount || ce.gross_commission || 0), 0)
  
  // Forecast based on active contracts
  const forecast = activeContracts.reduce((sum, c) => {
    const yearlyPrem = c.premium_yearly || (c.premium_monthly || 0) * 12
    const rate = c.commission_rate || 0
    return sum + ((yearlyPrem * rate) / 100)
  }, 0)
  
  return {
    total,
    pending,
    received,
    mtd,
    forecast,
    recordCount: commissionEntries.filter(c => !c.is_storno && c.status !== 'cancelled').length,
    timestamp: new Date().toISOString(),
  }
}