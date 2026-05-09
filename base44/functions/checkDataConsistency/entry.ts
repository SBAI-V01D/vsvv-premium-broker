import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

/**
 * Phase 2: Check data consistency and orphan records
 */
Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user || user.role !== 'admin') {
      return Response.json({ error: 'Admin required' }, { status: 403 });
    }

    const report = {
      timestamp: new Date().toISOString(),
      checks: {},
      orphans: {},
      issues: []
    };

    // 1. Contracts without valid customer_id
    try {
      const contracts = await base44.entities.Contract.list(null, 5000);
      const orphans = contracts.filter(c => !c.customer_id);
      if (orphans.length > 0) {
        report.orphans.contracts_no_customer = orphans.length;
        report.issues.push(`${orphans.length} contracts without customer_id`);
      }
    } catch (err) {
      report.issues.push(`Contract consistency check failed`);
    }

    // 2. Tasks without valid customer or assigned_to
    try {
      const tasks = await base44.entities.Task.list(null, 5000);
      const orphans = tasks.filter(t => !t.customer_id || !t.assigned_to);
      if (orphans.length > 0) {
        report.orphans.tasks_incomplete = orphans.length;
        report.issues.push(`${orphans.length} tasks without customer_id or assigned_to`);
      }
    } catch (err) {
      report.issues.push(`Task consistency check failed`);
    }

    // 3. Documents without customer_id
    try {
      const docs = await base44.entities.Document.list(null, 5000);
      const orphans = docs.filter(d => !d.customer_id && !d.primary_customer_id);
      if (orphans.length > 0) {
        report.orphans.documents_no_customer = orphans.length;
        report.issues.push(`${orphans.length} documents without customer reference`);
      }
    } catch (err) {
      report.issues.push(`Document consistency check failed`);
    }

    // 4. Customer organization assignment
    try {
      const customers = await base44.entities.Customer.list(null, 5000);
      const noOrg = customers.filter(c => !c.organization_id);
      if (noOrg.length > 0) {
        report.orphans.customers_no_organization = noOrg.length;
        report.issues.push(`${noOrg.length} customers without organization_id`);
      }
    } catch (err) {
      report.issues.push(`Organization assignment check failed`);
    }

    // 5. Advisor references validity
    try {
      const customers = await base44.entities.Customer.list(null, 5000);
      const advisors = await base44.entities.Advisor.list(null, 5000);
      const advisorIds = new Set(advisors.map(a => a.id));
      
      const invalidRef = customers.filter(c => c.advisor_id && !advisorIds.has(c.advisor_id));
      if (invalidRef.length > 0) {
        report.orphans.invalid_advisor_refs = invalidRef.length;
        report.issues.push(`${invalidRef.length} invalid advisor references`);
      }
    } catch (err) {
      report.issues.push(`Advisor reference check failed`);
    }

    // 6. Archived records count
    try {
      const [customers, contracts, tasks] = await Promise.all([
        base44.entities.Customer.filter({ archived: true }, 1000).catch(() => []),
        base44.entities.Contract.filter({ archived: true }, 1000).catch(() => []),
        base44.entities.Task.filter({ archived: true }, 1000).catch(() => [])
      ]);

      report.checks.archived_records = {
        customers: customers.length,
        contracts: contracts.length,
        tasks: tasks.length
      };
    } catch (err) {
      report.issues.push(`Archived records check failed`);
    }

    report.health_score = 100 - (report.issues.length * 10);

    return Response.json(report, { status: 200 });

  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});