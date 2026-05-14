import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25'

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req)
    const user = await base44.auth.me()
    
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 })

    const { opportunity_id } = await req.json()
    if (!opportunity_id) return Response.json({ error: 'opportunity_id required' }, { status: 400 })

    const opp = await base44.entities.Verkaufschance.filter({ id: opportunity_id }).then(r => r[0])
    if (!opp) return Response.json({ error: 'Opportunity not found' }, { status: 404 })

    let score = 0

    // Deal Value (0-35 points)
    if (opp.estimated_value) {
      const valueTier = opp.estimated_value > 50000 ? 35 : opp.estimated_value > 20000 ? 25 : 15
      score += valueTier
    }

    // Status (0-30 points)
    const statusScores = {
      gewonnen: 50,
      kunde_entscheidet: 30,
      beratung_erfolgt: 25,
      offerten_erhalten: 20,
      in_ausschreibung: 10,
      neu: 0,
      verloren: -50,
      wiedervorlage: 5,
    }
    score += statusScores[opp.status] || 0

    // Recency (0-15 points)
    if (opp.renewal_last_activity || opp.renewal_stage_updated) {
      const lastActivity = new Date(opp.renewal_last_activity || opp.renewal_stage_updated)
      const daysSince = (Date.now() - lastActivity.getTime()) / 86400000
      if (daysSince < 3) score += 15
      else if (daysSince < 7) score += 10
      else if (daysSince < 14) score += 5
    }

    // Probability (0-20 points)
    if (opp.expected_close_date) {
      const closeDate = new Date(opp.expected_close_date)
      const daysUntilClose = (closeDate.getTime() - Date.now()) / 86400000
      if (daysUntilClose < 7) score += 20
      else if (daysUntilClose < 14) score += 15
      else if (daysUntilClose < 30) score += 10
      else if (daysUntilClose < 60) score += 5
    }

    // Cap at 100
    score = Math.max(0, Math.min(score, 100))

    // Health Status
    let health = 'healthy'
    if (score >= 80) health = 'hot'
    else if (score >= 60) health = 'warm'
    else if (score >= 40) health = 'qualified'
    else health = 'at_risk'

    return Response.json({
      opportunity_id,
      score: Math.round(score),
      health,
      courtageEstimate: opp.estimated_value ? Math.round(opp.estimated_value * 0.02) : 0,
      recommendation: health === 'hot' ? 'Push to close' : health === 'warm' ? 'Follow up soon' : 'Monitor',
      timestamp: new Date().toISOString(),
    })
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 })
  }
})