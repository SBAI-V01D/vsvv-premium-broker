import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user || user.role !== 'admin') {
      return Response.json({ error: 'Admin access required' }, { status: 403 });
    }

    const audit = {
      timestamp: new Date().toISOString(),
      checks: {},
      issues: [],
      summary: {}
    };

    // ── Check 1: Customer duplicates ──
    const customers = await base44.entities.Customer.list(null, 5000);
    const emailMap = new Map();
    const customerDupes = [];
    
    customers.forEach(c => {
      if (!c.email) return;
      if (emailMap.has(c.email)) {
        customerDupes.push({
          email: c.email,
          ids: [emailMap.get(c.email), c.id]
        });
      } else {
        emailMap.set(c.email, c.id);
      }
    });

    audit.checks.customer_duplicates = {
      total: customers.length,
      duplicates: customerDupes.length,
      examples: customerDupes.slice(0, 5)
    };
    if (customerDupes.length > 0) {
      audit.issues.push(`Found ${customerDupes.length} duplicate customer emails`);
    }

    // ── Check 2: Customers missing organization_id ──
    const customersNoOrg = customers.filter(c => !c.organization_id);
    audit.checks.customer_missing_org = {
      count: customersNoOrg.length,
      examples: customersNoOrg.slice(0, 3).map(c => ({ id: c.id, name: `${c.first_name} ${c.last_name}` }))
    };
    if (customersNoOrg.length > 0) {
      audit.issues.push(`Found ${customersNoOrg.length} customers missing organization_id`);
    }

    // ── Check 3: Contracts orphan check ──
    const contracts = await base44.entities.Contract.list(null, 5000);
    const customerIds = new Set(customers.map(c => c.id));
    
    const contractsOrphan = contracts.filter(c => 
      c.customer_id && !customerIds.has(c.customer_id)
    );
    
    audit.checks.contract_orphans = {
      total: contracts.length,
      orphaned: contractsOrphan.length,
      examples: contractsOrphan.slice(0, 3).map(c => ({ id: c.id, customer_id: c.customer_id }))
    };
    if (contractsOrphan.length > 0) {
      audit.issues.push(`Found ${contractsOrphan.length} contracts with non-existent customer_id`);
    }

    // ── Check 4: Applications orphan check ──
    const applications = await base44.entities.Application.list(null, 5000);
    const applicationsOrphan = applications.filter(a => 
      a.customer_id && !customerIds.has(a.customer_id)
    );
    
    audit.checks.application_orphans = {
      total: applications.length,
      orphaned: applicationsOrphan.length,
      examples: applicationsOrphan.slice(0, 3).map(a => ({ id: a.id, customer_id: a.customer_id }))
    };
    if (applicationsOrphan.length > 0) {
      audit.issues.push(`Found ${applicationsOrphan.length} applications with non-existent customer_id`);
    }

    // ── Check 5: Tasks orphan check ──
    const tasks = await base44.entities.Task.list(null, 5000);
    const tasksOrphan = tasks.filter(t => 
      t.customer_id && !customerIds.has(t.customer_id)
    );
    const tasksNoAssignee = tasks.filter(t => !t.assigned_to);
    
    audit.checks.task_orphans = {
      total: tasks.length,
      orphaned: tasksOrphan.length,
      missing_assignee: tasksNoAssignee.length,
      examples: tasksOrphan.slice(0, 3).map(t => ({ id: t.id, title: t.title, customer_id: t.customer_id }))
    };
    if (tasksOrphan.length > 0) {
      audit.issues.push(`Found ${tasksOrphan.length} tasks with non-existent customer_id`);
    }
    if (tasksNoAssignee.length > 0) {
      audit.issues.push(`Found ${tasksNoAssignee.length} tasks without assigned_to`);
    }

    // ── Check 6: Advisors referential integrity ──
    const advisors = await base44.entities.Advisor.list(null, 5000);
    const advisorIds = new Set(advisors.map(a => a.id));
    const advisorEmails = new Set(advisors.map(a => a.email));
    
    const contractsBadAdvisor = contracts.filter(c => 
      c.assigned_broker && !advisorEmails.has(c.assigned_broker)
    );
    
    const tasksBadAssignee = tasks.filter(t => 
      t.assigned_to && !advisorEmails.has(t.assigned_to)
    );

    audit.checks.advisor_references = {
      total_advisors: advisors.length,
      contracts_bad_broker: contractsBadAdvisor.length,
      tasks_bad_assignee: tasksBadAssignee.length,
      contract_examples: contractsBadAdvisor.slice(0, 2).map(c => ({ id: c.id, broker: c.assigned_broker })),
      task_examples: tasksBadAssignee.slice(0, 2).map(t => ({ id: t.id, assignee: t.assigned_to }))
    };
    if (contractsBadAdvisor.length > 0) {
      audit.issues.push(`Found ${contractsBadAdvisor.length} contracts with invalid assigned_broker`);
    }
    if (tasksBadAssignee.length > 0) {
      audit.issues.push(`Found ${tasksBadAssignee.length} tasks with invalid assigned_to`);
    }

    // ── Check 7: Archived & Deleted records ──
    const archivedCustomers = customers.filter(c => c.archived);
    const deletedTasks = tasks.filter(t => t.deleted);
    const archivedContracts = contracts.filter(c => c.archived);

    audit.checks.archived_deleted = {
      archived_customers: archivedCustomers.length,
      archived_contracts: archivedContracts.length,
      deleted_tasks: deletedTasks.length
    };

    // ── Check 8: Test data ──
    const testCustomers = customers.filter(c => c.is_test_data);
    const testTasks = tasks.filter(t => t.is_test_data);
    const testContracts = contracts.filter(c => c.is_test_data);

    audit.checks.test_data = {
      test_customers: testCustomers.length,
      test_contracts: testContracts.length,
      test_tasks: testTasks.length
    };
    if (testCustomers.length > 0 || testTasks.length > 0 || testContracts.length > 0) {
      audit.issues.push(`Found ${testCustomers.length + testTasks.length + testContracts.length} test data records`);
    }

    // ── Summary ──
    audit.summary = {
      total_customers: customers.length,
      total_contracts: contracts.length,
      total_applications: applications.length,
      total_tasks: tasks.length,
      total_advisors: advisors.length,
      total_issues: audit.issues.length,
      critical: audit.issues.filter(i => i.includes('orphan') || i.includes('invalid')).length
    };

    return Response.json(audit, { status: 200 });

  } catch (error) {
    return Response.json({ error: error.message, stack: error.stack }, { status: 500 });
  }
});