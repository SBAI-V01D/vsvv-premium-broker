import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

/**
 * Automation: Automatische Task-Zuordnung
 * Weist neue Aufgaben automatisch dem Hauptberater zu
 */
Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const { event, data } = await req.json();

    // Nur bei neuen Tasks
    if (event.type !== 'create') {
      return Response.json({ skipped: 'not_create' });
    }

    const task = data;
    if (!task.customer_id) {
      return Response.json({ skipped: 'no_customer' });
    }

    // Finde Hauptberater des Kunden
    const assignments = await base44.asServiceRole.entities.CustomerAdvisor.filter({
      customer_id: task.customer_id,
      is_primary: true,
    });

    if (assignments.length === 0) {
      return Response.json({ skipped: 'no_primary_advisor' });
    }

    const primaryAdvisor = assignments[0];

    // Weise Task dem Hauptberater zu
    await base44.asServiceRole.entities.Task.update(task.id, {
      assigned_to: primaryAdvisor.advisor_email,
    });

    return Response.json({
      success: true,
      assigned_to: primaryAdvisor.advisor_email,
      advisor_id: primaryAdvisor.advisor_id,
    });
  } catch (error) {
    console.error('Task Assignment Error:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});