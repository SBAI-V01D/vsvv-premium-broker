import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const { event, data } = await req.json();

    // Nur bei CREATE (nicht bei UPDATE) Aufgaben erstellen
    if (event.type !== 'create') {
      return Response.json({ success: true, skipped: true, reason: 'Only triggered on create' });
    }

    // Prüfe ob GD erforderlich ist
    const healthDeclaration = data?.sparte_data?.health_declaration;
    if (healthDeclaration !== 'Ja') {
      return Response.json({ success: true, skipped: true, reason: 'No health declaration required' });
    }

    // Validiere notwendige Daten
    if (!data?.id || !data?.customer_id || !data?.customer_name) {
      return Response.json({ success: false, error: 'Missing required application data' }, { status: 400 });
    }

    // Prüfe ob bereits eine offene/in_progress GD-Task für diese Applikation existiert
    const existingTasks = await base44.asServiceRole.entities.Task.list();
    const duplicateTask = existingTasks.find(t => 
      t.linked_application_id === data.id && 
      t.task_type === 'health_declaration' &&
      ['open', 'in_progress'].includes(t.status)
    );

    if (duplicateTask) {
      return Response.json({ 
        success: true, 
        skipped: true, 
        reason: `GD-Task existiert bereits (ID: ${duplicateTask.id})` 
      });
    }

    // Erstelle neue Aufgabe
    const dueDate = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
    
    const task = await base44.asServiceRole.entities.Task.create({
      title: `Gesundheitserklärung erforderlich – ${data.customer_name}`,
      description: `Gesundheitserklärung für Antrag erforderlich.\n\nKunde: ${data.customer_name}\nSparte: ${data.sparte || data.insurance_type}\nVersicherer: ${data.insurer}\nProdukt: ${data.product || '–'}`,
      customer_id: data.customer_id,
      customer_name: data.customer_name,
      linked_application_id: data.id,
      assigned_to: data.assigned_broker || 'unassigned',
      priority: 'high',
      status: 'open',
      task_type: 'health_declaration',
      due_date: dueDate,
    });

    return Response.json({ 
      success: true, 
      taskId: task.id,
      message: `GD-Task erstellt: ${data.customer_name}`
    });
  } catch (error) {
    console.error('GD Task creation error:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});