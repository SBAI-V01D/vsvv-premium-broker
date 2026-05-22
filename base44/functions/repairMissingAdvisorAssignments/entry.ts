/**
 * repairMissingAdvisorAssignments — Phase 1 Go-Live Guard
 *
 * Findet alle Kunden ohne advisor_id und weist intelligent zu:
 *   1. Vertragsberater (contract.advisor_id)
 *   2. Antragsberater (application.advisor_id)
 *   3. Ersteller (created_by → passender Advisor)
 *   4. Einziger Berater der Organisation (Fallback)
 *
 * Dry-Run: dryRun=true → nur Analyse, kein Schreiben.
 * Admin-only.
 */
import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });
    if (user.role !== 'admin') return Response.json({ error: 'Forbidden: Admin only' }, { status: 403 });

    const body = await req.json().catch(() => ({}));
    const dryRun = body.dryRun !== false; // Default: dry run for safety

    // ── Load data ──────────────────────────────────────────────────────────
    const [customers, contracts, applications, advisors] = await Promise.all([
      base44.asServiceRole.entities.Customer.filter({ archived: false }),
      base44.asServiceRole.entities.Contract.filter({ archived: false }),
      base44.asServiceRole.entities.Application.filter({ archived: false }),
      base44.asServiceRole.entities.Advisor.filter({ status: 'active' }),
    ]);

    const advisorByEmail = {};
    const advisorById = {};
    advisors.forEach(a => {
      advisorById[a.id] = a;
      if (a.email) advisorByEmail[a.email.toLowerCase()] = a;
    });

    // ── Find customers missing advisor_id ──────────────────────────────────
    const unassigned = customers.filter(c => !c.advisor_id && !c.primary_advisor_id);

    if (unassigned.length === 0) {
      return Response.json({
        status: 'ok',
        message: 'Alle Kunden haben eine Berater-Zuweisung.',
        repaired: 0,
        dry_run: dryRun,
      });
    }

    // ── Build lookup maps ──────────────────────────────────────────────────
    const contractsByCustomer = {};
    contracts.forEach(c => {
      if (c.customer_id && c.advisor_id) {
        if (!contractsByCustomer[c.customer_id]) contractsByCustomer[c.customer_id] = [];
        contractsByCustomer[c.customer_id].push(c);
      }
    });

    const applicationsByCustomer = {};
    applications.forEach(a => {
      if (a.customer_id && a.advisor_id) {
        if (!applicationsByCustomer[a.customer_id]) applicationsByCustomer[a.customer_id] = [];
        applicationsByCustomer[a.customer_id].push(a);
      }
    });

    // Org → advisors mapping (for single-advisor-org fallback)
    const advisorsByOrg = {};
    advisors.forEach(a => {
      if (a.organization_id) {
        if (!advisorsByOrg[a.organization_id]) advisorsByOrg[a.organization_id] = [];
        advisorsByOrg[a.organization_id].push(a);
      }
    });

    // ── Determine best advisor for each unassigned customer ────────────────
    const repairPlan = [];
    const cannotResolve = [];

    for (const customer of unassigned) {
      let assignedAdvisorId = null;
      let strategy = null;

      // Strategy 1: Vertragsberater
      const custContracts = contractsByCustomer[customer.id] || [];
      if (custContracts.length > 0) {
        // Take most recently updated contract's advisor
        const sorted = custContracts.sort((a, b) => new Date(b.updated_date || 0) - new Date(a.updated_date || 0));
        assignedAdvisorId = sorted[0].advisor_id;
        strategy = `contract:${sorted[0].id}`;
      }

      // Strategy 2: Antragsberater
      if (!assignedAdvisorId) {
        const custApps = applicationsByCustomer[customer.id] || [];
        if (custApps.length > 0) {
          const sorted = custApps.sort((a, b) => new Date(b.updated_date || 0) - new Date(a.updated_date || 0));
          assignedAdvisorId = sorted[0].advisor_id;
          strategy = `application:${sorted[0].id}`;
        }
      }

      // Strategy 3: created_by → Advisor mit gleicher E-Mail
      if (!assignedAdvisorId && customer.created_by) {
        const matchedAdvisor = advisorByEmail[customer.created_by.toLowerCase()];
        if (matchedAdvisor) {
          assignedAdvisorId = matchedAdvisor.id;
          strategy = `created_by:${customer.created_by}`;
        }
      }

      // Strategy 4: Einziger Berater in der Organisation
      if (!assignedAdvisorId && customer.organization_id) {
        const orgAdvisors = (advisorsByOrg[customer.organization_id] || []).filter(a => a.role !== 'address_broker');
        if (orgAdvisors.length === 1) {
          assignedAdvisorId = orgAdvisors[0].id;
          strategy = `single_org_advisor:${orgAdvisors[0].id}`;
        }
      }

      if (assignedAdvisorId && advisorById[assignedAdvisorId]) {
        const adv = advisorById[assignedAdvisorId];
        repairPlan.push({
          customer_id: customer.id,
          customer_name: `${customer.first_name} ${customer.last_name}`,
          advisor_id: assignedAdvisorId,
          advisor_name: `${adv.firstname} ${adv.lastname}`,
          strategy,
        });
      } else {
        cannotResolve.push({
          customer_id: customer.id,
          customer_name: `${customer.first_name} ${customer.last_name}`,
          organization_id: customer.organization_id,
          reason: 'Kein Berater ermittelbar — manuelle Zuweisung erforderlich',
        });
      }
    }

    // ── Execute repairs (unless dry run) ───────────────────────────────────
    let repairedCount = 0;
    const errors = [];

    if (!dryRun && repairPlan.length > 0) {
      for (const plan of repairPlan) {
        try {
          await base44.asServiceRole.entities.Customer.update(plan.customer_id, {
            advisor_id: plan.advisor_id,
            primary_advisor_id: plan.advisor_id,
          });
          repairedCount++;
        } catch (err) {
          errors.push({ customer_id: plan.customer_id, error: err.message });
        }
      }

      // Create EnterpriseIncident if unresolvable customers exist
      if (cannotResolve.length > 0) {
        await base44.asServiceRole.entities.EnterpriseIncident.create({
          severity: 'critical',
          category: 'data_integrity',
          module: 'customers',
          title: `${cannotResolve.length} Kunden ohne Berater-Zuweisung — manuelle Intervention`,
          description: `${cannotResolve.length} Kunden konnten nicht automatisch einem Berater zugewiesen werden.`,
          technical_details: JSON.stringify(cannotResolve.slice(0, 20)),
          recommended_action: 'Betroffene Kunden manuell einem Berater zuweisen. Betrifft: ' + cannotResolve.map(c => c.customer_name).join(', '),
          manual_review_required: true,
          auto_fix_possible: false,
          detected_by: user.email,
          detected_at: new Date().toISOString(),
        });
      }

      // SystemLog
      await base44.asServiceRole.entities.SystemLog.create({
        level: errors.length > 0 ? 'warn' : 'info',
        source: 'repairMissingAdvisorAssignments',
        message: `Berater-Repair: ${repairedCount} Kunden repariert, ${cannotResolve.length} ungelöst, ${errors.length} Fehler`,
        details: JSON.stringify({ repaired: repairedCount, cannot_resolve: cannotResolve.length, errors }),
        user_email: user.email,
      });
    }

    return Response.json({
      status: cannotResolve.length === 0 ? 'ok' : 'partial',
      dry_run: dryRun,
      unassigned_total: unassigned.length,
      repair_plan_count: repairPlan.length,
      cannot_resolve_count: cannotResolve.length,
      repaired: repairedCount,
      errors,
      repair_plan: repairPlan.slice(0, 50),        // Preview (max 50)
      cannot_resolve: cannotResolve.slice(0, 50),
      message: dryRun
        ? `DRY RUN: ${repairPlan.length} Kunden könnten repariert werden, ${cannotResolve.length} ungelöst. Sende dryRun=false zum Ausführen.`
        : `${repairedCount} Kunden repariert, ${cannotResolve.length} benötigen manuelle Zuweisung.`,
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});