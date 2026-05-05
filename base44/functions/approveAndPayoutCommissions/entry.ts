import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

/**
 * APPROVE & CREATE PAYOUT
 * 
 * Groups earned commissions by advisor & month
 * Creates Payout record with status=approved
 * Only allows payout if commission.status = earned
 * 
 * CRITICAL: Enforces audit trail (approved_by, approved_date)
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
      payout_month, // YYYY-MM-01
      advisor_id, // Optional: filter by advisor
      auto_create = true,
    } = payload;

    if (!payout_month) {
      return Response.json({ error: 'payout_month erforderlich' }, { status: 400 });
    }

    console.log(
      `[approveAndPayoutCommissions] START month=${payout_month} advisor=${advisor_id || 'all'}`
    );

    // ─── FETCH EARNED COMMISSIONS ───
    let filter = {
      status: 'earned', // Only earned commissions
      is_storno: false, // Exclude storno entries
    };

    // If advisor_id provided, filter by advisor
    if (advisor_id) {
      filter.advisor_id = advisor_id;
    }

    const commissions = await base44.entities.CommissionEntry.filter(filter);

    if (commissions.length === 0) {
      console.log('[approveAndPayoutCommissions] No earned commissions found');
      return Response.json({
        success: true,
        message: 'No earned commissions to payout',
        payouts_created: 0,
      });
    }

    // ─── GROUP BY advisor + month ───
    const payoutsByAdvisor = {};

    for (const commission of commissions) {
      // Extract month from entry_date
      const commMonth = commission.entry_date.substring(0, 7) + '-01';

      // Only include if matches payout_month
      if (commMonth !== payout_month) continue;

      const key = `${commission.advisor_id}|${payout_month}`;

      if (!payoutsByAdvisor[key]) {
        payoutsByAdvisor[key] = {
          advisor_id: commission.advisor_id,
          advisor_name: commission.advisor_name,
          organization_id: commission.organization_id,
          organization_name: commission.organization_name,
          payout_month: payout_month,
          commissions: [],
          total_amount: 0,
        };
      }

      payoutsByAdvisor[key].commissions.push(commission);
      payoutsByAdvisor[key].total_amount += commission.commission_amount || 0;
    }

    // ─── CREATE PAYOUTS ───
    const payoutsCreated = [];

    for (const [key, data] of Object.entries(payoutsByAdvisor)) {
      if (data.total_amount <= 0) {
        console.warn(`[approveAndPayoutCommissions] ⚠️ Skipping advisor ${data.advisor_id}: total_amount=${data.total_amount}`);
        continue;
      }

      // CHECK: Payout already exists?
      const existingPayouts = await base44.entities.Payout.filter({
        advisor_id: data.advisor_id,
        payout_month: data.payout_month,
      });

      if (existingPayouts.length > 0) {
        console.warn(
          `[approveAndPayoutCommissions] ⚠️ Payout already exists for ${data.advisor_id} ${data.payout_month}`
        );
        continue;
      }

      // ─── CREATE PAYOUT ───
      const payout = await base44.entities.Payout.create({
        advisor_id: data.advisor_id,
        advisor_name: data.advisor_name,
        organization_id: data.organization_id,
        organization_name: data.organization_name,
        payout_month: data.payout_month,
        total_amount: data.total_amount,
        commission_count: data.commissions.length,
        status: 'approved',
        approved_date: new Date().toISOString().split('T')[0],
        approved_by: user.email,
        notes: `Auto-approved for ${data.commissions.length} commissions`,
      });

      payoutsCreated.push(payout);

      console.log(
        `[approveAndPayoutCommissions] ✅ Payout ${payout.id} created: ${data.advisor_name} ${data.total_amount} CHF`
      );

      // ─── LINK COMMISSIONS TO PAYOUT ───
      for (const commission of data.commissions) {
        await base44.entities.CommissionEntry.update(commission.id, {
          payout_id: payout.id,
        });
      }

      // ─── CREATE ACCOUNTING ENTRIES (PAYOUT ACCRUAL) ───
      await base44.entities.AccountingEntry.create({
        entry_date: data.payout_month,
        entry_type: 'payout',
        amount: data.total_amount,
        advisor_id: data.advisor_id,
        advisor_name: data.advisor_name,
        organization_id: data.organization_id,
        organization_name: data.organization_name,
        status: 'booked',
        reference_type: 'payout',
        reference_id: payout.id,
        notes: `Auszahlung genehmigt: ${data.commissions.length} Provisionen`,
      });
    }

    console.log(
      `[approveAndPayoutCommissions] ✅ COMPLETE: ${payoutsCreated.length} payouts created`
    );

    return Response.json({
      success: true,
      payout_month,
      payouts_created: payoutsCreated.length,
      total_amount: payoutsCreated.reduce((sum, p) => sum + p.total_amount, 0),
      payouts: payoutsCreated.map(p => ({
        id: p.id,
        advisor_id: p.advisor_id,
        advisor_name: p.advisor_name,
        amount: p.total_amount,
        count: p.commission_count,
      })),
    });
  } catch (error) {
    console.error(`[approveAndPayoutCommissions] ERROR: ${error.message}`);
    return Response.json(
      { success: false, error: error.message },
      { status: 500 }
    );
  }
});