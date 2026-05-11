import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

const WORKFLOW_TASK_TYPES = new Set([
  'renewal',
  'health_declaration'
]);

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    
    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Fetch all contracts and tasks
    const contracts = await base44.asServiceRole.entities.Contract.list(null, 1000);
    const allTasks = await base44.asServiceRole.entities.Task.list(null, 1000);

    // Find all active contracts
    const activeContracts = contracts.filter(c => 
      c.status && ['active', 'definitiv_aktiv', 'policiert', 'abgeschlossen'].includes(c.status)
    );

    console.log(`Found ${activeContracts.length} active contracts`);

    // Find all open workflow tasks related to these contracts
    const activeContractIds = new Set(activeContracts.map(c => c.id));
    const activeCustomerIds = new Set(activeContracts.map(c => c.customer_id));

    const workflowTasks = allTasks.filter(t => {
      // Must be open/in_progress
      if (!['open', 'in_progress'].includes(t.status)) return false;
      
      // Must be related to active contract or customer
      if (t.contract_id && activeContractIds.has(t.contract_id)) return true;
      if (t.customer_id && activeCustomerIds.has(t.customer_id)) {
        // Must be workflow task type
        if (WORKFLOW_TASK_TYPES.has(t.task_type)) return true;
        
        // Or have workflow keywords
        const title = (t.title || '').toLowerCase();
        if (title.includes('police') || title.includes('vertrag') || 
            title.includes('verlänger') || title.includes('prüf')) {
          return true;
        }
      }
      
      return false;
    });

    console.log(`Found ${workflowTasks.length} open workflow tasks to complete`);

    // Complete all workflow tasks
    const completed = [];
    for (const task of workflowTasks) {
      // Find the contract for this task
      const contract = activeContracts.find(c => 
        c.id === task.contract_id || c.customer_id === task.customer_id
      );

      await base44.asServiceRole.entities.Task.update(task.id, {
        contract_id: contract?.id || task.contract_id,
        status: 'completed',
        completion_date: new Date().toISOString().split('T')[0],
        notes: (task.notes || '') + `\n[Manuell abgeschlossen: ${new Date().toLocaleDateString('de-CH')}]`
      });

      completed.push({
        id: task.id,
        title: task.title,
        customer: task.customer_name
      });

      console.log(`Completed: ${task.title} (${task.customer_name})`);
    }

    return Response.json({
      success: true,
      activeContracts: activeContracts.length,
      completedTasks: completed.length,
      completed,
      message: `${completed.length} Workflow-Aufgaben abgeschlossen`
    });

  } catch (error) {
    console.error('Error:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});