import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25'

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req)
    const user = await base44.auth.me()
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 })

    // Fetch leads with autopilot active
    const leads = await base44.entities.Lead.list()
    const today = new Date()
    let followupsSent = 0

    for (const lead of leads) {
      // Check if autopilot is active AND contacted AND no activity for 2+ days
      if (lead.autopilot_status !== 'active' || lead.status !== 'contacted') continue

      const lastActivity = lead.last_contact_date ? new Date(lead.last_contact_date) : new Date(lead.created_date)
      const daysSinceActivity = Math.floor((today - lastActivity) / (1000 * 60 * 60 * 24))

      if (daysSinceActivity >= 2 && (!lead.last_followup_sent || daysSinceActivity >= 5)) {
        // Generate follow-up message
        const message = `Sehr geehrte/r ${lead.name || 'Kontakt'},

ich wollte kurz nachfragen, ob Sie die Unterlagen zum ${lead.company ? lead.company : 'Angebot'} prüfen konnten.

Gerne stehe ich Ihnen für Fragen zur Verfügung und unterstütze Sie bei der nächsten Schritte.

Freundliche Grüsse,
${user.full_name}`

        // Send via email (create notification/task)
        await base44.entities.Task.create({
          title: `Follow-up: ${lead.name}`,
          description: message,
          task_type: 'follow_up',
          status: 'open',
          related_lead_id: lead.id,
          due_date: new Date().toISOString().split('T')[0],
        })

        // Update lead: last_followup_sent
        await base44.entities.Lead.update(lead.id, {
          last_followup_sent: today.toISOString(),
        })

        followupsSent++
      }
    }

    return Response.json({ followupsSent, status: 'success' })
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 })
  }
})