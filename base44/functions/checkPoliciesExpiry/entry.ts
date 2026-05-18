import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

/**
 * CHECK POLICIES EXPIRY — Täglicher Job (06:30 UTC)
 *
 * ANTI-DUPLICATION RULES:
 * - Pro Vertrag + Schwellenwert (90/60/30d + Kündigungsfrist) darf exakt EINE offene Task existieren
 * - Duplikatschutz: contract_id + task_type + title-Fragment (Fallback für alte Tasks ohne contract_id)
 * - Verkaufschancen: nur wenn KEIN offener VS mit linked_contract_id existiert
 * - process_status wird NUR vorwärts geschrieben (nie rückwärts)
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

// Strikte Duplikatprüfung: contract_id + task_type (atomar)
const hasOpenTask = (existingTasks, contractId, taskType) => {
  return existingTasks.some(t => {
    if (t.status === 'completed') return false;
    // Primär: contract_id + task_type (eindeutig)
    if (t.contract_id === contractId && t.task_type === taskType) return true;
    return false;
  });
};

// Strikte VS-Duplikatprüfung: linked_contract_id ODER customer_id + sparte + nicht verloren
const hasOpenVerkaufschance = (existingVs, contract) => {
  return existingVs.some(v => {
    if (['gewonnen', 'verloren'].includes(v.status)) return false;
    if (v.linked_contract_id === contract.id) return true;
    return false;
  });
};

// process_status Reihenfolge — nie rückwärts
const PROCESS_STATUS_ORDER = ['neu', 'pruefung_offen', 'kunde_kontaktieren', 'verlaengerung_vorbereiten', 'beratung_erfolgt', 'erledigt'];
const canAdvanceStatus = (current, target) => {
  const ci = PROCESS_STATUS_ORDER.indexOf(current || 'neu');
  const ti = PROCESS_STATUS_ORDER.indexOf(target);
  return ti > ci;
};

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const today = new Date().toISOString().split('T')[0];
    console.log(`[checkPoliciesExpiry] START date=${today}`);

    // Alles auf einmal laden — minimale DB-Calls
    const [contracts, existingTasks, existingVs] = await Promise.all([
      base44.asServiceRole.entities.Contract.list(),
      base44.asServiceRole.entities.Task.list(),
      base44.asServiceRole.entities.Verkaufschance.list(),
    ]);

    let expiredCount = 0;
    let tasksCreated = 0;
    let vsCreated = 0;
    let skippedDuplicates = 0;

    for (const c of contracts) {
      if (['cancelled', 'archived'].includes(c.status)) continue;
      // Erledigte Prozesse überspringen
      if (c.process_status === 'erledigt' || c.process_status === 'beratung_erfolgt') continue;

      const endDays = daysUntil(c.end_date);
      const cancelDays = daysUntil(c.cancellation_deadline);
      const insurer = c.insurer || '';

      // ── 1. Vertrag abgelaufen → expired ────────────────────────────────
      if (c.status === 'active' && c.end_date && today > c.end_date) {
        await base44.asServiceRole.entities.Contract.update(c.id, { status: 'expired' });
        expiredCount++;
        console.log(`[expired] ${c.customer_name} | ${insurer} | ${c.end_date}`);
        continue; // Keine weiteren Tasks für abgelaufene
      }

      // ── 2. 90 Tage vor Ablauf: Prüfungs-Aufgabe ────────────────────────
      if (endDays !== null && endDays <= 90 && endDays > 60 && c.status === 'active') {
        if (!hasOpenTask(existingTasks, c.id, 'renewal')) {
          await base44.asServiceRole.entities.Task.create({
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
          if (canAdvanceStatus(c.process_status, 'pruefung_offen')) {
            await base44.asServiceRole.entities.Contract.update(c.id, { process_status: 'pruefung_offen' });
          }
        } else {
          skippedDuplicates++;
        }
      }

      // ── 3. 60 Tage: Kundenkontakt-Aufgabe ──────────────────────────────
      if (endDays !== null && endDays <= 60 && endDays > 30 && c.status === 'active') {
        if (!hasOpenTask(existingTasks, c.id, 'follow_up')) {
          await base44.asServiceRole.entities.Task.create({
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
          if (canAdvanceStatus(c.process_status, 'kunde_kontaktieren')) {
            await base44.asServiceRole.entities.Contract.update(c.id, { process_status: 'kunde_kontaktieren' });
          }
        } else {
          skippedDuplicates++;
        }
      }

      // ── 4. 30 Tage: Dringende Beratung + Verkaufschance ────────────────
      if (endDays !== null && endDays <= 30 && endDays >= 0 && c.status === 'active') {
        if (!hasOpenTask(existingTasks, c.id, 'consultation')) {
          await base44.asServiceRole.entities.Task.create({
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
          if (canAdvanceStatus(c.process_status, 'verlaengerung_vorbereiten')) {
            await base44.asServiceRole.entities.Contract.update(c.id, { process_status: 'verlaengerung_vorbereiten' });
          }
        } else {
          skippedDuplicates++;
        }

        // Verkaufschance — NUR wenn noch keine mit diesem Vertrag verknüpft
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
          existingVs.push(newVs); // In-Memory aktualisieren für weitere Loop-Iterationen
          vsCreated++;
        } else {
          skippedDuplicates++;
        }
      }

      // ── 5. Kündigungsfrist <= 30 Tage: Urgente Aufgabe ─────────────────
      if (cancelDays !== null && cancelDays <= 30 && cancelDays >= -30) {
        if (!hasOpenTask(existingTasks, c.id, 'general')) {
          await base44.asServiceRole.entities.Task.create({
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
        } else {
          skippedDuplicates++;
        }
      }
    }

    console.log(`[checkPoliciesExpiry] DONE: ${expiredCount} expired, ${tasksCreated} tasks, ${vsCreated} VS, ${skippedDuplicates} duplicates skipped`);
    return Response.json({ success: true, date: today, expiredCount, tasksCreated, vsCreated, skippedDuplicates });

  } catch (error) {
    console.error(`[checkPoliciesExpiry] ERROR: ${error.message}`);
    return Response.json({ success: false, error: error.message }, { status: 500 });
  }
});