import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

// Status-Gruppen
const ACCEPTED_STATUSES = ['angenommen', 'policiert', 'approved', 'angenommen_vorbehalt', 'conditional_approved'];
const REJECTED_STATUSES = ['abgelehnt', 'rejected', 'storniert'];
const REVIEW_STATUSES   = ['rueckfrage', 'vorbehalt', 'under_review'];

// Hilfsfunktion: Vertragsfeld aus Sparte-Daten aufbauen
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

    if (!['update', 'create'].includes(eventType)) {
      return Response.json({ skipped: true, reason: 'not a create/update event' });
    }

    const app = data;
    if (!app?.id) {
      return Response.json({ skipped: true, reason: 'no application data' });
    }

    const oldStatus = old_data?.custom_status || old_data?.status || null;
    const newStatus = app.custom_status || app.status;
    const statusChanged = eventType === 'create' || (oldStatus !== newStatus && !!newStatus);
    const isNewAcceptance = ACCEPTED_STATUSES.includes(newStatus) && !ACCEPTED_STATUSES.includes(oldStatus);

    // ── 1. STATUS CHANGE LOGGING + TIMELINE ──────────────────────────────────
    if (statusChanged && newStatus) {
      await base44.asServiceRole.entities.SystemLog.create({
        level: 'info',
        source: 'onApplicationUpdate',
        message: `Antrag-Status: "${oldStatus || 'neu'}" → "${newStatus}" | Kunde: ${app.customer_name || app.customer_id} | Versicherer: ${app.insurer || '–'}`,
        related_entity_type: 'Application',
        related_entity_id: app.id,
        user_email: app.assigned_broker || null,
      });

      // Timeline: StatusHistory entry
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
    }

    // ── 2. FOLLOW-UP TASK bei Rückfrage/Vorbehalt ────────────────────────────
    if (statusChanged && REVIEW_STATUSES.includes(newStatus) && !REVIEW_STATUSES.includes(oldStatus)) {
      const dueDate = new Date();
      dueDate.setDate(dueDate.getDate() + 3);

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
    }

    // ── 3. AUTOMATISCHE VERTRAGSERSTELLUNG + ERWARTETE PROVISION bei Annahme ──
    if (statusChanged && isNewAcceptance && app.customer_id) {
      // Duplikatschutz: prüfen über linked_application_id (direkt — kein race-window)
      const [existingByLink, existingByCustomer] = await Promise.all([
        base44.asServiceRole.entities.Contract.filter({ linked_application_id: app.id }),
        base44.asServiceRole.entities.Contract.filter({ customer_id: app.customer_id }),
      ]);
      const existingContracts = [...existingByLink, ...existingByCustomer];

      const alreadyLinked = existingContracts.some(c =>
        c.linked_application_id === app.id ||
        (app.linked_contract_id && c.id === app.linked_contract_id)
      );

      const premiumMonthly = app.estimated_premium_monthly || null;
      const premiumYearly = app.estimated_premium_yearly || (premiumMonthly ? Math.round(premiumMonthly * 12 * 100) / 100 : null);

      if (!alreadyLinked) {
        // Guard: insurance_type und organization_id sind required auf Contract
        const insuranceType = app.insurance_type || app.sparte || 'other';
        const organizationId = app.organization_id || null;
        if (!organizationId) {
          console.warn(`[onApplicationUpdate] Kein organization_id auf Antrag ${app.id} — Vertragserstellung übersprungen`);
          return Response.json({ ok: true, skipped: 'no organization_id', application_id: app.id });
        }

        const newContract = await base44.asServiceRole.entities.Contract.create({
          customer_id: app.customer_id,
          customer_name: app.customer_name,
          primary_customer_id: app.primary_customer_id || app.customer_id,
          is_family_member: app.is_family_member || false,
          organization_id: organizationId,
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
          custom_status: 'aktiv',
          status: 'active',
          linked_application_id: app.id,
          // Erwartete Provision vom Antrag übernehmen (kein eigener Wert)
          commission_amount: app.commission_estimate || null,
          notes: buildContractNotes(app),
        });

        // Antrag mit Vertrags-ID verknüpfen
        await base44.asServiceRole.entities.Application.update(app.id, {
          linked_contract_id: newContract.id,
        });

        // ── ERWARTETE PROVISION aus application.commission_estimate ──────────
        // Einzige Quelle für erwartete Provisionen ist der Antrag.
        // Nur erstellen wenn commission_estimate vorhanden.
        const commissionEstimate = app.commission_estimate || null;
        if (commissionEstimate && commissionEstimate > 0) {
          // Duplikat-Check: kein expected-Eintrag für gleiche Policy/Application
          const existingExpected = await base44.asServiceRole.entities.CommissionEntry.filter({
            policy_number: app.policy_number || '',
          });
          const hasExpected = existingExpected.some(e =>
            !e.archived &&
            !e.is_storno &&
            (e.provision_status === 'expected' || e.is_expected === true)
          );

          if (!hasExpected) {
            const customerData = await base44.asServiceRole.entities.Customer.filter({ id: app.customer_id })
              .then(r => r[0] || null).catch(() => null);

            await base44.asServiceRole.entities.CommissionEntry.create({
              // Referenzen
              policy_id: newContract.id,
              policy_number: app.policy_number || '',
              source_application_id: app.id,
              advisor_id: app.advisor_id || '',
              advisor_name: app.assigned_broker || '',
              organization_id: organizationId,
              organization_name: '',
              customer_id: app.customer_id,
              customer_name: app.customer_name || '',
              insurer: app.insurer || '',
              product_category: app.sparte || app.insurance_type || '',

              // Prämie als Referenz
              premium_yearly: premiumYearly || 0,
              start_date: app.contract_start_date || '',

              // Erwartete Provision — EINZIGE QUELLE: application.commission_estimate
              company_provision_amount: commissionEstimate,
              advisor_provision_percentage: null,
              advisor_provision_amount: null,
              provision_storno_percentage: 10,
              provision_payout_amount: null,
              provision_storno_amount: null,

              // Status: expected = noch nicht fakturiert, nur erwartet
              provision_status: 'expected',
              status: 'expected',
              is_expected: true,

              // Courtage leer (nicht relevant bei automatischer Erstellung)
              company_courtage_amount: null,
              advisor_courtage_percentage: null,
              advisor_courtage_amount: null,
              courtage_status: 'pending',

              entry_date: new Date().toISOString().split('T')[0],
              archived: false,
              is_storno: false,
              notes: `Erwartete Provision aus Antrag (commission_estimate: CHF ${commissionEstimate}) — wird ersetzt sobald real fakturiert`,
            });
          }
        }

        await base44.asServiceRole.entities.SystemLog.create({
          level: 'info',
          source: 'onApplicationUpdate',
          message: `Vertrag + erwartete Provision erstellt: ${app.customer_name} | ${app.insurer} | Provision: CHF ${commissionEstimate || 0}`,
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

    // ── 4. TASKS mit application_id automatisch auf completed setzen ─────────
    if (statusChanged && newStatus && newStatus !== oldStatus) {
      const linkedTasks = await base44.asServiceRole.entities.Task.filter({ application_id: app.id });
      const openLinkedTasks = linkedTasks.filter(t => t.status !== 'completed');
      if (openLinkedTasks.length > 0) {
        await Promise.all(openLinkedTasks.map(task =>
          base44.asServiceRole.entities.Task.update(task.id, {
            status: 'completed',
            completion_date: new Date().toISOString().slice(0, 10),
            notes: (task.notes ? task.notes + '\n' : '') + `Automatisch erledigt durch Statusänderung: ${newStatus}`,
          })
        ));
      }
    }

    // ── 5. LOG bei Ablehnung ──────────────────────────────────────────────────
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
      event_type: eventType,
      status_changed: statusChanged,
      old_status: oldStatus,
      new_status: newStatus,
    });

  } catch (error) {
    console.error('[onApplicationUpdate] ERROR:', error.message);
    return Response.json({ error: error.message }, { status: 500 });
  }
});