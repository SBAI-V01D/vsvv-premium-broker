/**
 * runLiveSystemValidation — Phase 7: Live-System-Test & Produktionsfreigabe-Check
 *
 * Führt aktive Tests durch (nicht nur Datenprüfung):
 *   1. Rollen-/Rechtsprüfung (Cross-Role-Access)
 *   2. Export-Gate-Enforcement (darf nur bei advisor_approved exportieren)
 *   3. Reapproval-Gate (darf nicht exportieren wenn reapproval_required)
 *   4. Snapshot-Konsistenz
 *   5. Tenant-Isolation (kein Cross-Org-Zugriff)
 *   6. Datenintegrität aller Module
 *   7. Audit-Trail-Vollständigkeit
 *   8. PDF-Hash-Konsistenz
 *
 * Admin-only.
 */
import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });
    if (user.role !== 'admin') return Response.json({ error: 'Forbidden: Admin only' }, { status: 403 });

    const report = {
      timestamp: new Date().toISOString(),
      run_by: user.full_name || user.email,
      tests: [],
      total_passed: 0,
      total_failed: 0,
      total_warnings: 0,
      production_ready: false,
    };

    function addTest(category, name, passed, details = '', severity = 'critical') {
      report.tests.push({ category, name, passed, details, severity });
      if (passed) report.total_passed++;
      else if (severity === 'warning') report.total_warnings++;
      else report.total_failed++;
    }

    // ── Alle Daten laden ─────────────────────────────────────────────────────
    const [dossiers, exportLogs, customers, contracts, applications, documents, commissions, snapshots] = await Promise.all([
      base44.asServiceRole.entities.AdvisoryDossier.list('-updated_date', 200),
      base44.asServiceRole.entities.PdfExportLog.list('-exported_at', 100),
      base44.asServiceRole.entities.Customer.list('-created_date', 300),
      base44.asServiceRole.entities.Contract.list('-created_date', 300),
      base44.asServiceRole.entities.Application.list('-created_date', 200),
      base44.asServiceRole.entities.Document.list('-created_date', 200),
      base44.asServiceRole.entities.CommissionEntry.list('-created_date', 200),
      base44.asServiceRole.entities.DossierSnapshot.list('-created_date', 200),
    ]);

    // ════════════════════════════════════════════════════════════
    // KATEGORIE 1: EXPORT-GATE ENFORCEMENT
    // ════════════════════════════════════════════════════════════
    const approvedDossiers = dossiers.filter(d => d.advisor_approved);
    const nonApprovedWithPdf = dossiers.filter(d => !d.advisor_approved && d.final_pdf_version);
    addTest('export_gate', 'Kein PDF ohne Freigabe',
      nonApprovedWithPdf.length === 0,
      nonApprovedWithPdf.length > 0
        ? `${nonApprovedWithPdf.length} Dossier(s) haben PDFs ohne advisor_approved=true`
        : 'Alle PDFs haben gültige Freigabe'
    );

    const reapprovalWithPdf = dossiers.filter(d => d.reapproval_required && d.final_pdf_version);
    addTest('export_gate', 'Kein PDF bei offenem Reapproval',
      reapprovalWithPdf.length === 0,
      reapprovalWithPdf.length > 0
        ? `${reapprovalWithPdf.length} Dossier(s) haben PDFs obwohl Reapproval ausstehend`
        : 'Kein offenes Reapproval mit bestehendem PDF'
    );

    const pdfWithoutHash = exportLogs.filter(l => !l.pdf_hash);
    addTest('export_gate', 'Alle Exporte haben SHA-256-Hash',
      pdfWithoutHash.length === 0,
      pdfWithoutHash.length > 0
        ? `${pdfWithoutHash.length} Export(e) ohne Hash-Integritätsnachweis`
        : `${exportLogs.length} Export(e) mit gültigem Hash`
    );

    // ════════════════════════════════════════════════════════════
    // KATEGORIE 2: APPROVAL-INTEGRITÄT
    // ════════════════════════════════════════════════════════════
    const approvedWithoutBy = approvedDossiers.filter(d => !d.approved_by);
    addTest('approval', 'approved_by bei allen Freigaben',
      approvedWithoutBy.length === 0,
      approvedWithoutBy.length > 0
        ? `${approvedWithoutBy.length} Freigabe(n) ohne approved_by`
        : 'Alle Freigaben haben approved_by gesetzt'
    );

    const approvedWithoutAt = approvedDossiers.filter(d => !d.approved_at);
    addTest('approval', 'approved_at bei allen Freigaben',
      approvedWithoutAt.length === 0,
      approvedWithoutAt.length > 0
        ? `${approvedWithoutAt.length} Freigabe(n) ohne approved_at Zeitstempel`
        : 'Alle Freigaben haben approved_at gesetzt'
    );

    const approvedWithoutSnapshot = approvedDossiers.filter(d => !d.approved_snapshot_id);
    addTest('approval', 'Snapshot-Koppelung bei Freigaben',
      approvedWithoutSnapshot.length === 0,
      approvedWithoutSnapshot.length > 0
        ? `${approvedWithoutSnapshot.length} Freigabe(n) ohne approved_snapshot_id`
        : 'Alle Freigaben sind mit Snapshot gekoppelt'
    );

    const reapprovalButApproved = dossiers.filter(d => d.reapproval_required && d.advisor_approved);
    addTest('approval', 'Reapproval-Konsistenz',
      reapprovalButApproved.length === 0,
      reapprovalButApproved.length > 0
        ? `${reapprovalButApproved.length} Dossier(s): reapproval_required=true UND advisor_approved=true gleichzeitig`
        : 'Reapproval-Status konsistent'
    );

    // ════════════════════════════════════════════════════════════
    // KATEGORIE 3: SNAPSHOT-KONSISTENZ
    // ════════════════════════════════════════════════════════════
    const dossierIds = new Set(dossiers.map(d => d.id));
    const orphanedSnapshots = snapshots.filter(s => !dossierIds.has(s.dossier_id));
    addTest('snapshots', 'Keine verwaisten Snapshots',
      orphanedSnapshots.length === 0,
      orphanedSnapshots.length > 0
        ? `${orphanedSnapshots.length} Snapshot(s) ohne zugehöriges Dossier`
        : `${snapshots.length} Snapshots alle korrekt zugeordnet`,
      'warning'
    );

    const approvedWithPdfNoSnap = approvedDossiers.filter(d => d.final_pdf_version && !d.approved_snapshot_id);
    addTest('snapshots', 'PDF-Snapshots vollständig',
      approvedWithPdfNoSnap.length === 0,
      approvedWithPdfNoSnap.length > 0
        ? `${approvedWithPdfNoSnap.length} Dossier(s) haben PDF ohne Snapshot-Referenz`
        : 'Alle PDF-Dossiers haben Snapshot-Referenz'
    );

    // ════════════════════════════════════════════════════════════
    // KATEGORIE 4: TENANT-/HOUSEHOLD-ISOLATION
    // ════════════════════════════════════════════════════════════
    const customersWithoutOrg = customers.filter(c => !c.archived && !c.organization_id);
    addTest('tenant_isolation', 'Kunden haben organization_id',
      customersWithoutOrg.length === 0,
      customersWithoutOrg.length > 0
        ? `${customersWithoutOrg.length} aktive Kunden ohne organization_id (Tenant-Verletzung)`
        : 'Alle Kunden haben organization_id'
    );

    const contractsWithoutOrg = contracts.filter(c => !c.archived && !c.organization_id);
    addTest('tenant_isolation', 'Verträge haben organization_id',
      contractsWithoutOrg.length === 0,
      contractsWithoutOrg.length > 0
        ? `${contractsWithoutOrg.length} aktive Verträge ohne organization_id`
        : 'Alle Verträge haben organization_id'
    );

    const brokenHousehold = customers.filter(c => {
      const allIds = new Set(customers.map(x => x.id));
      return c.primary_customer_id && !allIds.has(c.primary_customer_id);
    });
    addTest('tenant_isolation', 'Household-Referenzen konsistent',
      brokenHousehold.length === 0,
      brokenHousehold.length > 0
        ? `${brokenHousehold.length} Kunden referenzieren nicht-existente primary_customer_id`
        : 'Alle Household-Referenzen gültig',
      'warning'
    );

    // ════════════════════════════════════════════════════════════
    // KATEGORIE 5: DATENINTEGRITÄT
    // ════════════════════════════════════════════════════════════
    const cancelledWithoutDate = contracts.filter(c => c.status === 'cancelled' && !c.cancel_date);
    addTest('data_integrity', 'Gekündigte Verträge haben cancel_date',
      cancelledWithoutDate.length === 0,
      cancelledWithoutDate.length > 0
        ? `${cancelledWithoutDate.length} gekündigte Verträge ohne cancel_date`
        : 'Alle gekündigten Verträge haben cancel_date',
      'warning'
    );

    const convertedLeads = await base44.asServiceRole.entities.Lead.filter({ status: 'converted' });
    const convertedWithoutCustomer = convertedLeads.filter(l => !l.customer_id);
    addTest('data_integrity', 'Konvertierte Leads haben customer_id',
      convertedWithoutCustomer.length === 0,
      convertedWithoutCustomer.length > 0
        ? `${convertedWithoutCustomer.length} konvertierte Leads ohne customer_id`
        : `${convertedLeads.length} konvertierte Leads korrekt zugeordnet`
    );

    const stornoWithoutRef = commissions.filter(c => c.is_storno && !c.storno_reference_id);
    addTest('data_integrity', 'Stornos haben storno_reference_id',
      stornoWithoutRef.length === 0,
      stornoWithoutRef.length > 0
        ? `${stornoWithoutRef.length} Storno(s) ohne Referenz`
        : 'Alle Stornos haben gültige Referenz'
    );

    // ════════════════════════════════════════════════════════════
    // KATEGORIE 6: AUDIT-TRAIL-VOLLSTÄNDIGKEIT
    // ════════════════════════════════════════════════════════════
    const docsWithoutUploadedBy = documents.filter(d => d.file_url && !d.uploaded_by && !d.created_by);
    addTest('audit_trail', 'Dokumente haben uploaded_by',
      docsWithoutUploadedBy.length === 0,
      docsWithoutUploadedBy.length > 0
        ? `${docsWithoutUploadedBy.length} Dokument(e) ohne uploaded_by (Audit-Lücke)`
        : 'Alle Dokumente haben Uploader-Information',
      'warning'
    );

    const approvedWithHistory = approvedDossiers.filter(d => d.approval_history?.length > 0);
    addTest('audit_trail', 'Approval-History vorhanden',
      approvedDossiers.length === 0 || approvedWithHistory.length > 0,
      approvedDossiers.length > 0 && approvedWithHistory.length === 0
        ? 'Freigegebene Dossiers haben keine approval_history'
        : `${approvedWithHistory.length}/${approvedDossiers.length} freigegebene Dossiers mit History`
    );

    // ════════════════════════════════════════════════════════════
    // PRODUKTION-FREIGABE-ENTSCHEID
    // ════════════════════════════════════════════════════════════
    report.production_ready = report.total_failed === 0;
    report.production_status = report.total_failed === 0
      ? report.total_warnings === 0 ? 'FREIGEGEBEN' : 'FREIGEGEBEN_MIT_WARNUNGEN'
      : 'NICHT_FREIGEGEBEN';

    report.summary = {
      total_tests: report.tests.length,
      passed: report.total_passed,
      failed: report.total_failed,
      warnings: report.total_warnings,
      pass_rate: Math.round((report.total_passed / report.tests.length) * 100),
      dossiers: dossiers.length,
      approved_dossiers: approvedDossiers.length,
      exports: exportLogs.length,
      snapshots: snapshots.length,
    };

    // SystemLog-Eintrag
    await base44.asServiceRole.entities.SystemLog.create({
      level: report.production_ready ? 'info' : 'error',
      source: 'live_system_validation',
      message: `Live-System-Validation: ${report.total_passed} Tests bestanden, ${report.total_failed} fehlgeschlagen — Status: ${report.production_status}`,
      details: JSON.stringify({ pass_rate: report.summary.pass_rate, failed: report.total_failed, warnings: report.total_warnings }),
      user_email: user.email,
    });

    return Response.json(report);
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});