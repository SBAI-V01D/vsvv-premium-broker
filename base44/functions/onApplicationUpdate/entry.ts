import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

// Status-Gruppen
const ACCEPTED_STATUSES = ['angenommen', 'policiert', 'approved', 'angenommen_vorbehalt'];
const REJECTED_STATUSES = ['abgelehnt', 'rejected', 'storniert'];
const REVIEW_STATUSES   = ['rueckfrage', 'vorbehalt', 'under_review'];

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const body = await req.json();

    const { event, data, old_data } = body;

    // Only handle update events
    if (event?.type !== 'update') {
      return Response.json({ skipped: true, reason: 'not an update event' });
    }

    const app = data;
    if (!app?.id) {
      return Response.json({ skipped: true, reason: 'no application data' });
    }

    const oldStatus = old_data?.custom_status || old_data?.status;
    const newStatus = app.custom_status || app.status;
    const statusChanged = oldStatus !== newStatus && !!newStatus;

    // ── 1. STATUS CHANGE LOGGING ─────────────────────────────────────────────
    if (statusChanged) {
      await base44.asServiceRole.entities.SystemLog.create({
        level: 'info',
        source: 'onApplicationUpdate',
        message: `Antrag-Status geändert: "${oldStatus}" → "${newStatus}" | Kunde: ${app.customer_name || app.customer_id} | Versicherer: ${app.insurer || '–'}`,
        related_entity_type: 'Application',
        related_entity_id: app.id,
        user_email: app.assigned_broker || null,
      });
    }

    // ── 2. FOLLOW-UP TASK bei Rückfrage/Vorbehalt ────────────────────────────
    if (statusChanged && REVIEW_STATUSES.includes(newStatus) && !REVIEW_STATUSES.includes(oldStatus)) {
      const dueDate = new Date();
      dueDate.setDate(dueDate.getDate() + 3); // 3 Tage Frist

      await base44.asServiceRole.entities.Task.create({
        title: `Rückfrage/Vorbehalt klären – ${app.customer_name || 'Kunde'}`,
        description: `Antrag bei ${app.insurer || '–'} hat Status "${newStatus}" erhalten. Rückfrage oder Vorbehalt muss geklärt werden.`,
        customer_id: app.customer_id,
        customer_name: app.customer_name,
        priority: 'high',
        status: 'open',
        due_date: dueDate.toISOString().slice(0, 10),
        task_type: 'follow_up',
        assigned_to: app.assigned_broker || null,
      });

      await base44.asServiceRole.entities.SystemLog.create({
        level: 'info',
        source: 'onApplicationUpdate',
        message: `Follow-up Task erstellt für ${app.customer_name || app.customer_id}: Status=${newStatus}`,
        related_entity_type: 'Application',
        related_entity_id: app.id,
      });
    }

    // ── 3. COMMISSION QUEUE bei Annahme ──────────────────────────────────────
    if (statusChanged && ACCEPTED_STATUSES.includes(newStatus) && !ACCEPTED_STATUSES.includes(oldStatus)) {
      // Queue commission calculation job
      await base44.asServiceRole.entities.AutomationQueue.create({
        job_type: 'commission_calc',
        status: 'pending',
        related_entity_type: 'Application',
        related_entity_id: app.id,
        payload: JSON.stringify({
          application_id: app.id,
          customer_id: app.customer_id,
          broker_email: app.assigned_broker,
          sparte: app.sparte || app.insurance_type,
          premium_yearly: app.estimated_premium_yearly,
          insurer: app.insurer,
        }),
      });

      await base44.asServiceRole.entities.SystemLog.create({
        level: 'info',
        source: 'onApplicationUpdate',
        message: `Antrag angenommen – Commission-Job eingestellt: ${app.customer_name} | ${app.insurer} | Sparte: ${app.sparte || app.insurance_type}`,
        related_entity_type: 'Application',
        related_entity_id: app.id,
      });
    }

    // ── 4. LOG bei Ablehnung ──────────────────────────────────────────────────
    if (statusChanged && REJECTED_STATUSES.includes(newStatus) && !REJECTED_STATUSES.includes(oldStatus)) {
      await base44.asServiceRole.entities.SystemLog.create({
        level: 'warn',
        source: 'onApplicationUpdate',
        message: `Antrag abgelehnt/storniert: ${app.customer_name || app.customer_id} | ${app.insurer || '–'} | Grund: ${app.notes || 'kein Grund angegeben'}`,
        related_entity_type: 'Application',
        related_entity_id: app.id,
        user_email: app.assigned_broker || null,
      });
    }

    return Response.json({
      ok: true,
      application_id: app.id,
      status_changed: statusChanged,
      old_status: oldStatus,
      new_status: newStatus,
    });

  } catch (error) {
    console.error('[onApplicationUpdate] ERROR:', error.message);
    return Response.json({ error: error.message }, { status: 500 });
  }
});