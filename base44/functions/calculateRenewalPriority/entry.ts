import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

/**
 * CALCULATE RENEWAL PRIORITY
 * 
 * KI-Priorisierung basierend auf Ablaufdatum:
 * - < 60 Tage → high
 * - 60-120 Tage → medium
 * - > 120 Tage → low
 * 
 * Läuft täglich, aktualisiert alle Policies
 */

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user?.role || user.role !== 'admin') {
      return Response.json({ error: 'Admin access required' }, { status: 403 });
    }

    console.log(`[calculateRenewalPriority] START`);

    const policies = await base44.entities.Contract.filter(
      { status: 'active' },
      '-end_date'
    );

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    let updated = 0;

    for (const policy of policies) {
      if (!policy.end_date) continue;

      const endDate = new Date(policy.end_date);
      const daysUntilEnd = Math.floor((endDate - today) / (1000 * 60 * 60 * 24));

      let priority = 'low';
      if (daysUntilEnd < 60) {
        priority = 'high';
      } else if (daysUntilEnd < 120) {
        priority = 'medium';
      }

      if (policy.renewal_priority !== priority) {
        await base44.entities.Contract.update(policy.id, {
          renewal_priority: priority,
        });
        updated += 1;
      }
    }

    console.log(`[calculateRenewalPriority] ✅ ${updated} policies updated`);

    return Response.json({
      success: true,
      message: 'Renewal priorities calculated',
      updated,
    });
  } catch (error) {
    console.error(`[calculateRenewalPriority] ERROR: ${error.message}`);
    return Response.json(
      { success: false, error: error.message },
      { status: 500 }
    );
  }
});