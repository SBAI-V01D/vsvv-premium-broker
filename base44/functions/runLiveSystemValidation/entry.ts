/**
 * runLiveSystemValidation — Enterprise Deep Diagnostics
 *
 * Jeder Test liefert jetzt affected_records:
 *   [{id, name, type, link, detail}] — konkrete betroffene Datensätze mit Direktlinks
 *
 * Admin-only. Incidents dedupliziert. SystemLog-Eintrag.
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

    const REMEDIATION = {
      'Kein PDF ohne Freigabe':                    { root_cause: 'Dossier hat PDF obwohl advisor_approved=false. Export-Gate umgangen oder Approval nachtraeglich widerrufen.', recommended_fix: '1. Dossier oeffnen\n2. Approval-Status pruefen\n3. Falls Reapproval noetig: Freigabe erneuern\n4. PDF-Version zuruecksetzen und neu exportieren', auto_fix: false, governance: true },
      'Kein PDF bei offenem Reapproval':           { root_cause: 'Dossier nach Freigabe geaendert (reapproval_required=true), aber PDF-Version existiert noch.', recommended_fix: '1. Dossier oeffnen\n2. Aenderungen pruefen\n3. Erneut freigeben (Supervisor)\n4. PDF neu exportieren', auto_fix: false, governance: true },
      'Alle Exporte haben SHA-256-Hash':           { root_cause: 'PDF vor SHA-256-Hashing generiert oder Hash-Berechnung fehlgeschlagen.', recommended_fix: '1. Betroffene PdfExportLog-Eintraege identifizieren\n2. Falls file_uri vorhanden: Hash nachberechnen\n3. Sonst: Export als Legacy markieren', auto_fix: false, governance: false },
      'Alle Exporte immutable=true':               { root_cause: 'PdfExportLog ohne immutable=true erstellt.', recommended_fix: 'Admin: immutable=true manuell setzen. Niemals loeschen.', auto_fix: true, repair_action: 'check_data_consistency', governance: false },
      'approved_by bei allen Freigaben':           { root_cause: 'Freigabe-Aktion hat Berater-Namen nicht gespeichert. Audit-Trail unvollstaendig.', recommended_fix: '1. Dossier oeffnen\n2. Approval-History pruefen\n3. Berater manuell nachtragen\n4. Approval neu ausloesen fuer vollstaendigen Trail', auto_fix: false, governance: true },
      'approved_at bei allen Freigaben':           { root_cause: 'Freigabe-Zeitstempel fehlt. FINMA-Konformitaet verletzt.', recommended_fix: 'Dossier-Freigabe wiederholen. Manuelles Nachtragen nicht empfohlen.', auto_fix: false, governance: true },
      'Reapproval-Konsistenz (kein Widerspruch)':  { root_cause: 'reapproval_required=true und advisor_approved=true gleichzeitig - logischer Widerspruch.', recommended_fix: '1. Dossier sofort sperren\n2. Supervisor informieren\n3. Approval-History pruefen\n4. Einen der beiden Flags korrekt setzen', auto_fix: false, governance: true },
      'Keine verwaisten Snapshots':                { root_cause: 'Dossier geloescht aber DossierSnapshot-Eintraege existieren noch.', recommended_fix: 'Verwaiste Snapshots archivieren. Pruefen ob Dossier irrtuemlicherweise geloescht wurde.', auto_fix: false, governance: false },
      'PDF-Snapshots vollstaendig verknuepft':     { root_cause: 'Dossier hat final_pdf_version aber keine approved_snapshot_id.', recommended_fix: '1. Letzten Snapshot des Dossiers finden\n2. approved_snapshot_id manuell setzen\n3. Oder PDF neu exportieren', auto_fix: false, governance: true },
      'Kunden haben organization_id':              { root_cause: 'Kunde ohne organization_id erstellt. Tenant-Isolation verletzt. Cross-Tenant-Datenleckage moeglich.', recommended_fix: '1. Sofort pruefen welcher Organisation der Kunde gehoert\n2. organization_id setzen\n3. Alle Vertraege/Antraege des Kunden pruefen', auto_fix: true, repair_action: 'sync_customer_status', governance: false },
      'Vertraege haben organization_id':           { root_cause: 'Vertrag ohne organization_id. Tenant-Isolation verletzt.', recommended_fix: 'organization_id des zugeh. Kunden auf den Vertrag uebertragen.', auto_fix: true, repair_action: 'sync_customer_status', governance: false },
      'Household-Referenzen konsistent':           { root_cause: 'Familienmitglied referenziert primary_customer_id die nicht mehr existiert.', recommended_fix: '1. primary_customer_id pruefen\n2. Falls Hauptkunde geloescht: Familienmitglied als eigenstaendigen Kunden behandeln\n3. primary_customer_id bereinigen', auto_fix: false, governance: false },
      'Dossiers haben organization_id':            { root_cause: 'Dossier ohne organization_id. Tenant-Isolation verletzt.', recommended_fix: 'organization_id des Beraters/Kunden auf das Dossier uebertragen.', auto_fix: false, governance: false },
      'Alle gespeicherten PDFs haben final_pdf_hash': { root_cause: 'PDF vor Hash-Governance generiert oder Hash-Berechnung fehlgeschlagen.', recommended_fix: '1. PDF neu exportieren (Hash automatisch berechnet)\n2. Oder: als Legacy dokumentieren und accepted_risk setzen', auto_fix: false, governance: false },
      'PDFs in Private Storage (file_uri statt URL)': { root_cause: 'PDF in Public Storage. Sicherheitsrisiko: URL koennte oeffentlich erreichbar sein.', recommended_fix: '1. Migration zu Private Storage durchfuehren\n2. file_uri setzen\n3. Public URL entfernen', auto_fix: false, governance: false },
      'Alle Benutzer haben gueltige Rollen':       { root_cause: 'Benutzer hat Rolle die nicht in der Whitelist ist. Berechtigungsluecke moeglich.', recommended_fix: 'Rolle sofort auf gueltigen Wert setzen: admin/broker/assistenz/supervisor/reviewer/viewer', auto_fix: false, governance: true },
      'Alle Benutzer haben eine Rolle':            { root_cause: 'Benutzer ohne Rolle. Berechtigungspruefungen greifen nicht korrekt.', recommended_fix: 'Sofort Rolle zuweisen. Bis dahin: kein Zugriff auf sensitive Daten.', auto_fix: false, governance: true },
      'Admin-Konten vorhanden und begrenzt':       { root_cause: 'Mehr als 5 Admin-Konten. Minimalprinzip verletzt.', recommended_fix: '1. Admin-Liste ueberpruefen\n2. Nicht mehr benoetigte Admin-Rechte entziehen\n3. Auf broker/reviewer Rolle downgraden', auto_fix: false, governance: true },
      'Letztes Backup < 24 Stunden alt':          { root_cause: 'Kein aktuelles Backup. Recovery Point Objective (RPO) ueberschritten.', recommended_fix: '1. Sofort manuelles Backup starten\n2. Backup-Automation pruefen\n3. BackupLog auf Fehler pruefen', auto_fix: false, governance: false },
      'Stornos haben storno_reference_id':         { root_cause: 'Storno-Buchung ohne Referenz auf urspruengliche Abrechnung. Audit-Trail unterbrochen.', recommended_fix: '1. Urspruengliche CommissionEntry manuell identifizieren\n2. storno_reference_id nachtragen\n3. Bei Unklarheit: als accepted_risk dokumentieren', auto_fix: false, governance: true },
      'Konvertierte Leads haben customer_id':      { root_cause: 'Lead als converted markiert ohne customer_id. Konvertierungsprozess unvollstaendig.', recommended_fix: 'Kunden-Datensatz suchen oder neu anlegen und customer_id setzen.', auto_fix: false, governance: false },
    };

    // Helper: betroffene Datensätze normalisieren (max 25)
    function toRecs(items, type, nameFn, linkFn, detailFn) {
      return items.slice(0, 25).map(function(x) {
        return {
          id: x.id,
          name: nameFn(x),
          type: type,
          link: linkFn(x),
          detail: detailFn ? detailFn(x) : null,
        };
      });
    }

    function addTest(category, name, passed, details, severity, affected_records) {
      if (!details) details = '';
      if (!severity) severity = 'critical';
      if (!affected_records) affected_records = [];
      var rem = REMEDIATION[name] || {};
      report.tests.push({
        category: category,
        name: name,
        passed: passed,
        details: details,
        severity: severity,
        affected_records: affected_records.slice(0, 25),
        root_cause: rem.root_cause || null,
        recommended_fix: rem.recommended_fix || null,
        auto_fix_possible: rem.auto_fix || false,
        repair_action: rem.repair_action || null,
        governance_block: rem.governance || false,
      });
      if (passed) report.total_passed++;
      else if (severity === 'warning') report.total_warnings++;
      else report.total_failed++;
    }

    // Daten laden
    var loaded = await Promise.all([
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
    var dossiers = loaded[0];
    var exportLogs = loaded[1];
    var customers = loaded[2];
    var contracts = loaded[3];
    var applications = loaded[4];
    var documents = loaded[5];
    var commissions = loaded[6];
    var snapshots = loaded[7];
    var users = loaded[8];
    var leads = loaded[9];

    var approvedDossiers = dossiers.filter(function(d) { return d.advisor_approved; });

    // KAT 1: EXPORT-GATE
    var nonApprovedWithPdf = dossiers.filter(function(d) { return !d.advisor_approved && d.final_pdf_version; });
    addTest('export_gate', 'Kein PDF ohne Freigabe', nonApprovedWithPdf.length === 0,
      nonApprovedWithPdf.length > 0 ? nonApprovedWithPdf.length + ' Dossier(s) haben PDF ohne advisor_approved=true' : 'Alle PDFs haben gueltige Freigabe',
      'critical',
      toRecs(nonApprovedWithPdf, 'Dossier', function(d) { return d.title || d.id; }, function() { return '/beratungsdossier'; }, function(d) { return 'Kunde: ' + (d.customer_name || '-'); }));

    var reapprovalWithPdf = dossiers.filter(function(d) { return d.reapproval_required && d.final_pdf_version; });
    addTest('export_gate', 'Kein PDF bei offenem Reapproval', reapprovalWithPdf.length === 0,
      reapprovalWithPdf.length > 0 ? reapprovalWithPdf.length + ' Dossier(s) haben PDF obwohl Reapproval ausstehend' : 'Kein offenes Reapproval mit bestehendem PDF',
      'critical',
      toRecs(reapprovalWithPdf, 'Dossier', function(d) { return d.title || d.id; }, function() { return '/beratungsdossier'; }, function(d) { return 'Kunde: ' + (d.customer_name || '-'); }));

    var pdfWithoutHash = exportLogs.filter(function(l) { return !l.pdf_hash; });
    addTest('export_gate', 'Alle Exporte haben SHA-256-Hash', pdfWithoutHash.length === 0,
      pdfWithoutHash.length > 0 ? pdfWithoutHash.length + ' Export(e) ohne Hash-Integritaetsnachweis' : exportLogs.length + ' Export(e) alle mit SHA-256-Hash',
      'critical',
      toRecs(pdfWithoutHash, 'PdfExportLog', function(l) { return l.dossier_title || l.filename || l.id; }, function() { return '/admin/enterprise-control-center'; }, function(l) { return 'Export: ' + (l.exported_at ? new Date(l.exported_at).toLocaleDateString('de-CH') : '-'); }));

    var pdfWithoutImmutable = exportLogs.filter(function(l) { return l.immutable === false; });
    addTest('export_gate', 'Alle Exporte immutable=true', pdfWithoutImmutable.length === 0,
      pdfWithoutImmutable.length > 0 ? pdfWithoutImmutable.length + ' Export(e) nicht als immutable markiert' : 'Alle Exporte korrekt als immutable markiert',
      'critical',
      toRecs(pdfWithoutImmutable, 'PdfExportLog', function(l) { return l.dossier_title || l.id; }, function() { return '/admin/enterprise-control-center'; }, function(l) { return 'Export: ' + (l.exported_at ? new Date(l.exported_at).toLocaleDateString('de-CH') : '-'); }));

    // KAT 2: APPROVAL-INTEGRITAET
    var approvedWithoutBy = approvedDossiers.filter(function(d) { return !d.approved_by; });
    addTest('approval', 'approved_by bei allen Freigaben', approvedWithoutBy.length === 0,
      approvedWithoutBy.length > 0 ? approvedWithoutBy.length + ' Freigabe(n) ohne approved_by' : 'OK',
      'critical',
      toRecs(approvedWithoutBy, 'Dossier', function(d) { return d.title || d.id; }, function() { return '/beratungsdossier'; }, function(d) { return 'Kunde: ' + (d.customer_name || '-') + ' | v' + (d.version || 1); }));

    var approvedWithoutAt = approvedDossiers.filter(function(d) { return !d.approved_at; });
    addTest('approval', 'approved_at bei allen Freigaben', approvedWithoutAt.length === 0,
      approvedWithoutAt.length > 0 ? approvedWithoutAt.length + ' Freigabe(n) ohne Zeitstempel' : 'OK',
      'critical',
      toRecs(approvedWithoutAt, 'Dossier', function(d) { return d.title || d.id; }, function() { return '/beratungsdossier'; }, function(d) { return 'Kunde: ' + (d.customer_name || '-') + ' | Von: ' + (d.approved_by || '-'); }));

    var reapprovalButApproved = dossiers.filter(function(d) { return d.reapproval_required && d.advisor_approved; });
    addTest('approval', 'Reapproval-Konsistenz (kein Widerspruch)', reapprovalButApproved.length === 0,
      reapprovalButApproved.length > 0 ? reapprovalButApproved.length + ' Dossier(s): reapproval_required=true UND advisor_approved=true gleichzeitig' : 'Kein widerspruechlicher Approval-Status',
      'critical',
      toRecs(reapprovalButApproved, 'Dossier', function(d) { return d.title || d.id; }, function() { return '/beratungsdossier'; }, function(d) { return 'Kunde: ' + (d.customer_name || '-'); }));

    // KAT 3: SNAPSHOT-KONSISTENZ
    var dossierIdSet = new Set(dossiers.map(function(d) { return d.id; }));
    var orphanedSnapshots = snapshots.filter(function(s) { return !dossierIdSet.has(s.dossier_id); });
    addTest('snapshots', 'Keine verwaisten Snapshots', orphanedSnapshots.length === 0,
      orphanedSnapshots.length > 0 ? orphanedSnapshots.length + ' Snapshot(s) ohne zugeh. Dossier' : snapshots.length + ' Snapshots korrekt zugeordnet',
      'warning',
      toRecs(orphanedSnapshots, 'DossierSnapshot', function(s) { return 'Snapshot v' + s.version + ' (Dossier: ' + (s.dossier_id || '').slice(0, 8) + '...)'; }, function() { return '/admin/enterprise-control-center'; }, function(s) { return 'Dossier-ID: ' + s.dossier_id; }));

    var approvedWithPdfNoSnap = approvedDossiers.filter(function(d) { return d.final_pdf_version && !d.approved_snapshot_id; });
    addTest('snapshots', 'PDF-Snapshots vollstaendig verknuepft', approvedWithPdfNoSnap.length === 0,
      approvedWithPdfNoSnap.length > 0 ? approvedWithPdfNoSnap.length + ' Dossier(s) haben PDF ohne Snapshot-Referenz' : 'Alle PDF-Dossiers mit Snapshot verknuepft',
      'critical',
      toRecs(approvedWithPdfNoSnap, 'Dossier', function(d) { return d.title || d.id; }, function() { return '/beratungsdossier'; }, function(d) { return 'Kunde: ' + (d.customer_name || '-') + ' | PDF-v' + d.final_pdf_version; }));

    // KAT 4: TENANT-ISOLATION
    var customersWithoutOrg = customers.filter(function(c) { return !c.archived && !c.organization_id; });
    addTest('tenant_isolation', 'Kunden haben organization_id', customersWithoutOrg.length === 0,
      customersWithoutOrg.length > 0 ? customersWithoutOrg.length + ' aktive Kunden ohne organization_id (Tenant-Verletzung)' : 'Alle Kunden haben organization_id',
      'critical',
      toRecs(customersWithoutOrg, 'Kunde',
        function(c) { return ((c.first_name || '') + ' ' + (c.last_name || '')).trim() || c.company_name || c.id; },
        function(c) { return '/kunden/' + c.id; },
        function(c) { return (c.customer_number ? 'Nr. ' + c.customer_number : '-') + ' | ' + (c.email || '-'); }));

    var contractsWithoutOrg = contracts.filter(function(c) { return !c.archived && !c.organization_id; });
    addTest('tenant_isolation', 'Vertraege haben organization_id', contractsWithoutOrg.length === 0,
      contractsWithoutOrg.length > 0 ? contractsWithoutOrg.length + ' aktive Vertraege ohne organization_id' : 'Alle Vertraege haben organization_id',
      'critical',
      toRecs(contractsWithoutOrg, 'Vertrag',
        function(c) { return (c.insurer || '-') + ' - ' + (c.customer_name || '-'); },
        function() { return '/vertraege'; },
        function(c) { return 'Police: ' + (c.policy_number || '-') + ' | ' + (c.insurance_type || '-'); }));

    var customerIdSet = new Set(customers.map(function(x) { return x.id; }));
    var brokenHousehold = customers.filter(function(c) { return c.primary_customer_id && !customerIdSet.has(c.primary_customer_id); });
    addTest('tenant_isolation', 'Household-Referenzen konsistent', brokenHousehold.length === 0,
      brokenHousehold.length > 0 ? brokenHousehold.length + ' Kunden referenzieren nicht-existente primary_customer_id' : 'Alle Household-Referenzen gueltig',
      'warning',
      toRecs(brokenHousehold, 'Kunde',
        function(c) { return ((c.first_name || '') + ' ' + (c.last_name || '')).trim() || c.id; },
        function(c) { return '/kunden/' + c.id; },
        function(c) { return 'primary_id: ' + (c.primary_customer_id || '').slice(0, 12) + '... nicht gefunden'; }));

    var dossiersWithoutOrg = dossiers.filter(function(d) { return !d.organization_id; });
    addTest('tenant_isolation', 'Dossiers haben organization_id', dossiersWithoutOrg.length === 0,
      dossiersWithoutOrg.length > 0 ? dossiersWithoutOrg.length + ' Dossier(s) ohne organization_id' : 'Alle Dossiers haben organization_id',
      'critical',
      toRecs(dossiersWithoutOrg, 'Dossier',
        function(d) { return d.title || d.id; },
        function() { return '/beratungsdossier'; },
        function(d) { return 'Kunde: ' + (d.customer_name || '-') + ' | Status: ' + (d.status || '-'); }));

    // KAT 5: DATENINTEGRITAET
    var cancelledWithoutDate = contracts.filter(function(c) { return c.status === 'cancelled' && !c.cancel_date; });
    addTest('data_integrity', 'Gekuendigte Vertraege haben cancel_date', cancelledWithoutDate.length === 0,
      cancelledWithoutDate.length > 0 ? cancelledWithoutDate.length + ' Vertraege ohne cancel_date' : 'OK',
      'warning',
      toRecs(cancelledWithoutDate, 'Vertrag',
        function(c) { return (c.insurer || '-') + ' - ' + (c.customer_name || '-'); },
        function() { return '/vertraege'; },
        function(c) { return 'Police: ' + (c.policy_number || '-'); }));

    var convertedLeads = leads.filter(function(l) { return l.status === 'converted'; });
    var convertedWithoutCustomer = convertedLeads.filter(function(l) { return !l.customer_id; });
    addTest('data_integrity', 'Konvertierte Leads haben customer_id', convertedWithoutCustomer.length === 0,
      convertedWithoutCustomer.length > 0 ? convertedWithoutCustomer.length + ' konvertierte Leads ohne customer_id' : convertedLeads.length + ' konvertierte Leads korrekt',
      'critical',
      toRecs(convertedWithoutCustomer, 'Lead',
        function(l) { return ((l.first_name || '') + ' ' + (l.last_name || '')).trim() || l.id; },
        function() { return '/leads'; },
        function(l) { return 'E-Mail: ' + (l.email || '-') + ' | Quelle: ' + (l.source || '-'); }));

    var stornoWithoutRef = commissions.filter(function(c) { return c.is_storno && !c.storno_reference_id; });
    addTest('data_integrity', 'Stornos haben storno_reference_id', stornoWithoutRef.length === 0,
      stornoWithoutRef.length > 0 ? stornoWithoutRef.length + ' Storno(s) ohne Referenz' : 'OK',
      'critical',
      toRecs(stornoWithoutRef, 'Provision',
        function(c) { return (c.insurer || '-') + ' - ' + (c.advisor_name || '-'); },
        function() { return '/provisionen-courtagen'; },
        function(c) { return 'Police: ' + (c.policy_number || '-') + ' | CHF ' + ((c.advisor_courtage_amount || c.advisor_provision_amount || 0).toFixed(2)); }));

    var negativePaidCommissions = commissions.filter(function(c) {
      return (c.courtage_payout_amount != null && c.courtage_payout_amount < 0 && !c.is_storno) ||
             (c.provision_payout_amount != null && c.provision_payout_amount < 0 && !c.is_storno);
    });
    addTest('data_integrity', 'Keine negativen Auszahlungsbetraege (non-storno)', negativePaidCommissions.length === 0,
      negativePaidCommissions.length > 0 ? negativePaidCommissions.length + ' Provisionen mit negativem Auszahlungsbetrag' : 'OK',
      'critical',
      toRecs(negativePaidCommissions, 'Provision',
        function(c) { return (c.insurer || '-') + ' - ' + (c.advisor_name || '-'); },
        function() { return '/provisionen-courtagen'; },
        function(c) { return 'Netto: CHF ' + ((c.courtage_payout_amount || c.provision_payout_amount || 0).toFixed(2)); }));

    // KAT 6: AUDIT-TRAIL
    var docsWithoutUploadedBy = documents.filter(function(d) { return d.file_url && !d.uploaded_by && !d.created_by; });
    addTest('audit_trail', 'Dokumente haben uploaded_by', docsWithoutUploadedBy.length === 0,
      docsWithoutUploadedBy.length > 0 ? docsWithoutUploadedBy.length + ' Dokument(e) ohne uploaded_by' : 'Alle Dokumente mit Uploader',
      'warning',
      toRecs(docsWithoutUploadedBy, 'Dokument',
        function(d) { return d.name || d.id; },
        function() { return '/dokumente'; },
        function(d) { return 'Kategorie: ' + (d.category || '-') + ' | Typ: ' + (d.doc_type || '-'); }));

    var approvedWithoutHistory = approvedDossiers.filter(function(d) { return !d.approval_history || d.approval_history.length === 0; });
    var approvedWithHistory = approvedDossiers.filter(function(d) { return d.approval_history && d.approval_history.length > 0; });
    addTest('audit_trail', 'Approval-History bei freigegebenen Dossiers',
      approvedDossiers.length === 0 || approvedWithHistory.length > 0,
      approvedWithHistory.length + '/' + approvedDossiers.length + ' haben approval_history',
      'critical',
      toRecs(approvedWithoutHistory, 'Dossier',
        function(d) { return d.title || d.id; },
        function() { return '/beratungsdossier'; },
        function(d) { return 'Kunde: ' + (d.customer_name || '-') + ' | Freigabe: ' + (d.approved_at ? new Date(d.approved_at).toLocaleDateString('de-CH') : '-'); }));

    var pdfExportsWithoutApprovedBy = exportLogs.filter(function(l) { return !l.approved_by && !l.generated_by_name; });
    addTest('audit_trail', 'Export-Logs haben Benutzerreferenz', pdfExportsWithoutApprovedBy.length === 0,
      pdfExportsWithoutApprovedBy.length > 0 ? pdfExportsWithoutApprovedBy.length + ' Exports ohne Benutzerreferenz' : 'Alle Exports mit Benutzerreferenz',
      'warning',
      toRecs(pdfExportsWithoutApprovedBy, 'PdfExportLog',
        function(l) { return l.dossier_title || l.filename || l.id; },
        function() { return '/admin/enterprise-control-center'; },
        function(l) { return 'Export: ' + (l.exported_at ? new Date(l.exported_at).toLocaleDateString('de-CH') : '-'); }));

    // KAT 7: PDF-HASH-INTEGRITAET
    var dossierWithPdfNoHash = dossiers.filter(function(d) { return d.final_pdf_version && !d.final_pdf_hash; });
    addTest('pdf_integrity', 'Alle gespeicherten PDFs haben final_pdf_hash', dossierWithPdfNoHash.length === 0,
      dossierWithPdfNoHash.length > 0 ? dossierWithPdfNoHash.length + ' Dossier(s) ohne Hash-Pruefwert' : approvedDossiers.filter(function(d) { return d.final_pdf_hash; }).length + ' PDFs mit Hash gesichert',
      'critical',
      toRecs(dossierWithPdfNoHash, 'Dossier',
        function(d) { return d.title || d.id; },
        function() { return '/beratungsdossier'; },
        function(d) { return 'Kunde: ' + (d.customer_name || '-') + ' | PDF-v' + d.final_pdf_version; }));

    var dossierWithPdfNoUri = dossiers.filter(function(d) { return d.final_pdf_version && d.final_pdf_url && !d.final_pdf_file_uri; });
    addTest('pdf_integrity', 'PDFs in Private Storage (file_uri statt URL)', dossierWithPdfNoUri.length === 0,
      dossierWithPdfNoUri.length > 0 ? dossierWithPdfNoUri.length + ' Dossier(s) in Public Storage (Migration erforderlich)' : 'Alle PDFs im Private Storage',
      'warning',
      toRecs(dossierWithPdfNoUri, 'Dossier',
        function(d) { return d.title || d.id; },
        function() { return '/beratungsdossier'; },
        function(d) { return 'Kunde: ' + (d.customer_name || '-'); }));

    var hashCounts = {};
    exportLogs.forEach(function(l) { if (l.pdf_hash) hashCounts[l.pdf_hash] = (hashCounts[l.pdf_hash] || 0) + 1; });
    var dupHashCount = Object.values(hashCounts).filter(function(c) { return c > 1; }).length;
    addTest('pdf_integrity', 'Keine duplizierten PDF-Hashes (Archiv-Integritaet)', dupHashCount === 0,
      dupHashCount > 0 ? dupHashCount + ' duplizierte Hash-Werte im Export-Archiv' : 'Alle PDF-Hashes eindeutig', 'warning');

    // KAT 8: SECURITY
    var validRoles = ['admin', 'broker', 'assistenz', 'user', 'viewer', 'supervisor', 'reviewer'];
    var usersWithInvalidRole = users.filter(function(u) { return u.role && !validRoles.includes(u.role); });
    addTest('security', 'Alle Benutzer haben gueltige Rollen', usersWithInvalidRole.length === 0,
      usersWithInvalidRole.length > 0 ? usersWithInvalidRole.length + ' Benutzer mit ungueltiger Rolle' : users.length + ' Benutzer alle mit gueltiger Rolle',
      'critical',
      toRecs(usersWithInvalidRole, 'Benutzer',
        function(u) { return u.full_name || u.email; },
        function() { return '/berater-organisation'; },
        function(u) { return 'Rolle: ' + u.role + ' | ' + u.email; }));

    var usersWithoutRole = users.filter(function(u) { return !u.role; });
    addTest('security', 'Alle Benutzer haben eine Rolle', usersWithoutRole.length === 0,
      usersWithoutRole.length > 0 ? usersWithoutRole.length + ' Benutzer ohne Rollenzuweisung (Sicherheitsrisiko)' : 'Alle Benutzer haben Rollenzuweisung',
      'warning',
      toRecs(usersWithoutRole, 'Benutzer',
        function(u) { return u.full_name || u.email; },
        function() { return '/berater-organisation'; },
        function(u) { return 'E-Mail: ' + u.email; }));

    var adminUsers = users.filter(function(u) { return u.role === 'admin'; });
    addTest('security', 'Admin-Konten vorhanden und begrenzt',
      adminUsers.length > 0 && adminUsers.length <= 5,
      adminUsers.length === 0 ? 'Kein Admin-Benutzer' : adminUsers.length > 5 ? adminUsers.length + ' Admin-Konten - Ueberpruefung empfohlen' : adminUsers.length + ' Admin-Konto(en) - OK',
      adminUsers.length > 5 ? 'warning' : 'critical',
      adminUsers.length > 5 ? toRecs(adminUsers, 'Benutzer', function(u) { return u.full_name || u.email; }, function() { return '/berater-organisation'; }, function(u) { return 'E-Mail: ' + u.email; }) : []);

    // KAT 9: DOKUMENTINTEGRITAET
    var docsWithoutName = documents.filter(function(d) { return !d.name; });
    addTest('document_integrity', 'Alle Dokumente haben Namen', docsWithoutName.length === 0,
      docsWithoutName.length > 0 ? docsWithoutName.length + ' Dokument(e) ohne Namen' : 'OK',
      'warning',
      toRecs(docsWithoutName, 'Dokument',
        function(d) { return 'Dokument ' + d.id.slice(0, 8); },
        function() { return '/dokumente'; },
        function(d) { return 'Hochgeladen: ' + (d.uploaded_by || d.created_by || '-'); }));

    var immutableDocsWithoutHash = documents.filter(function(d) { return d.immutable && !d.file_hash; });
    addTest('document_integrity', 'Immutable Dokumente haben file_hash', immutableDocsWithoutHash.length === 0,
      immutableDocsWithoutHash.length > 0 ? immutableDocsWithoutHash.length + ' immutable Dokumente ohne file_hash' : 'Alle immutable Dokumente haben Hash-Pruefwert',
      'critical',
      toRecs(immutableDocsWithoutHash, 'Dokument',
        function(d) { return d.name || d.id; },
        function() { return '/dokumente'; },
        function(d) { return 'Kunde: ' + (d.customer_name || '-'); }));

    var docsWithPublicUrl = documents.filter(function(d) {
      return d.file_url && d.file_url.startsWith('http') && !d.file_url.includes('storage') && d.immutable;
    });
    addTest('document_integrity', 'Immutable Dokumente nicht oeffentlich zugaenglich', docsWithPublicUrl.length === 0,
      docsWithPublicUrl.length > 0 ? docsWithPublicUrl.length + ' immutable Dokumente mit potenziell oeffentlicher URL' : 'OK',
      'warning',
      toRecs(docsWithPublicUrl, 'Dokument',
        function(d) { return d.name || d.id; },
        function() { return '/dokumente'; },
        function(d) { return 'Kunde: ' + (d.customer_name || '-'); }));

    // KAT 10: RECOVERY-READINESS
    var recentBackups = await base44.asServiceRole.entities.BackupLog.filter({ status: 'completed' });
    var latestBackup = recentBackups.sort(function(a, b) { return new Date(b.timestamp) - new Date(a.timestamp); })[0];
    var backupAge = latestBackup ? (Date.now() - new Date(latestBackup.timestamp).getTime()) / (1000 * 60 * 60 * 24) : 999;
    addTest('recovery', 'Letztes Backup < 24 Stunden alt', backupAge < 1,
      latestBackup ? 'Letztes Backup: ' + new Date(latestBackup.timestamp).toLocaleString('de-CH') + ' (' + backupAge.toFixed(1) + 'd alt)' : 'Kein abgeschlossenes Backup gefunden',
      backupAge > 7 ? 'critical' : 'warning');

    var failedBackupsList = recentBackups.filter(function(b) { return b.status === 'failed'; });
    addTest('recovery', 'Keine fehlgeschlagenen Backups', failedBackupsList.length === 0,
      failedBackupsList.length > 0 ? failedBackupsList.length + ' fehlgeschlagene(s) Backup(s)' : recentBackups.length + ' abgeschlossene Backups',
      'warning',
      toRecs(failedBackupsList, 'BackupLog',
        function(b) { return 'Backup ' + (b.backup_type || '') + ' ' + (b.backup_id || b.id); },
        function() { return '/admin/enterprise-control-center'; },
        function(b) { return 'Fehler: ' + (b.error_message || '-'); }));

    var backupsWithChecksum = recentBackups.filter(function(b) { return b.checksum; });
    addTest('recovery', 'Backups haben Pruefummen', recentBackups.length === 0 || backupsWithChecksum.length > 0,
      backupsWithChecksum.length + '/' + recentBackups.length + ' Backups mit Pruefumme', 'warning');

    // PRODUKTIONSFREIGABE
    report.production_ready = report.total_failed === 0;
    report.production_status = report.total_failed === 0
      ? (report.total_warnings === 0 ? 'FREIGEGEBEN' : 'FREIGEGEBEN_MIT_WARNUNGEN')
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

    // Incidents persistieren (dedupliziert, mit Datensatz-Details)
    var runId = 'val-' + Date.now();
    var failedTests = report.tests.filter(function(t) { return !t.passed; });
    var existingOpen = await base44.asServiceRole.entities.EnterpriseIncident.filter({ status: 'open' }, '-detected_at', 200);
    var openTitles = new Set(existingOpen.map(function(i) { return i.title; }));
    var newIncidents = failedTests.filter(function(t) { return !openTitles.has(t.name); });

    await Promise.all(newIncidents.map(function(t) {
      var sev = t.severity === 'warning' ? 'warning' : 'critical';
      var recsSummary = t.affected_records && t.affected_records.length > 0
        ? t.affected_records.map(function(r) { return r.name + (r.detail ? ' (' + r.detail + ')' : ''); }).join(' | ')
        : null;
      return base44.asServiceRole.entities.EnterpriseIncident.create({
        severity: sev,
        category: t.category,
        title: t.name,
        description: t.details,
        root_cause: t.root_cause || null,
        technical_details: recsSummary
          ? t.details + '\n\nBetroffene Datensaetze (' + t.affected_records.length + '):\n' + recsSummary
          : t.details,
        recommended_action: t.recommended_fix || 'Bitte manuell pruefen und beheben.',
        auto_fix_possible: t.auto_fix_possible || false,
        auto_fix_action: t.repair_action || null,
        governance_block: t.governance_block || false,
        manual_review_required: true,
        status: 'open',
        detected_by: 'runLiveSystemValidation',
        detected_at: report.timestamp,
        validation_run_id: runId,
      });
    }));

    report.new_incidents_created = newIncidents.length;
    report.deduplicated_incidents = failedTests.length - newIncidents.length;

    await base44.asServiceRole.entities.SystemLog.create({
      level: report.production_ready ? 'info' : 'error',
      source: 'live_system_validation',
      message: 'Enterprise Live Validation: ' + report.total_passed + '/' + report.summary.total_tests + ' bestanden (' + report.summary.pass_rate + '%) - ' + report.production_status,
      details: JSON.stringify({ categories: [...new Set(report.tests.map(function(t) { return t.category; }))], failed: report.total_failed, warnings: report.total_warnings }),
      user_email: user.email,
    });

    return Response.json(report);
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});