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

    // 3. AUDIT TRAIL
    const auditLogs = await sr.entities.AuditLog.list('-timestamp', 500);
    const last7d = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    const recentLogs = auditLogs.filter(l => new Date(l.timestamp) >= last7d).length;
    const contractsWithHistory = contracts.filter(c => c.change_history?.length > 0).length;
    const auditCoverage = contracts.length > 0 ? Math.round((contractsWithHistory / contracts.length) * 100) : 100;
    // Fix: recentLogs * 5 statt * 2 — realistischer Schwellwert (20 Logs/Woche = 100%)
    domains.audit_trail = {
      score: Math.round((Math.min(100, recentLogs * 5) * 0.4) + (auditCoverage * 0.6)),
      label: 'Audit Trail',
      details: { recent_audit_logs_7d: recentLogs, audit_coverage_pct: auditCoverage },
    };

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

    // 5. INCIDENT HEALTH
    const incidents = await sr.entities.EnterpriseIncident.list('-detected_at', 100);
    const open = incidents.filter(i => ['open', 'investigating', 'in_progress'].includes(i.status));
    const slaBreached = open.filter(i => i.sla_status === 'breached').length;
    const criticalOpen = open.filter(i => ['critical', 'blocking'].includes(i.severity)).length;
    const incidentScore = Math.max(0, 100 - criticalOpen * 15 - slaBreached * 20 - Math.max(0, open.length - 5) * 5);
    domains.incident_health = { score: incidentScore, label: 'Incident Health', details: { open_incidents: open.length, critical_open: criticalOpen, sla_breached: slaBreached } };
    if (slaBreached > 0) alerts.push({ domain: 'incident_health', message: `${slaBreached} Incidents mit SLA-Breach`, severity: 'critical' });
    if (criticalOpen > 0) alerts.push({ domain: 'incident_health', message: `${criticalOpen} kritische offene Incidents`, severity: 'critical' });

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