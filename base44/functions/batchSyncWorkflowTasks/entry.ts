import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

const ACTIVE_STATUSES = new Set([
  'active',
  'definitiv_aktiv',
  'policiert',
  'abgeschlossen'
]);

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    
    if (!user || user.role !== 'admin') {
      return Response.json({ error: 'Admin access required' }, { status: 403 });
    }

    // Get all active contracts
    const allContracts = await base44.entities.Contract.list();
    const activeContracts = allContracts.filter(c => ACTIVE_STATUSES.has(c.status));

    console.log(`Found ${activeContracts.length} active contracts`);

    // Get all open tasks
    const allTasks = await base44.entities.Task.list();
    const openTasks = allTasks.filter(t => ['open', 'in_progress', 'waiting'].includes(t.status));

    console.log(`Found ${openTasks.length} open tasks`);

    const completedTaskIds = [];

    // For each active contract, find and complete related tasks
    for (const contract of activeContracts) {
      const relatedTasks = openTasks.filter(t => {
        // Direct contract link
        if (t.contract_id === contract.id) return true;
        
        // Customer match + workflow keywords
        if (t.customer_id === contract.customer_id) {
          const title = (t.title || '').toLowerCase();
          return (
            t.task_type === 'renewal' ||
            t.task_type === 'health_declaration' ||
            title.includes('police') ||
            title.includes('vertrag') ||
            title.includes('verlänger') ||
            title.includes('prüf')
          );
        }
        return false;
      });

      // Complete all related tasks
      for (const task of relatedTasks) {
        if (!completedTaskIds.includes(task.id)) {
          await base44.entities.Task.update(task.id, {
            status: 'completed',
            completion_date: new Date().toISOString().split('T')[0],
            notes: (task.notes || '') + `\n[Batch-Auto-erledigt am ${new Date().toLocaleDateString('de-CH')}]`
          });
          completedTaskIds.push(task.id);
          console.log(`Completed task ${task.id} for contract ${contract.id}`);
        }
      }
    }

    return Response.json({
      synced: completedTaskIds.length,
      taskIds: completedTaskIds,
      message: `${completedTaskIds.length} Workflow-Aufgaben abgeschlossen`
    });

  } catch (error) {
    console.error('Batch sync error:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});