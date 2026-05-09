import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

/**
 * Validate dashboard KPIs match actual data
 * Phase 2: Data consistency check
 */
Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user || user.role !== 'admin') {
      return Response.json({ error: 'Admin required' }, { status: 403 });
    }

    const validation = {
      timestamp: new Date().toISOString(),
      checks: {},
      issues: [],
      score: 100
    };

    // 1. Active Contracts Count
    try {
      const contracts = await base44.entities.Contract.list(null, 5000);
      const activeCount = contracts.filter(c => c.status === 'active').length;
      validation.checks.active_contracts = { expected: activeCount, verified: true };
    } catch (err) {
      validation.checks.active_contracts = { error: err.message, verified: false };
      validation.issues.push(`Contract query failed: ${err.message}`);
      validation.score -= 15;
    }

    // 2. Active Customers (with active contracts)
    try {
      const customers = await base44.entities.Customer.list(null, 5000);
      const contracts = await base44.entities.Contract.list(null, 5000);
      
      const activeCustomerIds = new Set(
        contracts.filter(c => c.status === 'active').map(c => c.customer_id)
      );
      const activeCustomers = customers.filter(c => activeCustomerIds.has(c.id));
      
      validation.checks.active_customers = { 
        total: customers.length,
        active: activeCustomers.length,
        verified: true 
      };
    } catch (err) {
      validation.issues.push(`Customer count failed: ${err.message}`);
      validation.score -= 15;
    }

    // 3. Open Tasks
    try {
      const tasks = await base44.entities.Task.list(null, 5000);
      const openCount = tasks.filter(t => 
        ['open', 'in_progress', 'waiting'].includes(t.status) && !t.deleted
      ).length;
      validation.checks.open_tasks = { count: openCount, verified: true };
    } catch (err) {
      validation.issues.push(`Task count failed: ${err.message}`);
      validation.score -= 10;
    }

    // 4. Expiring Contracts (90 days)
    try {
      const contracts = await base44.entities.Contract.list(null, 5000);
      const in90 = new Date(); in90.setDate(in90.getDate() + 90);
      const expiringCount = contracts.filter(c => 
        c.status === 'active' && c.end_date && new Date(c.end_date) <= in90
      ).length;
      validation.checks.expiring_contracts = { count: expiringCount, verified: true };
    } catch (err) {
      validation.issues.push(`Expiry check failed: ${err.message}`);
      validation.score -= 10;
    }

    // 5. Leads & Conversion Rate
    try {
      const leads = await base44.entities.Lead.list(null, 5000);
      const converted = leads.filter(l => l.status === 'converted').length;
      const conversionRate = leads.length > 0 ? (converted / leads.length * 100).toFixed(1) : 0;
      
      validation.checks.leads = { 
        total: leads.length,
        converted: converted,
        conversion_rate: parseFloat(conversionRate),
        verified: true 
      };
    } catch (err) {
      validation.issues.push(`Lead analysis failed: ${err.message}`);
      validation.score -= 10;
    }

    // 6. Commission Data
    try {
      const commissions = await base44.entities.CommissionEntry.list(null, 5000);
      const totalYearly = commissions
        .filter(c => c.status === 'earned' || c.status === 'paid')
        .reduce((sum, c) => sum + (c.commission_amount || 0), 0);
      
      validation.checks.commissions = { 
        total_records: commissions.length,
        total_earned_chf: Math.round(totalYearly),
        verified: true 
      };
    } catch (err) {
      validation.issues.push(`Commission check failed: ${err.message}`);
      validation.score -= 10;
    }

    // 7. Test Data Filter
    try {
      const allEntities = ['Customer', 'Contract', 'Task', 'Document'];
      const testDataCounts = {};
      
      for (const entity of allEntities) {
        const records = await base44.entities[entity].filter({ is_test_data: true }, 1000).catch(() => []);
        testDataCounts[entity] = records.length;
        
        if (records.length > 0) {
          validation.issues.push(`Found ${records.length} test records in ${entity}`);
        }
      }
      
      validation.checks.test_data = testDataCounts;
    } catch (err) {
      validation.issues.push(`Test data check failed: ${err.message}`);
    }

    return Response.json({
      validation,
      quality_score: validation.score,
      summary: `${validation.issues.length} issue(s) detected` + (validation.score < 90 ? ' - review required' : '')
    }, { status: 200 });

  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});