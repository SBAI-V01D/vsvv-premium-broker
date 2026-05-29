import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

/**
 * syncCancellationDeadline
 * 
 * Wird ausgelöst wenn end_date auf einem Contract geändert wird.
 * Berechnet cancellation_deadline = end_date minus 3 Monate.
 * 
 * Auslöser: Entity-Automation auf Contract (update), wenn changed_fields.end_date
 * Kann auch manuell aufgerufen werden: { contract_id: "..." }
 * Oder Batch-Sync: { batch: true } — alle Contracts mit end_date aber ohne cancellation_deadline
 */
Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const body = await req.json();

    // ── Hilfsfunktion ──────────────────────────────────────────────────────────
    function computeDeadline(endDateStr) {
      if (!endDateStr) return null;
      const d = new Date(endDateStr + 'T00:00:00');
      if (isNaN(d.getTime())) return null;
      // 3 Monate zurück, dann letzter Tag des Monats
      const targetMonth = d.getMonth() - 3; // kann negativ werden → Date() handles overflow
      const year = d.getFullYear();
      // new Date(year, month, 0) = letzter Tag des Vormonats → daher month (nicht month-1)
      const lastDay = new Date(year, targetMonth + 1, 0);
      return lastDay.toISOString().slice(0, 10);
    }

    // ── AUTOMATION-PAYLOAD: { event, data, old_data } ─────────────────────────
    if (body.event) {
      const contract = body.data;
      const oldData  = body.old_data;

      if (!contract?.id) {
        return Response.json({ skipped: true, reason: 'no contract data' });
      }

      const newEndDate = contract.end_date;
      const oldEndDate = oldData?.end_date;

      // Nur verarbeiten wenn end_date tatsächlich geändert wurde
      if (!newEndDate || newEndDate === oldEndDate) {
        // Auch verarbeiten wenn cancellation_deadline noch fehlt und end_date vorhanden
        if (!contract.cancellation_deadline && newEndDate) {
          // Fall-through zur Berechnung
        } else {
          return Response.json({ skipped: true, reason: 'end_date unchanged or missing' });
        }
      }

      const newDeadline = computeDeadline(newEndDate);
      if (!newDeadline) {
        return Response.json({ skipped: true, reason: 'could not parse end_date' });
      }

      // Kein Update wenn Deadline bereits korrekt
      if (contract.cancellation_deadline === newDeadline) {
        return Response.json({ skipped: true, reason: 'cancellation_deadline already correct', deadline: newDeadline });
      }

      await base44.asServiceRole.entities.Contract.update(contract.id, {
        cancellation_deadline: newDeadline,
      });

      console.log(`[syncCancellationDeadline] Contract ${contract.id}: end_date=${newEndDate} → cancellation_deadline=${newDeadline}`);

      return Response.json({
        ok: true,
        contract_id: contract.id,
        end_date: newEndDate,
        cancellation_deadline: newDeadline,
      });
    }

    // ── MANUELLER AUFRUF: { contract_id: "..." } ──────────────────────────────
    if (body.contract_id) {
      const contract = await base44.asServiceRole.entities.Contract.get(body.contract_id);
      if (!contract) {
        return Response.json({ error: 'Contract not found' }, { status: 404 });
      }

      const newDeadline = computeDeadline(contract.end_date);
      if (!newDeadline) {
        return Response.json({ skipped: true, reason: 'no end_date on contract' });
      }

      await base44.asServiceRole.entities.Contract.update(contract.id, {
        cancellation_deadline: newDeadline,
      });

      return Response.json({
        ok: true,
        contract_id: contract.id,
        end_date: contract.end_date,
        cancellation_deadline: newDeadline,
      });
    }

    // ── BATCH-SYNC: { batch: true } — alle Contracts mit end_date ─────────────
    if (body.batch) {
      const contracts = await base44.asServiceRole.entities.Contract.filter({ archived: false });
      let updated = 0;
      let skipped = 0;

      for (const c of contracts) {
        if (!c.end_date) { skipped++; continue; }

        const correctDeadline = computeDeadline(c.end_date);
        if (!correctDeadline) { skipped++; continue; }

        // Update wenn: kein Deadline gesetzt ODER Deadline falsch (end_date wurde geändert)
        if (!c.cancellation_deadline || c.cancellation_deadline !== correctDeadline) {
          await base44.asServiceRole.entities.Contract.update(c.id, {
            cancellation_deadline: correctDeadline,
          });
          updated++;
        } else {
          skipped++;
        }
      }

      console.log(`[syncCancellationDeadline] Batch: ${updated} updated, ${skipped} skipped`);

      return Response.json({
        ok: true,
        batch: true,
        total: contracts.length,
        updated,
        skipped,
      });
    }

    return Response.json({ error: 'Missing required parameter: event, contract_id, or batch' }, { status: 400 });

  } catch (error) {
    console.error('[syncCancellationDeadline] ERROR:', error.message);
    return Response.json({ error: error.message }, { status: 500 });
  }
});