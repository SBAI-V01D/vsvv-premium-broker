import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25'

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req)
    const user = await base44.auth.me()
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 })

    // Fetch qualified leads
    const leads = await base44.entities.Lead.list()
    let offersPrepared = 0

    for (const lead of leads) {
      // Only process qualified leads with autopilot active and no offer yet
      if (lead.autopilot_status !== 'active' || lead.status !== 'qualified' || lead.offer_status !== 'none') {
        continue
      }

      // Mark offer as "preparing"
      await base44.entities.Lead.update(lead.id, {
        offer_status: 'preparing',
      })

      // Create notification task for advisor to review/send
      await base44.entities.Task.create({
        title: `Angebot bereit: ${lead.name}`,
        description: `Angebot für ${lead.name} (${lead.company || 'Privatperson'}) wurde vorbereitet und wartet auf Freigabe.`,
        task_type: 'offer_review',
        status: 'open',
        related_lead_id: lead.id,
        priority: 'high',
        due_date: new Date().toISOString().split('T')[0],
      })

      // Mark as ready (system says: ready for human approval)
      await base44.entities.Lead.update(lead.id, {
        offer_status: 'ready',
        offer_prepared_date: new Date().toISOString(),
      })

      offersPrepared++
    }

    return Response.json({ offersPrepared, status: 'success' })
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 })
  }
})