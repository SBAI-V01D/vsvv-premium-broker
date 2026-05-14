import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25'

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req)
    const user = await base44.auth.me()
    
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 })

    const { customer_id } = await req.json()
    if (!customer_id) return Response.json({ error: 'customer_id required' }, { status: 400 })

    const customer = await base44.entities.Customer.filter({ id: customer_id }).then(r => r[0])
    if (!customer) return Response.json({ error: 'Customer not found' }, { status: 404 })

    // Fetch customer's contracts
    const contracts = await base44.entities.Contract.filter({ customer_id })
    if (!contracts.length) return Response.json({ risk_score: 0, risk_level: 'none', reason: 'No contracts' })

    let riskScore = 0
    const reasons = []

    // Contract Status – cancelled/expired = high risk
    const cancelledCount = contracts.filter(c => c.status === 'cancelled').length
    if (cancelledCount > 0) {
      riskScore += 30
      reasons.push(`${cancelledCount} stornierte Verträge`)
    }

    // No activity
    const now = new Date()
    const noActivityContracts = contracts.filter(c => {
      if (!c.last_review_date) return true
      const daysSince = (now.getTime() - new Date(c.last_review_date).getTime()) / 86400000
      return daysSince > 180
    }).length

    if (noActivityContracts > 0) {
      riskScore += noActivityContracts * 10
      reasons.push(`${noActivityContracts} Verträge ohne Aktivität > 180 Tage`)
    }

    // Renewal stage – if many are in early stage, low engagement
    const renewalEarlyCount = contracts.filter(c => c.renewal_stage === 'early').length
    const activeRenewals = contracts.filter(c => ['contact', 'offer', 'negotiation'].includes(c.renewal_stage)).length
    
    if (renewalEarlyCount > activeRenewals && renewalEarlyCount > 0) {
      riskScore += 15
      reasons.push(`${renewalEarlyCount} Verträge im Early Stage – niedrige Engagementtätigkeit`)
    }

    // Price sensitivity – if premium was high but customer never reviewed
    const highPremiumContracts = contracts.filter(c => (c.premium_yearly || 0) > 10000).length
    if (highPremiumContracts > 0 && noActivityContracts > 0) {
      riskScore += 10
      reasons.push(`${highPremiumContracts} hochwertige Verträge – Preissensitivität`)
    }

    // Cap at 100
    riskScore = Math.min(riskScore, 100)

    let riskLevel = 'low'
    if (riskScore >= 70) riskLevel = 'critical'
    else if (riskScore >= 50) riskLevel = 'high'
    else if (riskScore >= 30) riskLevel = 'medium'

    return Response.json({
      customer_id,
      risk_score: Math.round(riskScore),
      risk_level: riskLevel,
      reasons,
      contractsAtRisk: cancelledCount + noActivityContracts,
      totalContracts: contracts.length,
      timestamp: new Date().toISOString(),
    })
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 })
  }
})