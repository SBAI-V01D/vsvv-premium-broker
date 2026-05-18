import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    if (user.role !== 'admin') {
      return Response.json({ error: 'Admin access required' }, { status: 403 });
    }

    // Finde Angelika Rosnovski
    const customers = await base44.entities.Customer.filter({ 
      first_name: 'Angelika', 
      last_name: 'Rosnovski' 
    });

    if (customers.length === 0) {
      return Response.json({ error: 'Customer not found' }, { status: 404 });
    }

    const customer = customers[0];
    console.log('Found customer:', customer.id, customer.email);

    // Finde alle Verträge von Angelika
    const contracts = await base44.entities.Contract.filter({ 
      customer_id: customer.id 
    });

    console.log('Found contracts:', contracts.length);

    // Aktualisiere den Kunden mit proper access control
    await base44.entities.Customer.update(customer.id, {
      primary_advisor_id: user.id,
      assigned_advisors: [user.id],
      access_level: 'assigned_advisors_only'
    });

    // Aktualisiere alle Verträge
    for (const contract of contracts) {
      await base44.entities.Contract.update(contract.id, {
        primary_broker_id: user.id,
        assigned_brokers: [user.id],
        advisor_id: user.id,
        assigned_broker: user.email
      });
    }

    return Response.json({ 
      success: true, 
      message: 'Access restored for Angelika Rosnovski',
      customer_id: customer.id,
      contracts_updated: contracts.length
    });
  } catch (error) {
    console.error('Error restoring access:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});