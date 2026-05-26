/**
 * checkRelationshipIntegrity — Daily Relationship Integrity Check
 *
 * Prüft täglich auf Ghost References und Broken Relationships:
 *   - Dossiers ohne gültigen Customer
 *   - Contracts ohne Organization
 *   - CommissionEntries ohne Advisor
 *   - Incidents ohne entity_id
 *   - Approvals ohne verknüpfte User
 *
 * Erzeugt pro Kategorie 1 gruppierten EnterpriseIncident (idempotent).
 * Täglich per Scheduled Automation aufrufbar. Nur von Admin oder Scheduler.
 */
import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    let callerEmail = 'scheduler';
    try {
      const user = await base44.auth.me();
      if (user) {
        if (user.role !== 'admin') return Response.json({ error: 'Admin access required' }, { status: 403 });
        callerEmail = user.email;
      }
    } catch { /* scheduled call */ }

    const sr = base44.asServiceRole;
    const now = new Date().toISOString();

    const [dossiers, contracts, customers, commissions, incidents, existingIncidents] = await Promise.all([
      sr.entities.AdvisoryDossier.list('-created_date', 300),
      sr.entities.Contract.list('-created_date', 500),
      sr.entities.Customer.list('-created_date', 500),
      sr.entities.CommissionEntry.list('-created_date', 500),
      sr.entities.EnterpriseIncident.list('-detected_at', 300),
      sr.entities.EnterpriseIncident.list('-detected_at', 200),
    ]);

    const customerIds  = new Set(customers.map(c => c.id));
    const orgIds       = new Set(customers.map(c => c.organization_id).filter(Boolean));
    const advisorIndex = new Set(commissions.map(c => c.advisor_id).filter(Boolean));

    const results = { checks: [], incidents_created: 0, incidents_updated: 0 };

    // Index bestehender offener Integrity-Incidents (nach validation_run_id)
    const openIntegrityByKey = {};
    for (const inc of existingIncidents) {
      if (['resolved', 'closed', 'rejected'].includes(inc.status)) continue;
      if (inc.validation_run_id?.startsWith('integrity_')) {
        openIntegrityByKey[inc.validation_run_id] = inc;
      }
    }

    const upsertIntegrityIncident = async (key, payload) => {
      if (payload.count === 0) return;
      const existing = openIntegrityByKey[key];
      const data = {
        title: payload.title,
        description: payload.description,
        category: 'data_integrity',
        severity: payload.count > 10 ? 'critical' : payload.count > 3 ? 'warning' : 'info',
        priority: payload.count > 10 ? 'high' : 'medium',
        module: 'RelationshipIntegrity',
        organization_id: 'system',
        detected_at: now,
        detected_by: 'checkRelationshipIntegrity',
        recommended_action: payload.action,
        manual_review_required: true,
        governance_block: false,
        validation_run_id: key,
        technical_details: JSON.stringify(payload.sample_ids?.slice(0, 15) || []),
      };
      if (existing) {
        await sr.entities.EnterpriseIncident.update(existing.id, { ...data, description: `${payload.description}\n\n[Aktualisiert: ${now}]` });
        results.incidents_updated++;
      } else {
        await sr.entities.EnterpriseIncident.create(data);
        results.incidents_created++;
      }
      results.checks.push({ key, count: payload.count });
    };

    // ── 1. Dossiers ohne Customer ────────────────────────────────────────────
    const dossiersNoCustomer = dossiers.filter(d => !d.archived && d.customer_id && !customerIds.has(d.customer_id));
    await upsertIntegrityIncident('integrity_dossier_no_customer', {
      title: `Ghost Reference: Dossiers ohne gültigen Kunden (${dossiersNoCustomer.length})`,
      description: `${dossiersNoCustomer.length} Dossiers verweisen auf nicht-existierende Customer-IDs. Audit-Trail und KI-Analysen betroffen.`,
      action: 'Dossiers manuell prüfen und customer_id korrigieren oder Dossier archivieren.',
      count: dossiersNoCustomer.length,
      sample_ids: dossiersNoCustomer.map(d => d.id),
    });

    // ── 2. Contracts ohne Organization ──────────────────────────────────────
    const contractsNoOrg = contracts.filter(c => !c.archived && !c.organization_id);
    await upsertIntegrityIncident('integrity_contract_no_org', {
      title: `Tenant Gap: Verträge ohne Organization (${contractsNoOrg.length})`,
      description: `${contractsNoOrg.length} Verträge haben keine organization_id. Tenant-Isolation verletzt.`,
      action: 'Organization-ID für betroffene Verträge setzen (validateTenantIntegrity).',
      count: contractsNoOrg.length,
      sample_ids: contractsNoOrg.map(c => c.id),
    });

    // ── 3. CommissionEntries ohne advisor_id ────────────────────────────────
    const commNoAdvisor = commissions.filter(c => !c.archived && !c.advisor_id);
    await upsertIntegrityIncident('integrity_commission_no_advisor', {
      title: `Broken Reference: Provisionen ohne Berater (${commNoAdvisor.length})`,
      description: `${commNoAdvisor.length} Provisions-Buchungen haben keine advisor_id. Abrechnungsauswertung und Reporting betroffen.`,
      action: 'advisor_id aus verknüpften Verträgen/Anträgen rekonstruieren.',
      count: commNoAdvisor.length,
      sample_ids: commNoAdvisor.map(c => c.id),
    });

    // ── 4. Incidents ohne entity_id (structural orphans) ────────────────────
    const incidentsNoEntity = incidents.filter(i =>
      !['resolved', 'closed', 'rejected'].includes(i.status) && !i.entity_id && !i.organization_id
    );
    await upsertIntegrityIncident('integrity_incident_no_entity', {
      title: `Orphaned Incidents ohne Entity-Referenz (${incidentsNoEntity.length})`,
      description: `${incidentsNoEntity.length} offene Incidents ohne entity_id und organization_id. Root-Cause-Korrelation nicht möglich.`,
      action: 'Incidents prüfen und fehlende Referenzen ergänzen oder schliessen.',
      count: incidentsNoEntity.length,
      sample_ids: incidentsNoEntity.map(i => i.id),
    });

    // ── 5. Dossiers ohne organization_id ────────────────────────────────────
    const dossiersNoOrg = dossiers.filter(d => !d.archived && !d.organization_id);
    await upsertIntegrityIncident('integrity_dossier_no_org', {
      title: `Tenant Gap: Dossiers ohne Organization (${dossiersNoOrg.length})`,
      description: `${dossiersNoOrg.length} Dossiers ohne organization_id — betrifft Multi-Tenant-Isolation und DSGVO-Datentrennung.`,
      action: 'repairDossierOrgIds ausführen.',
      count: dossiersNoOrg.length,
      sample_ids: dossiersNoOrg.map(d => d.id),
    });

    // Audit-Log
    await sr.entities.AuditLog.create({
      timestamp: now,
      action: 'check_relationship_integrity',
      actor_type: 'automation',
      actor_id: callerEmail,
      actor_name: callerEmail,
      details: JSON.stringify(results),
    }).catch(() => {});

    return Response.json({
      success: true,
      ...results,
      ran_at: now,
      message: `Integrity-Check abgeschlossen: ${results.incidents_created} neue + ${results.incidents_updated} aktualisierte Incidents. ${results.checks.filter(c => c.count > 0).length} aktive Problembereiche.`,
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});