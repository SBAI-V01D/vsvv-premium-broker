import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

/**
 * UPDATE KPI: Advisor Cache Fields
 * 
 * Recalculates and persists:
 * - total_commission (sum of all earned commissions)
 * - paid_commission (sum of paid commissions)
 * - open_commission (total - paid)
 * 
 * Called by: commission lifecycle changes
 */

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user?.role || user.role !== 'admin') {
      return Response.json({ error: 'Admin access required' }, { status: 403 });
    }

    const payload = await req.json();
    const { advisor_id } = payload;

    if (!advisor_id) {
      return Response.json({ error: 'advisor_id erforderlich' }, { status: 400 });
    }

    console.log(`[updateKPIAdvisor] RECALC advisor=${advisor_id}`);

    // ─── FETCH ALL COMMISSIONS FOR ADVISOR ───
    const commissions = await base44.entities.CommissionEntry.filter({
      advisor_id: advisor_id,
    });

    // ─── CALCULATE KPIs ───
    let totalCommission = 0;
    let paidCommission = 0;

    for (const comm of commissions) {
      if (comm.is_storno) continue; // Exclude storno entries
      if (comm.status === 'cancelled') continue; // Exclude cancelled

      // Total: all earned + pending + invoiced + received
      if (['earned', 'pending', 'invoiced', 'received'].includes(comm.status)) {
        totalCommission += comm.commission_amount || 0;
      }

      // Paid: only status=paid
      if (comm.status === 'paid') {
        paidCommission += comm.commission_amount || 0;
      }
    }

    const openCommission = totalCommission - paidCommission;

    console.log(
      `[updateKPIAdvisor] total=${totalCommission} paid=${paidCommission} open=${openCommission}`
    );

    // ─── UPDATE ADVISOR ───
    await base44.entities.Advisor.update(advisor_id, {
      total_commission: totalCommission,
      paid_commission: paidCommission,
      open_commission: openCommission,
    });

    console.log(`[updateKPIAdvisor] ✅ Advisor KPI updated`);

    return Response.json({
      success: true,
      advisor_id,
      total_commission: totalCommission,
      paid_commission: paidCommission,
      open_commission: openCommission,
    });
  } catch (error) {
    console.error(`[updateKPIAdvisor] ERROR: ${error.message}`);
    return Response.json(
      { success: false, error: error.message },
      { status: 500 }
    );
  }
});