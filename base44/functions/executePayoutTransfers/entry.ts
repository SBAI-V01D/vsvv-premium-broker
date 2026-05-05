import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

/**
 * EXECUTE PAYOUT TRANSFERS
 * 
 * Mark payout.status = paid only when:
 * - payout.status = approved
 * - all linked commissions.status = earned
 * 
 * Creates final accounting "paid" entries
 * Locks accounting records (immutable audit trail)
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
      payout_id,
      paid_date = new Date().toISOString().split('T')[0],
      bank_reference = '',
    } = payload;

    if (!payout_id) {
      return Response.json({ error: 'payout_id erforderlich' }, { status: 400 });
    }

    console.log(
      `[executePayoutTransfers] START payout=${payout_id} paid_date=${paid_date}`
    );

    // ─── FETCH PAYOUT ───
    const payout = await base44.entities.Payout.get(payout_id);
    if (!payout) {
      return Response.json({ error: 'Payout nicht gefunden' }, { status: 404 });
    }

    // ─── SAFETY GATE: Only approved → paid ───
    if (payout.status !== 'approved') {
      return Response.json(
        {
          error: `Cannot pay payout: status ${payout.status} is not "approved"`,
        },
        { status: 400 }
      );
    }

    // ─── FETCH LINKED COMMISSIONS ───
    const commissions = await base44.entities.CommissionEntry.filter({
      payout_id: payout_id,
    });

    // ─── VERIFY ALL EARNED ───
    const nonEarned = commissions.filter(c => c.status !== 'earned');
    if (nonEarned.length > 0) {
      return Response.json(
        {
          error: `Cannot pay: ${nonEarned.length} commissions are not "earned" status`,
          examples: nonEarned.map(c => ({ id: c.id, status: c.status })).slice(0, 3),
        },
        { status: 400 }
      );
    }

    // ─── UPDATE PAYOUT → PAID ───
    await base44.entities.Payout.update(payout_id, {
      status: 'paid',
      paid_date: paid_date,
      bank_reference: bank_reference || '',
    });

    console.log(`[executePayoutTransfers] ✅ Payout marked paid`);

    // ─── UPDATE COMMISSIONS → PAID ───
    // CRITICAL: Set is_paid = true to prevent double payment
    for (const commission of commissions) {
      await base44.entities.CommissionEntry.update(commission.id, {
        status: 'paid',
        paid_date: paid_date,
        is_paid: true, // GUARD: Mark as paid
      });
    }

    console.log(`[executePayoutTransfers] ✅ ${commissions.length} commissions marked paid`);

    // ─── CREATE FINAL ACCOUNTING ENTRY (PAID) ───
    const paymentEntry = await base44.entities.AccountingEntry.create({
      entry_date: paid_date,
      entry_type: 'payout',
      amount: payout.total_amount,
      advisor_id: payout.advisor_id,
      advisor_name: payout.advisor_name,
      organization_id: payout.organization_id,
      organization_name: payout.organization_name,
      status: 'paid',
      reference_type: 'payout',
      reference_id: payout_id,
      notes: `Auszahlung ausgeführt: ${payout.commission_count} Provisionen (${bank_reference || 'manual'})`,
    });

    console.log(
      `[executePayoutTransfers] ✅ Payment accounting entry created (locked)`
    );

    console.log(
      `[executePayoutTransfers] ✅ COMPLETE: Payout ${payout_id} paid ${payout.total_amount} CHF`
    );

    return Response.json({
      success: true,
      payout_id,
      amount_paid: payout.total_amount,
      commissions_paid: commissions.length,
      paid_date,
      bank_reference,
      message: 'Payout executed',
    });
  } catch (error) {
    console.error(`[executePayoutTransfers] ERROR: ${error.message}`);
    return Response.json(
      { success: false, error: error.message },
      { status: 500 }
    );
  }
});