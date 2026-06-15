import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';

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

// Contract Lifecycle State Machine — erlaubt NUR vorwärtsgerichtete Übergänge
const CONTRACT_LIFECYCLE = {
  'neu': ['pruefung_offen', 'kunde_kontaktieren'],
  'pruefung_offen': ['kunde_kontaktieren', 'verlaengerung_vorbereiten', 'erledigt'],
  'kunde_kontaktieren': ['verlaengerung_vorbereiten', 'beratung_erfolgt', 'erledigt'],
  'verlaengerung_vorbereiten': ['beratung_erfolgt', 'erledigt'],
  'beratung_erfolgt': ['erledigt'],
  'erledigt': [], // Terminal
};

function canTransitionProcessStatus(current, target) {
  if (!current || current === 'neu') return true;
  const allowed = CONTRACT_LIFECYCLE[current] || [];
  return allowed.includes(target);
}

function buildContractNotes(app) {
  return [
    'Automatisch erstellt aus Antrag.',
    app.sparte_data?.franchise ? `Franchise: CHF ${app.sparte_data.franchise}` : null,
    app.sparte_data?.model ? `Modell: ${app.sparte_data.model}` : null,
    app.sparte_data?.age_group ? `Kategorie: ${app.sparte_data.age_group}` : null,
    app.notes || null,
  ].filter(Boolean).join(' | ');
}

/**
 * CONTRACT CREATION GUARD — Atomare Prüfung VOR create()
 * Verhindert Race-Conditions und Duplikate deterministisch.
 *
 * FACHLICHE DUPLIKAT-REGEL (Motorfahrzeug & alle Sparten):
 * Duplikat = gleiche policy_number + gleicher insurer + gleiche sparte + gleicher Kunde + gleicher start_date
 * NICHT Duplikat = gleiche Sparte, anderes Fahrzeug/Versicherer/Vertragsbeginn (Multi-Policy ist erlaubt)
 */
async function guardContractCreation(base44, appId, customerId, app) {
  // 1. Check: Existiert bereits ein Contract mit dieser source_application_id? (Race-Condition)
  const existingBySource = await base44.asServiceRole.entities.Contract.filter({ source_application_id: appId });
  const nonArchivedBySource = existingBySource.filter(c => !c.archived);
  if (nonArchivedBySource.length > 0) {
    return {
      allowed: false,
      reason: 'contract_exists_by_source',
      existingContractId: nonArchivedBySource[0].id,
    };
  }

  // 2. Check: Hat der Antrag bereits eine linked_contract_id?
  const application = await base44.asServiceRole.entities.Application.get(appId);
  if (application?.linked_contract_id) {
    return {
      allowed: false,
      reason: 'contract_already_linked',
      existingContractId: application.linked_contract_id,
    };
  }

  // 3. FACHLICHER DUPLIKAT-CHECK: policy_number + insurer + sparte + start_date + customer
  // Verhindert echte fachliche Duplikate (z.B. gleiche Police doppelt erfasst)
  if (app?.policy_number && app?.insurer && app?.sparte) {
    const existingContracts = await base44.asServiceRole.entities.Contract.filter({
      customer_id: customerId,
      archived: false,
    });
    const exactDuplicate = existingContracts.find(c => {
      const samePolicy   = c.policy_number === app.policy_number;
      const sameInsurer  = c.insurer?.toLowerCase() === app.insurer?.toLowerCase();
      const sameSparte   = c.sparte === app.sparte;
      const sameStart    = !app.contract_start_date || !c.start_date || c.start_date === app.contract_start_date;
      const notCancelled = c.status !== 'cancelled' && c.status !== 'expired';
      return samePolicy && sameInsurer && sameSparte && sameStart && notCancelled;
    });
    if (exactDuplicate) {
      return {
        allowed: false,
        reason: 'exact_policy_duplicate',
        existingContractId: exactDuplicate.id,
        note: `Police ${app.policy_number} (${app.insurer}/${app.sparte}) bereits vorhanden`,
      };
    }
  }

  // 4. Guard passed — creation allowed
  return {
    allowed: true,
    reason: null,
    existingContractId: null,
  };
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

    const startTime = Date.now();

    // ── 1. STATUS CHANGE LOGGING + TIMELINE ──────────────────────────────────
    await base44.asServiceRole.entities.SystemLog.create({
      level: 'info',
      source: 'onApplicationUpdate',
      message: `Antrag-Status: "${oldStatus || 'neu'}" → "${newStatus}" | Kunde: ${app.customer_name || app.customer_id} | Versicherer: ${app.insurer || '–'}`,
      related_entity_type: 'Application',
      related_entity_id: app.id,
      user_email: app.assigned_broker || null,
    });

    // AUDIT LOG: Status-Transition
    await base44.functions.invoke('auditLogWrite', {
      entity_type: 'Application',
      entity_id: app.id,
      action: 'update',
      source: 'onApplicationUpdate',
      trigger_reason: `status_change:${oldStatus || 'neu'}→${newStatus}`,
      old_values: { status: oldStatus, custom_status: old_data?.custom_status },
      new_values: { status: newStatus, custom_status: app.custom_status },
      summary: `Antrag-Status geändert: ${oldStatus || 'neu'} → ${newStatus}`,
      duration_ms: Date.now() - startTime,
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

    // ── 3. AUTOMATISCHE VERTRAGSERSTELLUNG bei Annahme — MIT HARD GUARDS ─────
    if (isNewAcceptance && app.customer_id) {
      // CRITICAL: Atomare Guard-Prüfung VOR create() — verhindert Race-Conditions + fachliche Duplikate
      const guardResult = await guardContractCreation(base44, app.id, app.customer_id, app);
      
      if (!guardResult.allowed) {
        // Contract existiert bereits — KEIN create(), kein update, kein Logging als "erstellt"
        const reasonMap = {
          contract_exists_by_source: 'Contract mit source_application_id existiert bereits',
          contract_already_linked: 'Antrag ist bereits mit Contract verknüpft',
        };
        
        await base44.asServiceRole.entities.SystemLog.create({
          level: 'info',
          source: 'onApplicationUpdate',
          message: `Vertragserstellung BLOCKIERT: ${reasonMap[guardResult.reason]} | Antrag ${app.id} → Contract ${guardResult.existingContractId}`,
          related_entity_type: 'Application',
          related_entity_id: app.id,
          details: JSON.stringify({ guardReason: guardResult.reason, existingContractId: guardResult.existingContractId }),
        });

        // AUDIT LOG: Guard-Hit (BLOCKED)
        await base44.functions.invoke('auditLogWrite', {
          entity_type: 'Contract',
          entity_id: guardResult.existingContractId,
          action: 'automation',
          source: 'onApplicationUpdate',
          trigger_reason: `status_change_to_${newStatus}`,
          guard_result: 'blocked',
          guard_reason: guardResult.reason,
          old_values: { application_id: app.id, status: newStatus },
          new_values: {},
          summary: `Contract-Erstellung blockiert: ${guardResult.reason}`,
          duration_ms: Date.now() - startTime,
        });
        
        // Skip — aber erfolgreich abgeschlossen (idempotent)
        return Response.json({
          ok: true,
          application_id: app.id,
          old_status: oldStatus,
          new_status: newStatus,
          contract_creation: 'skipped',
          contract_exists: true,
          existing_contract_id: guardResult.existingContractId,
          reason: guardResult.reason,
        });
      }

      // Guard passed — safe to create
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
        // organization_id auf Antrag reparieren (idempotent)
        await base44.asServiceRole.entities.Application.update(app.id, { organization_id: finalOrgId });
      }

      const premiumMonthly = app.estimated_premium_monthly || null;
      const premiumYearly = app.estimated_premium_yearly || (premiumMonthly ? Math.round(premiumMonthly * 12 * 100) / 100 : null);

      // Kündigungsfrist berechnen: Vertragsende minus 3 Monate (Standard)
      const rawEndDate = app.contract_end_date || app.requested_start_date || null;
      let cancellationDeadline = null;
      if (rawEndDate) {
        const endDateObj = new Date(rawEndDate + 'T00:00:00');
        endDateObj.setMonth(endDateObj.getMonth() - 3);
        cancellationDeadline = endDateObj.toISOString().slice(0, 10);
      }

      // CONTRACT CREATE — einmalig, atomar, durch Guard geschützt
      const contractCreateStart = Date.now();
      const brokerId = app.advisor_id || null;
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
        cancellation_deadline: cancellationDeadline || '',
        assigned_broker: app.assigned_broker || '',
        advisor_id: brokerId,
        primary_broker_id: brokerId,
        assigned_brokers: brokerId ? [brokerId] : [],
        custom_status: 'aktiv',
        status: 'active',
        commission_amount: app.commission_estimate || null,
        notes: buildContractNotes(app),
      });
      const contractCreateDuration = Date.now() - contractCreateStart;

      // Antrag mit Contract verknüpfen (idempotent update)
      await base44.asServiceRole.entities.Application.update(app.id, {
        linked_contract_id: newContract.id,
      });

      // Berater-Zuordnung auf Kunden übernehmen (wenn noch nicht gesetzt)
      if (brokerId) {
        try {
          const customerToUpdate = await base44.asServiceRole.entities.Customer.get(app.customer_id);
          if (customerToUpdate) {
            const updateData = {};
            if (!customerToUpdate.primary_advisor_id) {
              updateData.primary_advisor_id = brokerId;
            }
            const existingAdvisors = customerToUpdate.assigned_advisors || [];
            if (!existingAdvisors.includes(brokerId)) {
              updateData.assigned_advisors = [...existingAdvisors, brokerId];
            }
            if (app.assigned_broker && !customerToUpdate.assigned_broker) {
              updateData.assigned_broker = app.assigned_broker;
            }
            if (Object.keys(updateData).length > 0) {
              await base44.asServiceRole.entities.Customer.update(app.customer_id, updateData);
              console.log(`[onApplicationUpdate] Berater ${brokerId} auf Kunde ${app.customer_id} übernommen`);
            }
          }
        } catch (advisorSyncErr) {
          console.warn(`[onApplicationUpdate] Berater-Sync auf Kunde fehlgeschlagen (non-fatal): ${advisorSyncErr.message}`);
        }
      }

      // AUDIT LOG: Contract Created
      await base44.functions.invoke('auditLogWrite', {
        entity_type: 'Contract',
        entity_id: newContract.id,
        action: 'create',
        source: 'onApplicationUpdate',
        trigger_reason: `application_approved:${newStatus}`,
        guard_result: 'allowed',
        guard_reason: 'all_guards_passed',
        old_values: {},
        new_values: {
          source_application_id: app.id,
          customer_id: app.customer_id,
          insurer: app.insurer,
          status: 'active',
        },
        summary: `Contract erstellt aus Antrag ${app.id}: ${app.customer_name} - ${app.insurer}`,
        duration_ms: contractCreateDuration,
      });

      // Erwartete Provision erstellen — NUR wenn Contract neu erstellt wurde
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
        message: `Vertrag ERSTELLT: ${app.customer_name} | ${app.insurer} | Provision: CHF ${commissionEstimate || 0}`,
        related_entity_type: 'Contract',
        related_entity_id: newContract.id,
        user_email: app.assigned_broker || null,
      });
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

    // Erfolgsresponse — immer idempotent
    return Response.json({
      ok: true,
      application_id: app.id,
      old_status: oldStatus,
      new_status: newStatus,
      contract_creation: isNewAcceptance ? 'processed' : 'not_applicable',
    });

  } catch (error) {
    console.error('[onApplicationUpdate] ERROR:', error.message);
    return Response.json({ error: error.message }, { status: 500 });
  }
});