import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25'

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req)

    // Fetch tasks due today or overdue
    const tasks = await base44.entities.Task.list()
    const today = new Date().toISOString().split('T')[0]

    let reminders_sent = 0

    for (const task of tasks) {
      if (task.status === 'completed') continue
      if (!task.due_date || new Date(task.due_date) > new Date(today)) continue
      if (!task.assigned_to) continue

      try {
        // assigned_to contains broker email
        const brokerEmail = task.assigned_to
        
        await base44.integrations.Core.SendEmail({
          to: brokerEmail,
          subject: `Erinnerung: Aufgabe fällig – ${task.title}`,
          body: `Liebe/r Kolleg/in,\n\nDie folgende Aufgabe ist heute fällig oder überfällig:\n\nTitel: ${task.title}\nPriorität: ${task.priority || 'medium'}\n${task.customer_name ? `Kunde: ${task.customer_name}` : ''}\n\nBitte kümmern Sie sich darum.`,
        })
        reminders_sent++
        console.log(`Reminder sent to ${brokerEmail} for task: ${task.title}`)
      } catch (error) {
        console.error(`Failed to send reminder to ${task.assigned_to}: ${error.message}`)
      }
    }

    return Response.json({ success: true, reminders_sent })
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 })
  }
})