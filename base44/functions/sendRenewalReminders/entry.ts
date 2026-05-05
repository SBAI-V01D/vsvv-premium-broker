import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

/**
 * SEND RENEWAL REMINDERS
 * 
 * Wiederkehrende Erinnerung alle 14 Tage
 * wenn renewal_status != completed
 * 
 * Läuft täglich, prüft aber nur 14-Tage-Abstände
 */

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user?.role || user.role !== 'admin') {
      return Response.json({ error: 'Admin access required' }, { status: 403 });
    }

    console.log(`[sendRenewalReminders] START`);

    // ─── FETCH POLICIES IN RENEWAL WORKFLOW ───
    const policies = await base44.entities.Contract.filter(
      { status: 'active' },
      '-end_date'
    );

    let reminded = 0;
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    for (const policy of policies) {
      // Skip if already completed
      if (policy.renewal_status === 'completed') continue;
      if (policy.renewal_status === 'none') continue;

      // ─── CHECK 14-DAY INTERVAL ───
      const lastReminder = policy.renewal_last_reminder
        ? new Date(policy.renewal_last_reminder)
        : new Date(0);
      lastReminder.setHours(0, 0, 0, 0);

      const daysSinceReminder = Math.floor(
        (today - lastReminder) / (1000 * 60 * 60 * 24)
      );

      if (daysSinceReminder >= 14) {
        // ─── SEND REMINDER (MOCK) ───
        // In production: send email, create task, etc.
        console.log(
          `[sendRenewalReminders] 📬 Reminder sent for policy ${policy.id} (last: ${daysSinceReminder} days ago)`
        );

        // ─── UPDATE LAST REMINDER ───
        await base44.entities.Contract.update(policy.id, {
          renewal_last_reminder: today.toISOString().split('T')[0],
        });

        reminded += 1;
      }
    }

    return Response.json({
      success: true,
      message: 'Renewal reminders sent',
      reminded,
    });
  } catch (error) {
    console.error(`[sendRenewalReminders] ERROR: ${error.message}`);
    return Response.json(
      { success: false, error: error.message },
      { status: 500 }
    );
  }
});