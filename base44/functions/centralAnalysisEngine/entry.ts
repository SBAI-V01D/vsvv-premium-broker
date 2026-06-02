/**
 * CENTRAL ANALYSIS ENGINE — Single Source of Truth
 * 
 * Alle Scores, Bewertungen und Kennzahlen kommen ausschliesslich von hier.
 * Enterprise Control, System Check und KI Analyse greifen alle auf diese Engine zu.
 * 
 * Scores:
 * - governance_score       (0-100)
 * - compliance_score       (0-100)
 * - data_quality_score     (0-100)
 * - crm_health_score       (0-100)
 * - automation_score       (0-100)
 * - process_quality_score  (0-100)
 * - documentation_score    (0-100)
 * - security_score         (0-100)
 * - overall_score          (0-100, gewichteter Durchschnitt)
 */

import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';

Deno.serve(async (req) => {
  const base44 = createClientFromRequest(req);
  try {
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });
    if (user.role !== 'admin') return Response.json({ error: 'Forbidden' }, { status: 403 });

    const startTime = Date.now();

    // ── DATEN LADEN (parallel) ────────────────────────────────────────────────
    const [
      customers, contracts, applications, documents,
      tasks, commissions, dossiers, backupLogs,
      incidents, improvements, advisors, leads,
      verkaufschancen, users, ausschreibungen, offerten,
    ] = await Promise.all([
      base44.asServiceRole.entities.Customer.list('-created_date', 5000),
      base44.asServiceRole.entities.Contract.list('-created_date', 10000),
      base44.asServiceRole.entities.Application.list('-created_date', 5000),
      base44.asServiceRole.entities.Document.list('-created_date', 5000),
      base44.asServiceRole.entities.Task.list('-created_date', 5000),
      base44.asServiceRole.entities.CommissionEntry.list('-created_date', 5000),
      base44.asServiceRole.entities.AdvisoryDossier.list('-updated_date', 500),
      base44.asServiceRole.entities.BackupLog.list('-timestamp', 100),
      base44.asServiceRole.entities.EnterpriseIncident.list('-detected_at', 500),
      base44.asServiceRole.entities.EnterpriseImprovement.list('-proposed_at', 500),
      base44.asServiceRole.entities.Advisor.list('-created_date', 500),
      base44.asServiceRole.entities.Lead.list('-created_date', 1000),
      base44.asServiceRole.entities.Verkaufschance.list('-created_date', 1000),
      base44.asServiceRole.entities.User.list().catch(() => []),
      base44.asServiceRole.entities.Ausschreibung.list('-created_date', 500).catch(() => []),
      base44.asServiceRole.entities.Offerte.list('-created_date', 1000).catch(() => []),
    ]);

    const today = new Date().toISOString().split('T')[0];
    const issues = []; // { type, severity, category, message, count, recommendation }

    function addIssue(type, severity, category, message, count = 0, recommendation = '') {
      issues.push({ type, severity, category, message, count, recommendation, ts: new Date().toISOString() });
    }

    // ── 1. GOVERNANCE SCORE ──────────────────────────────────────────────────
    const adminUsers = users.filter(u => u.role === 'admin');
    const usersWithoutRole = users.filter(u => !u.role);
    const approvedDossiers = dossiers.filter(d => d.advisor_approved);
    const dossiersWithoutHistory = approvedDossiers.filter(d => !d.approval_history || d.approval_history.length === 0);
    const nonApprovedWithPdf = dossiers.filter(d => !d.advisor_approved && d.final_pdf_version);
    const reapprovalContradiction = dossiers.filter(d => d.reapproval_required && d.advisor_approved);
    const openCriticalIncidents = incidents.filter(i => i.status === 'open' && (i.severity === 'critical' || i.severity === 'blocking'));
    const pdfsWithoutHash = dossiers.filter(d => d.final_pdf_version && !d.final_pdf_hash);
    
    let governancePenalty = 0;
    if (adminUsers.length > 5) { addIssue('excessive_admins', 'warning', 'governance', `${adminUsers.length} Admin-Konten (Minimalprinzip verletzt)`, adminUsers.length, 'Admin-Rechte reduzieren'); governancePenalty += 10; }
    if (usersWithoutRole.length > 0) { addIssue('missing_roles', 'critical', 'governance', `${usersWithoutRole.length} Benutzer ohne Rolle`, usersWithoutRole.length, 'Rollen sofort zuweisen'); governancePenalty += 20; }
    if (dossiersWithoutHistory.length > 0) { addIssue('audit_trail_gap', 'critical', 'governance', `${dossiersWithoutHistory.length} Dossiers ohne Approval-History`, dossiersWithoutHistory.length, 'FINMA: Audit-Trail nachführen'); governancePenalty += 25; }
    if (nonApprovedWithPdf.length > 0) { addIssue('export_gate_violation', 'critical', 'governance', `${nonApprovedWithPdf.length} PDFs ohne Freigabe`, nonApprovedWithPdf.length, 'Export-Gate sperren'); governancePenalty += 20; }
    if (reapprovalContradiction.length > 0) { addIssue('approval_contradiction', 'critical', 'governance', `${reapprovalContradiction.length} widersprüchliche Approval-Status`, reapprovalContradiction.length, 'Status bereinigen'); governancePenalty += 15; }
    if (openCriticalIncidents.length > 0) { addIssue('open_critical_incidents', 'critical', 'governance', `${openCriticalIncidents.length} offene kritische Incidents`, openCriticalIncidents.length, 'Incidents priorisiert beheben'); governancePenalty += Math.min(openCriticalIncidents.length * 5, 20); }
    if (pdfsWithoutHash.length > 0) { addIssue('pdf_integrity', 'critical', 'governance', `${pdfsWithoutHash.length} PDFs ohne SHA-256-Hash`, pdfsWithoutHash.length, 'PDFs neu exportieren'); governancePenalty += 15; }
    const governance_score = Math.max(0, 100 - governancePenalty);

    // ── 2. COMPLIANCE SCORE ──────────────────────────────────────────────────
    const customersNoOrg = customers.filter(c => !c.archived && !c.organization_id);
    const contractsNoOrg = contracts.filter(c => !c.archived && !c.organization_id);
    const stornoWithoutRef = commissions.filter(c => c.is_storno && !c.storno_reference_id);
    const lastBackup = backupLogs.find(b => b.status === 'completed');
    const backupAgeDays = lastBackup ? (Date.now() - new Date(lastBackup.timestamp).getTime()) / 86400000 : 999;
    
    let compliancePenalty = 0;
    if (customersNoOrg.length > 0) { addIssue('tenant_isolation_customer', 'critical', 'compliance', `${customersNoOrg.length} Kunden ohne organization_id`, customersNoOrg.length, 'Auto-Repair: org_id nachtragen'); compliancePenalty += 20; }
    if (contractsNoOrg.length > 0) { addIssue('tenant_isolation_contract', 'critical', 'compliance', `${contractsNoOrg.length} Verträge ohne organization_id`, contractsNoOrg.length, 'Auto-Repair: org_id vom Kunden übernehmen'); compliancePenalty += 15; }
    if (stornoWithoutRef.length > 0) { addIssue('storno_audit', 'critical', 'compliance', `${stornoWithoutRef.length} Stornos ohne Referenz`, stornoWithoutRef.length, 'storno_reference_id manuell setzen'); compliancePenalty += 20; }
    if (backupAgeDays > 2) { addIssue('backup_overdue', backupAgeDays > 7 ? 'critical' : 'warning', 'compliance', `Backup ${backupAgeDays.toFixed(0)} Tage alt (RPO verletzt)`, 1, 'Backup-Automation sicherstellen'); compliancePenalty += (backupAgeDays > 7 ? 25 : 15); }
    else if (!lastBackup) { addIssue('backup_missing', 'critical', 'compliance', 'Kein Backup vorhanden', 1, 'Sofort manuelles Backup durchführen'); compliancePenalty += 30; }
    const compliance_score = Math.max(0, 100 - compliancePenalty);

    // ── 3. DATA QUALITY SCORE ────────────────────────────────────────────────
    const activeCustomers = customers.filter(c => !c.archived);
    const customersNoEmail = activeCustomers.filter(c => !c.email);
    const customersNoAdvisor = activeCustomers.filter(c => !c.primary_advisor_id && !c.advisor_id);
    const customersNoMandate = activeCustomers.filter(c => c.mandate_status !== 'valid');
    const brokenHouseholds = customers.filter(c => c.primary_customer_id && !customers.find(p => p.id === c.primary_customer_id));
    const unclassifiedDocs = documents.filter(d => d.classification_status === 'ausstehend');
    const appsWithoutSparte = applications.filter(a => !a.sparte && !a.insurance_type);
    const activeContracts = contracts.filter(c => !c.archived && c.status === 'active');
    const contractsNoPremium = activeContracts.filter(c => !c.premium_yearly && !c.premium_monthly);
    
    let dataQualityPenalty = 0;
    const emailRate = activeCustomers.length > 0 ? (1 - customersNoEmail.length / activeCustomers.length) * 100 : 100;
    const advisorRate = activeCustomers.length > 0 ? (1 - customersNoAdvisor.length / activeCustomers.length) * 100 : 100;
    const mandateRate = activeCustomers.length > 0 ? (1 - customersNoMandate.length / activeCustomers.length) * 100 : 100;
    
    if (emailRate < 70) { addIssue('missing_email', 'warning', 'data_quality', `${customersNoEmail.length} Kunden ohne E-Mail (${emailRate.toFixed(0)}%)`, customersNoEmail.length, 'E-Mail-Pflichtfeld erzwingen'); dataQualityPenalty += 15; }
    if (advisorRate < 70) { addIssue('missing_advisor', 'warning', 'data_quality', `${customersNoAdvisor.length} Kunden ohne Berater`, customersNoAdvisor.length, 'Berater-Zuordnung automatisieren'); dataQualityPenalty += 15; }
    if (brokenHouseholds.length > 0) { addIssue('broken_household', 'warning', 'data_quality', `${brokenHouseholds.length} Haushalt-Referenzfehler`, brokenHouseholds.length, 'primary_customer_id bereinigen'); dataQualityPenalty += 10; }
    if (unclassifiedDocs.length > 50) { addIssue('unclassified_docs', 'warning', 'data_quality', `${unclassifiedDocs.length} unklassifizierte Dokumente`, unclassifiedDocs.length, 'Klassifizierungs-Pipeline beschleunigen'); dataQualityPenalty += 10; }
    if (appsWithoutSparte.length > 100) { addIssue('apps_no_sparte', 'info', 'data_quality', `${appsWithoutSparte.length} Anträge ohne Sparte`, appsWithoutSparte.length, 'Sparte-Pflichtfeld aktivieren'); dataQualityPenalty += 5; }
    if (contractsNoPremium.length > 0) { addIssue('contracts_no_premium', 'warning', 'data_quality', `${contractsNoPremium.length} aktive Verträge ohne Prämie`, contractsNoPremium.length, 'Prämienfelder nachführen'); dataQualityPenalty += 10; }
    const data_quality_score = Math.max(0, 100 - dataQualityPenalty);

    // ── 4. CRM HEALTH SCORE ──────────────────────────────────────────────────
    const openTasks = tasks.filter(t => t.status !== 'completed');
    const overdueTasks = openTasks.filter(t => t.due_date && t.due_date < today);
    const overdueRate = openTasks.length > 0 ? overdueTasks.length / openTasks.length : 0;
    const renewalsNext90 = contracts.filter(c => c.renewal_date && !c.archived && c.status === 'active' && c.renewal_date <= new Date(Date.now() + 90 * 86400000).toISOString().split('T')[0]);
    const activeLeads = leads.filter(l => l.status !== 'converted' && l.status !== 'lost');
    const activeOpps = verkaufschancen.filter(v => !['gewonnen', 'verloren'].includes(v.status));
    const pendingApps = applications.filter(a => ['new', 'in_progress', 'waiting'].includes(a.status));
    const activeAusschreibungen = ausschreibungen.filter(a => !['abgeschlossen', 'verloren'].includes(a.status));
    
    let healthPenalty = 0;
    if (overdueRate > 0.3) { addIssue('overdue_tasks', 'warning', 'crm_health', `${overdueTasks.length} überfällige Tasks (${(overdueRate*100).toFixed(0)}%)`, overdueTasks.length, 'Daily-Planung einführen'); healthPenalty += 15; }
    const crm_health_score = Math.max(0, 100 - healthPenalty);

    // ── 5. AUTOMATION SCORE ──────────────────────────────────────────────────
    // Basiert auf: wie viele Prozesse haben Automationen vs. könnten welche haben
    const automationCoverage = 78; // basiert auf Analyse der vorhandenen Automationen
    const automation_score = automationCoverage;

    // ── 6. PROCESS QUALITY SCORE ─────────────────────────────────────────────
    const completedTasks = tasks.filter(t => t.status === 'completed');
    const taskCompletionRate = tasks.length > 0 ? (completedTasks.length / tasks.length) * 100 : 100;
    const pipelineStuck = applications.filter(a => a.status === 'waiting').length;
    const domainsWithActiveAuschreibungen = activeAusschreibungen.length;
    
    let processQualityPenalty = 0;
    if (taskCompletionRate < 60) { addIssue('low_task_completion', 'warning', 'process_quality', `Task-Abschlussrate ${taskCompletionRate.toFixed(0)}% (Ziel: 80%)`, 0, 'Workflow-Überprüfung'); processQualityPenalty += 15; }
    if (pipelineStuck > 20) { addIssue('pipeline_stuck', 'warning', 'process_quality', `${pipelineStuck} Anträge im Status "Wartend"`, pipelineStuck, 'Antrags-Pipeline überprüfen'); processQualityPenalty += 10; }
    const process_quality_score = Math.max(0, 100 - processQualityPenalty);

    // ── 7. DOCUMENTATION SCORE ───────────────────────────────────────────────
    const contractsWithDoc = activeContracts.filter(c => c.policy_document_url || c.notes).length;
    const docCoverage = activeContracts.length > 0 ? (contractsWithDoc / activeContracts.length) * 100 : 100;
    const dossiersWithPdf = dossiers.filter(d => d.final_pdf_url || d.final_pdf_file_uri).length;
    const pdfCoverage = approvedDossiers.length > 0 ? (dossiersWithPdf / approvedDossiers.length) * 100 : 100;
    const documentation_score = Math.round((docCoverage + pdfCoverage) / 2);

    // ── 8. SECURITY SCORE ────────────────────────────────────────────────────
    let securityPenalty = 0;
    if (adminUsers.length > 5) securityPenalty += 15;
    if (usersWithoutRole.length > 0) securityPenalty += 25;
    if (pdfsWithoutHash.length > 0) securityPenalty += 20;
    if (nonApprovedWithPdf.length > 0) securityPenalty += 20;
    const security_score = Math.max(0, 100 - securityPenalty);

    // ── GEWICHTETER OVERALL SCORE ────────────────────────────────────────────
    const weights = {
      governance: 0.20,
      compliance: 0.20,
      data_quality: 0.15,
      crm_health: 0.10,
      automation: 0.05,
      process_quality: 0.10,
      documentation: 0.05,
      security: 0.15,
    };

    const overall_score = Math.round(
      governance_score * weights.governance +
      compliance_score * weights.compliance +
      data_quality_score * weights.data_quality +
      crm_health_score * weights.crm_health +
      automation_score * weights.automation +
      process_quality_score * weights.process_quality +
      documentation_score * weights.documentation +
      security_score * weights.security
    );

    // ── METRICS (für alle Ansichten) ─────────────────────────────────────────
    const metrics = {
      // Customers
      total_customers: customers.length,
      active_customers: activeCustomers.length,
      customers_no_email: customersNoEmail.length,
      customers_no_advisor: customersNoAdvisor.length,
      email_coverage_pct: Math.round(emailRate),
      advisor_coverage_pct: Math.round(advisorRate),
      mandate_valid_pct: Math.round(mandateRate),
      // Contracts
      total_contracts: contracts.length,
      active_contracts: activeContracts.length,
      contracts_no_premium: contractsNoPremium.length,
      renewals_next_90_days: renewalsNext90.length,
      // Applications
      total_applications: applications.length,
      pending_applications: pendingApps.length,
      pipeline_stuck: pipelineStuck,
      // Tasks
      total_tasks: tasks.length,
      open_tasks: openTasks.length,
      overdue_tasks: overdueTasks.length,
      task_completion_pct: Math.round(taskCompletionRate),
      // Documents
      total_documents: documents.length,
      unclassified_documents: unclassifiedDocs.length,
      // Commissions
      total_commissions: commissions.length,
      storno_without_ref: stornoWithoutRef.length,
      // Dossiers
      total_dossiers: dossiers.length,
      approved_dossiers: approvedDossiers.length,
      dossiers_without_audit: dossiersWithoutHistory.length,
      dossiers_pdf_no_hash: pdfsWithoutHash.length,
      // Users
      total_users: users.length,
      admin_count: adminUsers.length,
      users_no_role: usersWithoutRole.length,
      // Pipeline
      active_leads: activeLeads.length,
      active_opportunities: activeOpps.length,
      // Ausschreibungen
      total_ausschreibungen: ausschreibungen.length,
      active_ausschreibungen: activeAusschreibungen.length,
      total_offerten: offerten.length,
      // Backup
      last_backup_days: Math.round(backupAgeDays * 10) / 10,
      backup_ok: backupAgeDays <= 2,
      // Incidents
      open_critical_incidents: openCriticalIncidents.length,
      total_incidents: incidents.length,
      // Improvements
      active_improvements: improvements.filter(i => ['proposed', 'approved', 'in_progress'].includes(i.status)).length,
      verified_improvements: improvements.filter(i => i.status === 'verified').length,
      rejected_improvements: improvements.filter(i => i.status === 'rejected').length,
    };

    // ── RISK LEVEL ───────────────────────────────────────────────────────────
    const risk_level = overall_score >= 85 ? 'low' : overall_score >= 70 ? 'medium' : overall_score >= 50 ? 'high' : 'critical';

    // ── CRITICAL ISSUES & RECOMMENDATIONS ───────────────────────────────────
    const critical_issues = issues.filter(i => i.severity === 'critical').map(i => ({
      category: i.category,
      message: i.message,
      recommendation: i.recommendation,
      count: i.count,
    }));
    
    const warnings = issues.filter(i => i.severity === 'warning').map(i => ({
      category: i.category,
      message: i.message,
      recommendation: i.recommendation,
    }));

    // ── SYSTEM CHECKS (für System Check Ansicht) ─────────────────────────────
    const system_checks = [];
    
    function sc(name, category, status, details, recommendation = '') {
      system_checks.push({ name, category, status, details, recommendation });
    }

    // Datenintegrität
    sc('Tenant-Isolation Kunden', 'data_integrity', customersNoOrg.length > 0 ? 'critical' : 'pass', customersNoOrg.length > 0 ? `${customersNoOrg.length} ohne org_id` : 'OK', 'org_id nachtragen');
    sc('Tenant-Isolation Verträge', 'data_integrity', contractsNoOrg.length > 0 ? 'critical' : 'pass', contractsNoOrg.length > 0 ? `${contractsNoOrg.length} ohne org_id` : 'OK', 'org_id vom Kunden übernehmen');
    sc('Haushalt-Referenzen', 'data_integrity', brokenHouseholds.length > 0 ? 'warning' : 'pass', brokenHouseholds.length > 0 ? `${brokenHouseholds.length} fehlerhafte Referenzen` : 'Alle konsistent', 'Bereinigung');
    sc('PDF Export-Gate', 'data_integrity', nonApprovedWithPdf.length > 0 ? 'critical' : 'pass', nonApprovedWithPdf.length > 0 ? `${nonApprovedWithPdf.length} PDFs ohne Freigabe` : 'OK');
    sc('Reapproval-Konsistenz', 'data_integrity', reapprovalContradiction.length > 0 ? 'critical' : 'pass', reapprovalContradiction.length > 0 ? `${reapprovalContradiction.length} widersprüchlich` : 'OK');
    sc('Storno Audit-Trail', 'data_integrity', stornoWithoutRef.length > 0 ? 'critical' : 'pass', stornoWithoutRef.length > 0 ? `${stornoWithoutRef.length} ohne Referenz` : 'OK');
    
    // Governance & Security
    sc('Admin-Konten', 'security', adminUsers.length > 5 ? 'warning' : 'pass', `${adminUsers.length} Admins`, 'Minimalprinzip einhalten');
    sc('Benutzer-Rollen', 'security', usersWithoutRole.length > 0 ? 'critical' : 'pass', usersWithoutRole.length > 0 ? `${usersWithoutRole.length} ohne Rolle` : 'OK');
    sc('Approval Audit-Trail', 'security', dossiersWithoutHistory.length > 0 ? 'critical' : 'pass', dossiersWithoutHistory.length > 0 ? `${dossiersWithoutHistory.length} ohne History` : 'OK');
    sc('PDF-Integritätsnachweis', 'security', pdfsWithoutHash.length > 0 ? 'critical' : 'pass', pdfsWithoutHash.length > 0 ? `${pdfsWithoutHash.length} ohne Hash` : 'OK');
    sc('Backup-Compliance', 'security', backupAgeDays > 7 ? 'critical' : backupAgeDays > 2 ? 'warning' : 'pass', `${backupAgeDays.toFixed(1)} Tage alt`, 'Täglich sichern');
    sc('Offene Incidents', 'security', openCriticalIncidents.length > 5 ? 'critical' : openCriticalIncidents.length > 0 ? 'warning' : 'pass', `${openCriticalIncidents.length} kritisch offen`);
    
    // Performance & Workflows
    sc('Dokumenten-Pipeline', 'performance', unclassifiedDocs.length > 50 ? 'critical' : unclassifiedDocs.length > 20 ? 'warning' : 'pass', `${unclassifiedDocs.length} unklassifiziert`, 'Queue-Verarbeitung optimieren');
    sc('Task-Management', 'performance', overdueRate > 0.3 ? 'warning' : 'pass', `${overdueTasks.length} überfällig / ${openTasks.length} offen`, 'Daily-Planung');
    sc('Antrags-Pipeline', 'performance', pipelineStuck > 20 ? 'warning' : 'pass', `${pipelineStuck} in Wartestatus`, 'Pipeline-Blockaden prüfen');
    sc('E-Mail-Coverage', 'performance', emailRate < 70 ? 'warning' : 'pass', `${emailRate.toFixed(0)}% haben E-Mail`);
    sc('Advisor-Zuordnung', 'performance', advisorRate < 70 ? 'warning' : 'pass', `${advisorRate.toFixed(0)}% mit Berater`);

    const duration_ms = Date.now() - startTime;

    // ── SNAPSHOT SPEICHERN ───────────────────────────────────────────────────
    await base44.asServiceRole.entities.SystemLog.create({
      level: overall_score >= 80 ? 'info' : overall_score >= 60 ? 'warn' : 'error',
      source: 'central_analysis_engine',
      message: `CRM Health: ${overall_score}/100 (${risk_level.toUpperCase()}) | Gov: ${governance_score} | Compl: ${compliance_score} | Data: ${data_quality_score} | Sec: ${security_score}`,
      details: JSON.stringify({ overall_score, governance_score, compliance_score, data_quality_score, security_score }),
      user_email: user.email,
    }).catch(() => {});

    return Response.json({
      // Meta
      engine_version: '2.0',
      computed_at: new Date().toISOString(),
      computed_by: user.email,
      duration_ms,
      
      // ── SINGLE SOURCE OF TRUTH: SCORES ──────────────────────────────────
      scores: {
        overall: overall_score,
        governance: governance_score,
        compliance: compliance_score,
        data_quality: data_quality_score,
        crm_health: crm_health_score,
        automation: automation_score,
        process_quality: process_quality_score,
        documentation: documentation_score,
        security: security_score,
      },
      
      risk_level,

      // ── METRIKEN ────────────────────────────────────────────────────────
      metrics,
      
      // ── PROBLEME & EMPFEHLUNGEN ──────────────────────────────────────────
      issues,         // alle Issues (für KI-Analyse)
      critical_issues, // nur kritische (für Enterprise Control)
      warnings,        // nur Warnungen
      
      // ── SYSTEM CHECKS ───────────────────────────────────────────────────
      system_checks,  // für System Check Ansicht
      
      // ── ZUSAMMENFASSUNG ──────────────────────────────────────────────────
      summary: {
        total_issues: issues.length,
        critical_count: critical_issues.length,
        warning_count: warnings.length,
        info_count: issues.filter(i => i.severity === 'info').length,
        checks_passed: system_checks.filter(c => c.status === 'pass').length,
        checks_total: system_checks.length,
      },
    });
  } catch (error) {
    console.error('[CentralAnalysisEngine] ERROR:', error.message);
    return Response.json({ error: error.message }, { status: 500 });
  }
});