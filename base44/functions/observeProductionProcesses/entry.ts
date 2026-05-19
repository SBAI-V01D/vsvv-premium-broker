import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

/**
 * PRODUCTION-LIKE PROCESS OBSERVATION — Phase 1B
 * 
 * Beobachtet echte Prozessmuster ohne sie zu verändern.
 * Ziel: Verhaltensvalidierung, Noise-Messung, Correlation-Qualität.
 * 
 * Was gemessen wird:
 * 1. Echte Contract-Lifecycle-Verteilung (Status, Process-Status)
 * 2. Guard-Relevanz-Score (welche Zustände sind problematisch?)
 * 3. Audit-Noise-Potential (wie viele Events würde ein Scheduler erzeugen?)
 * 4. Correlation-Chain-Qualität (sind Daten vollständig verknüpfbar?)
 * 5. Anomalie-Indikationen (auffällige Verteilungen)
 */
Deno.serve(async (req) => {
  const startTime = Date.now();

  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user || user.role !== 'admin') {
      return Response.json({ error: 'Admin access required' }, { status: 403 });
    }

    const today = new Date().toISOString().split('T')[0];
    const date = today.replace(/-/g, '');
    const random = Math.random().toString(36).slice(2, 8).toUpperCase();

    console.log(`[OBSERVE] Production-Like Observation START — ${today}`);

    // Alle relevanten Daten laden — kein State verändern
    const [contracts, tasks, auditLogs] = await Promise.all([
      base44.asServiceRole.entities.Contract.list(),
      base44.asServiceRole.entities.Task.list(),
      base44.asServiceRole.entities.AuditLog.list('-created_date', 50),
    ]);

    // ─────────────────────────────────────────────────────
    // 1. CONTRACT LIFECYCLE VERTEILUNG
    // ─────────────────────────────────────────────────────
    const statusDist = {};
    const processStatusDist = {};
    const insurerDist = {};
    const expirySoonContracts = [];     // < 90 Tage
    const missingDataContracts = [];    // fehlende Felder
    const duplicateRiskContracts = [];  // gleicher Kunde + Versicherer aktiv

    for (const c of contracts) {
      // Status-Verteilung
      statusDist[c.status || 'unknown'] = (statusDist[c.status || 'unknown'] || 0) + 1;
      processStatusDist[c.process_status || 'unset'] = (processStatusDist[c.process_status || 'unset'] || 0) + 1;
      insurerDist[c.insurer || 'unknown'] = (insurerDist[c.insurer || 'unknown'] || 0) + 1;

      // Ablauf-Kandidaten prüfen
      if (c.end_date && c.status === 'active') {
        const daysLeft = Math.ceil((new Date(c.end_date + 'T00:00:00Z') - new Date()) / 86400000);
        if (daysLeft <= 90 && daysLeft >= -30) {
          expirySoonContracts.push({
            id: c.id,
            customer: c.customer_name,
            insurer: c.insurer,
            days_left: daysLeft,
            process_status: c.process_status,
            has_assigned_broker: !!c.assigned_broker,
            missing_renewal_task: !tasks.some(t => t.contract_id === c.id && t.task_type === 'renewal' && t.status !== 'completed'),
          });
        }
      }

      // Fehlende Pflichtdaten
      const missing = [];
      if (!c.customer_id) missing.push('customer_id');
      if (!c.end_date) missing.push('end_date');
      if (!c.assigned_broker) missing.push('assigned_broker');
      if (!c.organization_id) missing.push('organization_id');
      if (missing.length > 0) {
        missingDataContracts.push({ id: c.id, customer: c.customer_name, missing });
      }
    }

    // Duplikat-Risiko: gleicher Kunde + Versicherer + status active
    const activeContractIndex = {};
    for (const c of contracts) {
      if (c.status !== 'active') continue;
      const key = `${c.customer_id}|${c.insurer}|${c.insurance_type}`;
      activeContractIndex[key] = (activeContractIndex[key] || 0) + 1;
    }
    for (const [key, count] of Object.entries(activeContractIndex)) {
      if (count > 1) {
        const [customer_id, insurer, insurance_type] = key.split('|');
        duplicateRiskContracts.push({ customer_id, insurer, insurance_type, count });
      }
    }

    // ─────────────────────────────────────────────────────
    // 2. GUARD RELEVANZ SCORE
    // ─────────────────────────────────────────────────────
    // Reale Zustände, die Guards benötigen würden
    const guardRelevance = {
      duplicate_risk_contracts: duplicateRiskContracts.length,
      missing_data_contracts: missingDataContracts.length,
      expiry_without_task: expirySoonContracts.filter(c => c.missing_renewal_task).length,
      expiry_without_broker: expirySoonContracts.filter(c => !c.has_assigned_broker).length,
      cancelled_with_active_tasks: tasks.filter(t =>
        t.status !== 'completed' &&
        contracts.find(c => c.id === t.contract_id && ['cancelled', 'archived'].includes(c.status))
      ).length,
    };

    // ─────────────────────────────────────────────────────
    // 3. AUDIT NOISE POTENTIAL
    // ─────────────────────────────────────────────────────
    // Schätze: wie viele Audit-Events würde der Scheduler HEUTE erzeugen?
    const activeContracts = contracts.filter(c => c.status === 'active');
    const noisePotential = {
      scheduler_contracts_total: activeContracts.length,
      contracts_90d_window: expirySoonContracts.filter(c => c.days_left <= 90 && c.days_left > 60).length,
      contracts_60d_window: expirySoonContracts.filter(c => c.days_left <= 60 && c.days_left > 30).length,
      contracts_30d_window: expirySoonContracts.filter(c => c.days_left <= 30 && c.days_left >= 0).length,
      // Geschätzte Events pro Scheduler-Run
      estimated_audit_events_per_run: Math.ceil(
        expirySoonContracts.filter(c => c.missing_renewal_task).length * 2 + // task create + process_status update
        duplicateRiskContracts.length * 1 +                                    // guard block
        missingDataContracts.length * 1                                        // skip log
      ),
      noise_risk_level: expirySoonContracts.length > 50 ? 'high' : expirySoonContracts.length > 20 ? 'medium' : 'low',
    };

    // ─────────────────────────────────────────────────────
    // 4. AUDIT LOG QUALITÄTSANALYSE (letzte 50)
    // ─────────────────────────────────────────────────────
    const auditQuality = {
      total_logs_analyzed: auditLogs.length,
      correlation_id_present: auditLogs.filter(a => a.correlation_id).length,
      decision_code_present: auditLogs.filter(a => a.decision_code).length,
      guard_evaluated_present: auditLogs.filter(a => a.guard_evaluated).length,
      process_type_distribution: {},
      guard_result_distribution: {},
      level_distribution: {},
    };

    for (const log of auditLogs) {
      const pt = log.process_type || 'unknown';
      const gr = log.guard_result || 'none';
      const lvl = `level_${log.audit_level || 'unknown'}`;
      auditQuality.process_type_distribution[pt] = (auditQuality.process_type_distribution[pt] || 0) + 1;
      auditQuality.guard_result_distribution[gr] = (auditQuality.guard_result_distribution[gr] || 0) + 1;
      auditQuality.level_distribution[lvl] = (auditQuality.level_distribution[lvl] || 0) + 1;
    }

    auditQuality.correlation_completeness_pct = auditLogs.length > 0
      ? ((auditQuality.correlation_id_present / auditLogs.length) * 100).toFixed(1)
      : 0;
    auditQuality.decision_code_completeness_pct = auditLogs.length > 0
      ? ((auditQuality.decision_code_present / auditLogs.length) * 100).toFixed(1)
      : 0;

    // ─────────────────────────────────────────────────────
    // 5. ANOMALIE-INDIKATOREN
    // ─────────────────────────────────────────────────────
    const anomalyIndicators = [];

    if (duplicateRiskContracts.length > 0) {
      anomalyIndicators.push({
        type: 'duplicate_active_contracts',
        severity: 'high',
        count: duplicateRiskContracts.length,
        description: `${duplicateRiskContracts.length} Fälle: gleicher Kunde + Versicherer + Sparte aktiv`,
        recommendation: 'Guard CONTRACT_DUPLICATE_ACTIVE benötigt',
      });
    }

    if (guardRelevance.expiry_without_task > 0) {
      anomalyIndicators.push({
        type: 'expiring_without_renewal_task',
        severity: 'medium',
        count: guardRelevance.expiry_without_task,
        description: `${guardRelevance.expiry_without_task} ablaufende Verträge ohne offene Renewal-Task`,
        recommendation: 'checkPoliciesExpiry würde diese aufgreifen',
      });
    }

    if (guardRelevance.cancelled_with_active_tasks > 0) {
      anomalyIndicators.push({
        type: 'orphaned_tasks',
        severity: 'low',
        count: guardRelevance.cancelled_with_active_tasks,
        description: `${guardRelevance.cancelled_with_active_tasks} offene Tasks für stornierte Verträge`,
        recommendation: 'Cleanup-Guard benötigt',
      });
    }

    if (missingDataContracts.length > 0) {
      anomalyIndicators.push({
        type: 'incomplete_contract_data',
        severity: 'medium',
        count: missingDataContracts.length,
        description: `${missingDataContracts.length} Verträge mit fehlenden Pflichtfeldern`,
        recommendation: 'Datenqualität verbessern vor Scheduler-Integration',
      });
    }

    if (noisePotential.noise_risk_level === 'high') {
      anomalyIndicators.push({
        type: 'scheduler_noise_risk',
        severity: 'high',
        count: noisePotential.estimated_audit_events_per_run,
        description: `Scheduler würde ~${noisePotential.estimated_audit_events_per_run} Audit-Events pro Tag erzeugen`,
        recommendation: 'Audit-Level-Strategie vor Integration festlegen',
      });
    }

    // ─────────────────────────────────────────────────────
    // OBSERVATION AUDIT LOG SCHREIBEN
    // ─────────────────────────────────────────────────────
    const observationAuditEntry = {
      audit_schema_version: '1.0',
      audit_id: `AUD-${date}-${random}`,
      audit_level: 4,
      audit_level_name: 'debug_verbose',
      timestamp: new Date().toISOString(),
      trigger_type: 'manual',
      trigger_source: 'observeProductionProcesses',
      actor_type: 'user',
      actor_id: user.id,
      actor_name: user.full_name || user.email,
      process_id: `observation_run_${date}_${random}`,
      process_type: 'system_observation',
      process_stage: 'production_like_observation',
      event_id: `EVT-${date}-OBS`,
      event_type: 'observation_run_completed',
      event_sequence: 1,
      entity_type: 'contract',
      entity_id: 'all',
      action: 'allow',
      decision_code: 'OBSERVATION_COMPLETED',
      decision_logic: `Production-Like Observation: ${contracts.length} contracts analyzed, ${anomalyIndicators.length} anomalies detected`,
      guard_evaluated: null,
      guard_result: null,
      guard_reason: null,
      business_severity_type: 'operational',
      business_severity_level: anomalyIndicators.some(a => a.severity === 'high') ? 'high' : 'low',
      technical_severity_type: 'info',
      technical_severity_level: 'low',
      previous_state_summary: {},
      new_state_summary: {
        contracts_total: contracts.length,
        anomalies_detected: anomalyIndicators.length,
        noise_risk: noisePotential.noise_risk_level,
        audit_correlation_completeness: auditQuality.correlation_completeness_pct + '%',
      },
      side_effects: [],
      business_impact_financial_chf: 0,
      business_impact_description: `${anomalyIndicators.filter(a => a.severity === 'high').length} high-severity anomalies detected`,
      correlation_id: `OBS-${date}-${random}`,
      related_entities: [],
      duration_ms: Date.now() - startTime,
      metadata: {
        observation_type: 'production_like',
        contracts_analyzed: contracts.length,
        anomaly_count: anomalyIndicators.length,
      },
    };

    // Async, non-blocking
    base44.entities.AuditLog.create(observationAuditEntry).catch(err => {
      console.error('[OBSERVE] Audit log write failed (non-blocking):', err.message);
    });

    // ─────────────────────────────────────────────────────
    // REPORT
    // ─────────────────────────────────────────────────────
    const report = {
      success: true,
      observation_id: `OBS-${date}-${random}`,
      timestamp: new Date().toISOString(),
      duration_ms: Date.now() - startTime,

      // 1. Lifecycle-Verteilung
      lifecycle_distribution: {
        status: statusDist,
        process_status: processStatusDist,
        top_insurers: Object.entries(insurerDist)
          .sort(([, a], [, b]) => b - a)
          .slice(0, 5)
          .map(([k, v]) => ({ insurer: k, count: v })),
      },

      // 2. Guard Relevanz
      guard_relevance: guardRelevance,

      // 3. Noise Potential
      noise_potential: noisePotential,

      // 4. Audit Qualität
      audit_quality: auditQuality,

      // 5. Anomalie-Indikatoren
      anomaly_indicators: anomalyIndicators,

      // 6. Readiness Assessment
      readiness_assessment: {
        scheduler_integration_ready: anomalyIndicators.filter(a => a.severity === 'high').length === 0,
        data_quality_sufficient: missingDataContracts.length < contracts.length * 0.1,
        guard_coverage_needed: anomalyIndicators.map(a => a.recommendation),
        recommendation: anomalyIndicators.filter(a => a.severity === 'high').length === 0
          ? 'READY: checkPoliciesExpiry Integration kann beginnen'
          : 'WAIT: Anomalien zuerst adressieren',
      },
    };

    console.log(`[OBSERVE] DONE in ${Date.now() - startTime}ms — ${anomalyIndicators.length} anomalies, readiness=${report.readiness_assessment.scheduler_integration_ready}`);

    return Response.json(report);

  } catch (error) {
    console.error('[OBSERVE ERROR]', error);
    return Response.json({ success: false, error: error.message }, { status: 500 });
  }
});