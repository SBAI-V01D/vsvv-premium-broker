import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

/**
 * CANCEL POLICY
 * 
 * Cancels policy and triggers storno logic
 * 
 * CRITICAL:
 * - Sets status = cancelled
 * - If within storno_period: reverse commissions
 * - Creates negative accounting entries
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
      policy_id,
      cancel_date = new Date().toISOString().split('T')[0],
      cancel_reason = 'Policy cancelled',
    } = payload;

    if (!policy_id) {
      return Response.json({ error: 'policy_id erforderlich' }, { status: 400 });
    }

    console.log(
      `[cancelPolicy] START policy=${policy_id} date=${cancel_date} reason=${cancel_reason}`
    );

    // ─── FETCH POLICY ───
    const policy = await base44.entities.Contract.get(policy_id);
    if (!policy) {
      return Response.json({ error: 'Policy nicht gefunden' }, { status: 404 });
    }

    // ─── MARK POLICY AS CANCELLED ───
    await base44.entities.Contract.update(policy_id, {
      status: 'cancelled',
      cancel_date: cancel_date,
      cancel_reason: cancel_reason,
    });

    console.log(`[cancelPolicy] ✅ Policy marked cancelled`);

    // ─── FETCH COMMISSIONS ───
    const commissions = await base44.entities.CommissionEntry.filter({
      policy_id: policy_id,
      is_storno: false, // Exclude existing storno entries
    });

    console.log(`[cancelPolicy] Found ${commissions.length} commissions to process`);

    let stornoCount = 0;

    // ─── PROCESS EACH COMMISSION ───
    for (const commission of commissions) {
      // Check storno eligibility
      if (commission.storno_eligible_until) {
        const stornoDeadline = new Date(commission.storno_eligible_until);
        const cancelDateObj = new Date(cancel_date);

        if (cancelDateObj <= stornoDeadline) {
          // Within storno period: reverse commission
          console.log(
            `[cancelPolicy] ⚠️ Commission ${commission.id} eligible for storno`
          );

          // Mark original as cancelled
          await base44.entities.CommissionEntry.update(commission.id, {
            status: 'cancelled',
            is_paid: false, // Reset in case of storno
          });

          // Create storno entry (negative)
          const stornoEntry = await base44.entities.CommissionEntry.create({
            policy_id: policy_id,
            policy_number: policy.policy_number,
            advisor_id: commission.advisor_id,
            advisor_name: commission.advisor_name,
            organization_id: commission.organization_id,
            organization_name: commission.organization_name,
            customer_id: commission.customer_id,
            customer_name: commission.customer_name,
            insurer: commission.insurer,
            product_category: commission.product_category,
            premium_yearly: -commission.premium_yearly,
            commission_percentage: commission.commission_percentage,
            commission_amount: -commission.commission_amount,
            status: 'received',
            entry_date: cancel_date,
            received_date: cancel_date,
            received_amount: -commission.commission_amount,
            is_storno: true,
            storno_reference_id: commission.id,
            notes: `Storno: ${cancel_reason}`,
          });

          // Create negative accounting entry
          await base44.entities.AccountingEntry.create({
            entry_date: cancel_date,
            entry_type: 'storno',
            amount: -commission.commission_amount,
            advisor_id: commission.advisor_id,
            advisor_name: commission.advisor_name,
            organization_id: commission.organization_id,
            organization_name: commission.organization_name,
            policy_id: policy_id,
            policy_number: policy.policy_number,
            insurer: commission.insurer,
            customer_id: commission.customer_id,
            customer_name: commission.customer_name,
            status: 'booked',
            reference_type: 'commission_entry',
            reference_id: stornoEntry.id,
            notes: `Storno für Policy-Kündigung: ${cancel_reason}`,
          });

          stornoCount++;
          console.log(
            `[cancelPolicy] ✅ Storno created for commission ${commission.id}`
          );
        } else {
          // Past storno period: mark cancelled but no reversal
          await base44.entities.CommissionEntry.update(commission.id, {
            status: 'cancelled',
          });
          console.log(
            `[cancelPolicy] ℹ️ Commission ${commission.id} past storno period, no reversal`
          );
        }
      }
    }

    console.log(
      `[cancelPolicy] ✅ COMPLETE: Policy cancelled, ${stornoCount} stornos created`
    );

    return Response.json({
      success: true,
      policy_id,
      status: 'cancelled',
      commissions_processed: commissions.length,
      stornos_created: stornoCount,
      cancel_date,
      message: 'Policy cancelled',
    });
  } catch (error) {
    console.error(`[cancelPolicy] ERROR: ${error.message}`);
    return Response.json(
      { success: false, error: error.message },
      { status: 500 }
    );
  }
});