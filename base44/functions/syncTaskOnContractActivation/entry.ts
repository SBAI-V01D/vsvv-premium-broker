import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

const ACTIVE_STATUSES = new Set([
  'active',
  'definitiv_aktiv',
  'policiert',
  'abgeschlossen'
]);

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

    const { event, data, old_data } = await req.json();

    // Only process update events
    if (event?.type !== 'update') {
      return Response.json({ skipped: 'Not an update event' });
    }

    // Only process Contract entity
    if (event?.entity_name !== 'Contract') {
      return Response.json({ skipped: 'Not a Contract entity' });
    }

    const contract = data;
    const oldContract = old_data;

    // Check if status changed to an active status
    const statusChanged = oldContract?.status !== contract?.status;
    const isNowActive = contract?.status && ACTIVE_STATUSES.has(contract.status);

    console.log(`Contract ${contract.id}: oldStatus=${oldContract?.status}, newStatus=${contract?.status}, changed=${statusChanged}, isActive=${isNowActive}`);

    if (!statusChanged || !isNowActive) {
      return Response.json({ skipped: 'Status not activated' });
    }

    // Find all related tasks for this contract
    console.log(`Looking for tasks related to contract ${contract.id}, customer ${contract.customer_id}`);
    
    const allTasks = await base44.entities.Task.list();
    console.log(`Found ${allTasks.length} total tasks in system`);

    const contractTasks = allTasks.filter(t => {
      // Match by explicit contract_id
      if (t.contract_id === contract.id) {
        console.log(`Match: Task ${t.id} linked via contract_id`);
        return true;
      }
      
      // Match by customer + workflow type/keywords
      if (t.customer_id === contract.customer_id && ['open', 'in_progress', 'waiting'].includes(t.status)) {
        const isWorkflowTaskType = WORKFLOW_TASK_TYPES.has(t.task_type);
        const title = (t.title || '').toLowerCase();
        const isWorkflowKeyword = 
          title.includes('police') ||
          title.includes('vertrag') ||
          title.includes('verlänger') ||
          title.includes('prüf');
        
        if (isWorkflowTaskType || isWorkflowKeyword) {
          console.log(`Match: Task ${t.id} (${t.title}) for customer ${contract.customer_id}, type=${t.task_type}`);
          return true;
        }
      }
      
      return false;
    });

    console.log(`Found ${contractTasks.length} related workflow tasks to complete`);

    if (contractTasks.length === 0) {
      return Response.json({ 
        synced: 0, 
        message: 'No related workflow tasks found',
        contractId: contract.id,
        customerId: contract.customer_id
      });
    }

    // Auto-complete related workflow tasks
    const completedTasks = [];
    for (const task of contractTasks) {
      await base44.entities.Task.update(task.id, {
        status: 'completed',
        completion_date: new Date().toISOString().split('T')[0],
        notes: (task.notes || '') + `\n[Auto-erledigt durch Vertragsaktivierung am ${new Date().toLocaleDateString('de-CH')}]`
      });
      completedTasks.push(task.id);
      console.log(`Completed task ${task.id}`);
    }

    return Response.json({
      synced: completedTasks.length,
      taskIds: completedTasks,
      contractId: contract.id,
      message: `${completedTasks.length} Workflow-Aufgabe(n) automatisch abgeschlossen`
    });

  } catch (error) {
    console.error('Sync error:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});