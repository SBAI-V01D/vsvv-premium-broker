import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Fetch all customers
    const allCustomers = await base44.entities.Customer.list('', 1000) || [];
    
    if (allCustomers.length === 0) {
      return Response.json({
        status: 'success',
        total_customers: 0,
        visible_customers: 0,
        hidden_customers: 0,
        issues: ['Keine Kunden im System']
      });
    }

    // Check visibility conditions
    const visibleCustomers = allCustomers.filter(c => {
      // Customer is visible if:
      // 1. status === 'active' (required)
      // 2. NOT is_family_member (primary customers only shown by default)
      // 3. organization_id exists
      return (
        c.status === 'active' &&
        !c.is_family_member &&
        c.organization_id
      );
    });

    const hiddenCustomers = allCustomers.filter(c => 
      !visibleCustomers.find(v => v.id === c.id)
    );

    // Identify issues
    const issues = [];
    const missingOrgId = allCustomers.filter(c => !c.organization_id);
    const inactiveCustomers = allCustomers.filter(c => c.status !== 'active');

    if (missingOrgId.length > 0) {
      issues.push(`${missingOrgId.length} Kunde(n) ohne organization_id`);
    }
    if (inactiveCustomers.length > 0) {
      issues.push(`${inactiveCustomers.length} inaktive Kunde(n)`);
    }

    return Response.json({
      status: 'success',
      total_customers: allCustomers.length,
      visible_customers: visibleCustomers.length,
      hidden_customers: hiddenCustomers.length,
      visibility_rate: ((visibleCustomers.length / allCustomers.length) * 100).toFixed(1),
      issues,
      sample_customers: visibleCustomers.slice(0, 5).map(c => ({
        id: c.id,
        name: `${c.first_name} ${c.last_name}`,
        email: c.email,
        status: c.status,
        organization_id: c.organization_id,
        created_date: c.created_date
      }))
    });
  } catch (error) {
    return Response.json({ 
      error: error.message,
      status: 'error'
    }, { status: 500 });
  }
});