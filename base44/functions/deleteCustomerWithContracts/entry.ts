import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { customer_id } = await req.json();
    if (!customer_id) {
      return Response.json({ error: 'customer_id erforderlich' }, { status: 400 });
    }

    // Delete all contracts for this customer
    const contracts = await base44.entities.Contract.filter({ customer_id });
    for (const contract of contracts) {
      await base44.entities.Contract.delete(contract.id);
    }

    // Delete the customer
    await base44.entities.Customer.delete(customer_id);

    return Response.json({
      success: true,
      message: `Kunde gelöscht. ${contracts.length} Vertrag(e) wurden ebenfalls gelöscht.`,
      deleted_contracts: contracts.length
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});