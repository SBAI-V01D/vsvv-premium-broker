/**
 * governanceRecovery — Retroaktive Governance-Historisierung
 *
 * Rekonstruiert fehlende change_history für Verträge und Kunden aus vorhandenen
 * AuditLog-Einträgen. Schreibt synthetische change_history-Einträge in bestehende
 * Datensätze, um den Audit Trail Score nachhaltig zu verbessern.
 *
 * Nur von Admin aufrufbar. Idempotent — bestehende Historien werden nicht überschrieben.
 */
import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (user?.role !== 'admin') {
      return Response.json({ error: 'Admin access required' }, { status: 403 });
    }

    const sr = base44.asServiceRole;
    const now = new Date().toISOString();

    const [contracts, customers, auditLogs] = await Promise.all([
      sr.entities.Contract.list('-created_date', 500),
      sr.entities.Customer.list('-created_date', 500),
      sr.entities.AuditLog.list('-timestamp', 1000),
    ]);

    // Index: entity_id → audit entries
    const auditByEntity = {};
    for (const log of auditLogs) {
      const eid = log.entity_id;
      if (!eid) continue;
      if (!auditByEntity[eid]) auditByEntity[eid] = [];
      auditByEntity[eid].push(log);
    }

    const results = {
      contracts_updated: 0,
      customers_updated: 0,
      contracts_already_ok: 0,
      customers_already_ok: 0,
      synthetic_entries_created: 0,
    };

    // Helper: baut change_history aus AuditLog-Einträgen
    const buildHistoryFromAudit = (logs) =>
      logs
        .filter(l => l.action)
        .map(l => ({
          timestamp: l.timestamp || l.created_date,
          user_id:   l.actor_id  || 'system',
          user_name: l.actor_name || l.actor_email || 'System',
          action:    l.action,
          changed_fields: l.changed_fields || l.field || '',
          previous_value: l.old_value != null ? String(l.old_value) : '',
          new_value:      l.new_value != null ? String(l.new_value) : '',
          notes: `[Rekonstruiert aus AuditLog am ${now}]`,
        }));

    // Synthetischer Fallback wenn kein Audit-Log vorhanden: created-Eintrag
    const buildCreatedEntry = (entity, type) => ([{
      timestamp: entity.created_date || now,
      user_id:   entity.created_by_id || 'system',
      user_name: 'System (Recovery)',
      action:    'created',
      changed_fields: '',
      previous_value: '',
      new_value: '',
      notes: `[Synthetischer Eintrag: ${type} erstellt. Ursprüngliche History nicht vorhanden. Recovery-Job: ${now}]`,
    }]);

    // ── Verträge ────────────────────────────────────────────────────────────
    for (const contract of contracts) {
      if (contract.archived) continue;
      if (contract.change_history && contract.change_history.length > 0) {
        results.contracts_already_ok++;
        continue;
      }
      const auditEntries = auditByEntity[contract.id] || [];
      const history = auditEntries.length > 0
        ? buildHistoryFromAudit(auditEntries)
        : buildCreatedEntry(contract, 'Contract');

      await sr.entities.Contract.update(contract.id, { change_history: history });
      results.contracts_updated++;
      results.synthetic_entries_created += history.length;
    }

    // ── Kunden ──────────────────────────────────────────────────────────────
    for (const customer of customers) {
      if (customer.archived) continue;
      if (customer.change_history && customer.change_history.length > 0) {
        results.customers_already_ok++;
        continue;
      }
      const auditEntries = auditByEntity[customer.id] || [];
      const history = auditEntries.length > 0
        ? buildHistoryFromAudit(auditEntries)
        : buildCreatedEntry(customer, 'Customer');

      await sr.entities.Customer.update(customer.id, { change_history: history });
      results.customers_updated++;
      results.synthetic_entries_created += history.length;
    }

    // Audit-Log für die Recovery selbst
    await sr.entities.AuditLog.create({
      timestamp: now,
      action: 'governance_recovery',
      actor_type: 'user',
      actor_id: user.id,
      actor_name: user.full_name || user.email,
      details: JSON.stringify(results),
    }).catch(() => {});

    return Response.json({
      success: true,
      ...results,
      message: `Recovery abgeschlossen: ${results.contracts_updated} Verträge + ${results.customers_updated} Kunden mit Änderungshistorie versehen. ${results.synthetic_entries_created} Einträge erstellt.`,
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});