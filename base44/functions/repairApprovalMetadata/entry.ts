/**
 * repairApprovalMetadata — Approval & Governance Integrity Repair
 *
 * Rekonstruiert fehlende Governance-Metadaten in:
 *   - AdvisoryDossier: approved_at, approved_by, approved_by_user_id aus approval_history
 *   - CommissionEntry: storno_reference_id aus storno_datum / policy_id
 *   - PdfExportLog: approved_at / approved_by aus Dossier-Daten
 *
 * Idempotent: bereits vorhandene Werte werden nicht überschrieben.
 * Nur von Admin aufrufbar.
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

    const results = {
      dossiers_repaired: 0,
      commission_storno_repaired: 0,
      pdf_logs_repaired: 0,
      skipped_already_ok: 0,
      details: [],
    };

    // ── 1. AdvisoryDossiers: approved_at / approved_by rekonstruieren ───────
    const dossiers = await sr.entities.AdvisoryDossier.list('-created_date', 300);
    for (const d of dossiers) {
      if (d.archived) continue;
      if (!d.advisor_approved) continue; // nur freigegebene Dossiers

      const needsRepair = !d.approved_at || !d.approved_by;
      if (!needsRepair) { results.skipped_already_ok++; continue; }

      const patch = {};

      // Aus approval_history rekonstruieren (jüngster 'approved'-Eintrag)
      if (d.approval_history && d.approval_history.length > 0) {
        const approvalEntry = [...d.approval_history]
          .reverse()
          .find(e => e.action === 'approved');
        if (approvalEntry) {
          if (!d.approved_at && approvalEntry.timestamp)
            patch.approved_at = approvalEntry.timestamp;
          if (!d.approved_by && approvalEntry.user_name)
            patch.approved_by = approvalEntry.user_name;
          if (!d.approved_by_user_id && approvalEntry.user_id)
            patch.approved_by_user_id = approvalEntry.user_id;
        }
      }

      // Fallback: aus updated_date / advisor_id
      if (!patch.approved_at && !d.approved_at)
        patch.approved_at = d.updated_date || d.created_date || now;
      if (!patch.approved_by && !d.approved_by)
        patch.approved_by = d.advisor_id || 'System (Recovery)';

      if (Object.keys(patch).length === 0) continue;

      // Eintrag in approval_history anfügen (Audit-Trail)
      const newHistoryEntry = {
        action: 'approval_metadata_recovered',
        timestamp: now,
        user_id: user.id,
        user_name: user.full_name || user.email,
        notes: `Metadaten rekonstruiert durch repairApprovalMetadata am ${now}. Felder: ${Object.keys(patch).join(', ')}`,
      };
      patch.approval_history = [
        ...(d.approval_history || []),
        newHistoryEntry,
      ];

      await sr.entities.AdvisoryDossier.update(d.id, patch);
      results.dossiers_repaired++;
      results.details.push({ type: 'AdvisoryDossier', id: d.id, fields_repaired: Object.keys(patch).filter(k => k !== 'approval_history') });
    }

    // ── 2. CommissionEntry: storno_reference_id reparieren ──────────────────
    const commissions = await sr.entities.CommissionEntry.list('-created_date', 500);
    const allCommByPolicy = {};
    for (const c of commissions) {
      const key = c.policy_id || c.contract_id;
      if (!key) continue;
      if (!allCommByPolicy[key]) allCommByPolicy[key] = [];
      allCommByPolicy[key].push(c);
    }

    for (const c of commissions) {
      if (!c.is_storno) continue;
      if (c.storno_reference_id) { results.skipped_already_ok++; continue; }

      // Suche die Original-Buchung (gleiche policy_id, nicht storno, älteres Datum)
      const siblings = (allCommByPolicy[c.policy_id] || []).filter(s =>
        s.id !== c.id && !s.is_storno &&
        new Date(s.entry_date || s.created_date) <= new Date(c.entry_date || c.created_date)
      );
      siblings.sort((a, b) => new Date(b.entry_date || b.created_date) - new Date(a.entry_date || a.created_date));
      const original = siblings[0];

      if (!original) continue;

      await sr.entities.CommissionEntry.update(c.id, {
        storno_reference_id: original.id,
        notes: `${c.notes || ''}\n[storno_reference_id rekonstruiert: ${original.id} — repairApprovalMetadata ${now}]`.trim(),
      });
      results.commission_storno_repaired++;
      results.details.push({ type: 'CommissionEntry', id: c.id, linked_to: original.id });
    }

    // ── 3. PdfExportLog: approved_at / approved_by aus Dossier ergänzen ─────
    const pdfLogs = await sr.entities.PdfExportLog.list('-exported_at', 200);
    const dossierMap = {};
    for (const d of dossiers) dossierMap[d.id] = d;

    for (const log of pdfLogs) {
      if (log.approved_at && log.approved_by) { results.skipped_already_ok++; continue; }
      const dossier = dossierMap[log.dossier_id];
      if (!dossier) continue;

      const patch = {};
      if (!log.approved_at && dossier.approved_at) patch.approved_at = dossier.approved_at;
      if (!log.approved_by && dossier.approved_by)  patch.approved_by = dossier.approved_by;
      if (Object.keys(patch).length === 0) continue;

      await sr.entities.PdfExportLog.update(log.id, patch);
      results.pdf_logs_repaired++;
    }

    // Audit-Log
    await sr.entities.AuditLog.create({
      timestamp: now,
      action: 'repair_approval_metadata',
      actor_type: 'user',
      actor_id: user.id,
      actor_name: user.full_name || user.email,
      details: JSON.stringify({ dossiers_repaired: results.dossiers_repaired, commission_storno_repaired: results.commission_storno_repaired }),
    }).catch(() => {});

    return Response.json({
      success: true,
      ...results,
      message: `Repair abgeschlossen: ${results.dossiers_repaired} Dossiers, ${results.commission_storno_repaired} Storno-Referenzen, ${results.pdf_logs_repaired} PDF-Logs repariert.`,
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});