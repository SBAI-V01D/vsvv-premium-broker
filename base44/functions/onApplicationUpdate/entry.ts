import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

// Status-Gruppen
const ACCEPTED_STATUSES = [
  'angenommen',
  'policiert',
  'approved',
  'angenommen_vorbehalt',
  'vorbehalt',
  'conditional_approved',
  'bewilligung_erteilt',
];
const REJECTED_STATUSES = ['abgelehnt', 'rejected', 'storniert'];
const REVIEW_STATUSES   = ['rueckfrage', 'in_pruefung', 'risikopruefung', 'under_review'];

function buildContractNotes(app) {
  return [
    'Automatisch erstellt aus Antrag.',
    app.sparte_data?.franchise ? `Franchise: CHF ${app.sparte_data.franchise}` : null,
    app.sparte_data?.model ? `Modell: ${app.sparte_data.model}` : null,
    app.sparte_data?.age_group ? `Kategorie: ${app.sparte_data.age_group}` : null,
    app.notes || null,
  ].filter(Boolean).join(' | ');
}

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const body = await req.json();

    const { event, data, old_data } = body;
    const eventType = event?.type;

    // Nur update-Events verarbeiten (create würde Race-Condition mit erstem update verursachen)
    if (eventType !== 'update') {
      return Response.json({ skipped: true, reason: 'only update events processed' });
    }

    const app = data;
    if (!app?.id) {
      return Response.json({ skipped: true, reason: 'no application data' });
    }

    const oldStatus = old_data?.custom_status || old_data?.status || null;
    const newStatus = app.custom_status || app.status;
    const statusChanged = oldStatus !== newStatus && !!newStatus;

    // Kein Status-Wechsel → nichts zu tun
    if (!statusChanged) {
      return Response.json({ skipped: true, reason: 'no status change' });
    }

    const isNewAcceptance = ACCEPTED_STATUSES.includes(newStatus) && !ACCEPTED_STATUSES.includes(oldStatus);

    // ── 1. STATUS CHANGE LOGGING + TIMELINE ──────────────────────────────────
    await base44.asServiceRole.entities.SystemLog.create({
      level: 'info',
      source: 'onApplicationUpdate',
      message: `Antrag-Status: "${oldStatus || 'neu'}" → "${newStatus}" | Kunde: ${app.customer_name || app.customer_id} | Versicherer: ${app.insurer || '–'}`,
      related_entity_type: 'Application',
      related_entity_id: app.id,
      user_email: app.assigned_broker || null,
    });

    if (app.customer_id) {
      try {
        await base44.asServiceRole.entities.StatusHistory.create({
          entity_type: 'application',
          entity_id: app.id,
          customer_id: app.customer_id,
          from_status: oldStatus || 'neu',
          to_status: newStatus,
          changed_by: app.assigned_broker || 'system',
          note: `${app.insurer || '–'} · ${app.sparte || app.insurance_type || '–'}`,
        });
      } catch (shErr) {
        console.warn('[onApplicationUpdate] StatusHistory create failed (non-fatal):', shErr.message);
      }
    }

    // ── 2. FOLLOW-UP TASK bei Rückfrage/Vorbehalt ────────────────────────────
    if (REVIEW_STATUSES.includes(newStatus) && !REVIEW_STATUSES.includes(oldStatus)) {
      const dueDate = new Date();
      dueDate.setDate(dueDate.getDate() + 3);
      await base44.asServiceRole.entities.Task.create({
        title: `Rückfrage/Vorbehalt klären – ${app.customer_name || 'Kunde'}`,
        description: `Antrag bei ${app.insurer || '–'} hat Status "${newStatus}" erhalten.`,
        customer_id: app.customer_id,
        customer_name: app.customer_name,
        priority: 'high',
        status: 'open',
        due_date: dueDate.toISOString().slice(0, 10),
        task_type: 'follow_up',
        assigned_to: app.assigned_broker || null,
      });
    }

    // ── 3. AUTOMATISCHE VERTRAGSERSTELLUNG bei Annahme ────────────────────────
    if (isNewAcceptance && app.customer_id) {
      // Duplikatschutz: atomarer Check via source_application_id UND linked_contract_id
      const existingBySource = await base44.asServiceRole.entities.Contract.filter({ source_application_id: app.id });
      const alreadyLinked = existingBySource.length > 0 || !!(app.linked_contract_id);

      if (!alreadyLinked) {
        // Guard: organization_id ermitteln
        const insuranceType = app.insurance_type || app.sparte || 'other';
        let finalOrgId = (app.organization_id && app.organization_id.trim()) ? app.organization_id : null;
        if (!finalOrgId) {
          const customerRec = await base44.asServiceRole.entities.Customer.filter({ id: app.customer_id })
            .then(r => r[0] || null).catch(() => null);
          finalOrgId = (customerRec?.organization_id && customerRec.organization_id.trim()) ? customerRec.organization_id : null;
          if (!finalOrgId) {
            console.warn(`[onApplicationUpdate] Kein organization_id auf Antrag ${app.id} — übersprungen`);
            return Response.json({ ok: true, skipped: 'no organization_id', application_id: app.id });
          }
          // organization_id auf Antrag reparieren
          await base44.asServiceRole.entities.Application.update(app.id, { organization_id: finalOrgId });
        }

        const premiumMonthly = app.estimated_premium_monthly || null;
        const premiumYearly = app.estimated_premium_yearly || (premiumMonthly ? Math.round(premiumMonthly * 12 * 100) / 100 : null);

        const newContract = await base44.asServiceRole.entities.Contract.create({
          customer_id: app.customer_id,
          customer_name: app.customer_name,
          primary_customer_id: app.primary_customer_id || app.customer_id,
          is_family_member: app.is_family_member || false,
          organization_id: finalOrgId,
          source_application_id: app.id,
          insurer: app.insurer,
          insurance_type: insuranceType,
          sparte: app.sparte || insuranceType,
          sparte_data: app.sparte_data || {},
          product: app.product || app.sparte || '',
          policy_number: app.policy_number || '',
          premium_yearly: premiumYearly,
          premium_monthly: premiumMonthly,
          start_date: app.contract_start_date || app.requested_start_date || '',
          end_date: app.contract_end_date || '',
          assigned_broker: app.assigned_broker || '',
          advisor_id: app.advisor_id || null,
          custom_status: 'aktiv',
          status: 'active',
          commission_amount: app.commission_estimate || null,
          notes: buildContractNotes(app),
        });

        // Antrag mit Vertrags-ID verknüpfen
        await base44.asServiceRole.entities.Application.update(app.id, {
          linked_contract_id: newContract.id,
        });

        // Erwartete Provision erstellen
        const commissionEstimate = app.commission_estimate || null;
        if (commissionEstimate && commissionEstimate > 0) {
          const existingExpected = await base44.asServiceRole.entities.CommissionEntry.filter({
            policy_id: newContract.id,
          });
          const hasExpected = existingExpected.some(e => !e.archived && !e.is_storno);

          if (!hasExpected) {
            await base44.asServiceRole.entities.CommissionEntry.create({
              policy_id: newContract.id,
              policy_number: app.policy_number || '',
              source_application_id: app.id,
              advisor_id: app.advisor_id || '',
              advisor_name: app.assigned_broker || '',
              organization_id: finalOrgId,
              organization_name: '',
              customer_id: app.customer_id,
              customer_name: app.customer_name || '',
              insurer: app.insurer || '',
              product_category: app.sparte || app.insurance_type || '',
              premium_yearly: premiumYearly || 0,
              start_date: app.contract_start_date || '',
              company_provision_amount: commissionEstimate,
              advisor_provision_percentage: null,
              advisor_provision_amount: null,
              provision_storno_percentage: 10,
              provision_payout_amount: null,
              provision_storno_amount: null,
              provision_status: 'expected',
              status: 'expected',
              is_expected: true,
              company_courtage_amount: null,
              advisor_courtage_percentage: null,
              advisor_courtage_amount: null,
              courtage_status: 'pending',
              entry_date: new Date().toISOString().split('T')[0],
              archived: false,
              is_storno: false,
              notes: `Erwartete Provision aus Antrag (CHF ${commissionEstimate})`,
            });
          }
        }

        await base44.asServiceRole.entities.SystemLog.create({
          level: 'info',
          source: 'onApplicationUpdate',
          message: `Vertrag erstellt: ${app.customer_name} | ${app.insurer} | Provision: CHF ${commissionEstimate || 0}`,
          related_entity_type: 'Contract',
          related_entity_id: newContract.id,
          user_email: app.assigned_broker || null,
        });

      } else {
        await base44.asServiceRole.entities.SystemLog.create({
          level: 'info',
          source: 'onApplicationUpdate',
          message: `Vertragserstellung übersprungen (bereits verknüpft): Antrag ${app.id}`,
          related_entity_type: 'Application',
          related_entity_id: app.id,
        });
      }
    }

    // ── 4. TASKS mit application_id auf completed setzen ─────────────────────
    const linkedTasks = await base44.asServiceRole.entities.Task.filter({ application_id: app.id });
    const openLinkedTasks = linkedTasks.filter(t => t.status !== 'completed');
    if (openLinkedTasks.length > 0) {
      await Promise.all(openLinkedTasks.map(task =>
        base44.asServiceRole.entities.Task.update(task.id, {
          status: 'completed',
          completion_date: new Date().toISOString().slice(0, 10),
          notes: (task.notes ? task.notes + '\n' : '') + `Automatisch erledigt: ${newStatus}`,
        })
      ));
    }

    // ── 5. LOG bei Ablehnung ──────────────────────────────────────────────────
    if (REJECTED_STATUSES.includes(newStatus) && !REJECTED_STATUSES.includes(oldStatus)) {
      await base44.asServiceRole.entities.SystemLog.create({
        level: 'warn',
        source: 'onApplicationUpdate',
        message: `Antrag abgelehnt: ${app.customer_name || app.customer_id} | ${app.insurer || '–'}`,
        related_entity_type: 'Application',
        related_entity_id: app.id,
        user_email: app.assigned_broker || null,
      });
    }

    return Response.json({
      ok: true,
      application_id: app.id,
      old_status: oldStatus,
      new_status: newStatus,
    });

  } catch (error) {
    console.error('[onApplicationUpdate] ERROR:', error.message);
    return Response.json({ error: error.message }, { status: 500 });
  }
});