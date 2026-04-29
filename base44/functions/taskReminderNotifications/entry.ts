import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    
    // Fetch all active tasks (not completed)
    const tasks = await base44.asServiceRole.entities.Task.filter({ status: { $ne: 'completed' } });
    
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    const sentEmails = [];
    const errors = [];

    for (const task of tasks) {
      if (!task.due_date || !task.assigned_to) continue;

      const dueDate = new Date(task.due_date);
      dueDate.setHours(0, 0, 0, 0);
      
      const daysUntilDue = Math.ceil((dueDate - today) / (1000 * 60 * 60 * 24));

      // Determine if notification should be sent
      let shouldSend = false;
      let reminderType = '';

      if (daysUntilDue === 14) {
        shouldSend = true;
        reminderType = '2 Wochen';
      } else if (daysUntilDue === 7) {
        shouldSend = true;
        reminderType = '1 Woche';
      } else if (daysUntilDue === 2) {
        shouldSend = true;
        reminderType = '2 Tage';
      } else if (daysUntilDue === 0) {
        shouldSend = true;
        reminderType = 'heute fällig';
      } else if (daysUntilDue < 0) {
        shouldSend = true;
        reminderType = `${Math.abs(daysUntilDue)} Tage überfällig`;
      }

      if (shouldSend) {
        try {
          const formatDate = (dateStr) => {
            const date = new Date(dateStr + 'T00:00:00Z');
            const day = String(date.getUTCDate()).padStart(2, '0');
            const month = String(date.getUTCMonth() + 1).padStart(2, '0');
            const year = date.getUTCFullYear();
            return `${day}.${month}.${year}`;
          };

          await base44.integrations.Core.SendEmail({
            to: task.assigned_to,
            subject: `Aufgabenerinnerung: ${task.title} (${reminderType})`,
            body: `Hallo,\n\nSie haben eine fällige Aufgabe:\n\n**${task.title}**\n\nStatus: ${task.status}\nFällig: ${formatDate(task.due_date)}\n${task.description ? `Beschreibung: ${task.description}\n` : ''}\nZugewiesen an: ${task.assigned_to}\n\nBitte bearbeiten Sie diese Aufgabe zeitnah.\n\nMit freundlichen Grüßen\nIhr CRM System`,
            from_name: 'CRM Broker'
          });

          sentEmails.push({
            taskId: task.id,
            taskTitle: task.title,
            recipientEmail: task.assigned_to,
            reminderType
          });
        } catch (emailError) {
          errors.push({
            taskId: task.id,
            error: emailError.message
          });
        }
      }
    }

    return Response.json({
      success: true,
      sentEmails: sentEmails.length,
      details: sentEmails,
      errors: errors.length > 0 ? errors : undefined
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});