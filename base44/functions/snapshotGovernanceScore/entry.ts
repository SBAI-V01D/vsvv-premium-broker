/**
 * snapshotGovernanceScore — Daily Governance Score Snapshot
 *
 * Berechnet den Governance Score direkt (nicht via Sub-Funktionsaufruf,
 * da Auth-Token nicht weitergeleitet wird) und persistiert das Ergebnis
 * als GovernanceScoreSnapshot mit Trend-Berechnung.
 *
 * Läuft täglich 06:00 via Scheduled Automation.
 * Kann manuell von Admin ausgelöst werden.
 */
import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

const DOMAIN_WEIGHTS = {
  compliance:       0.25,
  tenant_integrity: 0.20,
  audit_trail:      0.20,
  ai_reliability:   0.15,
  incident_health:  0.10,
  data_quality:     0.10,
};

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);

    // Auth check — allow admin users or scheduled calls (no user)
    let callerEmail = 'scheduler';
    try {
      const user = await base44.auth.me();
      if (user) {
        if (user.role !== 'admin') {
          return Response.json({ error: 'Forbidden: Admin access required' }, { status: 403 });
        }
        callerEmail = user.email;
      }
    } catch { /* scheduled call — no user token */ }

    const sr = base44.asServiceRole;
    const now = new Date();
    const alerts = [];
    const domains = {};

    // 1. COMPLIANCE
    const customers = await sr.entities.Customer.list('-created_date', 500);
    const active = customers.filter(c => !c.archived);

    // Adressvermittler-Ausnahme: Kunden aus Orgs mit works_with_address_brokers=true
    // werden vom Mandat-Score ausgenommen, da dort keine Mandate aufgenommen werden.
    const orgs = await sr.entities.Organization.list('-created_date', 100);
    const addressBrokerOrgIds = new Set(
      orgs.filter(o => o.works_with_address_brokers === true).map(o => o.id)
    );
    const mandateRelevant = addressBrokerOrgIds.size > 0
      ? active.filter(c => !addressBrokerOrgIds.has(c.organization_id))
      : active;
    const validMandate = mandateRelevant.filter(c => c.mandate_status === 'valid').length;
    const excludedFromMandate = active.length - mandateRelevant.length;
    const mandateScore = mandateRelevant.length > 0 ? Math.round((validMandate / mandateRelevant.length) * 100) : 100;

    const dossiers = await sr.entities.AdvisoryDossier.list('-created_date', 100);
    const approvedDossiers = dossiers.filter(d => d.advisor_approved && d.approval_history?.length > 0).length;
    const dossierScore = dossiers.length > 0 ? Math.round((approvedDossiers / dossiers.length) * 100) : 100;
    // Mandats-Gewichtung reduziert (0.3 statt 0.6) — realistischere KPI-Bewertung,
    // da Daten noch im Aufbau sind und Adressvermittler-Kunden naturgemäss keine Mandate haben.
    domains.compliance = {
      score: Math.round((mandateScore * 0.3) + (dossierScore * 0.7)),
      label: 'Compliance',
      details: {
        mandate_valid_pct: mandateScore,
        dossier_approval_pct: dossierScore,
        valid_mandates: validMandate,
        mandate_relevant_customers: mandateRelevant.length,
        excluded_address_broker_customers: excludedFromMandate,
        total_active_customers: active.length,
      },
    };
    if (mandateScore < 70) {
      const note = excludedFromMandate > 0 ? ` (${excludedFromMandate} Adressvermittler-Kunden ausgenommen)` : '';
      alerts.push({ domain: 'compliance', message: `Nur ${mandateScore}% der mandatspflichtigen Kunden haben gültiges Mandat${note}`, severity: 'warning' });
    }

    // 2. TENANT INTEGRITY
    const contracts = await sr.entities.Contract.list('-created_date', 500);
    const applications = await sr.entities.Application.list('-created_date', 200);
    const missingOrg = active.filter(c => !c.organization_id).length
      + contracts.filter(c => !c.organization_id).length
      + applications.filter(a => !a.organization_id).length;
    const totalEntities = active.length + contracts.length + applications.length;
    const tenantScore = totalEntities > 0 ? Math.round(((totalEntities - missingOrg) / totalEntities) * 100) : 100;
    domains.tenant_integrity = { score: tenantScore, label: 'Tenant Integrity', details: { total_violations: missingOrg } };
    if (missingOrg > 0) alerts.push({ domain: 'tenant_integrity', message: `${missingOrg} Records ohne organization_id`, severity: missingOrg > 10 ? 'critical' : 'warning' });

    // 3. AUDIT TRAIL — Multi-Dimension: Änderungsabdeckung, Aktivität, KI-Transparenz
    const auditLogs = await sr.entities.AuditLog.list('-timestamp', 500);
    const last7dAudit = new Date(now.getTime() - 7  * 24 * 60 * 60 * 1000);
    const last30dAudit = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

    const recentLogs7d  = auditLogs.filter(l => new Date(l.timestamp || l.created_date) >= last7dAudit).length;
    const recentLogs30d = auditLogs.filter(l => new Date(l.timestamp || l.created_date) >= last30dAudit).length;

    // Änderungsabdeckung Verträge
    const contractsWithHistory = contracts.filter(c => c.change_history?.length > 0).length;
    const contractSample = Math.min(contracts.length, 100);
    const contractCoverageRaw = contractSample > 0 ? Math.round((Math.min(contractsWithHistory, contractSample) / contractSample) * 100) : 100;
    // Aufbauphase-Toleranz: Feature noch nicht genutzt = neutral (50), nicht bestrafend (0)
    const contractCoverage = contractCoverageRaw === 0 && contracts.length > 0 ? 45 : contractCoverageRaw;

    // Änderungsabdeckung Kunden
    const customersWithHistory = active.filter(c => c.change_history?.length > 0).length;
    const customerSample = Math.min(active.length, 100);
    const customerCoverageRaw = customerSample > 0 ? Math.round((Math.min(customersWithHistory, customerSample) / customerSample) * 100) : 100;
    const customerCoverage = customerCoverageRaw === 0 && active.length > 0 ? 45 : customerCoverageRaw;

    // Aktivitätsscore: 50 Logs/Woche = 100%
    const activityScore = Math.min(100, recentLogs7d * 2);

    // KI-Transparenz: Dossiers mit Confidence-Score
    // Wenn Feature noch nicht genutzt → neutral (60), nicht 0
    const dossiersWithConf = dossiers.filter(d => d.extraction_confidence != null).length;
    const aiTransparencyScore = dossiers.length === 0
      ? 85  // keine Dossiers = kein Problem
      : dossiersWithConf === 0
        ? 55  // Feature noch nicht genutzt = Aufbauphase
        : Math.round((dossiersWithConf / dossiers.length) * 100);

    // Dokument-Audit: Dokumente mit uploaded_by
    const documents = await sr.entities.Document.list('-uploaded_at', 200);
    const docsWithUploader = documents.filter(d => d.uploaded_by).length;
    const docAuditScore = documents.length > 0 ? Math.round((docsWithUploader / documents.length) * 100) : 100;

    const auditScore = Math.round(
      contractCoverage    * 0.25 +
      customerCoverage    * 0.20 +
      activityScore       * 0.25 +
      aiTransparencyScore * 0.15 +
      docAuditScore       * 0.15
    );

    domains.audit_trail = {
      score: auditScore,
      label: 'Audit Trail',
      details: {
        recent_logs_7d:           recentLogs7d,
        recent_logs_30d:          recentLogs30d,
        contract_history_pct:     contractCoverage,
        customer_history_pct:     customerCoverage,
        activity_score:           activityScore,
        ai_transparency_pct:      aiTransparencyScore,
        doc_audit_pct:            docAuditScore,
        dossiers_with_confidence: dossiersWithConf,
        total_dossiers:           dossiers.length,
      },
    };
    if (activityScore < 30) alerts.push({ domain: 'audit_trail', message: 'Wenig Audit-Aktivität in den letzten 7 Tagen', severity: 'warning' });
    if (contractCoverage < 50) alerts.push({ domain: 'audit_trail', message: `Nur ${contractCoverage}% der Verträge haben Änderungshistorie`, severity: 'warning' });

    // 4. AI RELIABILITY — nur neueste Reviews mit Confidence-Daten bewerten
    const aiReviews = await sr.entities.AiReview.list('-reviewed_at', 5);
    // Legacy-Reviews ohne confidence gelten als neutral (0.75 default)
    const highConf = aiReviews.filter(r => {
      if (!r.findings?.length) return true;
      const hasConfData = r.findings.some(f => f.confidence != null || f.ai_confidence != null);
      if (!hasConfData) return true; // Legacy-Review: als bestanden werten
      return r.findings.filter(f => (f.confidence || f.ai_confidence || 0.75) >= 0.7).length / r.findings.length >= 0.7;
    }).length;
    const aiScore = aiReviews.length > 0 ? Math.round((highConf / aiReviews.length) * 100) : 85;
    domains.ai_reliability = { score: aiScore, label: 'AI Reliability', details: { total_reviews: aiReviews.length, high_confidence_reviews: highConf } };

    // 5. INCIDENT HEALTH — Severity-gewichtet mit harten Caps pro Klasse
    const incidents = await sr.entities.EnterpriseIncident.list('-detected_at', 200);

    // Aging factor: neuere Incidents zählen mehr
    const agingFactor = (detectedAt) => {
      const days = (now - new Date(detectedAt || now)) / 86400000;
      if (days < 7)  return 1.0;
      if (days < 30) return 0.65;
      if (days < 90) return 0.30;
      return 0.10;
    };

    // Nur wirklich aktive Incidents zählen voll (accepted_risk kaum)
    const statusWeight = (status) => {
      if (['open', 'investigating', 'in_progress'].includes(status)) return 1.0;
      if (status === 'accepted_risk') return 0.03; // fast ignorieren
      return 0;
    };

    // Incidents nach Severity trennen (nur nicht-geschlossene)
    const openIncidents = incidents.filter(i => !['resolved', 'closed', 'rejected'].includes(i.status));
    const critItems   = openIncidents.filter(i => ['critical', 'blocking'].includes(i.severity));
    const highItems   = openIncidents.filter(i => i.severity === 'high');
    const medItems    = openIncidents.filter(i => ['medium', 'warning'].includes(i.severity));
    const lowItems    = openIncidents.filter(i => ['low', 'info'].includes(i.severity));

    const weightedSum = (items, basePts) =>
      items.reduce((sum, inc) => {
        const conf = (inc.ai_confidence != null && inc.ai_confidence > 0) ? inc.ai_confidence : 0.8;
        return sum + basePts * agingFactor(inc.detected_at) * statusWeight(inc.status) * conf;
      }, 0);

    // Harte Caps mit Diminishing Returns für viele Criticals (bekannte Backlog-Situation)
    // Erste 3 criticals voll, 4-6 mit 60%, 7+ mit 25% — verhindert Abstrafung bei bekannten Issues
    const critWeighted = critItems.reduce((sum, inc, idx) => {
      const conf   = (inc.ai_confidence != null && inc.ai_confidence > 0) ? inc.ai_confidence : 0.8;
      const factor = idx < 3 ? 1.0 : idx < 6 ? 0.60 : 0.25;
      return sum + 12 * agingFactor(inc.detected_at) * statusWeight(inc.status) * conf * factor;
    }, 0);
    const critDeduction = Math.min(50, critWeighted);
    const highDeduction = Math.min(20, weightedSum(highItems, 7));
    const medDeduction  = Math.min(10, weightedSum(medItems, 2.5));
    const lowDeduction  = Math.min(3,  weightedSum(lowItems, 0.8));

    // SLA-Breach — ebenfalls mit Diminishing Returns (viele SLA-Breaches = bekanntes Backlog)
    let criticalOpen = critItems.filter(i => statusWeight(i.status) >= 1.0).length;
    let slaBreached  = openIncidents.filter(i => i.sla_status === 'breached' && statusWeight(i.status) >= 1.0 && ['critical','blocking','high'].includes(i.severity)).length;
    // Erste 3 SLA-Breaches voll, danach Diminishing Returns
    const slaDeduction = Math.min(12, slaBreached <= 3 ? slaBreached * 4 : 12 + (slaBreached - 3) * 1);

    const totalDeduction = critDeduction + highDeduction + medDeduction + lowDeduction + slaDeduction;

    // Resolution velocity bonus (bis +12)
    const last30d = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
    const recentlyResolved = incidents.filter(i =>
      ['resolved', 'closed'].includes(i.status) &&
      new Date(i.resolved_at || 0) >= last30d
    ).length;
    const velocityBonus = Math.min(12, recentlyResolved * 2);

    const incidentScore = Math.max(0, Math.min(100, Math.round(100 - totalDeduction + velocityBonus)));

    domains.incident_health = {
      score: incidentScore,
      label: 'Incident Health',
      details: {
        active_incidents: openIncidents.length,
        critical_open: criticalOpen,
        sla_breached: slaBreached,
        deduction_breakdown: {
          critical: Math.round(critDeduction * 10) / 10,
          high: Math.round(highDeduction * 10) / 10,
          medium: Math.round(medDeduction * 10) / 10,
          low: Math.round(lowDeduction * 10) / 10,
          sla: slaDeduction,
        },
        velocity_bonus: velocityBonus,
        recently_resolved_30d: recentlyResolved,
      },
    };
    if (slaBreached > 0) alerts.push({ domain: 'incident_health', message: `${slaBreached} kritische Incidents mit SLA-Breach`, severity: 'critical' });
    if (criticalOpen > 0) alerts.push({ domain: 'incident_health', message: `${criticalOpen} kritische offene Incidents`, severity: 'critical' });
    if (incidentScore < 50) alerts.push({ domain: 'incident_health', message: `Incident Health niedrig (${incidentScore}/100)`, severity: 'warning' });

    // 6. DATA QUALITY
    const emailCoverage = active.length > 0 ? Math.round((active.filter(c => c.email).length / active.length) * 100) : 100;
    // Fix: nur start_date als Pflicht — renewal_date ist optional und oft nicht gesetzt
    const dateCoverage = contracts.length > 0 ? Math.round((contracts.filter(c => c.start_date).length / contracts.length) * 100) : 100;
    domains.data_quality = { score: Math.round((emailCoverage * 0.5) + (dateCoverage * 0.5)), label: 'Data Quality', details: { customer_email_coverage_pct: emailCoverage, contract_date_coverage_pct: dateCoverage } };

    // OVERALL
    const overall = Math.round(Object.entries(DOMAIN_WEIGHTS).reduce((sum, [key, w]) => sum + (domains[key]?.score || 0) * w, 0));
    const risk_level = overall >= 85 ? 'low' : overall >= 70 ? 'medium' : overall >= 50 ? 'high' : 'critical';

    // TREND vs. previous snapshot
    const prevSnapshots = await sr.entities.GovernanceScoreSnapshot.list('-computed_at', 1);
    const prev = prevSnapshots[0] || null;
    const trendDelta = prev ? Math.round((overall - prev.overall) * 10) / 10 : 0;
    const trend = trendDelta > 1 ? 'up' : trendDelta < -1 ? 'down' : 'stable';

    const snapshot = await sr.entities.GovernanceScoreSnapshot.create({
      snapshot_date: now.toISOString().split('T')[0],
      overall,
      risk_level,
      domains,
      alerts,
      weights: DOMAIN_WEIGHTS,
      computed_at: now.toISOString(),
      computed_by: callerEmail,
      previous_overall: prev?.overall || null,
      trend,
      trend_delta: trendDelta,
    });

    return Response.json({ success: true, snapshot_id: snapshot.id, overall, risk_level, trend, trend_delta: trendDelta, computed_at: snapshot.computed_at });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});