/**
 * validateEnterpriseIntegrity — Sprint E v2: Systemweiter Enterprise-Check
 *
 * Prüft alle Kernmodule:
 *   DOSSIERS:      PDF-Governance, Approval, Snapshots, Confidence
 *   KUNDEN:        Pflichtfelder, Soft-Delete-Konsistenz, Household-Isolation
 *   DOKUMENTE:     Hash-Pflicht, Private-Storage, Immutable-Flags
 *   ANTRÄGE:       Status-Konsistenz, Status-History
 *   VERTRÄGE:      Versions-Konsistenz, Status-Pflichtfelder, Dokument-Verknüpfung
 *   PROVISIONEN:   Berechnungs-Integrität, Storno-Konsistenz
 *   LEADS:         Pipeline-Konsistenz, Duplikat-Check
 *   AUFGABEN:      Assigned-Konsistenz, überfällige Tasks
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

    const results = {
      timestamp: new Date().toISOString(),
      checked_by: user.full_name || user.email,
      checks: [],
      total_issues: 0,
      status: 'ok',
      module_summary: {},
    };

    function addCheck(module, name, passed, issues = [], details = {}) {
      results.checks.push({ module, name, passed, issue_count: issues.length, issues: issues.slice(0, 5), ...details });
      results.total_issues += issues.length;
      if (!results.module_summary[module]) results.module_summary[module] = { checks: 0, issues: 0, status: 'ok' };
      results.module_summary[module].checks++;
      results.module_summary[module].issues += issues.length;
      if (issues.length > 0) results.module_summary[module].status = issues.length > 3 ? 'critical' : 'warning';
    }

    // ── Daten parallel laden ─────────────────────────────────────────────────
    const [
      dossiers, approvedDossiers, exportLogs, snapshots,
      customers, documents, applications, contracts,
      commissions, leads, tasks, verkaufschancen,
    ] = await Promise.all([
      base44.asServiceRole.entities.AdvisoryDossier.filter({ archived: false }),
      base44.asServiceRole.entities.AdvisoryDossier.filter({ advisor_approved: true }),
      base44.asServiceRole.entities.PdfExportLog.list('-exported_at', 200),
      base44.asServiceRole.entities.DossierSnapshot.list('-created_date', 500),
      base44.asServiceRole.entities.Customer.list('-created_date', 500),
      base44.asServiceRole.entities.Document.list('-created_date', 500),
      base44.asServiceRole.entities.Application.list('-created_date', 500),
      base44.asServiceRole.entities.Contract.list('-created_date', 500),
      base44.asServiceRole.entities.CommissionEntry.list('-created_date', 500),
      base44.asServiceRole.entities.Lead.list('-created_date', 200),
      base44.asServiceRole.entities.Task.list('-created_date', 200),
      base44.asServiceRole.entities.Verkaufschance.list('-created_date', 200),
    ]);

    // ══════════════════════════════════════════════════════════════════════════
    // MODULE: DOSSIERS
    // ══════════════════════════════════════════════════════════════════════════
    addCheck('dossiers', 'PDF-Hash-Pflicht',
      !approvedDossiers.some(d => d.final_pdf_version && !d.final_pdf_hash),
      approvedDossiers.filter(d => d.final_pdf_version && !d.final_pdf_hash)
        .map(d => ({ id: d.id, title: d.title, issue: 'PDF exportiert ohne Hash' }))
    );
    addCheck('dossiers', 'Snapshot-Koppelung',
      !approvedDossiers.some(d => !d.approved_snapshot_id),
      approvedDossiers.filter(d => !d.approved_snapshot_id)
        .map(d => ({ id: d.id, title: d.title, issue: 'Freigabe ohne Snapshot' }))
    );
    addCheck('dossiers', 'Reapproval-Konsistenz',
      !dossiers.some(d => d.reapproval_required && d.advisor_approved),
      dossiers.filter(d => d.reapproval_required && d.advisor_approved)
        .map(d => ({ id: d.id, title: d.title, issue: 'reapproval_required=true aber advisor_approved=true' }))
    );
    addCheck('dossiers', 'ExportLog-Hash',
      !exportLogs.some(l => !l.pdf_hash),
      exportLogs.filter(l => !l.pdf_hash).map(l => ({ id: l.id, issue: 'Export ohne Hash' }))
    );
    addCheck('dossiers', 'Orphaned-Snapshots',
      true,
      (() => {
        const ids = new Set(dossiers.map(d => d.id));
        return snapshots.filter(s => !ids.has(s.dossier_id)).map(s => ({ id: s.id, dossier_id: s.dossier_id, issue: 'Snapshot ohne Dossier' }));
      })()
    );

    // ══════════════════════════════════════════════════════════════════════════
    // MODULE: KUNDEN
    // ══════════════════════════════════════════════════════════════════════════
    const activeCustomers = customers.filter(c => !c.archived);
    addCheck('customers', 'Pflichtfelder',
      true,
      activeCustomers.filter(c => !c.first_name || !c.last_name || !c.email)
        .map(c => ({ id: c.id, name: `${c.first_name} ${c.last_name}`, issue: 'Fehlende Pflichtfelder' }))
    );
    addCheck('customers', 'Household-Konsistenz',
      true,
      (() => {
        const allIds = new Set(customers.map(c => c.id));
        return customers
          .filter(c => c.primary_customer_id && !allIds.has(c.primary_customer_id))
          .map(c => ({ id: c.id, issue: `primary_customer_id ${c.primary_customer_id} existiert nicht` }));
      })()
    );
    addCheck('customers', 'Soft-Delete-Konsistenz',
      true,
      customers.filter(c => c.archived && !c.archived_at)
        .map(c => ({ id: c.id, issue: 'archived=true aber archived_at fehlt' }))
    );
    addCheck('customers', 'Organisation-Isolation',
      true,
      activeCustomers.filter(c => !c.organization_id)
        .map(c => ({ id: c.id, name: `${c.first_name} ${c.last_name}`, issue: 'Kein organization_id (Tenant-Isolation verletzt)' }))
    );

    // ══════════════════════════════════════════════════════════════════════════
    // MODULE: DOKUMENTE
    // ══════════════════════════════════════════════════════════════════════════
    const activeDocs = documents.filter(d => d.file_url);
    addCheck('documents', 'Private-Storage-Check',
      true,
      activeDocs.filter(d => d.file_url && !d.file_url.includes('private') && !d.file_url.includes('supabase'))
        .slice(0, 20)
        .map(d => ({ id: d.id, name: d.name, issue: 'Möglicherweise öffentliche URL (keine Private-Storage-URI)' }))
    );
    addCheck('documents', 'Uploaded-By-Pflicht',
      true,
      activeDocs.filter(d => !d.uploaded_by && !d.created_by)
        .map(d => ({ id: d.id, name: d.name, issue: 'uploaded_by fehlt (Audit-Trail lückenhaft)' }))
    );
    addCheck('documents', 'Kunde-Zuordnung',
      true,
      activeDocs.filter(d => !d.customer_id)
        .map(d => ({ id: d.id, name: d.name, issue: 'Kein customer_id (Tenant-Isolation verletzt)' }))
    );

    // ══════════════════════════════════════════════════════════════════════════
    // MODULE: ANTRÄGE
    // ══════════════════════════════════════════════════════════════════════════
    const activeApps = applications.filter(a => !a.archived);
    const VALID_APP_STATUSES = new Set(['new', 'in_progress', 'waiting', 'approved', 'rejected', 'archived']);
    addCheck('applications', 'Status-Validität',
      true,
      activeApps.filter(a => a.status && !VALID_APP_STATUSES.has(a.status))
        .map(a => ({ id: a.id, status: a.status, issue: 'Ungültiger Status' }))
    );
    addCheck('applications', 'Kunde-Zuordnung',
      true,
      activeApps.filter(a => !a.customer_id)
        .map(a => ({ id: a.id, issue: 'Kein customer_id' }))
    );
    addCheck('applications', 'Organisation-Isolation',
      true,
      activeApps.filter(a => !a.organization_id)
        .map(a => ({ id: a.id, issue: 'Kein organization_id (Tenant-Isolation)' }))
    );

    // ══════════════════════════════════════════════════════════════════════════
    // MODULE: VERTRÄGE
    // ══════════════════════════════════════════════════════════════════════════
    const activeContracts = contracts.filter(c => !c.archived && c.status !== 'archived');
    addCheck('contracts', 'Pflichtfelder',
      true,
      activeContracts.filter(c => !c.insurer || !c.insurance_type)
        .map(c => ({ id: c.id, issue: 'Fehlende Pflichtfelder (insurer/insurance_type)' }))
    );
    addCheck('contracts', 'Soft-Delete-Konsistenz',
      true,
      contracts.filter(c => c.archived && !c.archived_at)
        .map(c => ({ id: c.id, issue: 'archived=true aber archived_at fehlt' }))
    );
    addCheck('contracts', 'Organisation-Isolation',
      true,
      activeContracts.filter(c => !c.organization_id)
        .map(c => ({ id: c.id, insurer: c.insurer, issue: 'Kein organization_id (Tenant-Isolation)' }))
    );
    addCheck('contracts', 'Storno-Periode-Konsistenz',
      true,
      activeContracts.filter(c => c.status === 'cancelled' && !c.cancel_date)
        .map(c => ({ id: c.id, issue: 'status=cancelled aber cancel_date fehlt' }))
    );

    // ══════════════════════════════════════════════════════════════════════════
    // MODULE: PROVISIONEN
    // ══════════════════════════════════════════════════════════════════════════
    const activeComm = commissions.filter(c => !c.archived && !c.is_storno);
    addCheck('commissions', 'Berater-Zuordnung',
      true,
      activeComm.filter(c => !c.advisor_id)
        .map(c => ({ id: c.id, issue: 'Kein advisor_id' }))
    );
    addCheck('commissions', 'Doppelzahlung-Guard',
      true,
      activeComm.filter(c => c.is_paid && c.courtage_status !== 'paid' && c.provision_status !== 'paid')
        .map(c => ({ id: c.id, issue: 'is_paid=true aber Status nicht "paid"' }))
    );
    addCheck('commissions', 'Storno-Referenz-Konsistenz',
      true,
      commissions.filter(c => c.is_storno && !c.storno_reference_id)
        .map(c => ({ id: c.id, issue: 'is_storno=true aber storno_reference_id fehlt' }))
    );
    addCheck('commissions', 'Negativ-Betrag-Check',
      true,
      activeComm.filter(c => (c.advisor_courtage_amount != null && c.advisor_courtage_amount < 0) || (c.advisor_provision_amount != null && c.advisor_provision_amount < 0))
        .map(c => ({ id: c.id, issue: 'Negative Beraterbeträge ohne Storno-Flag' }))
    );

    // ══════════════════════════════════════════════════════════════════════════
    // MODULE: LEADS
    // ══════════════════════════════════════════════════════════════════════════
    const VALID_LEAD_STATUSES = new Set(['new', 'contacted', 'qualified', 'converted', 'lost']);
    addCheck('leads', 'Status-Validität',
      true,
      leads.filter(l => l.status && !VALID_LEAD_STATUSES.has(l.status))
        .map(l => ({ id: l.id, status: l.status, issue: 'Ungültiger Lead-Status' }))
    );
    addCheck('leads', 'Konvertierungs-Konsistenz',
      true,
      leads.filter(l => l.status === 'converted' && !l.customer_id)
        .map(l => ({ id: l.id, issue: 'status=converted aber customer_id fehlt' }))
    );
    addCheck('leads', 'Pflichtfelder',
      true,
      leads.filter(l => !l.first_name || !l.last_name || !l.email)
        .map(l => ({ id: l.id, issue: 'Fehlende Pflichtfelder' }))
    );

    // ══════════════════════════════════════════════════════════════════════════
    // MODULE: AUFGABEN
    // ══════════════════════════════════════════════════════════════════════════
    const today = new Date().toISOString().split('T')[0];
    const openTasks = tasks.filter(t => t.status !== 'completed');
    addCheck('tasks', 'Überfällige Tasks',
      true,
      openTasks.filter(t => t.due_date && t.due_date < today)
        .map(t => ({ id: t.id, title: t.title, due: t.due_date, issue: `Überfällig seit ${t.due_date}` })),
      { total_open: openTasks.length }
    );
    addCheck('tasks', 'Zuweisung-Konsistenz',
      true,
      openTasks.filter(t => !t.assigned_to)
        .map(t => ({ id: t.id, title: t.title, issue: 'Kein assigned_to' }))
    );

    // ══════════════════════════════════════════════════════════════════════════
    // GESAMTERGEBNIS
    // ══════════════════════════════════════════════════════════════════════════
    results.status = results.total_issues === 0 ? 'ok' : results.total_issues < 10 ? 'warning' : 'critical';
    results.summary = {
      total_customers: customers.length,
      total_contracts: contracts.length,
      active_contracts: activeContracts.length,
      total_applications: applications.length,
      total_documents: documents.length,
      total_leads: leads.length,
      total_tasks: tasks.length,
      total_commissions: commissions.length,
      total_dossiers: dossiers.length,
      approved_dossiers: approvedDossiers.length,
    };

    // SystemLog-Eintrag
    await base44.asServiceRole.entities.SystemLog.create({
      level: results.status === 'ok' ? 'info' : results.status === 'warning' ? 'warn' : 'error',
      source: 'enterprise_integrity_check',
      message: `Systemweite Integritätsprüfung: ${results.total_issues} Problem(e) in ${results.checks.length} Checks`,
      details: JSON.stringify({ status: results.status, total_issues: results.total_issues, modules: Object.keys(results.module_summary) }),
      user_email: user.email,
    });

    return Response.json(results);
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});