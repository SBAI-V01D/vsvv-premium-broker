import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const { event, data } = await req.json();

    // Prüfe ob GD erforderlich ist
    const healthDeclaration = data?.sparte_data?.health_declaration;
    if (healthDeclaration !== 'Ja') {
      return Response.json({ success: true, skipped: true });
    }

    // Prüfe ob bereits eine Task für diese Applikation existiert
    const existingTasks = await base44.entities.Task.filter({
      linked_application_id: data.id,
      task_type: 'health_declaration'
    });

    if (existingTasks.length > 0) {
      return Response.json({ success: true, skipped: true, reason: 'Task already exists' });
    }

    // Erstelle neue Aufgabe
    const task = await base44.entities.Task.create({
      title: `Gesundheitserklärung erforderlich – ${data.customer_name}`,
      description: `Gesundheitserklärung für Antrag erforderlich.\n\nKunde: ${data.customer_name}\nSparte: ${data.sparte || data.insurance_type}\nVersicherer: ${data.insurer}\nProduct: ${data.product || '–'}`,
      customer_id: data.customer_id,
      customer_name: data.customer_name,
      linked_application_id: data.id,
      assigned_to: data.assigned_broker || 'unassigned',
      priority: 'high',
      status: 'open',
      task_type: 'health_declaration',
      due_date: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
    });

    return Response.json({ 
      success: true, 
      taskId: task.id,
      message: `Task erstellt für GD-Prüfung: ${data.customer_name}`
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});