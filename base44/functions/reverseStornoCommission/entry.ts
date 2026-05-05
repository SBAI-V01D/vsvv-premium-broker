import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

/**
 * REVERSE STORNO COMMISSION
 * 
 * Called when policy is cancelled within storno_period.
 * Creates negative commission entry (is_storno=true).
 * Blocks payout for original commission.
 * 
 * CRITICAL: Enforces market standard Stornoziehung
 */

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const payload = await req.json();
    const {
      commission_id,
      storno_date = new Date().toISOString().split('T')[0],
      reason = 'Policy cancelled',
    } = payload;

    if (!commission_id) {
      return Response.json({ error: 'commission_id erforderlich' }, { status: 400 });
    }

    console.log(
      `[reverseStornoCommission] START comm=${commission_id} date=${storno_date}`
    );

    // ─── FETCH ORIGINAL COMMISSION ───
    const original = await base44.entities.CommissionEntry.get(commission_id);
    if (!original) {
      return Response.json({ error: 'Commission nicht gefunden' }, { status: 404 });
    }

    if (original.is_storno) {
      return Response.json(
        { error: 'Dieses ist bereits eine Storno-Entry' },
        { status: 400 }
      );
    }

    // ─── CHECK STORNO PERIOD ───
    if (original.storno_eligible_until) {
      const eligibleDate = new Date(original.storno_eligible_until);
      const stornoDateObj = new Date(storno_date);
      if (stornoDateObj > eligibleDate) {
        return Response.json(
          {
            error: `Storno-Periode abgelaufen (bis ${original.storno_eligible_until})`,
          },
          { status: 400 }
        );
      }
    }

    // ─── MARK ORIGINAL AS CANCELLED ───
    await base44.entities.CommissionEntry.update(commission_id, {
      status: 'cancelled',
    });

    console.log(`[reverseStornoCommission] ✅ Original commission marked cancelled`);

    // ─── CREATE NEGATIVE STORNO ENTRY ───
    const stornoEntry = await base44.entities.CommissionEntry.create({
      policy_id: original.policy_id,
      policy_number: original.policy_number,
      advisor_id: original.advisor_id,
      advisor_name: original.advisor_name,
      organization_id: original.organization_id,
      organization_name: original.organization_name,
      customer_id: original.customer_id,
      customer_name: original.customer_name,
      insurer: original.insurer,
      product_category: original.product_category,
      premium_yearly: -original.premium_yearly, // NEGATIVE
      commission_percentage: original.commission_percentage,
      commission_amount: -original.commission_amount, // NEGATIVE
      status: 'received', // Storno immediately "received"
      entry_date: storno_date,
      received_date: storno_date,
      received_amount: -original.commission_amount,
      is_storno: true,
      storno_reference_id: commission_id,
      notes: `Storno: ${reason} (Original: ${commission_id})`,
    });

    console.log(
      `[reverseStornoCommission] ✅ Storno entry created: ${stornoEntry.id}`
    );

    // ─── CREATE NEGATIVE ACCOUNTING ENTRY ───
    const accountingEntry = await base44.entities.AccountingEntry.create({
      entry_date: storno_date,
      entry_type: 'storno',
      amount: -original.commission_amount, // NEGATIVE
      advisor_id: original.advisor_id,
      advisor_name: original.advisor_name,
      organization_id: original.organization_id,
      organization_name: original.organization_name,
      policy_id: original.policy_id,
      policy_number: original.policy_number,
      insurer: original.insurer,
      customer_id: original.customer_id,
      customer_name: original.customer_name,
      status: 'booked',
      reference_type: 'commission_entry',
      reference_id: stornoEntry.id,
      notes: `Storno-Buchung: ${reason}`,
    });

    console.log(
      `[reverseStornoCommission] ✅ Accounting storno entry created: ${accountingEntry.id}`
    );

    // ─── PREVENT PAYOUT ───
    // If original was already in a payout, mark payout as void (optional: create credit)
    if (original.payout_id) {
      console.warn(
        `[reverseStornoCommission] ⚠️ Original commission was in payout ${original.payout_id} - consider credit`
      );
    }

    console.log(
      `[reverseStornoCommission] ✅ COMPLETE: commission storniert ${commission_id}`
    );

    return Response.json({
      success: true,
      original_commission_id: commission_id,
      storno_entry_id: stornoEntry.id,
      storno_amount: -original.commission_amount,
      message: 'Commission storniert',
    });
  } catch (error) {
    console.error(`[reverseStornoCommission] ERROR: ${error.message}`);
    return Response.json(
      { success: false, error: error.message },
      { status: 500 }
    );
  }
});