import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25'

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req)
    
    const { event, data } = await req.json()
    
    if (event.type !== 'create') {
      return Response.json({ message: 'Not a create event' })
    }

    const opp = data
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

    // Cap at 100
    score = Math.max(0, Math.min(score, 100))

    // Health
    let health = 'healthy'
    if (score >= 80) health = 'hot'
    else if (score >= 60) health = 'warm'
    else if (score >= 40) health = 'qualified'

    // Update opportunity
    await base44.entities.Verkaufschance.update(opp.id, {
      priority: health === 'hot' ? 'high' : health === 'warm' ? 'medium' : 'low',
    })

    return Response.json({
      event: 'opportunity_scored',
      opportunity_id: opp.id,
      score: Math.round(score),
      health,
      courtageEstimate: opp.estimated_value ? Math.round(opp.estimated_value * 0.02) : 0,
      status: 'success',
    })
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 })
  }
})