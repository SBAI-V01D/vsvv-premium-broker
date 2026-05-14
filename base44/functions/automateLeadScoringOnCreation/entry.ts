import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25'

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req)
    
    // Payload from entity automation trigger
    const { event, data } = await req.json()
    
    if (event.type !== 'create') {
      return Response.json({ message: 'Not a create event' })
    }

    const lead = data
    let score = 0

    // Status scoring
    const statusScores = { converted: 30, qualified: 20, contacted: 10, new: 0, lost: -50 }
    score += statusScores[lead.status] || 0

    // Lead score field
    score += Math.min(lead.lead_score || 0, 25)

    // Recency
    if (lead.created_date) {
      const daysSinceCreated = (Date.now() - new Date(lead.created_date).getTime()) / 86400000
      if (daysSinceCreated < 1) score += 10
    }

    // Cap at 100
    score = Math.max(0, Math.min(score, 100))

    // Determine tier
    let tier = 'cold'
    if (score >= 80) tier = 'hot'
    else if (score >= 60) tier = 'warm'
    else if (score >= 40) tier = 'qualified'

    // Update lead with score and tier
    await base44.entities.Lead.update(lead.id, {
      lead_score: Math.round(score),
    })

    // Log automation
    await base44.entities.SystemLog.create({
      action: 'auto_score_lead',
      entity_type: 'lead',
      entity_id: lead.id,
      details: { score: Math.round(score), tier },
      timestamp: new Date().toISOString(),
    }).catch(() => {})

    return Response.json({
      event: 'lead_scored',
      lead_id: lead.id,
      score: Math.round(score),
      tier,
      status: 'success',
    })
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 })
  }
})