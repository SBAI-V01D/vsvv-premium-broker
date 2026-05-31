import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

/**
 * birthdayEmailReminder
 * Täglich ausführen — sendet Geburtstagsglückwünsche und erstellt Berater-Tasks
 */
Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (user && user.role !== 'admin') {
      return Response.json({ error: 'Forbidden: Admin required' }, { status: 403 });
    }

    const today = new Date();
    const todayMD = `${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;

    const allCustomers = await base44.asServiceRole.entities.Customer.list(null, 5000);
    const birthdayCustomers = allCustomers.filter(c => {
      if (!c.birthdate || c.archived) return false;
      return c.birthdate.slice(5) === todayMD; // MM-DD match
    });

    let emailsSent = 0;
    let tasksCreated = 0;

    for (const customer of birthdayCustomers) {
      const age = today.getFullYear() - parseInt(customer.birthdate.slice(0, 4));

      // Send birthday email if customer has email
      if (customer.email) {
        await base44.asServiceRole.integrations.Core.SendEmail({
          to: customer.email,
          from_name: 'VSV Management GmbH',
          subject: `Herzlichen Glückwunsch zum Geburtstag, ${customer.first_name}!`,
          body: `<div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto">
<p style="font-size:16px">Liebe/r ${customer.first_name} ${customer.last_name},</p>
<p>Das gesamte Team von <strong>VSV Management GmbH</strong> wünscht Ihnen herzlich alles Gute zu Ihrem <strong>${age}. Geburtstag</strong>!</p>
<p>Wir schätzen Ihr Vertrauen und freuen uns auf die weitere Zusammenarbeit.</p>
<p style="margin-top:24px">Mit freundlichen Grüssen<br><strong>VSV Management GmbH</strong></p>
</div>`
        });
        emailsSent++;
      }

      // Create advisor task
      if (customer.advisor_id || customer.assigned_broker) {
        const existingTasks = await base44.asServiceRole.entities.Task.filter({
          customer_id: customer.id,
          status: ['open', 'in_progress']
        });
        const alreadyExists = existingTasks.some(t =>
          t.title?.includes('Geburtstag') && t.due_date === today.toISOString().split('T')[0]
        );
        if (!alreadyExists) {
          await base44.asServiceRole.entities.Task.create({
            title: `🎂 Geburtstag: ${customer.first_name} ${customer.last_name} (${age} Jahre)`,
            task_type: 'general',
            priority: 'medium',
            status: 'open',
            customer_id: customer.id,
            customer_name: `${customer.first_name} ${customer.last_name}`,
            due_date: today.toISOString().split('T')[0],
            notes: `Geburtstagskunde — persönlichen Glückwunsch übermitteln und Kundenbindung stärken.`
          });
          tasksCreated++;
        }
      }
    }

    return Response.json({
      success: true,
      date: today.toISOString().split('T')[0],
      birthday_customers: birthdayCustomers.length,
      emails_sent: emailsSent,
      tasks_created: tasksCreated,
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});