/**
 * runLiveSystemValidation — Phase 7 + Final Hardening
 *
 * Kategorien:
 *   1. Export-Gate Enforcement
 *   2. Approval-Integrität
 *   3. Snapshot-Konsistenz
 *   4. Tenant-/Household-Isolation
 *   5. Datenintegrität
 *   6. Audit-Trail-Vollständigkeit
 *   7. PDF-Hash-Integrität (NEU)
 *   8. Security / Rollenverletzungen (NEU)
 *   9. Dokumentintegrität (NEU)
 *  10. Recovery-Readiness (NEU)
 *
 * Admin-only. Loggt Ergebnis in SystemLog.
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
      platform_status: 'Enterprise Live System',
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

    // ── Daten laden ──────────────────────────────────────────────────────────
    const [dossiers, exportLogs, customers, contracts, applications, documents, commissions, snapshots, users, leads] = await Promise.all([
      base44.asServiceRole.entities.AdvisoryDossier.list('-updated_date', 300),
      base44.asServiceRole.entities.PdfExportLog.list('-exported_at', 200),
      base44.asServiceRole.entities.Customer.list('-created_date', 500),
      base44.asServiceRole.entities.Contract.list('-created_date', 500),
      base44.asServiceRole.entities.Application.list('-created_date', 300),
      base44.asServiceRole.entities.Document.list('-created_date', 300),
      base44.asServiceRole.entities.CommissionEntry.list('-created_date', 300),
      base44.asServiceRole.entities.DossierSnapshot.list('-created_date', 300),
      base44.asServiceRole.entities.User.list(),
      base44.asServiceRole.entities.Lead.list('-created_date', 200),
    ]);

    const approvedDossiers = dossiers.filter(d => d.advisor_approved);

    // ════════════════════════════════════════════════════════════════
    // KAT 1: EXPORT-GATE ENFORCEMENT
    // ════════════════════════════════════════════════════════════════
    const nonApprovedWithPdf = dossiers.filter(d => !d.advisor_approved && d.final_pdf_version);
    addTest('export_gate', 'Kein PDF ohne Freigabe', nonApprovedWithPdf.length === 0,
      nonApprovedWithPdf.length > 0
        ? `${nonApprovedWithPdf.length} Dossier(s) haben PDF ohne advisor_approved=true`
        : 'Alle PDFs haben gültige Freigabe');

    const reapprovalWithPdf = dossiers.filter(d => d.reapproval_required && d.final_pdf_version);
    addTest('export_gate', 'Kein PDF bei offenem Reapproval', reapprovalWithPdf.length === 0,
      reapprovalWithPdf.length > 0
        ? `${reapprovalWithPdf.length} Dossier(s) haben PDF obwohl Reapproval ausstehend`
        : 'Kein offenes Reapproval mit bestehendem PDF');

    const pdfWithoutHash = exportLogs.filter(l => !l.pdf_hash);
    addTest('export_gate', 'Alle Exporte haben SHA-256-Hash', pdfWithoutHash.length === 0,
      pdfWithoutHash.length > 0
        ? `${pdfWithoutHash.length} Export(e) ohne Hash-Integritätsnachweis`
        : `${exportLogs.length} Export(e) alle mit SHA-256-Hash`);

    const pdfWithoutImmutable = exportLogs.filter(l => l.immutable === false);
    addTest('export_gate', 'Alle Exporte immutable=true', pdfWithoutImmutable.length === 0,
      pdfWithoutImmutable.length > 0
        ? `${pdfWithoutImmutable.length} Export(e) nicht als immutable markiert`
        : 'Alle Exporte korrekt als immutable markiert');

    // ════════════════════════════════════════════════════════════════
    // KAT 2: APPROVAL-INTEGRITÄT
    // ════════════════════════════════════════════════════════════════
    const approvedWithoutBy = approvedDossiers.filter(d => !d.approved_by);
    addTest('approval', 'approved_by bei allen Freigaben', approvedWithoutBy.length === 0,
      approvedWithoutBy.length > 0 ? `${approvedWithoutBy.length} Freigabe(n) ohne approved_by` : 'OK');

    const approvedWithoutAt = approvedDossiers.filter(d => !d.approved_at);
    addTest('approval', 'approved_at bei allen Freigaben', approvedWithoutAt.length === 0,
      approvedWithoutAt.length > 0 ? `${approvedWithoutAt.length} Freigabe(n) ohne Zeitstempel` : 'OK');

    const reapprovalButApproved = dossiers.filter(d => d.reapproval_required && d.advisor_approved);
    addTest('approval', 'Reapproval-Konsistenz (kein Widerspruch)', reapprovalButApproved.length === 0,
      reapprovalButApproved.length > 0
        ? `${reapprovalButApproved.length} Dossier(s): reapproval_required=true UND advisor_approved=true gleichzeitig`
        : 'Kein widersprüchlicher Approval-Status');

    // ════════════════════════════════════════════════════════════════
    // KAT 3: SNAPSHOT-KONSISTENZ
    // ════════════════════════════════════════════════════════════════
    const dossierIds = new Set(dossiers.map(d => d.id));
    const orphanedSnapshots = snapshots.filter(s => !dossierIds.has(s.dossier_id));
    addTest('snapshots', 'Keine verwaisten Snapshots', orphanedSnapshots.length === 0,
      orphanedSnapshots.length > 0
        ? `${orphanedSnapshots.length} Snapshot(s) ohne zugehöriges Dossier`
        : `${snapshots.length} Snapshots korrekt zugeordnet`, 'warning');

    const approvedWithPdfNoSnap = approvedDossiers.filter(d => d.final_pdf_version && !d.approved_snapshot_id);
    addTest('snapshots', 'PDF-Snapshots vollständig verknüpft', approvedWithPdfNoSnap.length === 0,
      approvedWithPdfNoSnap.length > 0
        ? `${approvedWithPdfNoSnap.length} Dossier(s) haben PDF ohne Snapshot-Referenz`
        : 'Alle PDF-Dossiers mit Snapshot verknüpft');

    // ════════════════════════════════════════════════════════════════
    // KAT 4: TENANT-/HOUSEHOLD-ISOLATION
    // ════════════════════════════════════════════════════════════════
    const customersWithoutOrg = customers.filter(c => !c.archived && !c.organization_id);
    addTest('tenant_isolation', 'Kunden haben organization_id', customersWithoutOrg.length === 0,
      customersWithoutOrg.length > 0
        ? `${customersWithoutOrg.length} aktive Kunden ohne organization_id (Tenant-Verletzung)`
        : 'Alle Kunden haben organization_id');

    const contractsWithoutOrg = contracts.filter(c => !c.archived && !c.organization_id);
    addTest('tenant_isolation', 'Verträge haben organization_id', contractsWithoutOrg.length === 0,
      contractsWithoutOrg.length > 0
        ? `${contractsWithoutOrg.length} aktive Verträge ohne organization_id`
        : 'Alle Verträge haben organization_id');

    const customerIdSet = new Set(customers.map(x => x.id));
    const brokenHousehold = customers.filter(c => c.primary_customer_id && !customerIdSet.has(c.primary_customer_id));
    addTest('tenant_isolation', 'Household-Referenzen konsistent', brokenHousehold.length === 0,
      brokenHousehold.length > 0
        ? `${brokenHousehold.length} Kunden referenzieren nicht-existente primary_customer_id`
        : 'Alle Household-Referenzen gültig', 'warning');

    const dossiersWithoutOrg = dossiers.filter(d => !d.organization_id);
    addTest('tenant_isolation', 'Dossiers haben organization_id', dossiersWithoutOrg.length === 0,
      dossiersWithoutOrg.length > 0
        ? `${dossiersWithoutOrg.length} Dossier(s) ohne organization_id`
        : 'Alle Dossiers haben organization_id');

    // ════════════════════════════════════════════════════════════════
    // KAT 5: DATENINTEGRITÄT
    // ════════════════════════════════════════════════════════════════
    const cancelledWithoutDate = contracts.filter(c => c.status === 'cancelled' && !c.cancel_date);
    addTest('data_integrity', 'Gekündigte Verträge haben cancel_date', cancelledWithoutDate.length === 0,
      cancelledWithoutDate.length > 0 ? `${cancelledWithoutDate.length} Verträge ohne cancel_date` : 'OK', 'warning');

    const convertedLeads = leads.filter(l => l.status === 'converted');
    const convertedWithoutCustomer = convertedLeads.filter(l => !l.customer_id);
    addTest('data_integrity', 'Konvertierte Leads haben customer_id', convertedWithoutCustomer.length === 0,
      convertedWithoutCustomer.length > 0
        ? `${convertedWithoutCustomer.length} konvertierte Leads ohne customer_id`
        : `${convertedLeads.length} konvertierte Leads korrekt`);

    const stornoWithoutRef = commissions.filter(c => c.is_storno && !c.storno_reference_id);
    addTest('data_integrity', 'Stornos haben storno_reference_id', stornoWithoutRef.length === 0,
      stornoWithoutRef.length > 0 ? `${stornoWithoutRef.length} Storno(s) ohne Referenz` : 'OK');

    const negativePaidCommissions = commissions.filter(c =>
      (c.courtage_payout_amount != null && c.courtage_payout_amount < 0 && !c.is_storno) ||
      (c.provision_payout_amount != null && c.provision_payout_amount < 0 && !c.is_storno));
    addTest('data_integrity', 'Keine negativen Auszahlungsbeträge (non-storno)', negativePaidCommissions.length === 0,
      negativePaidCommissions.length > 0 ? `${negativePaidCommissions.length} Provisionen mit negativem Auszahlungsbetrag` : 'OK');

    // ════════════════════════════════════════════════════════════════
    // KAT 6: AUDIT-TRAIL
    // ════════════════════════════════════════════════════════════════
    const docsWithoutUploadedBy = documents.filter(d => d.file_url && !d.uploaded_by && !d.created_by);
    addTest('audit_trail', 'Dokumente haben uploaded_by', docsWithoutUploadedBy.length === 0,
      docsWithoutUploadedBy.length > 0
        ? `${docsWithoutUploadedBy.length} Dokument(e) ohne uploaded_by`
        : 'Alle Dokumente mit Uploader', 'warning');

    const approvedWithHistory = approvedDossiers.filter(d => d.approval_history?.length > 0);
    addTest('audit_trail', 'Approval-History bei freigegebenen Dossiers',
      approvedDossiers.length === 0 || approvedWithHistory.length > 0,
      `${approvedWithHistory.length}/${approvedDossiers.length} haben approval_history`);

    const pdfExportsWithoutApprovedBy = exportLogs.filter(l => !l.approved_by && !l.generated_by_name);
    addTest('audit_trail', 'Export-Logs haben Benutzerreferenz', pdfExportsWithoutApprovedBy.length === 0,
      pdfExportsWithoutApprovedBy.length > 0
        ? `${pdfExportsWithoutApprovedBy.length} Exports ohne Benutzerreferenz`
        : 'Alle Exports mit Benutzerreferenz', 'warning');

    // ════════════════════════════════════════════════════════════════
    // KAT 7: PDF-HASH-INTEGRITÄT (NEU)
    // ════════════════════════════════════════════════════════════════
    const dossierWithPdfNoHash = dossiers.filter(d => d.final_pdf_version && !d.final_pdf_hash);
    addTest('pdf_integrity', 'Alle gespeicherten PDFs haben final_pdf_hash', dossierWithPdfNoHash.length === 0,
      dossierWithPdfNoHash.length > 0
        ? `${dossierWithPdfNoHash.length} Dossier(s) haben PDF-Version ohne Hash-Prüfwert`
        : `${approvedDossiers.filter(d => d.final_pdf_hash).length} PDFs mit Hash gesichert`);

    const dossierWithPdfNoUri = dossiers.filter(d => d.final_pdf_version && d.final_pdf_url && !d.final_pdf_file_uri);
    addTest('pdf_integrity', 'PDFs in Private Storage (file_uri statt URL)', dossierWithPdfNoUri.length === 0,
      dossierWithPdfNoUri.length > 0
        ? `${dossierWithPdfNoUri.length} Dossier(s) haben PDF in Public Storage (Migration erforderlich)`
        : 'Alle PDFs im Private Storage', 'warning');

    const exportLogsDuplicateHash = (() => {
      const hashCounts = {};
      exportLogs.forEach(l => { if (l.pdf_hash) hashCounts[l.pdf_hash] = (hashCounts[l.pdf_hash] || 0) + 1; });
      return Object.values(hashCounts).filter(c => c > 1).length;
    })();
    addTest('pdf_integrity', 'Keine duplizierten PDF-Hashes (Archiv-Integrität)', exportLogsDuplicateHash === 0,
      exportLogsDuplicateHash > 0
        ? `${exportLogsDuplicateHash} duplizierte Hash-Werte im Export-Archiv`
        : 'Alle PDF-Hashes eindeutig', 'warning');

    // ════════════════════════════════════════════════════════════════
    // KAT 8: SECURITY / ROLLENVERLETZUNGEN (NEU)
    // ════════════════════════════════════════════════════════════════
    const validRoles = ['admin', 'broker', 'assistenz', 'user', 'viewer', 'supervisor', 'reviewer'];
    const usersWithInvalidRole = users.filter(u => u.role && !validRoles.includes(u.role));
    addTest('security', 'Alle Benutzer haben gültige Rollen', usersWithInvalidRole.length === 0,
      usersWithInvalidRole.length > 0
        ? `${usersWithInvalidRole.length} Benutzer mit ungültiger Rolle: ${usersWithInvalidRole.map(u => u.email).join(', ')}`
        : `${users.length} Benutzer alle mit gültiger Rolle`);

    const usersWithoutRole = users.filter(u => !u.role);
    addTest('security', 'Alle Benutzer haben eine Rolle', usersWithoutRole.length === 0,
      usersWithoutRole.length > 0
        ? `${usersWithoutRole.length} Benutzer ohne Rollenzuweisung (Sicherheitsrisiko)`
        : 'Alle Benutzer haben Rollenzuweisung', 'warning');

    const adminUsers = users.filter(u => u.role === 'admin');
    addTest('security', 'Admin-Konten vorhanden und begrenzt',
      adminUsers.length > 0 && adminUsers.length <= 5,
      adminUsers.length === 0
        ? 'Kein Admin-Benutzer — System nicht verwaltet'
        : adminUsers.length > 5
          ? `${adminUsers.length} Admin-Konten — Überprüfung empfohlen (min. Rechteprinzip)`
          : `${adminUsers.length} Admin-Konto(en) — OK`,
      adminUsers.length > 5 ? 'warning' : 'critical');

    // ════════════════════════════════════════════════════════════════
    // KAT 9: DOKUMENTINTEGRITÄT (NEU)
    // ════════════════════════════════════════════════════════════════
    const docsWithoutName = documents.filter(d => !d.name);
    addTest('document_integrity', 'Alle Dokumente haben Namen', docsWithoutName.length === 0,
      docsWithoutName.length > 0 ? `${docsWithoutName.length} Dokument(e) ohne Namen` : 'OK', 'warning');

    const immutableDocsWithoutHash = documents.filter(d => d.immutable && !d.file_hash);
    addTest('document_integrity', 'Immutable Dokumente haben file_hash', immutableDocsWithoutHash.length === 0,
      immutableDocsWithoutHash.length > 0
        ? `${immutableDocsWithoutHash.length} als immutable markierte Dokumente ohne file_hash`
        : 'Alle immutable Dokumente haben Hash-Prüfwert');

    const docsWithPublicUrlNotPrivate = documents.filter(d =>
      d.file_url && d.file_url.startsWith('http') && !d.file_url.includes('storage') && d.immutable);
    addTest('document_integrity', 'Immutable Dokumente nicht öffentlich zugänglich',
      docsWithPublicUrlNotPrivate.length === 0,
      docsWithPublicUrlNotPrivate.length > 0
        ? `${docsWithPublicUrlNotPrivate.length} immutable Dokumente mit potenziell öffentlicher URL`
        : 'OK', 'warning');

    // ════════════════════════════════════════════════════════════════
    // KAT 10: RECOVERY-READINESS (NEU)
    // ════════════════════════════════════════════════════════════════
    const recentBackups = await base44.asServiceRole.entities.BackupLog.filter({ status: 'completed' });
    const latestBackup = recentBackups.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp))[0];
    const backupAge = latestBackup
      ? (Date.now() - new Date(latestBackup.timestamp).getTime()) / (1000 * 60 * 60 * 24)
      : 999;
    addTest('recovery', 'Letztes Backup < 24 Stunden alt', backupAge < 1,
      latestBackup
        ? `Letztes Backup: ${new Date(latestBackup.timestamp).toLocaleString('de-CH')} (${backupAge.toFixed(1)}d alt)`
        : 'Kein abgeschlossenes Backup gefunden', backupAge > 7 ? 'critical' : 'warning');

    const failedBackups = recentBackups.filter(b => b.status === 'failed');
    addTest('recovery', 'Keine fehlgeschlagenen Backups', failedBackups.length === 0,
      failedBackups.length > 0
        ? `${failedBackups.length} fehlgeschlagene(s) Backup(s) in der Historie`
        : `${recentBackups.length} abgeschlossene Backups`, 'warning');

    const backupsWithChecksum = recentBackups.filter(b => b.checksum);
    addTest('recovery', 'Backups haben Prüfsummen', recentBackups.length === 0 || backupsWithChecksum.length > 0,
      `${backupsWithChecksum.length}/${recentBackups.length} Backups mit Prüfsumme`, 'warning');

    // ════════════════════════════════════════════════════════════════
    // PRODUKTIONSFREIGABE-ENTSCHEID
    // ════════════════════════════════════════════════════════════════
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
      users: users.length,
      admin_users: adminUsers.length,
      backups: recentBackups.length,
    };

    // ── Incidents für kritische/blocking Fehler persistieren ─────────────
    const runId = `val-${Date.now()}`;
    const failedTests = report.tests.filter(t => !t.passed);
    await Promise.all(failedTests.map(t => {
      const sev = t.severity === 'warning' ? 'warning' : 'critical';
      return base44.asServiceRole.entities.EnterpriseIncident.create({
        severity: sev,
        category: t.category,
        title: t.name,
        description: t.details,
        recommended_action: 'Bitte manuell prüfen und beheben. Keine automatische Korrektur für Governance-Daten.',
        auto_fix_possible: false,
        manual_review_required: true,
        status: 'open',
        detected_by: 'runLiveSystemValidation',
        detected_at: report.timestamp,
        validation_run_id: runId,
      });
    }));

    // SystemLog-Eintrag
    await base44.asServiceRole.entities.SystemLog.create({
      level: report.production_ready ? 'info' : 'error',
      source: 'live_system_validation',
      message: `Enterprise Live Validation: ${report.total_passed}/${report.summary.total_tests} bestanden (${report.summary.pass_rate}%) — ${report.production_status}`,
      details: JSON.stringify({ categories: [...new Set(report.tests.map(t => t.category))], failed: report.total_failed, warnings: report.total_warnings }),
      user_email: user.email,
    });

    return Response.json(report);
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});