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
        deleted: { customers: 0, contracts: 0, applications: 0, tasks: 0, documents: 0 },
        message: 'No customers to delete' 
      });
    }

    // Get the 960 newest customers to delete
    const toDelete = customers.slice(0, Math.min(960, customers.length));
    const customerIds = toDelete.map(c => c.id);

    console.log(`[CLEANUP] Starting cleanup for ${customerIds.length} customers`);

    // Start cleanup in background
    (async () => {
      const stats = {
        contracts: 0,
        applications: 0,
        tasks: 0,
        documents: 0,
        customers: 0,
        errors: 0
      };

      // Step 1: Get and delete all contracts for these customers
      try {
        const allContracts = await base44.entities.Contract.list('', 1000);
        const contractsToDelete = allContracts.filter(c => customerIds.includes(c.customer_id));
        
        for (const contract of contractsToDelete) {
          try {
            await base44.entities.Contract.delete(contract.id);
            stats.contracts++;
          } catch (e) {
            console.error(`[CLEANUP] Failed to delete contract ${contract.id}: ${e.message}`);
            stats.errors++;
          }
        }
      } catch (e) {
        console.error(`[CLEANUP] Error fetching contracts: ${e.message}`);
      }

      await new Promise(r => setTimeout(r, 500));

      // Step 2: Get and delete all applications for these customers
      try {
        const allApps = await base44.entities.Application.list('', 1000);
        const appsToDelete = allApps.filter(a => customerIds.includes(a.customer_id));
        
        for (const app of appsToDelete) {
          try {
            await base44.entities.Application.delete(app.id);
            stats.applications++;
          } catch (e) {
            console.error(`[CLEANUP] Failed to delete application ${app.id}: ${e.message}`);
            stats.errors++;
          }
        }
      } catch (e) {
        console.error(`[CLEANUP] Error fetching applications: ${e.message}`);
      }

      await new Promise(r => setTimeout(r, 500));

      // Step 3: Get and delete all tasks for these customers
      try {
        const allTasks = await base44.entities.Task.list('', 1000);
        const tasksToDelete = allTasks.filter(t => customerIds.includes(t.customer_id));
        
        for (const task of tasksToDelete) {
          try {
            await base44.entities.Task.delete(task.id);
            stats.tasks++;
          } catch (e) {
            console.error(`[CLEANUP] Failed to delete task ${task.id}: ${e.message}`);
            stats.errors++;
          }
        }
      } catch (e) {
        console.error(`[CLEANUP] Error fetching tasks: ${e.message}`);
      }

      await new Promise(r => setTimeout(r, 500));

      // Step 4: Get and delete all documents for these customers
      try {
        const allDocs = await base44.entities.Document.list('', 1000);
        const docsToDelete = allDocs.filter(d => customerIds.includes(d.customer_id));
        
        for (const doc of docsToDelete) {
          try {
            await base44.entities.Document.delete(doc.id);
            stats.documents++;
          } catch (e) {
            console.error(`[CLEANUP] Failed to delete document ${doc.id}: ${e.message}`);
            stats.errors++;
          }
        }
      } catch (e) {
        console.error(`[CLEANUP] Error fetching documents: ${e.message}`);
      }

      await new Promise(r => setTimeout(r, 500));

      // Step 5: Delete the customers themselves
      for (let i = 0; i < customerIds.length; i++) {
        try {
          await base44.entities.Customer.delete(customerIds[i]);
          stats.customers++;
        } catch (e) {
          console.error(`[CLEANUP] Failed to delete customer ${customerIds[i]}: ${e.message}`);
          stats.errors++;
        }

        // Rate limit: delay every 5 deletes
        if ((i + 1) % 5 === 0) {
          await new Promise(r => setTimeout(r, 800));
        }
      }

      console.log(`[CLEANUP] Completed: ${JSON.stringify(stats)}`);
    })();

    // Return immediately
    return Response.json({
      status: 'success',
      message: `System-Cleanup läuft... ${toDelete.length} Kunden + zugehörige Verträge/Anträge/Aufgaben/Dokumente werden gelöscht.`,
      preview: `${toDelete.length} Kunden`
    });
    
  } catch (error) {
    console.error('[CLEANUP] Error:', error.message);
    return Response.json({ status: 'error', error: error.message }, { status: 500 });
  }
});