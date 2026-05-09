import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25'

/**
 * Validates commission data integrity across applications and commission entries.
 * Detects mismatches, duplicates, and missing links.
 * Intended for admin diagnostics and automated monitoring.
 */
Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req)
    const user = await base44.auth.me()
    
    if (!user?.role !== 'admin') {
      return Response.json({ error: 'Admin only' }, { status: 403 })
    }

    const [applications, commissionEntries, contracts] = await Promise.all([
      base44.entities.Application.list(),
      base44.entities.CommissionEntry.list(),
      base44.entities.Contract.list(),
    ])

    const report = {
      timestamp: new Date().toISOString(),
      summary: {
        totalApplications: applications.length,
        totalCommissions: commissionEntries.length,
        totalContracts: contracts.length,
        issues: 0,
      },
      issues: [],
      duplicates: [],
      mismatches: [],
      orphans: [],
    }

    // 1. Check for invalid commission entries (missing required fields)
    commissionEntries.forEach(ce => {
      const errors = []
      if (!ce.policy_id && !ce.policy_number) errors.push('Missing policy reference')
      if (!ce.advisor_id) errors.push('Missing advisor')
      if (!ce.organization_id) errors.push('Missing organization')
      if (!ce.customer_id) errors.push('Missing customer')
      if (ce.commission_amount === null || ce.commission_amount === undefined) errors.push('Missing amount')
      
      if (errors.length > 0) {
        report.issues.push({
          type: 'invalid_entry',
          id: ce.id,
          errors,
        })
        report.summary.issues++
      }
    })

    // 2. Detect duplicate commissions (same policy, same status)
    const policyMap = {}
    commissionEntries.forEach(ce => {
      if (!ce.policy_id) return
      if (!policyMap[ce.policy_id]) policyMap[ce.policy_id] = []
      policyMap[ce.policy_id].push(ce)
    })

    Object.entries(policyMap).forEach(([policyId, entries]) => {
      const activeEntries = entries.filter(e => !e.is_storno && e.status !== 'cancelled')
      if (activeEntries.length > 1) {
        const total = activeEntries.reduce((s, e) => s + (e.commission_amount || 0), 0)
        report.duplicates.push({
          policy_id: policyId,
          count: activeEntries.length,
          totalAmount: total,
          entries: activeEntries.map(e => ({ id: e.id, amount: e.commission_amount, status: e.status })),
        })
        report.summary.issues++
      }
    })

    // 3. Check application-commission sync
    const ACCEPTED_STATUSES = ['angenommen', 'policiert', 'approved', 'angenommen_vorbehalt']
    applications
      .filter(app => ACCEPTED_STATUSES.includes(app.custom_status || app.status) && app.linked_contract_id)
      .forEach(app => {
        const appComm = calculateAppCommission(app)
        const related = commissionEntries.filter(ce => ce.policy_id === app.linked_contract_id)
        
        if (related.length === 0 && appComm > 0) {
          report.orphans.push({
            application_id: app.id,
            insurer: app.insurer,
            expectedAmount: appComm,
            message: 'Accepted application has no commission entry',
          })
          report.summary.issues++
        }
        
        if (related.length > 0) {
          const actual = related
            .filter(c => !c.is_storno && c.status !== 'cancelled')
            .reduce((s, c) => s + (c.commission_amount || 0), 0)
          
          const variance = Math.abs(actual - appComm) / (appComm || 1)
          if (variance > 0.02) {
            report.mismatches.push({
              application_id: app.id,
              insurer: app.insurer,
              expected: appComm,
              actual,
              variance: (variance * 100).toFixed(1) + '%',
            })
            report.summary.issues++
          }
        }
      })

    // 4. Check for orphaned commission entries (no matching contract)
    const contractIds = new Set(contracts.map(c => c.id))
    commissionEntries
      .filter(ce => ce.policy_id && !contractIds.has(ce.policy_id) && !ce.is_storno)
      .slice(0, 10)
      .forEach(ce => {
        report.orphans.push({
          commission_id: ce.id,
          policy_id: ce.policy_id,
          message: 'Commission entry references non-existent contract',
        })
      })

    return Response.json({
      success: true,
      report,
      hasIssues: report.summary.issues > 0,
    })
    
  } catch (error) {
    console.error('Validation error:', error)
    return Response.json({ 
      error: error.message,
      success: false,
    }, { status: 500 })
  }
})

function calculateAppCommission(app) {
  const yearly = app.estimated_premium_yearly || (app.estimated_premium_monthly ? app.estimated_premium_monthly * 12 : 0)
  const rate = app.commission_rate || 0
  return Math.round((yearly * (rate / 100)) * 100) / 100
}