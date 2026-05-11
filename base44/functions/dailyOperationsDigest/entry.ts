import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

/**
 * DAILY OPERATIONS DIGEST — Täglicher Job (07:00 Zürich / 05:00 UTC)
 *
 * WICHTIG: Diese Funktion erstellt KEINE Renewal-Tasks mehr für ablaufende Verträge.
 * Das ist Aufgabe von checkPoliciesExpiry (06:30 UTC).
 *
 * Diese Funktion macht nur:
 * 1. Logging / Summary für SystemLog
 * 2. Follow-up Tasks für inaktive Leads (max 3, mit Duplikatschutz)
 * 3. Stalled Applications loggen (keine Tasks)
 */

Deno.serve(async (req) => {
  const base44 = createClientFromRequest(req);

  try {
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

    let actionsCreated = 0;

    // ── 1. Kennzahlen berechnen (nur Logging, keine Tasks) ───────────────
    const in14 = new Date(today); in14.setDate(today.getDate() + 14);
    const urgentExpiring = contracts.filter(c => {
      if (c.status !== 'active' || !c.end_date) return false;
      const d = new Date(c.end_date + 'T00:00:00Z');
      return d >= today && d <= in14;
    });

    const overdueTasks = tasks.filter(t =>
      t.status !== 'completed' &&
      t.due_date &&
      t.due_date < todayStr
    );

    const cutoff48h = new Date(today);
    cutoff48h.setHours(cutoff48h.getHours() - 48);
    const pendingDocs = documents.filter(d =>
      d.classification_status === 'ausstehend' &&
      new Date(d.created_date) < cutoff48h
    );

    // ── 2. Follow-up Tasks für inaktive Leads (max 3, strikte Duplikatprüfung) ─
    const in7ago = new Date(today); in7ago.setDate(today.getDate() - 7);
    const staleLeads = leads.filter(l =>
      ['new', 'contacted', 'qualified'].includes(l.status) &&
      (!l.last_contact_date || new Date(l.last_contact_date) < in7ago)
    );

    for (const lead of staleLeads.slice(0, 3)) {
      const leadName = `${lead.first_name || ''} ${lead.last_name || ''}`.trim();
      // Duplikatschutz: kein offener follow_up Task mit diesem Lead in den letzten 7 Tagen
      const cutoff7d = new Date(today); cutoff7d.setDate(today.getDate() - 7);
      const alreadyHasFollowup = tasks.some(t =>
        t.status !== 'completed' &&
        t.task_type === 'follow_up' &&
        (
          (lead.customer_id && t.customer_id === lead.customer_id) ||
          t.title?.includes(leadName)
        ) &&
        new Date(t.created_date || '2000-01-01') > cutoff7d
      );

      if (!alreadyHasFollowup && leadName) {
        await base44.asServiceRole.entities.Task.create({
          title: `Follow-up: ${leadName} (kein Kontakt seit 7+ Tagen)`,
          description: `Lead wurde seit mehr als 7 Tagen nicht kontaktiert. Status: ${lead.status}`,
          customer_id: lead.customer_id || null,
          customer_name: leadName,
          status: 'open',
          priority: 'medium',
          due_date: todayStr,
          task_type: 'follow_up',
          assigned_to: lead.advisor_id || null,
        });
        actionsCreated++;
      }
    }

    // ── 3. Stalled Applications (nur loggen, keine Tasks erstellen) ──────
    const in14ago = new Date(today); in14ago.setDate(today.getDate() - 14);
    const stalledApps = applications.filter(a =>
      ['submitted', 'under_review', 'waiting'].includes(a.status) &&
      new Date(a.created_date) < in14ago
    );

    // ── 4. SystemLog Summary ─────────────────────────────────────────────
    const summary = [
      `Tagesübersicht ${todayStr}:`,
      `${urgentExpiring.length} Verträge laufen in 14 Tagen ab`,
      `${overdueTasks.length} überfällige Aufgaben`,
      `${pendingDocs.length} Dokumente ausstehend (>48h)`,
      `${staleLeads.length} inaktive Leads`,
      `${stalledApps.length} stockende Anträge`,
      `${actionsCreated} neue Tasks erstellt`,
    ].join(' | ');

    await base44.asServiceRole.entities.SystemLog.create({
      level: urgentExpiring.length > 0 || overdueTasks.length > 5 ? 'warn' : 'info',
      source: 'dailyOperationsDigest',
      message: summary,
    });

    console.log(`[dailyOperationsDigest] DONE: ${summary}`);

    return Response.json({
      success: true,
      date: todayStr,
      stats: {
        urgent_expiring: urgentExpiring.length,
        overdue_tasks: overdueTasks.length,
        pending_docs: pendingDocs.length,
        stale_leads: staleLeads.length,
        stalled_apps: stalledApps.length,
        actions_created: actionsCreated,
      },
    });

  } catch (error) {
    console.error(`[dailyOperationsDigest] ERROR: ${error.message}`);
    await base44.asServiceRole.entities.SystemLog.create({
      level: 'error',
      source: 'dailyOperationsDigest',
      message: `Fehler im Tagesdigest: ${error.message}`,
    }).catch(() => {});
    return Response.json({ success: false, error: error.message }, { status: 500 });
  }
});