import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user || user.role !== 'admin') {
      return Response.json({ error: 'Forbidden: Admin only' }, { status: 403 });
    }

    const body = await req.json().catch(() => ({}));
    const dryRun = body.dry_run === true;

    // Fetch all CustomerAdvisor junction records
    const junctionRecords = await base44.asServiceRole.entities.CustomerAdvisor.list('-created_date', 5000);

    // Fetch all customers (primary, not family)
    const customers = await base44.asServiceRole.entities.Customer.list('-created_date', 5000);

    // Build a map: customer_id -> { primary_advisor_id, assigned_advisors[], assigned_assistants[] }
    const advisorMap = {};
    for (const jr of junctionRecords) {
      if (!jr.customer_id || !jr.advisor_id) continue;
      if (!advisorMap[jr.customer_id]) {
        advisorMap[jr.customer_id] = { primary_advisor_id: null, assigned_advisors: [] };
      }
      const entry = advisorMap[jr.customer_id];
      if (jr.is_primary || jr.role === 'primary') {
        entry.primary_advisor_id = jr.advisor_id;
      }
      if (!entry.assigned_advisors.includes(jr.advisor_id)) {
        entry.assigned_advisors.push(jr.advisor_id);
      }
    }

    // Also fetch contracts to derive advisor from contract data
    const contracts = await base44.asServiceRole.entities.Contract.list('-created_date', 5000);
    const applications = await base44.asServiceRole.entities.Application.list('-created_date', 5000);

    // Build advisor from contracts: customer_id -> most frequent advisor_id
    const contractAdvisorMap = {};
    for (const c of contracts) {
      if (!c.customer_id || !c.advisor_id) continue;
      if (!contractAdvisorMap[c.customer_id]) contractAdvisorMap[c.customer_id] = {};
      contractAdvisorMap[c.customer_id][c.advisor_id] = (contractAdvisorMap[c.customer_id][c.advisor_id] || 0) + 1;
    }
    for (const a of applications) {
      if (!a.customer_id || !a.advisor_id) continue;
      if (!contractAdvisorMap[a.customer_id]) contractAdvisorMap[a.customer_id] = {};
      contractAdvisorMap[a.customer_id][a.advisor_id] = (contractAdvisorMap[a.customer_id][a.advisor_id] || 0) + 1;
    }

    // Merge: junction table takes priority, contract data as fallback
    const mergedMap = { ...advisorMap };
    for (const [custId, advisorCounts] of Object.entries(contractAdvisorMap)) {
      if (mergedMap[custId]) continue; // junction table already has data
      const topAdvisor = Object.entries(advisorCounts).sort((a, b) => b[1] - a[1])[0]?.[0];
      if (topAdvisor) {
        mergedMap[custId] = { primary_advisor_id: topAdvisor, assigned_advisors: [topAdvisor] };
      }
    }

    // Only restore customers that currently have NO advisor (were wiped by revert)
    // AND have data in the junction or contract table
    const toRestore = customers.filter(c =>
      !c.is_family_member &&
      !c.advisor_id && !c.primary_advisor_id && !(c.assigned_advisors || []).length &&
      mergedMap[c.id]
    );

    const results = { dry_run: dryRun, restored: 0, skipped: 0, details: [] };

    for (const customer of toRestore) {
      const adv = mergedMap[customer.id];
      const primaryId = adv.primary_advisor_id;

      results.details.push({
        name: `${customer.first_name} ${customer.last_name}`,
        primary_advisor_id: primaryId,
        assigned_advisors: adv.assigned_advisors,
      });

      if (!dryRun) {
        await base44.asServiceRole.entities.Customer.update(customer.id, {
          primary_advisor_id: primaryId || null,
          advisor_id: primaryId || null,
          assigned_advisors: adv.assigned_advisors,
        });
      }
      results.restored++;
    }

    return Response.json({
      ...results,
      message: dryRun
        ? `DRY RUN: ${results.restored} Kunden würden aus CustomerAdvisor wiederhergestellt`
        : `${results.restored} Kunden erfolgreich aus CustomerAdvisor-Tabelle wiederhergestellt`,
    });

  } catch (error) {
    console.error('[restoreAdvisorAssignments] ERROR:', error.message);
    return Response.json({ error: error.message }, { status: 500 });
  }
});