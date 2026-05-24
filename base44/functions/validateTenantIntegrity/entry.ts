/**
 * validateTenantIntegrity — P1 Governance Validator
 * Prüft alle relevanten Entitäten auf:
 *  - Fehlende organization_id (Tenant-Isolation)
 *  - Fehlende Pflichtfelder
 *  - Relationship-Integrität
 * 
 * Muss VOR jeder AI-Analyse ausgeführt werden.
 * Nur für Admin-User zugänglich.
 */
import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

const ENTITY_CHECKS = [
  {
    name: 'Customer',
    requiredFields: ['first_name', 'last_name', 'email', 'organization_id'],
    tenantField: 'organization_id',
  },
  {
    name: 'Contract',
    requiredFields: ['customer_id', 'insurer', 'insurance_type', 'organization_id'],
    tenantField: 'organization_id',
  },
  {
    name: 'Application',
    requiredFields: ['customer_id', 'insurer', 'organization_id'],
    tenantField: 'organization_id',
  },
  {
    name: 'Advisor',
    requiredFields: ['firstname', 'lastname', 'email', 'organization_id'],
    tenantField: 'organization_id',
  },
  {
    name: 'CommissionEntry',
    requiredFields: ['advisor_id', 'organization_id', 'insurer', 'premium_yearly'],
    tenantField: 'organization_id',
  },
];

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user || user.role !== 'admin') {
      return Response.json({ error: 'Forbidden: Admin access required' }, { status: 403 });
    }

    const runId = `TI-${Date.now()}`;
    const results = [];
    let totalViolations = 0;
    let criticalViolations = 0;

    for (const check of ENTITY_CHECKS) {
      const violations = [];

      // Fetch records missing organization_id
      const allRecords = await base44.asServiceRole.entities[check.name].list('-created_date', 500);

      for (const record of allRecords) {
        const recordViolations = [];

        // Check tenant isolation
        if (!record[check.tenantField]) {
          recordViolations.push({
            type: 'missing_tenant_id',
            field: check.tenantField,
            severity: 'critical',
            message: `${check.name} [${record.id}] hat keine organization_id — Tenant-Isolation verletzt`,
          });
          criticalViolations++;
        }

        // Check required fields
        for (const field of check.requiredFields) {
          if (field !== check.tenantField && (record[field] === null || record[field] === undefined || record[field] === '')) {
            recordViolations.push({
              type: 'missing_required_field',
              field,
              severity: 'warning',
              message: `${check.name} [${record.id}] fehlt Pflichtfeld: ${field}`,
            });
          }
        }

        if (recordViolations.length > 0) {
          violations.push({
            entity_id: record.id,
            entity_name: record.first_name
              ? `${record.first_name} ${record.last_name}`
              : record.name || record.title || record.customer_name || record.id,
            violations: recordViolations,
          });
          totalViolations += recordViolations.length;
        }
      }

      results.push({
        entity: check.name,
        total_records: allRecords.length,
        violation_count: violations.length,
        violations: violations.slice(0, 20), // max 20 pro Entität
      });
    }

    // Relationship integrity: Contracts without valid customer
    const contracts = await base44.asServiceRole.entities.Contract.list('-created_date', 500);
    const customers = await base44.asServiceRole.entities.Customer.list('-created_date', 1000);
    const customerIds = new Set(customers.map(c => c.id));

    const orphanContracts = contracts.filter(c => c.customer_id && !customerIds.has(c.customer_id));
    if (orphanContracts.length > 0) {
      results.push({
        entity: 'Contract_Relationship',
        total_records: contracts.length,
        violation_count: orphanContracts.length,
        violations: orphanContracts.slice(0, 10).map(c => ({
          entity_id: c.id,
          entity_name: c.customer_name || c.id,
          violations: [{
            type: 'orphan_relationship',
            field: 'customer_id',
            severity: 'critical',
            message: `Vertrag [${c.id}] hat ungültige customer_id: ${c.customer_id}`,
          }],
        })),
      });
      criticalViolations += orphanContracts.length;
      totalViolations += orphanContracts.length;
    }

    // Create incidents for critical violations
    const incidentsCreated = [];
    for (const result of results) {
      const criticalInResult = result.violations.filter(v =>
        v.violations.some(vi => vi.severity === 'critical')
      );

      if (criticalInResult.length > 0) {
        const incident = await base44.asServiceRole.entities.EnterpriseIncident.create({
          severity: 'critical',
          priority: 'high',
          category: 'tenant_isolation',
          title: `Tenant-Isolation verletzt: ${result.entity} (${criticalInResult.length} Records)`,
          description: `${criticalInResult.length} ${result.entity}-Records ohne organization_id gefunden. Tenant-Isolation ist verletzt.`,
          technical_details: JSON.stringify(criticalInResult.slice(0, 5), null, 2),
          recommended_action: 'organization_id für alle betroffenen Records setzen. Imports ohne organization_id blockieren.',
          manual_review_required: true,
          governance_block: true,
          status: 'open',
          detected_by: user.email,
          detected_at: new Date().toISOString(),
          validation_run_id: runId,
          sla_due_at: new Date(Date.now() + 4 * 60 * 60 * 1000).toISOString(), // 4h SLA
          sla_status: 'ok',
          affected_entities: criticalInResult.slice(0, 10).map(v => ({
            entity_type: result.entity,
            entity_id: v.entity_id,
            description: v.entity_name,
          })),
        });
        incidentsCreated.push(incident.id);
      }
    }

    const summary = {
      run_id: runId,
      timestamp: new Date().toISOString(),
      executed_by: user.email,
      total_entities_checked: ENTITY_CHECKS.length + 1,
      total_violations: totalViolations,
      critical_violations: criticalViolations,
      incidents_created: incidentsCreated.length,
      status: criticalViolations === 0 ? 'PASSED' : criticalViolations < 5 ? 'WARNING' : 'CRITICAL',
      results,
    };

    // Log to SystemLog
    await base44.asServiceRole.entities.SystemLog.create({
      level: criticalViolations > 0 ? 'critical' : 'info',
      source: 'validateTenantIntegrity',
      message: `Tenant-Integrity Check: ${totalViolations} Violations (${criticalViolations} kritisch) — Run ID: ${runId}`,
      details: JSON.stringify({ summary: { total: totalViolations, critical: criticalViolations, incidents: incidentsCreated.length } }),
    });

    return Response.json(summary);
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});