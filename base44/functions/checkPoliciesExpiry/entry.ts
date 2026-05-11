import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

/**
 * CHECK POLICIES EXPIRY — Täglicher Job
 * 
 * 1. Markiert abgelaufene Verträge als expired
 * 2. Erstellt automatisch Aufgaben bei:
 *    - 90 Tage vor Ablauf → Vertragsablauf erfassen + Aufgabe
 *    - 60 Tage → Wiedervorlage / Kunde kontaktieren
 *    - 30 Tage → Beratung empfehlen + Verkaufschance
 *    - Kündigungsfrist <= 30 Tage → Urgente Aufgabe
 * 3. Setzt process_status auf dem Contract
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

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const today = new Date().toISOString().split('T')[0];
    console.log(`[checkPoliciesExpiry] START date=${today}`);

    const contracts = await base44.asServiceRole.entities.Contract.list();
    const existingTasks = await base44.asServiceRole.entities.Task.list();

    let expiredCount = 0;
    let tasksCreated = 0;
    let vsCreated = 0;

    for (const c of contracts) {
      if (['cancelled', 'archived'].includes(c.status)) continue;

      const endDays = daysUntil(c.end_date);
      const cancelDays = daysUntil(c.cancellation_deadline);

      // ── 1. Vertrag abgelaufen → expired ─────────────────────────────────
      if (c.status === 'active' && c.end_date && today > c.end_date) {
        await base44.asServiceRole.entities.Contract.update(c.id, { status: 'expired' });
        expiredCount++;
        console.log(`[expired] ${c.customer_name} | ${c.insurer} | ${c.end_date}`);
      }

      // ── Aufgaben-Duplikat-Check (Vertragsablauf-Tasks für diese Policy) ──
      const hasTaskForContract = (taskType) => existingTasks.some(t =>
        t.contract_id === c.id &&
        t.task_type === taskType &&
        t.status !== 'completed'
      );

      // ── 2. 90 Tage vor Ablauf: process_status setzen + Aufgabe ──────────
      if (endDays !== null && endDays <= 90 && endDays > 60 && c.status !== 'expired') {
        if (!hasTaskForContract('renewal')) {
          await base44.asServiceRole.entities.Task.create({
            title: `Vertragsablauf prüfen — ${c.insurer} (${c.customer_name})`,
            description: `Vertrag läuft in ${endDays} Tagen ab. Verlängerung/Kündigung prüfen.`,
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

          if (c.process_status === 'neu' || !c.process_status) {
            await base44.asServiceRole.entities.Contract.update(c.id, { process_status: 'pruefung_offen' });
          }
        }
      }

      // ── 3. 60 Tage: Kunde kontaktieren ──────────────────────────────────
      if (endDays !== null && endDays <= 60 && endDays > 30 && c.status !== 'expired') {
        if (!hasTaskForContract('follow_up')) {
          await base44.asServiceRole.entities.Task.create({
            title: `Kunde kontaktieren — ${c.insurer} Verlängerung (${c.customer_name})`,
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

          if (!['kunde_kontaktieren', 'verlaengerung_vorbereiten', 'beratung_erfolgt', 'erledigt'].includes(c.process_status)) {
            await base44.asServiceRole.entities.Contract.update(c.id, { process_status: 'kunde_kontaktieren' });
          }
        }
      }

      // ── 4. 30 Tage: Dringende Beratung + Verkaufschance ─────────────────
      if (endDays !== null && endDays <= 30 && endDays >= 0 && c.status !== 'expired') {
        if (!hasTaskForContract('consultation')) {
          await base44.asServiceRole.entities.Task.create({
            title: `⚠️ DRINGEND: Beratung ${c.insurer} (${c.customer_name})`,
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

          // Verkaufschance automatisch erstellen
          const existingVs = await base44.asServiceRole.entities.Verkaufschance.filter({
            customer_id: c.customer_id,
            linked_contract_id: c.id,
          });
          if (existingVs.length === 0) {
            await base44.asServiceRole.entities.Verkaufschance.create({
              customer_id: c.customer_id,
              customer_name: c.customer_name,
              organization_id: c.organization_id,
              sparte: c.sparte || c.insurance_type,
              status: 'neu',
              linked_contract_id: c.id,
              title: `Verlängerung ${c.insurer} — ${c.customer_name}`,
              estimated_value: c.premium_yearly || 0,
              notes: `Automatisch erstellt — Vertrag läuft in ${endDays} Tagen ab.`,
              assigned_broker: c.assigned_broker || null,
            });
            vsCreated++;
          }

          if (!['verlaengerung_vorbereiten', 'beratung_erfolgt', 'erledigt'].includes(c.process_status)) {
            await base44.asServiceRole.entities.Contract.update(c.id, { process_status: 'verlaengerung_vorbereiten' });
          }
        }
      }

      // ── 5. Kündigungsfrist <= 30 Tage: Urgente Aufgabe ──────────────────
      if (cancelDays !== null && cancelDays <= 30 && cancelDays >= -30) {
        const hasCancelTask = existingTasks.some(t =>
          t.contract_id === c.id &&
          t.task_type === 'general' &&
          t.title?.includes('Kündigungsfrist') &&
          t.status !== 'completed'
        );
        if (!hasCancelTask) {
          await base44.asServiceRole.entities.Task.create({
            title: `⚠️ Kündigungsfrist läuft ab — ${c.insurer} (${c.customer_name})`,
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
        }
      }
    }

    console.log(`[checkPoliciesExpiry] ✅ DONE: ${expiredCount} expired, ${tasksCreated} tasks, ${vsCreated} VS created`);
    return Response.json({ success: true, date: today, expiredCount, tasksCreated, vsCreated });

  } catch (error) {
    console.error(`[checkPoliciesExpiry] ERROR: ${error.message}`);
    return Response.json({ success: false, error: error.message }, { status: 500 });
  }
});