import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

/**
 * DAILY OPERATIONS DIGEST
 * 
 * Scheduled daily at 07:00 — generates a prioritized action digest for brokers:
 * - Urgent expiring contracts (0-14 days)
 * - Overdue tasks
 * - Pending documents needing review
 * - New leads without contact
 * - Stalled applications
 * 
 * Creates Tasks and SystemLogs for each category.
 */

Deno.serve(async (req) => {
  const base44 = createClientFromRequest(req);

  try {
    // Scheduled automations don't have a user — use service role
    const today = new Date();
    const todayStr = today.toISOString().split('T')[0];
    console.log(`[dailyOperationsDigest] START date=${todayStr}`);

    const [contracts, tasks, documents, leads, applications] = await Promise.all([
      base44.asServiceRole.entities.Contract.list(),
      base44.asServiceRole.entities.Task.list(),
      base44.asServiceRole.entities.Document.list(),
      base44.asServiceRole.entities.Lead.list(),
      base44.asServiceRole.entities.Application.list(),
    ]);

    const digest = {
      date: todayStr,
      urgent_expirations: [],
      overdue_tasks: [],
      pending_documents: [],
      stale_leads: [],
      stalled_applications: [],
      actions_created: 0,
    };

    // ── 1. Urgent expiring contracts (0–14 days) ─────────────────────────
    const in14 = new Date(today); in14.setDate(today.getDate() + 14);
    const urgentExpiring = contracts.filter(c => {
      if (c.status !== 'active' || !c.end_date) return false;
      const d = new Date(c.end_date);
      return d >= today && d <= in14;
    });

    for (const c of urgentExpiring) {
      const daysLeft = Math.ceil((new Date(c.end_date) - today) / (1000 * 60 * 60 * 24));
      digest.urgent_expirations.push({ id: c.id, policy_number: c.policy_number, days_left: daysLeft });

      // Create urgent task if not already existing
      const existingTask = tasks.find(t =>
        t.customer_id === c.customer_id &&
        t.status !== 'completed' &&
        t.task_type === 'renewal' &&
        t.contract_id === c.id
      );

      if (!existingTask) {
        await base44.asServiceRole.entities.Task.create({
          title: `🔴 Dringend: Vertrag läuft in ${daysLeft} Tagen ab – ${c.insurer || 'Unbekannt'}`,
          description: `Police ${c.policy_number || '–'} läuft am ${c.end_date} ab. Sofort Kunden kontaktieren!`,
          customer_id: c.customer_id,
          customer_name: c.customer_name,
          contract_id: c.id,
          status: 'open',
          priority: 'urgent',
          due_date: c.end_date,
          task_type: 'renewal',
        });
        digest.actions_created++;
      }
    }

    // ── 2. Overdue tasks (due_date < today, not completed) ────────────────
    digest.overdue_tasks = tasks.filter(t =>
      t.status !== 'completed' &&
      t.due_date &&
      t.due_date < todayStr
    ).map(t => ({ id: t.id, title: t.title, due_date: t.due_date }));

    // ── 3. Pending documents > 48h old ───────────────────────────────────
    const cutoff48h = new Date(today); cutoff48h.setHours(cutoff48h.getHours() - 48);
    digest.pending_documents = documents.filter(d =>
      d.classification_status === 'ausstehend' &&
      new Date(d.created_date) < cutoff48h
    ).map(d => ({ id: d.id, name: d.name, created: d.created_date }));

    // ── 4. Stale leads (no contact in 7+ days, still active) ─────────────
    const in7ago = new Date(today); in7ago.setDate(today.getDate() - 7);
    digest.stale_leads = leads.filter(l =>
      ['new', 'contacted', 'qualified'].includes(l.status) &&
      (!l.last_contact_date || new Date(l.last_contact_date) < in7ago)
    ).map(l => ({
      id: l.id,
      name: `${l.first_name} ${l.last_name}`,
      status: l.status,
      last_contact: l.last_contact_date,
    }));

    // Create follow-up tasks for stale leads (max 5 to avoid spam)
    for (const lead of digest.stale_leads.slice(0, 5)) {
      const existingFollowup = tasks.find(t =>
        t.title.includes(lead.name) &&
        t.status !== 'completed' &&
        t.task_type === 'follow_up'
      );
      if (!existingFollowup) {
        await base44.asServiceRole.entities.Task.create({
          title: `📞 Follow-up: ${lead.name} (kein Kontakt seit 7+ Tagen)`,
          description: `Lead ${lead.name} wurde seit mehr als 7 Tagen nicht kontaktiert. Status: ${lead.status}`,
          status: 'open',
          priority: 'medium',
          due_date: todayStr,
          task_type: 'follow_up',
        });
        digest.actions_created++;
      }
    }

    // ── 5. Stalled applications (submitted > 14 days ago, no update) ─────
    const in14ago = new Date(today); in14ago.setDate(today.getDate() - 14);
    digest.stalled_applications = applications.filter(a =>
      ['submitted', 'under_review'].includes(a.status) &&
      new Date(a.created_date) < in14ago
    ).map(a => ({ id: a.id, customer: a.customer_name, insurer: a.insurer, status: a.status }));

    // ── 6. System Log ─────────────────────────────────────────────────────
    const summary = `Tagesübersicht ${todayStr}: ${digest.urgent_expirations.length} dringende Abläufe, ${digest.overdue_tasks.length} überfällige Aufgaben, ${digest.pending_documents.length} ausstehende Dokumente, ${digest.stale_leads.length} inaktive Leads. ${digest.actions_created} neue Tasks erstellt.`;

    await base44.asServiceRole.entities.SystemLog.create({
      level: digest.urgent_expirations.length > 0 ? 'warn' : 'info',
      source: 'dailyOperationsDigest',
      message: summary,
    });

    console.log(`[dailyOperationsDigest] ✅ COMPLETE: ${summary}`);

    return Response.json({
      success: true,
      digest,
    });

  } catch (error) {
    console.error(`[dailyOperationsDigest] ERROR: ${error.message}`);
    await base44.asServiceRole.entities.SystemLog.create({
      level: 'error',
      source: 'dailyOperationsDigest',
      message: `Fehler im Tagesdigest: ${error.message}`,
      details: error.stack,
    }).catch(() => {});
    return Response.json({ success: false, error: error.message }, { status: 500 });
  }
});