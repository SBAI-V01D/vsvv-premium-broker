import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

/**
 * ENTERPRISE VALIDATION SUITE — Final System Hardening
 * 
 * Führt vollständige Enterprise-Validierung durch:
 * 1. E2E Process Chain Validation (Antrag → Vertrag → Provision → Renewal)
 * 2. Race Condition & Parallel Tests
 * 3. Guard & Decision Validation
 * 4. Data Integrity & Governance Scan
 * 5. Performance Check
 * 
 * PRINZIPIEN:
 * - Read-Only auf Produktionsdaten (kein State verändern)
 * - Audit-Logs für alle Befunde
 * - Deterministische, reproduzierbare Ergebnisse
 * - Noise-bewusst: nur signifikante Findings loggen
 */
Deno.serve(async (req) => {
  const startTime = Date.now();

  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user || user.role !== 'admin') {
      return Response.json({ error: 'Admin access required' }, { status: 403 });
    }

    const body = await req.json();
    const suite = body.suite || 'all'; // 'e2e' | 'race' | 'guards' | 'integrity' | 'performance' | 'all'

    const today = new Date().toISOString().split('T')[0];
    const date = today.replace(/-/g, '');
    const runId = Math.random().toString(36).slice(2, 8).toUpperCase();
    const correlationId = `VAL-${date}-${runId}`;

    console.log(`[VALIDATION] START suite=${suite} correlation=${correlationId}`);

    const report = {
      suite_id: correlationId,
      suite,
      timestamp: new Date().toISOString(),
      sections: {},
      summary: { total_checks: 0, passed: 0, warnings: 0, failures: 0, critical: 0 },
    };

    // Daten einmalig laden — kein State ändern
    const [contracts, applications, tasks, commissions, auditLogs, customers] = await Promise.all([
      base44.asServiceRole.entities.Contract.list(),
      base44.asServiceRole.entities.Application.list(),
      base44.asServiceRole.entities.Task.list(),
      base44.asServiceRole.entities.CommissionEntry.list(),
      base44.asServiceRole.entities.AuditLog.list('-created_date', 100),
      base44.asServiceRole.entities.Customer.list(),
    ]);

    // ─────────────────────────────────────────────────────────────────────
    // SECTION 1: E2E PROCESS CHAIN VALIDATION
    // ─────────────────────────────────────────────────────────────────────
    if (suite === 'e2e' || suite === 'all') {
      const e2e = { checks: [], passed: 0, warnings: 0, failures: 0 };

      // Chain 1: Application → Contract (alle approved Apps haben Contract?)
      const approvedApps = applications.filter(a => a.status === 'approved' && !a.archived);
      const linkedApps = approvedApps.filter(a => a.linked_contract_id);
      const unlinkedApps = approvedApps.filter(a => !a.linked_contract_id);

      e2e.checks.push({
        check: 'approved_applications_have_contract',
        status: unlinkedApps.length === 0 ? 'pass' : 'warning',
        detail: `${linkedApps.length}/${approvedApps.length} approved applications have linked contract`,
        findings: unlinkedApps.map(a => ({ id: a.id, customer: a.customer_name, insurer: a.insurer })),
      });
      if (unlinkedApps.length === 0) e2e.passed++; else e2e.warnings++;

      // Chain 2: Contract → Commission (aktive Verträge haben Commission-Eintrag?)
      const activeContracts = contracts.filter(c => c.status === 'active' && !c.archived);
      const contractsWithCommission = activeContracts.filter(c =>
        commissions.some(cm => cm.policy_id === c.id && !cm.archived)
      );
      const contractsWithoutCommission = activeContracts.filter(c =>
        !commissions.some(cm => cm.policy_id === c.id && !cm.archived)
      );

      e2e.checks.push({
        check: 'active_contracts_have_commission',
        status: contractsWithoutCommission.length > activeContracts.length * 0.3 ? 'warning' : 'pass',
        detail: `${contractsWithCommission.length}/${activeContracts.length} active contracts have commission entry`,
        missing_count: contractsWithoutCommission.length,
      });
      if (contractsWithoutCommission.length <= activeContracts.length * 0.3) e2e.passed++; else e2e.warnings++;

      // Chain 3: Cancelled Contracts → Storno Commission
      const cancelledContracts = contracts.filter(c => c.status === 'cancelled' || c.cancel_date);
      const cancelledWithStorno = cancelledContracts.filter(c =>
        commissions.some(cm => cm.policy_id === c.id && cm.is_storno)
      );

      e2e.checks.push({
        check: 'cancelled_contracts_have_storno',
        status: 'info',
        detail: `${cancelledWithStorno.length}/${cancelledContracts.length} cancelled contracts have storno commission`,
      });
      e2e.passed++;

      // Chain 4: Renewal Tasks vorhanden für ablaufende Verträge (< 90d)
      const soonExpiring = contracts.filter(c => {
        if (c.status !== 'active' || !c.end_date) return false;
        const days = Math.ceil((new Date(c.end_date + 'T00:00:00Z') - new Date()) / 86400000);
        return days <= 90 && days >= 0;
      });
      const expiringWithTask = soonExpiring.filter(c =>
        tasks.some(t => t.contract_id === c.id && t.task_type === 'renewal' && t.status !== 'completed')
      );

      e2e.checks.push({
        check: 'expiring_contracts_have_renewal_task',
        status: soonExpiring.length > 0 && expiringWithTask.length < soonExpiring.length ? 'warning' : 'pass',
        detail: `${expiringWithTask.length}/${soonExpiring.length} expiring contracts have renewal task`,
        expiring_contracts: soonExpiring.map(c => ({
          id: c.id, customer: c.customer_name, insurer: c.insurer, end_date: c.end_date,
          has_task: expiringWithTask.some(x => x.id === c.id),
        })),
      });
      if (soonExpiring.length === 0 || expiringWithTask.length >= soonExpiring.length) e2e.passed++; else e2e.warnings++;

      // Chain 5: Tasks orphaned (kein Contract, kein Customer)
      const orphanedTasks = tasks.filter(t =>
        t.status !== 'completed' &&
        t.contract_id &&
        !contracts.find(c => c.id === t.contract_id)
      );

      e2e.checks.push({
        check: 'no_orphaned_tasks',
        status: orphanedTasks.length === 0 ? 'pass' : 'warning',
        detail: `${orphanedTasks.length} tasks reference non-existent contracts`,
        findings: orphanedTasks.map(t => ({ id: t.id, title: t.title, contract_id: t.contract_id })),
      });
      if (orphanedTasks.length === 0) e2e.passed++; else e2e.warnings++;

      report.sections.e2e = e2e;
      report.summary.total_checks += e2e.checks.length;
      report.summary.passed += e2e.passed;
      report.summary.warnings += e2e.warnings;
    }

    // ─────────────────────────────────────────────────────────────────────
    // SECTION 2: RACE CONDITION & DUPLICATE DETECTION
    // ─────────────────────────────────────────────────────────────────────
    if (suite === 'race' || suite === 'all') {
      const race = { checks: [], passed: 0, warnings: 0, failures: 0 };

      // Doppelte Verträge: gleicher Kunde + Versicherer + Status active
      const activeContractsByKey = {};
      contracts.filter(c => c.status === 'active').forEach(c => {
        const key = `${c.customer_id}|${c.insurer}|${c.insurance_type}`;
        if (!activeContractsByKey[key]) activeContractsByKey[key] = [];
        activeContractsByKey[key].push(c);
      });
      const duplicateContracts = Object.entries(activeContractsByKey)
        .filter(([, v]) => v.length > 1)
        .map(([k, v]) => ({ key: k, count: v.length, contracts: v.map(c => ({ id: c.id, customer: c.customer_name, insurer: c.insurer })) }));

      race.checks.push({
        check: 'no_duplicate_active_contracts',
        status: duplicateContracts.length === 0 ? 'pass' : 'critical',
        detail: `${duplicateContracts.length} duplicate active contract groups found`,
        findings: duplicateContracts,
      });
      if (duplicateContracts.length === 0) race.passed++; else { race.failures++; report.summary.critical++; }

      // Doppelte offene Tasks: gleicher Contract + Type
      const tasksByKey = {};
      tasks.filter(t => t.status !== 'completed' && t.contract_id).forEach(t => {
        const key = `${t.contract_id}|${t.task_type}`;
        if (!tasksByKey[key]) tasksByKey[key] = [];
        tasksByKey[key].push(t);
      });
      const duplicateTasks = Object.entries(tasksByKey)
        .filter(([, v]) => v.length > 1)
        .map(([k, v]) => ({ key: k, count: v.length, tasks: v.map(t => ({ id: t.id, title: t.title })) }));

      race.checks.push({
        check: 'no_duplicate_open_tasks',
        status: duplicateTasks.length === 0 ? 'pass' : 'warning',
        detail: `${duplicateTasks.length} duplicate open task groups found`,
        findings: duplicateTasks,
      });
      if (duplicateTasks.length === 0) race.passed++; else race.warnings++;

      // Storno-Duplikate: gleiche Policy mehrfach storniert
      const stornoByPolicy = {};
      commissions.filter(cm => cm.is_storno).forEach(cm => {
        if (!stornoByPolicy[cm.policy_id]) stornoByPolicy[cm.policy_id] = [];
        stornoByPolicy[cm.policy_id].push(cm);
      });
      const duplicateStornos = Object.entries(stornoByPolicy)
        .filter(([, v]) => v.length > 1);

      race.checks.push({
        check: 'no_duplicate_stornos',
        status: duplicateStornos.length === 0 ? 'pass' : 'critical',
        detail: `${duplicateStornos.length} policies with multiple storno entries`,
        findings: duplicateStornos.map(([k, v]) => ({ policy_id: k, count: v.length })),
      });
      if (duplicateStornos.length === 0) race.passed++; else { race.failures++; report.summary.critical++; }

      // Inkonsistente Statuswechsel: expired aber process_status != erledigt
      const statusMismatches = contracts.filter(c =>
        (c.status === 'expired' || c.status === 'cancelled') &&
        c.process_status &&
        !['erledigt', 'beratung_erfolgt'].includes(c.process_status)
      );

      race.checks.push({
        check: 'status_consistency',
        status: statusMismatches.length === 0 ? 'pass' : 'warning',
        detail: `${statusMismatches.length} contracts with inconsistent status/process_status`,
        findings: statusMismatches.map(c => ({ id: c.id, status: c.status, process_status: c.process_status, customer: c.customer_name })),
      });
      if (statusMismatches.length === 0) race.passed++; else race.warnings++;

      report.sections.race = race;
      report.summary.total_checks += race.checks.length;
      report.summary.passed += race.passed;
      report.summary.warnings += race.warnings;
      report.summary.failures += race.failures;
    }

    // ─────────────────────────────────────────────────────────────────────
    // SECTION 3: GUARD & DECISION VALIDATION (basierend auf AuditLogs)
    // ─────────────────────────────────────────────────────────────────────
    if (suite === 'guards' || suite === 'all') {
      const guards = { checks: [], passed: 0, warnings: 0, failures: 0 };

      // Guard-Coverage: welche Guards haben Treffer?
      const guardHits = {};
      auditLogs.filter(a => a.guard_evaluated).forEach(a => {
        const g = a.guard_evaluated;
        if (!guardHits[g]) guardHits[g] = { allowed: 0, blocked: 0, total: 0 };
        guardHits[g].total++;
        if (a.guard_result === 'blocked') guardHits[g].blocked++;
        if (a.guard_result === 'allowed') guardHits[g].allowed++;
      });

      guards.checks.push({
        check: 'guard_coverage',
        status: Object.keys(guardHits).length > 0 ? 'pass' : 'warning',
        detail: `${Object.keys(guardHits).length} unique guards observed`,
        guard_statistics: guardHits,
      });
      if (Object.keys(guardHits).length > 0) guards.passed++; else guards.warnings++;

      // Decision-Code Konsistenz
      const decisionCodes = {};
      auditLogs.filter(a => a.decision_code).forEach(a => {
        decisionCodes[a.decision_code] = (decisionCodes[a.decision_code] || 0) + 1;
      });
      const missingDecisionCodes = auditLogs.filter(a => !a.decision_code).length;

      guards.checks.push({
        check: 'decision_code_consistency',
        status: missingDecisionCodes < auditLogs.length * 0.1 ? 'pass' : 'warning',
        detail: `${missingDecisionCodes}/${auditLogs.length} audit logs missing decision_code`,
        decision_code_distribution: decisionCodes,
      });
      if (missingDecisionCodes < auditLogs.length * 0.1) guards.passed++; else guards.warnings++;

      // Correlation-ID Qualität
      const withCorrelation = auditLogs.filter(a => a.correlation_id).length;
      const correlationPct = auditLogs.length > 0 ? (withCorrelation / auditLogs.length * 100).toFixed(1) : 0;

      guards.checks.push({
        check: 'correlation_id_coverage',
        status: parseFloat(correlationPct) >= 30 ? 'pass' : 'warning',
        detail: `${correlationPct}% of audit logs have correlation_id (baseline: 34% from pilot)`,
        note: 'Coverage will increase as more processes are instrumented',
      });
      if (parseFloat(correlationPct) >= 30) guards.passed++; else guards.warnings++;

      // Audit-Level Verteilung (Noise-Check)
      const levelDist = { 1: 0, 2: 0, 3: 0, 4: 0 };
      auditLogs.forEach(a => { if (a.audit_level) levelDist[a.audit_level]++; });
      const level4Pct = auditLogs.length > 0 ? (levelDist[4] / auditLogs.length * 100).toFixed(1) : 0;

      guards.checks.push({
        check: 'audit_noise_level',
        status: parseFloat(level4Pct) < 30 ? 'pass' : 'warning',
        detail: `Level 4 (Debug) = ${level4Pct}% of logs — should stay < 30%`,
        level_distribution: levelDist,
      });
      if (parseFloat(level4Pct) < 30) guards.passed++; else guards.warnings++;

      report.sections.guards = guards;
      report.summary.total_checks += guards.checks.length;
      report.summary.passed += guards.passed;
      report.summary.warnings += guards.warnings;
    }

    // ─────────────────────────────────────────────────────────────────────
    // SECTION 4: DATA INTEGRITY & GOVERNANCE SCAN
    // ─────────────────────────────────────────────────────────────────────
    if (suite === 'integrity' || suite === 'all') {
      const integrity = { checks: [], passed: 0, warnings: 0, failures: 0 };

      // Verträge ohne Pflichtfelder
      const contractsNoOrg = contracts.filter(c => !c.organization_id);
      const contractsNoCustomer = contracts.filter(c => !c.customer_id);
      const contractsNoInsurer = contracts.filter(c => !c.insurer);
      const contractsNoEndDate = contracts.filter(c => c.status === 'active' && !c.end_date);

      integrity.checks.push({
        check: 'contract_required_fields',
        status: (contractsNoOrg.length + contractsNoCustomer.length + contractsNoInsurer.length) === 0 ? 'pass' : 'critical',
        detail: `Missing: org=${contractsNoOrg.length}, customer=${contractsNoCustomer.length}, insurer=${contractsNoInsurer.length}, active_no_end_date=${contractsNoEndDate.length}`,
      });
      if (contractsNoOrg.length + contractsNoCustomer.length + contractsNoInsurer.length === 0) integrity.passed++;
      else { integrity.failures++; report.summary.critical++; }

      // Kunden ohne Verträge (aktive Kunden)
      const activeCustomers = customers.filter(c => c.status === 'active' && !c.archived);
      const customersWithContracts = activeCustomers.filter(c =>
        contracts.some(ct => ct.customer_id === c.id && ct.status === 'active')
      );
      const customersWithoutContracts = activeCustomers.filter(c =>
        !contracts.some(ct => ct.customer_id === c.id && ct.status === 'active')
      );

      integrity.checks.push({
        check: 'active_customers_have_contracts',
        status: 'info',
        detail: `${customersWithContracts.length}/${activeCustomers.length} active customers have active contracts (${customersWithoutContracts.length} without)`,
      });
      integrity.passed++;

      // Commission ohne Policy-Link
      const commissionsNoPolicy = commissions.filter(cm => !cm.policy_id && !cm.is_storno && !cm.archived);

      integrity.checks.push({
        check: 'commissions_have_policy_link',
        status: commissionsNoPolicy.length === 0 ? 'pass' : 'warning',
        detail: `${commissionsNoPolicy.length} commission entries missing policy_id`,
        findings: commissionsNoPolicy.map(cm => ({ id: cm.id, advisor: cm.advisor_name, amount: cm.premium_yearly })),
      });
      if (commissionsNoPolicy.length === 0) integrity.passed++; else integrity.warnings++;

      // Verträge mit status 'aktiv' statt 'active' (Datenmigrations-Fehler)
      const wrongStatusContracts = contracts.filter(c => !['active', 'expired', 'cancelled', 'pending', 'archived'].includes(c.status));

      integrity.checks.push({
        check: 'valid_contract_status_values',
        status: wrongStatusContracts.length === 0 ? 'pass' : 'critical',
        detail: `${wrongStatusContracts.length} contracts with invalid status values`,
        findings: wrongStatusContracts.map(c => ({ id: c.id, status: c.status, customer: c.customer_name })),
      });
      if (wrongStatusContracts.length === 0) integrity.passed++; else { integrity.failures++; report.summary.critical++; }

      // Tasks für stornierte/archivierte Verträge (Orphan Tasks)
      const tasksForDeadContracts = tasks.filter(t =>
        t.status !== 'completed' && t.contract_id &&
        contracts.find(c => c.id === t.contract_id && ['cancelled', 'archived', 'expired'].includes(c.status))
      );

      integrity.checks.push({
        check: 'no_tasks_for_dead_contracts',
        status: tasksForDeadContracts.length === 0 ? 'pass' : 'warning',
        detail: `${tasksForDeadContracts.length} open tasks reference cancelled/archived/expired contracts`,
        findings: tasksForDeadContracts.map(t => ({ id: t.id, title: t.title, contract_id: t.contract_id })),
      });
      if (tasksForDeadContracts.length === 0) integrity.passed++; else integrity.warnings++;

      // Applications ohne customer_id
      const appsNoCustomer = applications.filter(a => !a.customer_id && !a.archived);

      integrity.checks.push({
        check: 'applications_have_customer',
        status: appsNoCustomer.length === 0 ? 'pass' : 'critical',
        detail: `${appsNoCustomer.length} active applications missing customer_id`,
      });
      if (appsNoCustomer.length === 0) integrity.passed++; else { integrity.failures++; report.summary.critical++; }

      report.sections.integrity = integrity;
      report.summary.total_checks += integrity.checks.length;
      report.summary.passed += integrity.passed;
      report.summary.warnings += integrity.warnings;
      report.summary.failures += integrity.failures;
    }

    // ─────────────────────────────────────────────────────────────────────
    // SECTION 5: PERFORMANCE CHECK
    // ─────────────────────────────────────────────────────────────────────
    if (suite === 'performance' || suite === 'all') {
      const perf = { checks: [], passed: 0, warnings: 0 };
      const loadTime = Date.now() - startTime;

      perf.checks.push({
        check: 'data_load_performance',
        status: loadTime < 3000 ? 'pass' : 'warning',
        detail: `Loaded 6 entities in ${loadTime}ms (threshold: 3000ms)`,
        duration_ms: loadTime,
        entities_loaded: {
          contracts: contracts.length,
          applications: applications.length,
          tasks: tasks.length,
          commissions: commissions.length,
          audit_logs: auditLogs.length,
          customers: customers.length,
        },
      });
      if (loadTime < 3000) perf.passed++; else perf.warnings++;

      // Scheduler-Noise-Estimate (basierend auf expiry-Daten)
      const expiryWindowContracts = contracts.filter(c => {
        if (c.status !== 'active' || !c.end_date) return false;
        const days = Math.ceil((new Date(c.end_date + 'T00:00:00Z') - new Date()) / 86400000);
        return days <= 90 && days >= 0;
      });

      const estimatedDailyAuditEvents = Math.max(1, expiryWindowContracts.length * 2 + 1);

      perf.checks.push({
        check: 'scheduler_noise_estimate',
        status: estimatedDailyAuditEvents < 50 ? 'pass' : 'warning',
        detail: `checkPoliciesExpiry would generate ~${estimatedDailyAuditEvents} audit events/day`,
        estimated_events: estimatedDailyAuditEvents,
        expiry_window_contracts: expiryWindowContracts.length,
      });
      if (estimatedDailyAuditEvents < 50) perf.passed++; else perf.warnings++;

      report.sections.performance = perf;
      report.summary.total_checks += perf.checks.length;
      report.summary.passed += perf.passed;
      report.summary.warnings += perf.warnings;
    }

    // ─────────────────────────────────────────────────────────────────────
    // FINAL SCORING & READINESS
    // ─────────────────────────────────────────────────────────────────────
    const totalChecks = report.summary.total_checks;
    const passRate = totalChecks > 0 ? ((report.summary.passed / totalChecks) * 100).toFixed(1) : 0;

    report.summary.pass_rate = parseFloat(passRate);
    report.summary.duration_ms = Date.now() - startTime;
    report.enterprise_readiness = {
      score: parseFloat(passRate),
      level: report.summary.critical > 0 ? 'BLOCKED' :
             report.summary.failures > 0 ? 'NOT_READY' :
             report.summary.warnings > 3 ? 'NEEDS_ATTENTION' :
             report.summary.warnings > 0 ? 'ALMOST_READY' : 'ENTERPRISE_READY',
      critical_blockers: report.summary.critical,
      action_required: report.summary.critical > 0 ? 'Fix critical issues before enterprise rollout' :
                       report.summary.failures > 0 ? 'Fix failures before proceeding' :
                       report.summary.warnings > 0 ? 'Review warnings — proceed with caution' :
                       'System validated — enterprise rollout approved',
    };

    // ─────────────────────────────────────────────────────────────────────
    // VALIDATION AUDIT LOG (async, non-blocking)
    // ─────────────────────────────────────────────────────────────────────
    base44.entities.AuditLog.create({
      audit_schema_version: '1.0',
      audit_id: `AUD-${date}-VAL${runId}`,
      audit_level: report.summary.critical > 0 ? 1 : 2,
      audit_level_name: report.summary.critical > 0 ? 'critical_business' : 'lifecycle_transition',
      timestamp: new Date().toISOString(),
      trigger_type: 'manual',
      trigger_source: 'enterpriseValidationSuite',
      actor_type: 'user',
      actor_id: user.id,
      actor_name: user.full_name || user.email,
      process_id: `enterprise_validation_${date}_${runId}`,
      process_type: 'system_validation',
      process_stage: 'enterprise_hardening',
      event_id: `EVT-${date}-VAL`,
      event_type: 'enterprise_validation_completed',
      event_sequence: 1,
      entity_type: 'contract',
      entity_id: 'all',
      action: report.summary.critical > 0 ? 'block' : 'allow',
      decision_code: `ENTERPRISE_VALIDATION_${report.enterprise_readiness.level}`,
      decision_logic: `Pass rate: ${passRate}% | Checks: ${totalChecks} | Critical: ${report.summary.critical} | Warnings: ${report.summary.warnings}`,
      guard_evaluated: 'enterprise_validation_suite',
      guard_result: report.summary.critical > 0 ? 'blocked' : 'allowed',
      guard_reason: report.enterprise_readiness.action_required,
      business_severity_type: report.summary.critical > 0 ? 'critical' : 'operational',
      business_severity_level: report.summary.critical > 0 ? 'critical' : 'low',
      technical_severity_type: 'info',
      technical_severity_level: 'low',
      previous_state_summary: {},
      new_state_summary: {
        pass_rate: parseFloat(passRate),
        readiness: report.enterprise_readiness.level,
        critical: report.summary.critical,
        warnings: report.summary.warnings,
      },
      side_effects: [],
      business_impact_financial_chf: 0,
      business_impact_description: `Enterprise validation: ${report.enterprise_readiness.level} (${passRate}%)`,
      correlation_id: correlationId,
      related_entities: [],
      duration_ms: Date.now() - startTime,
      metadata: { suite, contracts_analyzed: contracts.length, checks_run: totalChecks },
    }).catch(err => console.error('[AUDIT] Validation log write failed:', err.message));

    console.log(`[VALIDATION] DONE: ${passRate}% pass rate | readiness=${report.enterprise_readiness.level} | duration=${Date.now() - startTime}ms`);

    return Response.json(report);

  } catch (error) {
    console.error('[VALIDATION ERROR]', error);
    return Response.json({ success: false, error: error.message }, { status: 500 });
  }
});