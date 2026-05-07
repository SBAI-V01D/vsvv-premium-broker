import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    
    if (!user || user.role !== 'admin') {
      return Response.json({ error: 'Admin only' }, { status: 403 });
    }

    // Get all customers, sorted by created_date descending (newest first)
    const customers = await base44.entities.Customer.list('-created_date', 1000);
    
    if (!customers || customers.length === 0) {
      return Response.json({ deleted: 0, message: 'No customers to delete' });
    }

    // Delete the newest 960 customers (likely from the import)
    const toDelete = customers.slice(0, 960);
    let deleted = 0;

    for (const customer of toDelete) {
      try {
        await base44.entities.Customer.delete(customer.id);
        deleted++;
      } catch (e) {
        console.error(`[DELETE] Failed to delete ${customer.id}: ${e.message}`);
      }
    }

    console.log(`[DELETE] Deleted ${deleted} customers`);

    return Response.json({
      status: 'success',
      deleted: deleted,
      message: `${deleted} Kunden gelöscht`
    });
    
  } catch (error) {
    console.error('[DELETE] Error:', error.message);
    return Response.json({ status: 'error', error: error.message }, { status: 500 });
  }
});