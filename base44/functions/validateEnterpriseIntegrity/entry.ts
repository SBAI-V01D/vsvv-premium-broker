/**
 * validateEnterpriseIntegrity — Sprint E: Finaler Enterprise-Systemcheck
 *
 * Prüft alle kritischen Enterprise-Invarianten:
 *   1. PDF-Governance: freigegebene Dossiers ohne Hash / ohne Snapshot
 *   2. Approval-Integrität: advisor_approved aber fehlende Pflichtfelder
 *   3. Reapproval-Anomalien: needs_reapproval aber trotzdem advisor_approved
 *   4. Orphaned Snapshots: Snapshots ohne Dossier
 *   5. PdfExportLog-Integrität: Exporte ohne Hash
 *   6. Confidence-Compliance: Dossiers mit kritischem Risk ohne Pflichtreview
 *
 * Admin-only: wirft 403 für nicht-Admins.
 */
import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });
    if (user.role !== 'admin') return Response.json({ error: 'Forbidden: Admin only' }, { status: 403 });

    const results = {
      timestamp: new Date().toISOString(),
      checked_by: user.full_name || user.email,
      checks: [],
      total_issues: 0,
      status: 'ok',
    };

    function addCheck(name, passed, issues = [], details = {}) {
      results.checks.push({ name, passed, issue_count: issues.length, issues: issues.slice(0, 10), ...details });
      results.total_issues += issues.length;
    }

    // ── 1. PDF-Governance ───────────────────────────────────────────────────
    const [approvedDossiers, exportLogs] = await Promise.all([
      base44.asServiceRole.entities.AdvisoryDossier.filter({ advisor_approved: true }),
      base44.asServiceRole.entities.PdfExportLog.list('-exported_at', 200),
    ]);

    const pdfIssues = approvedDossiers
      .filter(d => d.final_pdf_version && !d.final_pdf_hash)
      .map(d => ({ dossier_id: d.id, title: d.title, issue: 'PDF exportiert ohne Hash' }));
    addCheck('PDF-Hash-Pflicht', pdfIssues.length === 0, pdfIssues);

    const snapshotIssues = approvedDossiers
      .filter(d => !d.approved_snapshot_id)
      .map(d => ({ dossier_id: d.id, title: d.title, issue: 'Freigabe ohne Snapshot-Koppelung' }));
    addCheck('Snapshot-Koppelung', snapshotIssues.length === 0, snapshotIssues);

    const exportHashIssues = exportLogs
      .filter(l => !l.pdf_hash)
      .map(l => ({ log_id: l.id, dossier_id: l.dossier_id, issue: 'Export ohne Hash' }));
    addCheck('ExportLog-Hash-Pflicht', exportHashIssues.length === 0, exportHashIssues);

    // ── 2. Approval-Integrität ──────────────────────────────────────────────
    const approvalFieldIssues = approvedDossiers
      .filter(d => !d.approved_by || !d.approved_at)
      .map(d => ({ dossier_id: d.id, title: d.title, missing: [!d.approved_by ? 'approved_by' : null, !d.approved_at ? 'approved_at' : null].filter(Boolean).join(', ') }));
    addCheck('Approval-Pflichtfelder', approvalFieldIssues.length === 0, approvalFieldIssues);

    // ── 3. Reapproval-Anomalien ────────────────────────────────────────────
    const allDossiers = await base44.asServiceRole.entities.AdvisoryDossier.filter({ archived: false });
    const reapprovalIssues = allDossiers
      .filter(d => d.reapproval_required && d.advisor_approved)
      .map(d => ({ dossier_id: d.id, title: d.title, issue: 'reapproval_required=true aber advisor_approved=true' }));
    addCheck('Reapproval-Konsistenz', reapprovalIssues.length === 0, reapprovalIssues);

    const statusMismatch = allDossiers
      .filter(d => d.review_status === 'freigegeben' && !d.advisor_approved)
      .map(d => ({ dossier_id: d.id, title: d.title, issue: 'review_status=freigegeben aber advisor_approved=false' }));
    addCheck('Status-Konsistenz', statusMismatch.length === 0, statusMismatch);

    // ── 4. Confidence-Compliance ───────────────────────────────────────────
    const confidenceIssues = allDossiers
      .filter(d => d.ai_risk_level === 'critical' && !d.requires_manual_review && d.review_status !== 'freigegeben')
      .map(d => ({ dossier_id: d.id, title: d.title, risk: d.ai_risk_level, issue: 'Kritisches Risiko ohne Pflichtreview-Flag' }));
    addCheck('Confidence-Compliance', confidenceIssues.length === 0, confidenceIssues);

    // ── 5. Orphaned Snapshots ──────────────────────────────────────────────
    const snapshots = await base44.asServiceRole.entities.DossierSnapshot.list('-created_date', 500);
    const dossierIds = new Set(allDossiers.map(d => d.id));
    const orphaned = snapshots
      .filter(s => !dossierIds.has(s.dossier_id))
      .map(s => ({ snapshot_id: s.id, dossier_id: s.dossier_id, version: s.version }));
    addCheck('Orphaned-Snapshots', orphaned.length === 0, orphaned, { total_snapshots: snapshots.length });

    // ── Gesamtergebnis ─────────────────────────────────────────────────────
    results.status = results.total_issues === 0 ? 'ok' : results.total_issues < 5 ? 'warning' : 'critical';
    results.summary = {
      total_dossiers: allDossiers.length,
      approved_dossiers: approvedDossiers.length,
      total_exports: exportLogs.length,
      total_snapshots: snapshots.length,
    };

    // Ergebnis in SystemLog schreiben
    await base44.asServiceRole.entities.SystemLog.create({
      level: results.status === 'ok' ? 'info' : results.status === 'warning' ? 'warn' : 'error',
      source: 'enterprise_integrity_check',
      message: `Enterprise-Integritätsprüfung: ${results.total_issues} Problem(e) gefunden`,
      details: JSON.stringify({ status: results.status, total_issues: results.total_issues, checked_by: results.checked_by }),
      user_email: user.email,
    });

    return Response.json(results);
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});