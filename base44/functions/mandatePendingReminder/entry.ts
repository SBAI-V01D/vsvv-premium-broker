import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

/**
 * mandatePendingReminder
 * Wöchentlich ausführen — erstellt Berater-Tasks für Kunden mit pendent > 30 Tage Mandat
 */
Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (user && user.role !== 'admin') {
      return Response.json({ error: 'Forbidden: Admin required' }, { status: 403 });
    }

    const today = new Date();
    const cutoff30 = new Date(today); cutoff30.setDate(cutoff30.getDate() - 30);
    const cutoff60 = new Date(today); cutoff60.setDate(cutoff60.getDate() - 60);

    const allCustomers = await base44.asServiceRole.entities.Customer.list(null, 5000);

    const pendingMandates = allCustomers.filter(c => {
      if (c.archived || c.mandate_status !== 'pending') return false;
      const ref = c.updated_date || c.created_date;
      if (!ref) return false;
      return new Date(ref) < cutoff30;
    });

    let tasksCreated = 0;
    let skipped = 0;

    for (const customer of pendingMandates) {
      const refDate = customer.updated_date || customer.created_date;
      const daysPending = Math.floor((today - new Date(refDate)) / 86400000);
      const priority = daysPending > 60 ? 'high' : 'medium';

      // Check for existing open mandate task
      const existing = await base44.asServiceRole.entities.Task.filter({
        customer_id: customer.id,
        task_type: 'onboarding',
        status: ['open', 'in_progress']
      });
      const mandateTaskExists = existing.some(t => t.title?.includes('Mandat'));
      if (mandateTaskExists) { skipped++; continue; }

      const dueDate = new Date(today);
      dueDate.setDate(dueDate.getDate() + 7);

      await base44.asServiceRole.entities.Task.create({
        title: `📋 Mandat prüfen: ${customer.first_name} ${customer.last_name} (${daysPending} Tage pendent)`,
        task_type: 'onboarding',
        priority,
        status: 'open',
        customer_id: customer.id,
        customer_name: `${customer.first_name} ${customer.last_name}`,
        due_date: dueDate.toISOString().split('T')[0],
        notes: `Mandat-Status ist seit ${daysPending} Tagen «pendent». Bitte Kunden kontaktieren, Mandat unterzeichnen lassen und Status aktualisieren.${daysPending > 60 ? '\n⚠️ DRINGEND: Über 60 Tage ohne Mandat!' : ''}`
      });
      tasksCreated++;
    }

    return Response.json({
      success: true,
      checked_customers: allCustomers.length,
      pending_mandates_found: pendingMandates.length,
      tasks_created: tasksCreated,
      skipped_existing: skipped,
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});