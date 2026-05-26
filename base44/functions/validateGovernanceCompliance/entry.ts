/**
 * validateGovernanceCompliance — Governance Middleware Validator
 *
 * Prüft systemweit auf Governance-Metadaten-Lücken und erzeugt pro Root-Cause-Kategorie
 * EINEN gruppierten EnterpriseIncident (statt N einzelne Incidents).
 *
 * Kategorien:
 *   - approval_gap:    fehlende approved_at / approved_by in Dossiers
 *   - storno_gap:      fehlende storno_reference_id in CommissionEntries
 *   - audit_gap:       fehlende change_history in Verträgen / Kunden
 *   - tenant_gap:      fehlende organization_id
 *   - confidence_gap:  fehlende AI-Confidence in Dossiers
 *
 * Idempotent: bestehende offene Incidents gleicher Kategorie werden aktualisiert,
 * nicht neu erzeugt.
 *
 * Nur von Admin aufrufbar.
 */
import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (user?.role !== 'admin') {
      return Response.json({ error: 'Admin access required' }, { status: 403 });
    }

    const sr = base44.asServiceRole;
    const now = new Date().toISOString();

    const [dossiers, contracts, customers, commissions, existingIncidents] = await Promise.all([
      sr.entities.AdvisoryDossier.list('-created_date', 200),
      sr.entities.Contract.list('-created_date', 500),
      sr.entities.Customer.list('-created_date', 500),
      sr.entities.CommissionEntry.list('-created_date', 500),
      sr.entities.EnterpriseIncident.list('-detected_at', 200),
    ]);

    // Index existierender offener Incidents nach validation_run_id (Kategorie)
    const openByCategory = {};
    for (const inc of existingIncidents) {
      if (['resolved', 'closed', 'rejected'].includes(inc.status)) continue;
      const cat = inc.validation_run_id; // wir nutzen dieses Feld als Kategorie-Schlüssel
      if (cat) openByCategory[cat] = inc;
    }

    const report = { categories_checked: 0, incidents_created: 0, incidents_updated: 0, findings: [] };

    // ── Hilfsfunktion: Incident erstellen oder aktualisieren ────────────────
    const upsertIncident = async (categoryKey, payload) => {
      report.categories_checked++;
      if (payload.affected_count === 0) return;

      const existing = openByCategory[categoryKey];
      const incidentData = {
        title: payload.title,
        description: payload.description,
        category: payload.category,
        severity: payload.severity,
        priority: payload.priority,
        module: 'GovernanceCompliance',
        organization_id: 'system',
        detected_at: now,
        detected_by: 'validateGovernanceCompliance',
        recommended_action: payload.recommended_action,
        manual_review_required: true,
        governance_block: false,
        validation_run_id: categoryKey,
        technical_details: JSON.stringify(payload.sample_ids?.slice(0, 10) || []),
      };

      if (existing) {
        await sr.entities.EnterpriseIncident.update(existing.id, {
          ...incidentData,
          description: `${payload.description}\n\n[Aktualisiert: ${now}]`,
        });
        report.incidents_updated++;
      } else {
        await sr.entities.EnterpriseIncident.create(incidentData);
        report.incidents_created++;
      }
      report.findings.push({ category: categoryKey, count: payload.affected_count, severity: payload.severity });
    };

    // ── 1. Approval Gap ─────────────────────────────────────────────────────
    const approvalGap = dossiers.filter(d =>
      !d.archived && d.advisor_approved && (!d.approved_at || !d.approved_by)
    );
    await upsertIncident('governance_approval_gap', {
      title: `Approval-Metadaten fehlen (${approvalGap.length} Dossiers)`,
      description: `${approvalGap.length} freigegebene Dossiers haben keine vollständigen Approval-Metadaten (approved_at / approved_by). Dies verletzt FINMA-Anforderungen für lückenlose Freigabedokumentation.`,
      category: 'approval',
      severity: approvalGap.length > 5 ? 'critical' : 'warning',
      priority: approvalGap.length > 5 ? 'high' : 'medium',
      recommended_action: 'repairApprovalMetadata ausführen, um fehlende Metadaten zu rekonstruieren.',
      affected_count: approvalGap.length,
      sample_ids: approvalGap.map(d => d.id),
    });

    // ── 2. Storno Gap ───────────────────────────────────────────────────────
    const stornoGap = commissions.filter(c => c.is_storno && !c.storno_reference_id);
    await upsertIncident('governance_storno_gap', {
      title: `Storno ohne Referenz (${stornoGap.length} Buchungen)`,
      description: `${stornoGap.length} Storno-Buchungen haben keine storno_reference_id. Bidirektionale Verknüpfung zur Ursprungsbuchung fehlt. Auswirkung auf Finanzreporting und Storno-Audit.`,
      category: 'audit_trail',
      severity: stornoGap.length > 3 ? 'critical' : 'warning',
      priority: 'high',
      recommended_action: 'repairApprovalMetadata ausführen (rekonstruiert storno_reference_id automatisch).',
      affected_count: stornoGap.length,
      sample_ids: stornoGap.map(c => c.id),
    });

    // ── 3. Audit Gap (Änderungshistorie) ─────────────────────────────────────
    const contractsNoHistory = contracts.filter(c => !c.archived && (!c.change_history || c.change_history.length === 0));
    const customersNoHistory = customers.filter(c => !c.archived && (!c.change_history || c.change_history.length === 0));
    const auditGapCount = contractsNoHistory.length + customersNoHistory.length;
    await upsertIncident('governance_audit_gap', {
      title: `Fehlende Änderungshistorie (${auditGapCount} Records)`,
      description: `${contractsNoHistory.length} Verträge und ${customersNoHistory.length} Kunden ohne Änderungshistorie. Audit Trail Coverage: ${Math.round(((contracts.length - contractsNoHistory.length) / Math.max(contracts.length, 1)) * 100)}% bei Verträgen.`,
      category: 'audit_trail',
      severity: auditGapCount > 50 ? 'critical' : auditGapCount > 20 ? 'warning' : 'info',
      priority: auditGapCount > 50 ? 'high' : 'medium',
      recommended_action: 'governanceRecovery ausführen, um Änderungshistorien retroaktiv zu rekonstruieren.',
      affected_count: auditGapCount,
      sample_ids: [...contractsNoHistory.slice(0, 5).map(c => c.id), ...customersNoHistory.slice(0, 5).map(c => c.id)],
    });

    // ── 4. Tenant Gap (fehlende organization_id) ─────────────────────────────
    const tenantGap = [
      ...contracts.filter(c => !c.organization_id),
      ...customers.filter(c => !c.organization_id),
    ];
    await upsertIncident('governance_tenant_gap', {
      title: `Fehlende organization_id (${tenantGap.length} Records)`,
      description: `${tenantGap.length} Records ohne organization_id. Tenant-Isolation verletzt — kritisch für Multi-Tenant-Compliance und DSGVO-Datentrennung.`,
      category: 'tenant_isolation',
      severity: tenantGap.length > 0 ? 'critical' : 'info',
      priority: tenantGap.length > 0 ? 'critical' : 'low',
      recommended_action: 'validateTenantIntegrity ausführen und betroffene Records manuell zuweisen.',
      affected_count: tenantGap.length,
      sample_ids: tenantGap.slice(0, 10).map(r => r.id),
    });

    // ── 5. AI Confidence Gap ─────────────────────────────────────────────────
    const confGap = dossiers.filter(d => !d.archived && d.extraction_confidence == null && (d.advisor_approved || d.review_status !== 'offen'));
    await upsertIncident('governance_confidence_gap', {
      title: `Fehlende KI-Konfidenz (${confGap.length} Dossiers)`,
      description: `${confGap.length} Dossiers wurden freigegeben oder reviewt, haben aber keinen extraction_confidence-Wert. KI-Transparenz und Nachvollziehbarkeit nicht gewährleistet.`,
      category: 'approval',
      severity: confGap.length > 10 ? 'warning' : 'info',
      priority: 'medium',
      recommended_action: 'KI-Extraktion für betroffene Dossiers wiederholen oder Konfidenz manuell setzen.',
      affected_count: confGap.length,
      sample_ids: confGap.slice(0, 10).map(d => d.id),
    });

    // Audit-Log
    await sr.entities.AuditLog.create({
      timestamp: now,
      action: 'validate_governance_compliance',
      actor_type: 'user',
      actor_id: user.id,
      actor_name: user.full_name || user.email,
      details: JSON.stringify(report),
    }).catch(() => {});

    return Response.json({
      success: true,
      ...report,
      message: `Governance-Compliance geprüft: ${report.incidents_created} neue Incidents, ${report.incidents_updated} aktualisiert. ${report.findings.length} aktive Root-Cause-Kategorien.`,
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});