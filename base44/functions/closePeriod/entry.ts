import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

/**
 * CLOSE PERIOD
 * 
 * Admin-only: Closes financial period (month)
 * Sets status = closed → blocks all changes
 * 
 * CRITICAL: Immutable Financial Audit Trail
 */

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user?.role || user.role !== 'admin') {
      return Response.json({ error: 'Admin access required' }, { status: 403 });
    }

    const payload = await req.json();
    const {
      month, // YYYY-MM-01
    } = payload;

    if (!month) {
      return Response.json({ error: 'month erforderlich (YYYY-MM-01)' }, { status: 400 });
    }

    console.log(`[closePeriod] START month=${month}`);

    // ─── FETCH OR CREATE PERIOD ───
    let periods = await base44.entities.FinancePeriod.filter({
      month: month,
    });

    let period;

    if (periods.length === 0) {
      // Create period
      period = await base44.entities.FinancePeriod.create({
        month: month,
        status: 'open',
      });
      console.log(`[closePeriod] ℹ️ Period created: ${period.id}`);
    } else {
      period = periods[0];
    }

    // ─── CHECK IF ALREADY CLOSED ───
    if (period.status === 'closed') {
      return Response.json(
        {
          error: `Period ${month} is already closed`,
          closed_date: period.closed_date,
          closed_by: period.closed_by,
        },
        { status: 400 }
      );
    }

    // ─── CALCULATE PERIOD TOTALS ───
    const monthPrefix = month.substring(0, 7); // YYYY-MM
    const commissions = await base44.entities.CommissionEntry.filter({});

    let totalCommissions = 0;
    let totalPayouts = 0;

    for (const comm of commissions) {
      if (!comm.entry_date || comm.entry_date.substring(0, 7) !== monthPrefix) continue;
      if (comm.is_storno) {
        totalCommissions -= comm.commission_amount || 0;
      } else {
        totalCommissions += comm.commission_amount || 0;
      }
    }

    const payouts = await base44.entities.Payout.filter({
      payout_month: month,
      status: 'paid',
    });

    for (const payout of payouts) {
      totalPayouts += payout.total_amount || 0;
    }

    console.log(
      `[closePeriod] Totals: commissions=${totalCommissions} payouts=${totalPayouts}`
    );

    // ─── CLOSE PERIOD ───
    await base44.entities.FinancePeriod.update(period.id, {
      status: 'closed',
      closed_date: new Date().toISOString().split('T')[0],
      closed_by: user.email,
      total_commissions: totalCommissions,
      total_payouts: totalPayouts,
    });

    console.log(`[closePeriod] ✅ Period CLOSED: ${month}`);

    return Response.json({
      success: true,
      month,
      status: 'closed',
      closed_by: user.email,
      total_commissions: totalCommissions,
      total_payouts: totalPayouts,
      message: 'Periode geschlossen – keine Änderungen mehr möglich',
    });
  } catch (error) {
    console.error(`[closePeriod] ERROR: ${error.message}`);
    return Response.json(
      { success: false, error: error.message },
      { status: 500 }
    );
  }
});