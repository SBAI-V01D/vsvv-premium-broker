import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

/**
 * Setzt bei jedem Kunden den Status auf 'active', wenn mindestens ein Vertrag vorhanden ist.
 * Kann auch als Automation bei Contract.create/update verwendet werden.
 */
/**
 * OPTIMIERT: Setzt Kundenstatus auf 'active' bei neuem Vertrag
 * 
 * PERFORMANCE-FIX:
 * - Liest NICHT alle Contracts + Customers
 * - Verwendet customer_id aus Contract direkt
 * - Ein einzelner Update pro betroffener Customer
 */
Deno.serve(async (req) => {
  const base44 = createClientFromRequest(req);

  try {
    const body = await req.json();
    const contract = body.data;

    // Nur bei Contract-Create Events
    if (body.event?.type !== 'create' || !contract?.customer_id) {
      return Response.json({ skipped: 'Not a Contract create event or no customer_id' });
    }

    const customerId = contract.customer_id;

    // Customer direkt laden (kein Full-Table-Scan!)
    const customer = await base44.asServiceRole.entities.Customer.get(customerId);
    
    if (!customer) {
      return Response.json({ skipped: 'Customer not found', customer_id: customerId });
    }

    // Nur updaten wenn nicht bereits active
    if (customer.status === 'active') {
      return Response.json({ skipped: 'Customer already active', customer_id: customerId });
    }

    // Status updaten
    await base44.asServiceRole.entities.Customer.update(customerId, { status: 'active' });

    console.log(`[syncCustomerStatusFromContracts] Customer ${customerId} (${customer.first_name} ${customer.last_name}) → active`);

    return Response.json({
      success: true,
      updated: 1,
      customer_id: customerId,
      customer_name: `${customer.first_name} ${customer.last_name}`,
      message: 'Customer status updated to active',
    });

  } catch (error) {
    console.error('[syncCustomerStatusFromContracts] ERROR:', error.message);
    return Response.json({ success: false, error: error.message }, { status: 500 });
  }
});