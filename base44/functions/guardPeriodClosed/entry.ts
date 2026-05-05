import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

/**
 * GUARD: Periodenabschluss-Lock
 * 
 * Prüft ob eine Periode (Monat) bereits geschlossen ist.
 * Wenn ja: BLOCK alle Änderungen (commission, accounting, payout)
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
    const { entry_date } = payload; // YYYY-MM-DD

    if (!entry_date) {
      return Response.json(
        { error: 'entry_date erforderlich (YYYY-MM-DD)' },
        { status: 400 }
      );
    }

    console.log(`[guardPeriodClosed] CHECK period for date=${entry_date}`);

    // ─── EXTRACT PERIOD (YYYY-MM-01) ───
    const periodStr = entry_date.substring(0, 7) + '-01'; // e.g. 2026-05-01

    // ─── FETCH PERIOD ───
    const periods = await base44.entities.FinancePeriod.filter({
      month: periodStr,
    });

    if (periods.length === 0) {
      // Period does not exist yet → safe (open by default)
      console.log(`[guardPeriodClosed] ℹ️ Period ${periodStr} does not exist (open)`);
      return Response.json({
        locked: false,
        period: periodStr,
        status: 'open',
        message: 'Period nicht vorhanden – standardmäßig offen',
      });
    }

    const period = periods[0];

    if (period.status === 'closed') {
      console.error(`[guardPeriodClosed] ❌ BLOCKED: period=${periodStr} status=closed`);
      return Response.json({
        locked: true,
        period: periodStr,
        status: 'closed',
        closed_date: period.closed_date,
        closed_by: period.closed_by,
        error: `Periode ${periodStr} ist geschlossen. Keine Änderungen möglich.`,
      });
    }

    console.log(`[guardPeriodClosed] ✅ SAFE: period=${periodStr} is open`);

    return Response.json({
      locked: false,
      period: periodStr,
      status: 'open',
    });
  } catch (error) {
    console.error(`[guardPeriodClosed] ERROR: ${error.message}`);
    return Response.json(
      { locked: true, error: error.message },
      { status: 500 }
    );
  }
});