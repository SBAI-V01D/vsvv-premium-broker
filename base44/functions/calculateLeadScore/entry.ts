import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25'

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req)
    const user = await base44.auth.me()
    
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 })

    const { lead_id } = await req.json()
    if (!lead_id) return Response.json({ error: 'lead_id required' }, { status: 400 })

    const lead = await base44.entities.Lead.filter({ id: lead_id }).then(r => r[0])
    if (!lead) return Response.json({ error: 'Lead not found' }, { status: 404 })

    let score = 0

    // Status (0-30 points)
    const statusScores = { converted: 30, qualified: 20, contacted: 10, new: 0, lost: -50 }
    score += statusScores[lead.status] || 0

    // Lead Score field (0-25 points)
    score += Math.min(lead.lead_score || 0, 25)

    // Recency (0-20 points)
    if (lead.last_contact_date) {
      const daysSinceContact = (Date.now() - new Date(lead.last_contact_date).getTime()) / 86400000
      if (daysSinceContact < 3) score += 20
      else if (daysSinceContact < 7) score += 15
      else if (daysSinceContact < 14) score += 10
      else if (daysSinceContact < 30) score += 5
    } else {
      // No contact yet
      if (lead.created_date) {
        const daysSinceCreated = (Date.now() - new Date(lead.created_date).getTime()) / 86400000
        if (daysSinceCreated < 1) score += 10
      }
    }

    // Offer Status (0-15 points)
    const offerScores = { accepted: 15, sent: 10, ready: 5, preparing: 2, none: 0, rejected: -20 }
    score += offerScores[lead.offer_status] || 0

    // Conversion Probability (0-10 points)
    if (lead.conversion_probability) {
      score += Math.min(lead.conversion_probability / 10, 10)
    }

    // Cap at 100
    score = Math.max(0, Math.min(score, 100))

    // Determine tier
    let tier = 'cold'
    if (score >= 80) tier = 'hot'
    else if (score >= 60) tier = 'warm'
    else if (score >= 40) tier = 'qualified'

    return Response.json({
      lead_id,
      score: Math.round(score),
      tier,
      recommendation: tier === 'hot' ? 'Contact immediately' : tier === 'warm' ? 'Schedule follow-up' : 'Nurture',
      timestamp: new Date().toISOString(),
    })
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 })
  }
})