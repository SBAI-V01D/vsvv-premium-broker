import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';

/**
 * CHECK POLICIES EXPIRY — Täglicher Job (06:30 UTC)
 * v2.0 — Mit Audit-Integration (Phase 1C)
 *
 * ANTI-DUPLICATION RULES:
 * - Pro Vertrag + Schwellenwert (90/60/30d + Kündigungsfrist) darf exakt EINE offene Task existieren
 * - Duplikatschutz: contract_id + task_type
 * - Verkaufschancen: nur wenn KEIN offener VS mit linked_contract_id existiert
 * - process_status wird NUR vorwärts geschrieben (nie rückwärts)
 *
 * AUDIT INTEGRATION:
 * - Level 1: Contract expired, VS created (Critical Business)
 * - Level 2: Task created, Status advanced (Lifecycle)
 * - Level 4: Duplicate skipped (Debug)
 * - ALLE Audit-Writes sind async/non-blocking
 * - Ein gemeinsamer correlation_id pro Scheduler-Run
 */

const addDays = (dateStr, days) => {
  const d = new Date(dateStr + 'T00:00:00Z');
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().split('T')[0];
};

const daysUntil = (dateStr) => {
  if (!dateStr) return null;
  return Math.ceil((new Date(dateStr + 'T00:00:00Z') - new Date()) / 86400000);
};

const hasOpenTask = (existingTasks, contractId, taskType) => {
  return existingTasks.some(t => {
    if (t.status === 'completed') return false;
    if (t.contract_id === contractId && t.task_type === taskType) return true;
    return false;
  });
};

const hasOpenVerkaufschance = (existingVs, contract) => {
  return existingVs.some(v => {
    if (['gewonnen', 'verloren'].includes(v.status)) return false;
    if (v.linked_contract_id === contract.id) return true;
    return false;
  });
};

const PROCESS_STATUS_ORDER = ['neu', 'pruefung_offen', 'kunde_kontaktieren', 'verlaengerung_vorbereiten', 'beratung_erfolgt', 'erledigt'];
const canAdvanceStatus = (current, target) => {
  const ci = PROCESS_STATUS_ORDER.indexOf(current || 'neu');
  const ti = PROCESS_STATUS_ORDER.indexOf(target);
  return ti > ci;
};

// ─── Audit Helper (async, non-blocking) ────────────────────────────────────
const writeAudit = (base44, entry) => {
  base44.entities.AuditLog.create(entry).catch(err => {
    console.error('[AUDIT] Non-blocking write failed:', err.message);
  });
};

const makeAuditBase = (correlationId, runDate, runId) => ({
  audit_schema_version: '1.0',
  trigger_type: 'scheduled',
  trigger_source: 'checkPoliciesExpiry',
  actor_type: 'scheduler',
  actor_id: 'daily_expiry_check',
  actor_name: 'Daily Expiry Check',
  process_type: 'renewal',
  correlation_id: correlationId,
  retry_attempt: 0,
  anomaly_detected: false,
  recovered: false,
  side_effects: [],
  related_entities: [],
  metadata: { run_id: runId, run_date: runDate },
});

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const today = new Date().toISOString().split('T')[0];
    const date = today.replace(/-/g, '');
    const runRandom = Math.random().toString(36).slice(2, 8).toUpperCase();

    // Gemeinsame Correlation-ID für den gesamten Scheduler-Run
    const runCorrelationId = `REN-${date}-${runRandom}`;
    const runId = `renewal_run_${date}_${runRandom}`;
    const auditBase = makeAuditBase(runCorrelationId, today, runId);

    console.log(`[checkPoliciesExpiry] START date=${today} correlation=${runCorrelationId}`);

    const [contracts, existingTasks, existingVs] = await Promise.all([
      base44.asServiceRole.entities.Contract.list(),
      base44.asServiceRole.entities.Task.list(),
      base44.asServiceRole.entities.Verkaufschance.list(),
    ]);

    let expiredCount = 0;
    let tasksCreated = 0;
    let vsCreated = 0;
    let skippedDuplicates = 0;
    let eventSequence = 0;

    for (const c of contracts) {
      if (['cancelled', 'archived'].includes(c.status)) continue;
      if (c.process_status === 'erledigt' || c.process_status === 'beratung_erfolgt') continue;

      const endDays = daysUntil(c.end_date);
      const cancelDays = daysUntil(c.cancellation_deadline);
      const insurer = c.insurer || '';
      const random = () => Math.random().toString(36).slice(2, 8).toUpperCase();

      // ── 1. Vertrag abgelaufen → expired ──────────────────────────────────
      if (c.status === 'active' && c.end_date && today > c.end_date) {
        await base44.asServiceRole.entities.Contract.update(c.id, { status: 'expired' });
        expiredCount++;
        eventSequence++;

        writeAudit(base44, {
          ...auditBase,
          audit_id: `AUD-${date}-${random()}`,
          audit_level: 1,
          audit_level_name: 'critical_business',
          timestamp: new Date().toISOString(),
          process_id: runId,
          process_stage: 'contract_expiry',
          event_id: `EVT-${date}-EXP${eventSequence}`,
          event_type: 'contract_expired',
          event_sequence: eventSequence,
          entity_type: 'contract',
          entity_id: c.id,
          action: 'update',
          decision_code: 'CONTRACT_EXPIRED_STATUS_UPDATED',
          decision_logic: `Contract ${c.id} passed end_date ${c.end_date} → set to expired`,
          guard_evaluated: 'contract_end_date_passed',
          guard_result: 'allowed',
          guard_reason: `end_date=${c.end_date} < today=${today}`,
          business_severity_type: 'customer_impact',
          business_severity_level: 'high',
          technical_severity_type: 'info',
          technical_severity_level: 'low',
          previous_state_summary: { status: 'active', end_date: c.end_date, customer: c.customer_name },
          new_state_summary: { status: 'expired' },
          business_impact_financial_chf: c.premium_yearly || 0,
          business_impact_description: `Contract expired: ${insurer} | ${c.customer_name} | CHF ${c.premium_yearly || 0}`,
          related_entities: [{ entity_type: 'customer', entity_id: c.customer_id, relationship: 'contract_holder' }],
          duration_ms: 0,
        });

        console.log(`[expired] ${c.customer_name} | ${insurer} | ${c.end_date} | audit=${runCorrelationId}`);
        continue;
      }

      // ── 2. 90 Tage vor Ablauf: Prüfungs-Aufgabe ──────────────────────────
      if (endDays !== null && endDays <= 90 && endDays > 60 && c.status === 'active') {
        if (!hasOpenTask(existingTasks, c.id, 'renewal')) {
          const newTask = await base44.asServiceRole.entities.Task.create({
            title: `Vertragsablauf prüfen — ${insurer} (${c.customer_name || ''})`,
            description: `Vertrag läuft in ${endDays} Tagen ab. Verlängerung oder Kündigung prüfen.`,
            customer_id: c.customer_id,
            customer_name: c.customer_name,
            contract_id: c.id,
            priority: 'medium',
            status: 'open',
            task_type: 'renewal',
            due_date: addDays(today, 14),
            assigned_to: c.assigned_broker || null,
          });
          tasksCreated++;
          eventSequence++;

          writeAudit(base44, {
            ...auditBase,
            audit_id: `AUD-${date}-${random()}`,
            audit_level: 2,
            audit_level_name: 'lifecycle_transition',
            timestamp: new Date().toISOString(),
            process_id: runId,
            process_stage: 'renewal_task_creation',
            event_id: `EVT-${date}-T90-${eventSequence}`,
            event_type: 'task_renewal_created',
            event_sequence: eventSequence,
            entity_type: 'task',
            entity_id: newTask?.id || 'unknown',
            action: 'create',
            decision_code: 'TASK_CREATED_90D_RENEWAL',
            decision_logic: `90-day renewal task created for contract ${c.id} (${endDays} days left)`,
            guard_evaluated: 'no_existing_renewal_task',
            guard_result: 'allowed',
            guard_reason: 'No open renewal task found for contract',
            business_severity_type: 'operational',
            business_severity_level: 'medium',
            technical_severity_type: 'info',
            technical_severity_level: 'low',
            previous_state_summary: { process_status: c.process_status },
            new_state_summary: { task_created: true, task_type: 'renewal', days_left: endDays },
            business_impact_financial_chf: c.premium_yearly || 0,
            business_impact_description: `Renewal task created: ${insurer} | ${c.customer_name} | CHF ${c.premium_yearly || 0}`,
            related_entities: [{ entity_type: 'contract', entity_id: c.id, relationship: 'triggered_by' }],
            duration_ms: 0,
          });

          if (canAdvanceStatus(c.process_status, 'pruefung_offen')) {
            await base44.asServiceRole.entities.Contract.update(c.id, { process_status: 'pruefung_offen' });
          }
        } else {
          skippedDuplicates++;
          eventSequence++;

          writeAudit(base44, {
            ...auditBase,
            audit_id: `AUD-${date}-${random()}`,
            audit_level: 4,
            audit_level_name: 'debug_verbose',
            timestamp: new Date().toISOString(),
            process_id: runId,
            process_stage: 'renewal_task_creation',
            event_id: `EVT-${date}-SKIP${eventSequence}`,
            event_type: 'task_creation_skipped_duplicate',
            event_sequence: eventSequence,
            entity_type: 'task',
            entity_id: c.id,
            action: 'skip',
            decision_code: 'TASK_SKIPPED_DUPLICATE_90D',
            decision_logic: `Skipped: open renewal task already exists for contract ${c.id}`,
            guard_evaluated: 'no_existing_renewal_task',
            guard_result: 'blocked',
            guard_reason: 'Open renewal task already exists',
            business_severity_type: 'operational',
            business_severity_level: 'low',
            technical_severity_type: 'info',
            technical_severity_level: 'low',
            previous_state_summary: {},
            new_state_summary: { skipped: true, reason: 'duplicate_task' },
            business_impact_financial_chf: 0,
            business_impact_description: 'Task creation skipped — duplicate guard',
            duration_ms: 0,
          });
        }
      }

      // ── 3. 60 Tage: Kundenkontakt-Aufgabe ────────────────────────────────
      if (endDays !== null && endDays <= 60 && endDays > 30 && c.status === 'active') {
        if (!hasOpenTask(existingTasks, c.id, 'follow_up')) {
          const newTask = await base44.asServiceRole.entities.Task.create({
            title: `Kunde kontaktieren — ${insurer} Verlängerung (${c.customer_name || ''})`,
            description: `Vertrag läuft in ${endDays} Tagen ab. Kunden anrufen und Verlängerungsoptionen besprechen.`,
            customer_id: c.customer_id,
            customer_name: c.customer_name,
            contract_id: c.id,
            priority: 'high',
            status: 'open',
            task_type: 'follow_up',
            due_date: addDays(today, 7),
            assigned_to: c.assigned_broker || null,
          });
          tasksCreated++;
          eventSequence++;

          writeAudit(base44, {
            ...auditBase,
            audit_id: `AUD-${date}-${random()}`,
            audit_level: 2,
            audit_level_name: 'lifecycle_transition',
            timestamp: new Date().toISOString(),
            process_id: runId,
            process_stage: 'customer_contact_task_creation',
            event_id: `EVT-${date}-T60-${eventSequence}`,
            event_type: 'task_follow_up_created',
            event_sequence: eventSequence,
            entity_type: 'task',
            entity_id: newTask?.id || 'unknown',
            action: 'create',
            decision_code: 'TASK_CREATED_60D_FOLLOW_UP',
            decision_logic: `60-day follow-up task created for contract ${c.id} (${endDays} days left)`,
            guard_evaluated: 'no_existing_follow_up_task',
            guard_result: 'allowed',
            guard_reason: 'No open follow-up task found',
            business_severity_type: 'operational',
            business_severity_level: 'medium',
            technical_severity_type: 'info',
            technical_severity_level: 'low',
            previous_state_summary: { process_status: c.process_status },
            new_state_summary: { task_created: true, task_type: 'follow_up', days_left: endDays },
            business_impact_financial_chf: c.premium_yearly || 0,
            business_impact_description: `Follow-up task created: ${insurer} | ${c.customer_name}`,
            related_entities: [{ entity_type: 'contract', entity_id: c.id, relationship: 'triggered_by' }],
            duration_ms: 0,
          });

          if (canAdvanceStatus(c.process_status, 'kunde_kontaktieren')) {
            await base44.asServiceRole.entities.Contract.update(c.id, { process_status: 'kunde_kontaktieren' });
          }
        } else {
          skippedDuplicates++;
          writeAudit(base44, {
            ...auditBase,
            audit_id: `AUD-${date}-${random()}`,
            audit_level: 4,
            audit_level_name: 'debug_verbose',
            timestamp: new Date().toISOString(),
            process_id: runId,
            process_stage: 'customer_contact_task_creation',
            event_id: `EVT-${date}-SKIP60-${eventSequence}`,
            event_type: 'task_creation_skipped_duplicate',
            event_sequence: ++eventSequence,
            entity_type: 'task',
            entity_id: c.id,
            action: 'skip',
            decision_code: 'TASK_SKIPPED_DUPLICATE_60D',
            decision_logic: `Skipped: open follow-up task already exists for contract ${c.id}`,
            guard_evaluated: 'no_existing_follow_up_task',
            guard_result: 'blocked',
            guard_reason: 'Open follow-up task already exists',
            business_severity_type: 'operational',
            business_severity_level: 'low',
            technical_severity_type: 'info',
            technical_severity_level: 'low',
            previous_state_summary: {},
            new_state_summary: { skipped: true },
            business_impact_financial_chf: 0,
            business_impact_description: 'Follow-up task skipped — duplicate guard',
            duration_ms: 0,
          });
        }
      }

      // ── 4. 30 Tage: Dringende Beratung + Verkaufschance ──────────────────
      if (endDays !== null && endDays <= 30 && endDays >= 0 && c.status === 'active') {
        if (!hasOpenTask(existingTasks, c.id, 'consultation')) {
          const newTask = await base44.asServiceRole.entities.Task.create({
            title: `DRINGEND: Beratung ${insurer} (${c.customer_name || ''})`,
            description: `Vertrag läuft in ${endDays} Tagen ab! Sofortige Beratung und Entscheid notwendig.`,
            customer_id: c.customer_id,
            customer_name: c.customer_name,
            contract_id: c.id,
            priority: 'urgent',
            status: 'open',
            task_type: 'consultation',
            due_date: addDays(today, 3),
            assigned_to: c.assigned_broker || null,
          });
          tasksCreated++;
          eventSequence++;

          writeAudit(base44, {
            ...auditBase,
            audit_id: `AUD-${date}-${random()}`,
            audit_level: 1,
            audit_level_name: 'critical_business',
            timestamp: new Date().toISOString(),
            process_id: runId,
            process_stage: 'urgent_consultation_task_creation',
            event_id: `EVT-${date}-T30-${eventSequence}`,
            event_type: 'task_urgent_consultation_created',
            event_sequence: eventSequence,
            entity_type: 'task',
            entity_id: newTask?.id || 'unknown',
            action: 'create',
            decision_code: 'TASK_CREATED_30D_URGENT',
            decision_logic: `URGENT: 30-day consultation task for contract ${c.id} (${endDays} days left)`,
            guard_evaluated: 'no_existing_consultation_task',
            guard_result: 'allowed',
            guard_reason: 'No open consultation task found',
            business_severity_type: 'financial',
            business_severity_level: 'high',
            technical_severity_type: 'info',
            technical_severity_level: 'low',
            previous_state_summary: { process_status: c.process_status, days_left: endDays },
            new_state_summary: { task_created: true, task_type: 'consultation', priority: 'urgent' },
            business_impact_financial_chf: c.premium_yearly || 0,
            business_impact_description: `URGENT task: ${insurer} | ${c.customer_name} | CHF ${c.premium_yearly || 0} at risk`,
            related_entities: [{ entity_type: 'contract', entity_id: c.id, relationship: 'triggered_by' }],
            duration_ms: 0,
          });

          if (canAdvanceStatus(c.process_status, 'verlaengerung_vorbereiten')) {
            await base44.asServiceRole.entities.Contract.update(c.id, { process_status: 'verlaengerung_vorbereiten' });
          }
        } else {
          skippedDuplicates++;
          writeAudit(base44, {
            ...auditBase,
            audit_id: `AUD-${date}-${random()}`,
            audit_level: 4,
            audit_level_name: 'debug_verbose',
            timestamp: new Date().toISOString(),
            process_id: runId,
            process_stage: 'urgent_consultation_task_creation',
            event_id: `EVT-${date}-SKIP30-${eventSequence}`,
            event_type: 'task_creation_skipped_duplicate',
            event_sequence: ++eventSequence,
            entity_type: 'task',
            entity_id: c.id,
            action: 'skip',
            decision_code: 'TASK_SKIPPED_DUPLICATE_30D',
            decision_logic: `Skipped: open consultation task already exists for contract ${c.id}`,
            guard_evaluated: 'no_existing_consultation_task',
            guard_result: 'blocked',
            guard_reason: 'Open consultation task already exists',
            business_severity_type: 'operational',
            business_severity_level: 'low',
            technical_severity_type: 'info',
            technical_severity_level: 'low',
            previous_state_summary: {},
            new_state_summary: { skipped: true },
            business_impact_financial_chf: 0,
            business_impact_description: 'Consultation task skipped — duplicate guard',
            duration_ms: 0,
          });
        }

        // Verkaufschance — NUR wenn noch keine verknüpft
        if (!hasOpenVerkaufschance(existingVs, c)) {
          const newVs = await base44.asServiceRole.entities.Verkaufschance.create({
            customer_id: c.customer_id,
            customer_name: c.customer_name,
            organization_id: c.organization_id,
            sparte: c.sparte || c.insurance_type,
            status: 'neu',
            linked_contract_id: c.id,
            title: `Verlängerung ${insurer} — ${c.customer_name || ''}`,
            estimated_value: c.premium_yearly || 0,
            notes: `Automatisch erstellt — Vertrag läuft in ${endDays} Tagen ab.`,
            assigned_broker: c.assigned_broker || null,
          });
          existingVs.push(newVs);
          vsCreated++;
          eventSequence++;

          writeAudit(base44, {
            ...auditBase,
            audit_id: `AUD-${date}-${random()}`,
            audit_level: 1,
            audit_level_name: 'critical_business',
            timestamp: new Date().toISOString(),
            process_id: runId,
            process_stage: 'sales_opportunity_creation',
            event_id: `EVT-${date}-VS30-${eventSequence}`,
            event_type: 'verkaufschance_created',
            event_sequence: eventSequence,
            entity_type: 'contract',
            entity_id: c.id,
            action: 'create',
            decision_code: 'VERKAUFSCHANCE_CREATED_30D',
            decision_logic: `Sales opportunity created for expiring contract ${c.id} (${endDays} days left)`,
            guard_evaluated: 'no_existing_verkaufschance',
            guard_result: 'allowed',
            guard_reason: 'No linked Verkaufschance found',
            business_severity_type: 'financial',
            business_severity_level: 'high',
            technical_severity_type: 'info',
            technical_severity_level: 'low',
            previous_state_summary: { linked_vs: false },
            new_state_summary: { vs_id: newVs?.id, vs_status: 'neu', estimated_value: c.premium_yearly },
            business_impact_financial_chf: c.premium_yearly || 0,
            business_impact_description: `Sales opportunity CHF ${c.premium_yearly || 0}: ${insurer} | ${c.customer_name}`,
            related_entities: [
              { entity_type: 'customer', entity_id: c.customer_id, relationship: 'potential_client' },
              { entity_type: 'contract', entity_id: c.id, relationship: 'expiring_contract' },
            ],
            duration_ms: 0,
          });
        } else {
          skippedDuplicates++;
        }
      }

      // ── 5. Kündigungsfrist <= 30 Tage ────────────────────────────────────
      if (cancelDays !== null && cancelDays <= 30 && cancelDays >= -30) {
        if (!hasOpenTask(existingTasks, c.id, 'general')) {
          const newTask = await base44.asServiceRole.entities.Task.create({
            title: `Kündigungsfrist läuft ab — ${insurer} (${c.customer_name || ''})`,
            description: cancelDays <= 0
              ? `Kündigungsfrist ist vor ${Math.abs(cancelDays)} Tagen abgelaufen! Sofort handeln.`
              : `Kündigungsfrist in ${cancelDays} Tagen. Entscheid: Kündigen oder verlängern?`,
            customer_id: c.customer_id,
            customer_name: c.customer_name,
            contract_id: c.id,
            priority: cancelDays <= 0 ? 'urgent' : 'high',
            status: 'open',
            task_type: 'general',
            due_date: addDays(today, Math.max(cancelDays, 1)),
            assigned_to: c.assigned_broker || null,
          });
          tasksCreated++;
          eventSequence++;

          writeAudit(base44, {
            ...auditBase,
            audit_id: `AUD-${date}-${random()}`,
            audit_level: cancelDays <= 0 ? 1 : 2,
            audit_level_name: cancelDays <= 0 ? 'critical_business' : 'lifecycle_transition',
            timestamp: new Date().toISOString(),
            process_id: runId,
            process_stage: 'cancellation_deadline_alert',
            event_id: `EVT-${date}-CXL-${eventSequence}`,
            event_type: cancelDays <= 0 ? 'cancellation_deadline_overdue' : 'cancellation_deadline_alert',
            event_sequence: eventSequence,
            entity_type: 'task',
            entity_id: newTask?.id || 'unknown',
            action: 'create',
            decision_code: cancelDays <= 0 ? 'TASK_CREATED_CANCELLATION_OVERDUE' : 'TASK_CREATED_CANCELLATION_DEADLINE',
            decision_logic: `Cancellation deadline task: ${cancelDays} days ${cancelDays <= 0 ? 'OVERDUE' : 'remaining'}`,
            guard_evaluated: 'cancellation_deadline_check',
            guard_result: 'allowed',
            guard_reason: `cancelDays=${cancelDays}`,
            business_severity_type: 'financial',
            business_severity_level: cancelDays <= 0 ? 'critical' : 'high',
            technical_severity_type: 'info',
            technical_severity_level: 'low',
            previous_state_summary: { cancellation_deadline: c.cancellation_deadline, cancel_days: cancelDays },
            new_state_summary: { task_created: true, priority: cancelDays <= 0 ? 'urgent' : 'high' },
            business_impact_financial_chf: c.premium_yearly || 0,
            business_impact_description: `Cancellation deadline: ${insurer} | ${c.customer_name} | ${cancelDays <= 0 ? 'OVERDUE' : cancelDays + 'd left'}`,
            related_entities: [{ entity_type: 'contract', entity_id: c.id, relationship: 'triggered_by' }],
            duration_ms: 0,
          });
        } else {
          skippedDuplicates++;
        }
      }
    }

    // ── RUN SUMMARY AUDIT ─────────────────────────────────────────────────
    writeAudit(base44, {
      ...auditBase,
      audit_id: `AUD-${date}-SUM${runRandom}`,
      audit_level: 2,
      audit_level_name: 'lifecycle_transition',
      timestamp: new Date().toISOString(),
      process_id: runId,
      process_stage: 'run_summary',
      event_id: `EVT-${date}-SUMMARY`,
      event_type: 'scheduler_run_completed',
      event_sequence: eventSequence + 1,
      entity_type: 'contract',
      entity_id: 'all',
      action: 'allow',
      decision_code: 'EXPIRY_CHECK_RUN_COMPLETED',
      decision_logic: `Daily expiry check completed: ${expiredCount} expired, ${tasksCreated} tasks, ${vsCreated} VS, ${skippedDuplicates} skipped`,
      guard_evaluated: null,
      guard_result: null,
      guard_reason: null,
      business_severity_type: 'operational',
      business_severity_level: expiredCount > 0 ? 'high' : 'low',
      technical_severity_type: 'info',
      technical_severity_level: 'low',
      previous_state_summary: {},
      new_state_summary: {
        expired: expiredCount,
        tasks_created: tasksCreated,
        vs_created: vsCreated,
        duplicates_skipped: skippedDuplicates,
        total_events: eventSequence,
      },
      business_impact_financial_chf: 0,
      business_impact_description: `Scheduler run: ${tasksCreated} tasks created, ${vsCreated} VS, ${expiredCount} expired`,
      duration_ms: 0,
    });

    console.log(`[checkPoliciesExpiry] DONE: ${expiredCount} expired, ${tasksCreated} tasks, ${vsCreated} VS, ${skippedDuplicates} skipped | correlation=${runCorrelationId}`);
    return Response.json({
      success: true,
      date: today,
      correlation_id: runCorrelationId,
      expiredCount,
      tasksCreated,
      vsCreated,
      skippedDuplicates,
      audit_events_generated: eventSequence + 1,
    });

  } catch (error) {
    console.error(`[checkPoliciesExpiry] ERROR: ${error.message}`);
    return Response.json({ success: false, error: error.message }, { status: 500 });
  }
});