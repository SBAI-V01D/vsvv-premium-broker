import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

/**
 * GUARD: Doppelte Auszahlung verhindern
 * 
 * Wird BEFORE Payout execution aufgerufen.
 * 
 * RULES:
 * - IF commission.is_paid = true → BLOCK
 * - IF commission.status ≠ earned → BLOCK
 * - IF commission.received_date IS NULL → BLOCK
 * 
 * CRITICAL: Synchronisieren mit executePayoutTransfers
 */

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user?.role || user.role !== 'admin') {
      return Response.json({ error: 'Admin access required' }, { status: 403 });
    }

    const payload = await req.json();
    const { commission_id } = payload;

    if (!commission_id) {
      return Response.json({ error: 'commission_id erforderlich' }, { status: 400 });
    }

    console.log(`[guardDoublePayment] CHECK commission=${commission_id}`);

    // ─── FETCH COMMISSION ───
    const commission = await base44.entities.CommissionEntry.get(commission_id);
    if (!commission) {
      return Response.json(
        { error: 'Commission nicht gefunden', safe: false },
        { status: 404 }
      );
    }

    // ─── GUARD 1: is_paid ───
    if (commission.is_paid === true) {
      console.error(`[guardDoublePayment] ❌ BLOCKED: commission.is_paid=true`);
      return Response.json({
        safe: false,
        error: 'Commission bereits ausbezahlt (is_paid=true)',
        commission_id,
      });
    }

    // ─── GUARD 2: status = earned ───
    if (commission.status !== 'earned') {
      console.error(
        `[guardDoublePayment] ❌ BLOCKED: status=${commission.status} (not earned)`
      );
      return Response.json({
        safe: false,
        error: `Commission status ${commission.status} ist nicht earned. Kann nicht ausbezahlt werden.`,
        commission_id,
      });
    }

    // ─── GUARD 3: received_date IS NOT NULL ───
    if (!commission.received_date) {
      console.error(`[guardDoublePayment] ❌ BLOCKED: received_date IS NULL`);
      return Response.json({
        safe: false,
        error: 'Commission: Zahlungseingang nicht verzeichnet (received_date fehlt)',
        commission_id,
      });
    }

    console.log(`[guardDoublePayment] ✅ SAFE: Commission kann ausbezahlt werden`);

    return Response.json({
      safe: true,
      commission_id,
      status: commission.status,
      is_paid: commission.is_paid,
      received_date: commission.received_date,
    });
  } catch (error) {
    console.error(`[guardDoublePayment] ERROR: ${error.message}`);
    return Response.json(
      { safe: false, error: error.message },
      { status: 500 }
    );
  }
});