import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

const ACTIVE_STATUSES = new Set(['active', 'definitiv_aktiv', 'policiert', 'abgeschlossen']);
const WORKFLOW_TASK_TYPES = new Set(['renewal', 'health_declaration', 'onboarding']);

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const { event, data, old_data } = await req.json();

    if (event?.type !== 'update') return Response.json({ skipped: 'Not an update event' });
    if (event?.entity_name !== 'Contract') return Response.json({ skipped: 'Not a Contract entity' });

    const contract = data;
    const oldContract = old_data;

    const statusChanged = oldContract?.status !== contract?.status;
    const isNowActive = contract?.status && ACTIVE_STATUSES.has(contract.status);

    if (!statusChanged || !isNowActive) return Response.json({ skipped: 'Status not activated' });

    if (!contract.customer_id) return Response.json({ skipped: 'No customer_id on contract' });

    console.log(`[syncTaskOnContractActivation] Contract ${contract.id}: ${oldContract?.status} → ${contract.status}`);

    // Targeted query: only tasks for this customer (not full table scan)
    const customerTasks = await base44.entities.Task.filter({ customer_id: contract.customer_id });

    const contractTasks = customerTasks.filter(t => {
      // Explicit contract link
      if (t.contract_id === contract.id) return true;

      // Only open/in-progress workflow tasks
      if (!['open', 'in_progress'].includes(t.status)) return false;

      // Only known workflow task types — no fuzzy keyword matching
      return WORKFLOW_TASK_TYPES.has(t.task_type);
    });

    console.log(`[syncTaskOnContractActivation] Found ${contractTasks.length} workflow tasks to complete`);

    if (contractTasks.length === 0) {
      return Response.json({ synced: 0, message: 'No related workflow tasks found' });
    }

    // Complete tasks in parallel
    await Promise.all(contractTasks.map(task =>
      base44.entities.Task.update(task.id, {
        contract_id: contract.id,
        status: 'completed',
        completion_date: new Date().toISOString().split('T')[0],
        notes: (task.notes || '') + `\n[Auto-erledigt durch Vertragsaktivierung am ${new Date().toLocaleDateString('de-CH')}]`,
      })
    ));

    return Response.json({
      synced: contractTasks.length,
      taskIds: contractTasks.map(t => t.id),
      contractId: contract.id,
      message: `${contractTasks.length} Workflow-Aufgabe(n) automatisch abgeschlossen`,
    });

  } catch (error) {
    console.error('[syncTaskOnContractActivation] ERROR:', error.message);
    return Response.json({ error: error.message }, { status: 500 });
  }
});