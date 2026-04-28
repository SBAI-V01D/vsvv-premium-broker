import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);

    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const todayStr = today.toISOString().split('T')[0];

    // Fetch all open/in-progress tasks
    const tasks = await base44.asServiceRole.entities.Task.filter({});
    const dueTasks = tasks.filter(t =>
      t.status !== 'erledigt' &&
      t.due_date &&
      t.due_date <= todayStr &&
      t.assigned_to
    );

    if (dueTasks.length === 0) {
      return Response.json({ message: 'Keine fälligen Aufgaben gefunden.' });
    }

    // Group tasks by assigned broker
    const byBroker = {};
    for (const task of dueTasks) {
      if (!byBroker[task.assigned_to]) byBroker[task.assigned_to] = [];
      byBroker[task.assigned_to].push(task);
    }

    const results = [];

    for (const [brokerEmail, brokerTasks] of Object.entries(byBroker)) {
      const overdueList = brokerTasks.filter(t => t.due_date < todayStr);
      const dueList = brokerTasks.filter(t => t.due_date === todayStr);

      const priorityLabel = { niedrig: 'Niedrig', mittel: 'Mittel', hoch: 'Hoch', dringend: '🔴 Dringend' };
      const statusLabel = { offen: 'Offen', in_bearbeitung: 'In Bearbeitung' };

      const formatTask = (t) =>
        `• <strong>${t.title}</strong>${t.customer_name ? ` (${t.customer_name})` : ''} – Priorität: ${priorityLabel[t.priority] || t.priority} | Status: ${statusLabel[t.status] || t.status} | Fällig: ${t.due_date}`;

      let body = `<p>Guten Morgen,</p><p>hier ist Ihre heutige Aufgaben-Zusammenfassung:</p>`;

      if (overdueList.length > 0) {
        body += `<h3 style="color:#ef4444">⚠️ Überfällige Aufgaben (${overdueList.length})</h3><ul>${overdueList.map(t => `<li>${formatTask(t)}</li>`).join('')}</ul>`;
      }
      if (dueList.length > 0) {
        body += `<h3 style="color:#f59e0b">📅 Heute fällig (${dueList.length})</h3><ul>${dueList.map(t => `<li>${formatTask(t)}</li>`).join('')}</ul>`;
      }

      body += `<p>Bitte bearbeiten Sie die offenen Aufgaben zeitnah.</p><p>Ihr BrokerCRM</p>`;

      await base44.asServiceRole.integrations.Core.SendEmail({
        to: brokerEmail,
        subject: `📋 Aufgaben-Erinnerung: ${brokerTasks.length} fällige Aufgabe(n) – ${todayStr}`,
        body,
      });

      results.push({ broker: brokerEmail, sent: brokerTasks.length });
    }

    return Response.json({ success: true, results });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});