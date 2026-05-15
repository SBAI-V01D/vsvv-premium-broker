import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

/**
 * Setzt bei jedem Kunden den Status auf 'active', wenn mindestens ein Vertrag vorhanden ist.
 * Kann auch als Automation bei Contract.create/update verwendet werden.
 */
Deno.serve(async (req) => {
  const base44 = createClientFromRequest(req);

  try {
    const user = await base44.auth.me();
    if (user?.role !== 'admin') {
      return Response.json({ error: 'Forbidden: Admin access required' }, { status: 403 });
    }

    // Alle Verträge laden (nur customer_id nötig)
    const contracts = await base44.asServiceRole.entities.Contract.list('-created_date', 2000);

    // Kunden-IDs mit mindestens einem Vertrag
    const customerIdsWithContract = new Set(
      contracts
        .filter(c => c.customer_id && !c.archived)
        .map(c => c.customer_id)
    );

    if (customerIdsWithContract.size === 0) {
      return Response.json({ success: true, updated: 0, message: 'Keine Verträge gefunden' });
    }

    // Alle Kunden laden
    const customers = await base44.asServiceRole.entities.Customer.list('-created_date', 2000);

    let updated = 0;
    const errors = [];

    for (const customer of customers) {
      if (customerIdsWithContract.has(customer.id) && customer.status !== 'active') {
        try {
          await base44.asServiceRole.entities.Customer.update(customer.id, { status: 'active' });
          updated++;
          console.log(`[syncCustomerStatus] ${customer.first_name} ${customer.last_name} → active`);
        } catch (err) {
          errors.push({ id: customer.id, error: err.message });
        }
      }
    }

    return Response.json({
      success: true,
      updated,
      total_with_contracts: customerIdsWithContract.size,
      errors: errors.length > 0 ? errors : undefined,
    });

  } catch (error) {
    return Response.json({ success: false, error: error.message }, { status: 500 });
  }
});