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
      return Response.json({ 
        status: 'success',
        deleted: 0, 
        message: 'No customers to delete' 
      });
    }

    // Delete the newest 960 customers in background (fire and forget)
    const toDelete = customers.slice(0, Math.min(960, customers.length));
    
    // Start deletion in background without blocking
    (async () => {
      let deleted = 0;
      for (let i = 0; i < toDelete.length; i++) {
        try {
          await base44.entities.Customer.delete(toDelete[i].id);
          deleted++;
        } catch (e) {
          console.error(`[DELETE] Failed to delete ${toDelete[i].id}: ${e.message}`);
        }
        
        // Rate limit: delay every 5 deletes
        if ((i + 1) % 5 === 0) {
          await new Promise(r => setTimeout(r, 800));
        }
      }
      console.log(`[DELETE] Completed: Deleted ${deleted} customers`);
    })();

    // Return immediately with count
    return Response.json({
      status: 'success',
      deleted: toDelete.length,
      message: `${toDelete.length} Kunden werden gelöscht... (läuft im Hintergrund)`
    });
    
  } catch (error) {
    console.error('[DELETE] Error:', error.message);
    return Response.json({ status: 'error', error: error.message }, { status: 500 });
  }
});