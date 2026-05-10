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

    if (!statusChanged || !isNowActive) {
      return Response.json({ skipped: 'Status not activated' });
    }

    // Find all related tasks for this contract
    const allTasks = await base44.entities.Task.list();
    const contractTasks = allTasks.filter(t => {
      // Match by explicit contract_id
      if (t.contract_id === contract.id) return true;
      
      // Match by customer_id + workflow-related task type or title
      if (t.customer_id === contract.customer_id) {
        const isWorkflowTaskType = WORKFLOW_TASK_TYPES.has(t.task_type);
        const title = (t.title || '').toLowerCase();
        const isWorkflowKeyword = 
          title.includes('police') ||
          title.includes('vertrag') ||
          title.includes('verlänger') ||
          title.includes('prüf');
        
        if (isWorkflowTaskType || isWorkflowKeyword) return true;
      }
      
      return false;
    }).filter(t => ['open', 'in_progress', 'waiting'].includes(t.status));

    if (contractTasks.length === 0) {
      return Response.json({ 
        synced: 0, 
        message: 'No related workflow tasks found'
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