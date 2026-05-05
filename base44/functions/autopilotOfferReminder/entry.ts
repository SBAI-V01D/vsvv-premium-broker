import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25'

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req)
    const user = await base44.auth.me()
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 })

    const leads = await base44.entities.Lead.list()
    const today = new Date()
    let remindersCreated = 0

    for (const lead of leads) {
      // Only process if offer was sent and autopilot is active
      if (lead.autopilot_status !== 'active' || lead.offer_status !== 'sent') continue

      const offerSentDate = lead.offer_sent_date ? new Date(lead.offer_sent_date) : null
      if (!offerSentDate) continue

      const daysSinceOffer = Math.floor((today - offerSentDate) / (1000 * 60 * 60 * 24))

      // Send reminder after 3 days
      if (daysSinceOffer === 3) {
        await base44.entities.Task.create({
          title: `Erinnerung: Angebot folgen ${lead.name}`,
          description: `Offer wurde vor 3 Tagen gesendet an ${lead.name}. Bitte verfolgen.`,
          task_type: 'follow_up',
          status: 'open',
          related_lead_id: lead.id,
          priority: 'high',
          due_date: new Date().toISOString().split('T')[0],
        })

        remindersCreated++
      }
    }

    return Response.json({ remindersCreated, status: 'success' })
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 })
  }
})