import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

/**
 * RECEIVE COMMISSION PAYMENT
 * 
 * Triggered when insurer payment arrives.
 * Updates commission status: invoiced → received → earned
 * 
 * SAFETY: Only allows status progression, not backwards
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
      commission_id,
      received_amount,
      received_date,
      auto_earn = true, // Auto-mark as earned after receipt
    } = payload;

    if (!commission_id || !received_amount || !received_date) {
      return Response.json(
        { error: 'commission_id, received_amount, received_date erforderlich' },
        { status: 400 }
      );
    }

    console.log(
      `[receiveCommission] START comm=${commission_id} amount=${received_amount} date=${received_date}`
    );

    // ─── FETCH COMMISSION ───
    const commission = await base44.entities.CommissionEntry.get(commission_id);
    if (!commission) {
      return Response.json({ error: 'Commission nicht gefunden' }, { status: 404 });
    }

    // ─── SAFETY GATE: Only allow progression pending→invoiced→received ───
    const VALID_STATES = {
      pending: ['invoiced', 'received'],
      invoiced: ['received'],
      received: ['received'], // idempotent
    };

    if (
      !VALID_STATES[commission.status] ||
      !VALID_STATES[commission.status].includes('received')
    ) {
      return Response.json(
        {
          error: `Cannot receive payment: current status ${commission.status} does not allow receipt`,
        },
        { status: 400 }
      );
    }

    // ─── UPDATE: received ───
    const updateData = {
      status: 'received',
      received_date: received_date,
      received_amount: received_amount,
    };

    // AUTO-EARN if requested and amount matches
    if (auto_earn && Math.abs(received_amount - commission.commission_amount) < 0.01) {
      updateData.status = 'earned';
      updateData.earned_date = new Date().toISOString().split('T')[0];
      console.log('[receiveCommission] ✅ Auto-earned (amounts match)');
    }

    await base44.entities.CommissionEntry.update(commission_id, updateData);

    // ─── READ-AFTER-WRITE ───
    const reloaded = await base44.entities.CommissionEntry.get(commission_id);
    if (reloaded.status !== updateData.status) {
      throw new Error(
        `Commission status update failed: expected ${updateData.status}, got ${reloaded.status}`
      );
    }

    console.log(
      `[receiveCommission] ✅ Commission ${commission_id} status=${reloaded.status}`
    );

    // ─── CREATE ACCOUNTING ENTRY (RECEIPT) ───
    await base44.entities.AccountingEntry.create({
      entry_date: received_date,
      entry_type: 'commission',
      amount: received_amount,
      advisor_id: commission.advisor_id,
      advisor_name: commission.advisor_name,
      organization_id: commission.organization_id,
      organization_name: commission.organization_name,
      policy_id: commission.policy_id,
      policy_number: commission.policy_number,
      insurer: commission.insurer,
      customer_id: commission.customer_id,
      customer_name: commission.customer_name,
      status: 'booked',
      reference_type: 'commission_entry',
      reference_id: commission_id,
      notes: `Zahlung erhalten: ${received_amount} CHF (Policy ${commission.policy_number})`,
    });

    console.log('[receiveCommission] ✅ Accounting entry created');

    return Response.json({
      success: true,
      commission_id,
      status: reloaded.status,
      received_amount,
      message: `Commission ${reloaded.status}`,
    });
  } catch (error) {
    console.error(`[receiveCommission] ERROR: ${error.message}`);
    return Response.json(
      { success: false, error: error.message },
      { status: 500 }
    );
  }
});