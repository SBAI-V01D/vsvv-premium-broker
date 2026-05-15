import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

/**
 * ENTERPRISE SYSTEM HEALTH CHECK
 * Runs every 60 minutes via automation.
 * Checks: Security, Functionality, Errors, Performance, Backup, Enterprise Status
 */

Deno.serve(async (req) => {
  const base44 = createClientFromRequest(req);
  const startTime = Date.now();

  // Allow both scheduled (no user) and manual (admin) invocation
  try {
    const user = await base44.auth.me().catch(() => null);
    if (user && user.role !== 'admin') {
      return Response.json({ error: 'Admin access required' }, { status: 403 });
    }
  } catch (_) { /* scheduled call, no user */ }

  console.log('[HealthCheck] === ENTERPRISE SYSTEM HEALTH CHECK START ===');

  const report = {
    timestamp: new Date().toISOString(),
    duration_ms: 0,
    overall_status: 'healthy', // healthy | warning | critical
    score: 100,
    categories: {},
    critical_issues: [],
    warnings: [],
    recommendations: [],
  };

  const deduct = (points, issue, level = 'warning') => {
    report.score = Math.max(0, report.score - points);
    if (level === 'critical') report.critical_issues.push(issue);
    else report.warnings.push(issue);
  };

  // ── 1. DATEN-LADEN ────────────────────────────────────────────────────────
  let customers = [], contracts = [], applications = [], documents = [],
      tasks = [], commissions = [], backupLogs = [], errorLogs = [], systemLogs = [];

  try {
    [customers, contracts, applications, documents, tasks, commissions, backupLogs, errorLogs, systemLogs] =
      await Promise.all([
        base44.asServiceRole.entities.Customer.list(null, 5000),
        base44.asServiceRole.entities.Contract.list(null, 10000),
        base44.asServiceRole.entities.Application.list(null, 10000),
        base44.asServiceRole.entities.Document.list(null, 5000),
        base44.asServiceRole.entities.Task.list(null, 5000),
        base44.asServiceRole.entities.CommissionEntry.list(null, 10000),
        base44.asServiceRole.entities.BackupLog.list('-timestamp', 50),
        base44.asServiceRole.entities.ErrorLog.filter({ status: 'new' }, 200).catch(() => []),
        base44.asServiceRole.entities.SystemLog.list('-created_date', 100),
      ]);
    console.log(`[HealthCheck] Data loaded: ${customers.length} customers, ${contracts.length} contracts`);
  } catch (err) {
    deduct(30, `Data load failed: ${err.message}`, 'critical');
  }

  // ── 2. SICHERHEIT (Security) ──────────────────────────────────────────────
  const security = { score: 100, checks: {} };

  // Kunden ohne organization_id → Datenlücke / Zugriffsproblem
  const customersNoOrg = customers.filter(c => !c.archived && !c.organization_id);
  security.checks.customers_without_org = customersNoOrg.length;
  if (customersNoOrg.length > 10) deduct(10, `${customersNoOrg.length} Kunden ohne Organisation (Zugriffslücke)`);

  // Portal-aktivierte Kunden mit abgelaufenem/ungültigem Mandat
  const portalNoMandate = customers.filter(c => c.portal_enabled && c.mandate_status === 'invalid');
  security.checks.portal_invalid_mandate = portalNoMandate.length;
  if (portalNoMandate.length > 0) deduct(15, `${portalNoMandate.length} Portal-Kunden mit ungültigem Mandat`, 'critical');

  // Dokumente ohne Kundenzuordnung (unstrukturierte Daten)
  const docsNoCustomer = documents.filter(d => !d.customer_id && !d.primary_customer_id);
  security.checks.documents_without_customer = docsNoCustomer.length;
  if (docsNoCustomer.length > 20) deduct(5, `${docsNoCustomer.length} Dokumente ohne Kundenzuordnung`);

  report.categories.security = security;

  // ── 3. FUNKTIONALITÄT (Functionality) ─────────────────────────────────────
  const functionality = { score: 100, checks: {} };

  // Verwaiste Verträge (kein Kunde)
  const customerIds = new Set(customers.map(c => c.id));
  const orphanedContracts = contracts.filter(c => !c.archived && !customerIds.has(c.customer_id));
  functionality.checks.orphaned_contracts = orphanedContracts.length;
  if (orphanedContracts.length > 0) deduct(10, `${orphanedContracts.length} Verträge ohne Kunden (verwaist)`, 'critical');

  // Verwaiste Anträge
  const orphanedApps = applications.filter(a => !a.archived && !customerIds.has(a.customer_id));
  functionality.checks.orphaned_applications = orphanedApps.length;
  if (orphanedApps.length > 0) deduct(8, `${orphanedApps.length} Anträge ohne Kunden (verwaist)`);

  // Offene Aufgaben > 30 Tage überfällig
  const now = new Date();
  const overdueTasks = tasks.filter(t => {
    if (t.status === 'completed') return false;
    if (!t.due_date) return false;
    const dueDate = new Date(t.due_date);
    return (now - dueDate) > 30 * 24 * 60 * 60 * 1000;
  });
  functionality.checks.overdue_tasks_30d = overdueTasks.length;
  if (overdueTasks.length > 20) deduct(5, `${overdueTasks.length} Aufgaben > 30 Tage überfällig`);

  // Anträge ohne Status > 14 Tage
  const stuckApps = applications.filter(a => {
    if (['approved', 'rejected', 'archived'].includes(a.status)) return false;
    const created = new Date(a.created_date);
    return (now - created) > 14 * 24 * 60 * 60 * 1000 && !a.status_changed_at;
  });
  functionality.checks.stuck_applications = stuckApps.length;
  if (stuckApps.length > 5) deduct(5, `${stuckApps.length} Anträge > 14 Tage ohne Statusänderung`);

  // Provisionen im Status 'pending' > 60 Tage
  const oldPendingCommissions = commissions.filter(c => {
    if (!['pending', 'invoiced'].includes(c.status)) return false;
    const created = new Date(c.created_date || c.entry_date || 0);
    return (now - created) > 60 * 24 * 60 * 60 * 1000;
  });
  functionality.checks.old_pending_commissions = oldPendingCommissions.length;
  if (oldPendingCommissions.length > 10) deduct(5, `${oldPendingCommissions.length} Provisionen > 60 Tage ausstehend`);

  report.categories.functionality = functionality;

  // ── 4. FEHLER (Errors) ────────────────────────────────────────────────────
  const errors = { score: 100, checks: {} };

  // Neue ungelöste Fehler
  errors.checks.unresolved_error_logs = errorLogs.length;
  if (errorLogs.length > 0) {
    const critical = errorLogs.filter(e => e.error_type === 'automation_failed' || e.error_type === 'upload_failed');
    if (critical.length > 0) deduct(15, `${critical.length} kritische ungelöste Fehler (Automation/Upload)`, 'critical');
    else if (errorLogs.length > 5) deduct(10, `${errorLogs.length} ungelöste Systemfehler`);
  }

  // System-Logs: Fehler der letzten 60 Min
  const oneHourAgo = new Date(now.getTime() - 60 * 60 * 1000);
  const recentSystemErrors = systemLogs.filter(l => {
    if (l.level !== 'error') return false;
    return new Date(l.created_date) > oneHourAgo;
  });
  errors.checks.system_errors_last_hour = recentSystemErrors.length;
  if (recentSystemErrors.length > 5) deduct(10, `${recentSystemErrors.length} System-Errors in der letzten Stunde`);

  report.categories.errors = errors;

  // ── 5. PERFORMANCE (Schnelligkeit) ────────────────────────────────────────
  const performance = { score: 100, checks: {} };

  // Datenbankgrösse: Warnung bei sehr grossen Datensätzen
  performance.checks.total_records = customers.length + contracts.length + applications.length + documents.length;
  performance.checks.customers = customers.length;
  performance.checks.contracts = contracts.length;
  performance.checks.applications = applications.length;
  performance.checks.documents = documents.length;
  performance.checks.tasks = tasks.length;
  performance.checks.commissions = commissions.length;

  // Dokumente ohne Klassifizierung (Pipeline-Stau)
  const unclassifiedDocs = documents.filter(d => d.classification_status === 'ausstehend');
  performance.checks.unclassified_documents = unclassifiedDocs.length;
  if (unclassifiedDocs.length > 30) deduct(5, `${unclassifiedDocs.length} Dokumente warten auf Klassifizierung (Pipeline-Stau)`);

  // Anträge ohne Sparte (Datenqualität / Performance)
  const appsNoSparte = applications.filter(a => !a.sparte && !a.insurance_type && !a.archived);
  performance.checks.applications_without_sparte = appsNoSparte.length;
  if (appsNoSparte.length > 20) deduct(3, `${appsNoSparte.length} Anträge ohne Sparte`);

  report.categories.performance = performance;

  // ── 6. SICHERUNG (Backup) ─────────────────────────────────────────────────
  const backup = { score: 100, checks: {} };

  // Letztes Backup
  const lastBackup = backupLogs.find(b => b.status === 'completed');
  if (!lastBackup) {
    deduct(30, 'Kein erfolgreiches Backup gefunden!', 'critical');
    backup.checks.last_backup = null;
  } else {
    const backupAge = (now - new Date(lastBackup.timestamp)) / (1000 * 60 * 60); // hours
    backup.checks.last_backup = lastBackup.timestamp;
    backup.checks.last_backup_age_hours = Math.round(backupAge);
    backup.checks.backup_type = lastBackup.backup_type;

    if (backupAge > 48) deduct(25, `Letztes Backup ist ${Math.round(backupAge)}h alt (> 48h)!`, 'critical');
    else if (backupAge > 25) deduct(10, `Letztes Backup ist ${Math.round(backupAge)}h alt (> 25h)`);
  }

  // Fehlgeschlagene Backups in den letzten 24h
  const recentFailedBackups = backupLogs.filter(b => {
    if (b.status !== 'failed') return false;
    return (now - new Date(b.timestamp)) < 24 * 60 * 60 * 1000;
  });
  backup.checks.failed_backups_24h = recentFailedBackups.length;
  if (recentFailedBackups.length > 0) deduct(15, `${recentFailedBackups.length} fehlgeschlagene Backups in den letzten 24h`, 'critical');

  // Backup-Typen vorhanden?
  const hasIncremental = backupLogs.some(b => b.backup_type === 'incremental' && b.status === 'completed');
  const hasFull = backupLogs.some(b => b.backup_type === 'full' && b.status === 'completed');
  backup.checks.has_incremental_backup = hasIncremental;
  backup.checks.has_full_backup = hasFull;
  if (!hasIncremental) deduct(10, 'Kein inkrementelles Backup vorhanden');
  if (!hasFull) deduct(10, 'Kein Full-Backup vorhanden');

  report.categories.backup = backup;

  // ── 7. ENTERPRISE STATUS ─────────────────────────────────────────────────
  const enterprise = { score: 100, checks: {} };

  // Aktive Kunden
  const activeCustomers = customers.filter(c => !c.archived && c.status === 'active');
  enterprise.checks.active_customers = activeCustomers.length;

  // Aktive Verträge
  const activeContracts = contracts.filter(c => !c.archived && c.status === 'active');
  enterprise.checks.active_contracts = activeContracts.length;

  // Verträge pro Kunde
  enterprise.checks.contracts_per_customer = activeCustomers.length > 0
    ? (activeContracts.length / activeCustomers.length).toFixed(2)
    : 0;

  // Mandate-Status
  const validMandates = customers.filter(c => !c.archived && c.mandate_status === 'valid');
  const expiredMandates = customers.filter(c => !c.archived && c.mandate_status === 'expired');
  enterprise.checks.valid_mandates = validMandates.length;
  enterprise.checks.expired_mandates = expiredMandates.length;
  if (expiredMandates.length > 5) deduct(8, `${expiredMandates.length} abgelaufene Mandate`);

  // Portal-Aktivierungsrate
  const portalEnabled = customers.filter(c => !c.archived && c.portal_enabled);
  enterprise.checks.portal_enabled_count = portalEnabled.length;
  enterprise.checks.portal_activation_rate = activeCustomers.length > 0
    ? ((portalEnabled.length / activeCustomers.length) * 100).toFixed(1) + '%'
    : '0%';

  // Gesamte Provision offen (Financial health)
  const totalOpenCommission = commissions
    .filter(c => ['pending', 'invoiced'].includes(c.status) && !c.archived)
    .reduce((sum, c) => sum + (c.courtage_payout_amount || c.advisor_courtage_amount || c.commission_amount || 0), 0);
  enterprise.checks.open_commission_chf = Math.round(totalOpenCommission);

  report.categories.enterprise = enterprise;

  // ── 8. OVERALL STATUS & SCORE ─────────────────────────────────────────────
  report.score = Math.max(0, report.score);
  if (report.score >= 90) report.overall_status = 'healthy';
  else if (report.score >= 70) report.overall_status = 'warning';
  else report.overall_status = 'critical';

  // Empfehlungen
  if (orphanedContracts.length > 0) report.recommendations.push('Verwaiste Verträge bereinigen (repairBrokenRelations)');
  if (docsNoCustomer.length > 20) report.recommendations.push('Dokumente ohne Kunden zuweisen');
  if (overdueTasks.length > 10) report.recommendations.push('Überfällige Aufgaben priorisieren');
  if (errorLogs.length > 0) report.recommendations.push('Fehler-Log im Admin-Bereich prüfen');
  if (!lastBackup || (now - new Date(lastBackup?.timestamp)) > 25 * 60 * 60 * 1000) {
    report.recommendations.push('Manuelles Backup sofort durchführen!');
  }
  if (expiredMandates.length > 0) report.recommendations.push('Abgelaufene Mandate erneuern');

  report.duration_ms = Date.now() - startTime;

  // ── 9. SYSTEMLOG EINTRAG ─────────────────────────────────────────────────
  const logLevel = report.overall_status === 'healthy' ? 'info'
    : report.overall_status === 'warning' ? 'warn' : 'error';

  await base44.asServiceRole.entities.SystemLog.create({
    level: logLevel,
    source: 'systemHealthCheck',
    message: `Health Check: ${report.overall_status.toUpperCase()} | Score: ${report.score}/100 | Kritisch: ${report.critical_issues.length} | Warnungen: ${report.warnings.length} | Dauer: ${report.duration_ms}ms`,
    related_entity_type: 'System',
    related_entity_id: 'health_check',
  });

  console.log(`[HealthCheck] === COMPLETE: ${report.overall_status.toUpperCase()} (${report.score}/100) in ${report.duration_ms}ms ===`);

  return Response.json(report);
});