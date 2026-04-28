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
        await base44.integrations.Core.SendEmail({
          to: task.assigned_to,
          subject: `Erinnerung: Aufgabe fällig – ${task.title}`,
          body: `Liebe/r Kolleg/in,\n\nDie folgende Aufgabe ist heute fällig oder überfällig:\n\n${task.title}\n\nPriorität: ${task.priority}\n\nBitte kümmern Sie sich darum.`,
        })
        reminders_sent++
      } catch (error) {
        console.error(`Failed to send reminder to ${task.assigned_to}:`, error.message)
      }
    }

    return Response.json({ success: true, reminders_sent })
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 })
  }
})