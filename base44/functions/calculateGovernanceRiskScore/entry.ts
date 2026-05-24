/**
 * calculateGovernanceRiskScore — Governance Risk Score Engine
 * 
 * Berechnet einen mehrdimensionalen Governance-Score für die Organisation:
 *  - Compliance Score      (Mandat, Approval-Trails, FINMA-Felder)
 *  - Tenant Integrity      (organization_id vorhanden)
 *  - Audit Trail           (Audit-Logs vollständig, lückenlos)
 *  - AI Reliability        (AI-Findings mit Confidence ≥ 0.7)
 *  - Incident Health       (offene Incidents, SLA-Status)
 *  - Data Quality          (Pflichtfelder, Relationship-Integrität)
 * 
 * Gibt zurück: { overall, domains, trend, alerts, computed_at }
 */
import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

const DOMAIN_WEIGHTS = {
  compliance:        0.25,
  tenant_integrity:  0.20,
  audit_trail:       0.20,
  ai_reliability:    0.15,
  incident_health:   0.10,
  data_quality:      0.10,
};

function score(value, maxValue, weight = 1) {
  return Math.min(100, Math.round((value / maxValue) * 100 * weight));
}

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user || user.role !== 'admin') {
      return Response.json({ error: 'Forbidden' }, { status: 403 });
    }

    const now = new Date();
    const alerts = [];
    const domains = {};

    // ── 1. COMPLIANCE SCORE ────────────────────────────────────────
    const customers = await base44.asServiceRole.entities.Customer.list('-created_date', 500);
    const activeCustomers = customers.filter(c => !c.archived);
    const validMandate = activeCustomers.filter(c => c.mandate_status === 'valid').length;
    const mandateScore = activeCustomers.length > 0
      ? Math.round((validMandate / activeCustomers.length) * 100) : 100;

    const dossiers = await base44.asServiceRole.entities.AdvisoryDossier.list('-created_date', 100);
    const approvedDossiers = dossiers.filter(d => d.advisor_approved && d.approval_history?.length > 0).length;
    const dossierApprovalScore = dossiers.length > 0
      ? Math.round((approvedDossiers / dossiers.length) * 100) : 100;

    domains.compliance = {
      score: Math.round((mandateScore * 0.6) + (dossierApprovalScore * 0.4)),
      label: 'Compliance',
      details: {
        mandate_valid_pct: mandateScore,
        dossier_approval_pct: dossierApprovalScore,
        valid_mandates: validMandate,
        total_active_customers: activeCustomers.length,
      },
    };

    if (mandateScore < 70) alerts.push({ domain: 'compliance', message: `Nur ${mandateScore}% der Kunden haben gültiges Mandat`, severity: 'warning' });

    // ── 2. TENANT INTEGRITY SCORE ──────────────────────────────────
    const contracts = await base44.asServiceRole.entities.Contract.list('-created_date', 500);
    const applications = await base44.asServiceRole.entities.Application.list('-created_date', 200);

    const customersMissingOrg = activeCustomers.filter(c => !c.organization_id).length;
    const contractsMissingOrg = contracts.filter(c => !c.organization_id).length;
    const appsMissingOrg = applications.filter(a => !a.organization_id).length;

    const totalEntities = activeCustomers.length + contracts.length + applications.length;
    const totalMissing = customersMissingOrg + contractsMissingOrg + appsMissingOrg;
    const tenantScore = totalEntities > 0
      ? Math.round(((totalEntities - totalMissing) / totalEntities) * 100) : 100;

    domains.tenant_integrity = {
      score: tenantScore,
      label: 'Tenant Integrity',
      details: {
        customers_missing_org: customersMissingOrg,
        contracts_missing_org: contractsMissingOrg,
        applications_missing_org: appsMissingOrg,
        total_violations: totalMissing,
      },
    };

    if (totalMissing > 0) alerts.push({ domain: 'tenant_integrity', message: `${totalMissing} Records ohne organization_id`, severity: totalMissing > 10 ? 'critical' : 'warning' });

    // ── 3. AUDIT TRAIL SCORE ───────────────────────────────────────
    const auditLogs = await base44.asServiceRole.entities.AuditLog.list('-timestamp', 500);
    const last7Days = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    const recentLogs = auditLogs.filter(l => new Date(l.timestamp) >= last7Days);

    // Contracts with change_history vs without
    const contractsWithHistory = contracts.filter(c => c.change_history?.length > 0).length;
    const auditCoverage = contracts.length > 0
      ? Math.round((contractsWithHistory / contracts.length) * 100) : 100;

    domains.audit_trail = {
      score: Math.round((Math.min(100, recentLogs.length * 2) * 0.4) + (auditCoverage * 0.6)),
      label: 'Audit Trail',
      details: {
        recent_audit_logs_7d: recentLogs.length,
        contracts_with_history: contractsWithHistory,
        audit_coverage_pct: auditCoverage,
      },
    };

    // ── 4. AI RELIABILITY SCORE ────────────────────────────────────
    const aiReviews = await base44.asServiceRole.entities.AiReview.list('-reviewed_at', 20);
    const highConfidenceReviews = aiReviews.filter(r => {
      if (!r.findings) return false;
      const totalFindings = r.findings.length;
      if (totalFindings === 0) return true;
      const criticalWithHighConfidence = r.findings.filter(f => f.confidence >= 0.7 || f.ai_confidence >= 0.7).length;
      return criticalWithHighConfidence / totalFindings >= 0.7;
    }).length;

    const aiScore = aiReviews.length > 0
      ? Math.round((highConfidenceReviews / aiReviews.length) * 100) : 85;

    domains.ai_reliability = {
      score: aiScore,
      label: 'AI Reliability',
      details: {
        total_reviews: aiReviews.length,
        high_confidence_reviews: highConfidenceReviews,
        latest_review: aiReviews[0]?.reviewed_at || null,
      },
    };

    // ── 5. INCIDENT HEALTH SCORE ───────────────────────────────────
    const incidents = await base44.asServiceRole.entities.EnterpriseIncident.list('-detected_at', 100);
    const openIncidents = incidents.filter(i => ['open', 'investigating', 'in_progress'].includes(i.status));
    const slaBreached = openIncidents.filter(i => i.sla_status === 'breached').length;
    const criticalOpen = openIncidents.filter(i => ['critical', 'blocking'].includes(i.severity)).length;

    const incidentScore = Math.max(0,
      100
      - (criticalOpen * 15)
      - (slaBreached * 20)
      - (Math.max(0, openIncidents.length - 5) * 5)
    );

    domains.incident_health = {
      score: incidentScore,
      label: 'Incident Health',
      details: {
        open_incidents: openIncidents.length,
        critical_open: criticalOpen,
        sla_breached: slaBreached,
        resolved_30d: incidents.filter(i => i.status === 'resolved' && new Date(i.resolved_at) >= new Date(now - 30 * 24 * 60 * 60 * 1000)).length,
      },
    };

    if (slaBreached > 0) alerts.push({ domain: 'incident_health', message: `${slaBreached} Incidents mit SLA-Breach`, severity: 'critical' });
    if (criticalOpen > 0) alerts.push({ domain: 'incident_health', message: `${criticalOpen} kritische offene Incidents`, severity: 'critical' });

    // ── 6. DATA QUALITY SCORE ──────────────────────────────────────
    const customersWithEmail = activeCustomers.filter(c => c.email).length;
    const contractsWithDates = contracts.filter(c => c.start_date && c.renewal_date).length;
    const emailCoverage = activeCustomers.length > 0
      ? Math.round((customersWithEmail / activeCustomers.length) * 100) : 100;
    const contractDateCoverage = contracts.length > 0
      ? Math.round((contractsWithDates / contracts.length) * 100) : 100;

    domains.data_quality = {
      score: Math.round((emailCoverage * 0.5) + (contractDateCoverage * 0.5)),
      label: 'Data Quality',
      details: {
        customer_email_coverage_pct: emailCoverage,
        contract_date_coverage_pct: contractDateCoverage,
        customers_missing_email: activeCustomers.length - customersWithEmail,
      },
    };

    // ── OVERALL WEIGHTED SCORE ─────────────────────────────────────
    const overall = Math.round(
      Object.entries(DOMAIN_WEIGHTS).reduce((sum, [key, weight]) => {
        return sum + (domains[key]?.score || 0) * weight;
      }, 0)
    );

    // Risk classification
    const riskLevel = overall >= 85 ? 'low' : overall >= 70 ? 'medium' : overall >= 50 ? 'high' : 'critical';

    const result = {
      overall,
      risk_level: riskLevel,
      computed_at: now.toISOString(),
      computed_by: user.email,
      domains,
      alerts,
      weights: DOMAIN_WEIGHTS,
    };

    return Response.json(result);
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});