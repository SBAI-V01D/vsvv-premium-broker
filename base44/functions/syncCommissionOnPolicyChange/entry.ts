import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const payload = await req.json();
    const { policy_id, old_status, new_status } = payload;

    if (!policy_id) return Response.json({ error: 'policy_id erforderlich' }, { status: 400 });

    console.log(`[syncCommissionOnPolicyChange] START policy=${policy_id} ${old_status}→${new_status}`);

    const policy = await base44.entities.Contract.get(policy_id);
    if (!policy) return Response.json({ error: 'Policy nicht gefunden' }, { status: 404 });

    const commissions = await base44.entities.CommissionEntry.filter({ policy_id });

    if (commissions.length === 0) {
      return Response.json({ success: true, message: 'No commissions to sync' });
    }

    for (const commission of commissions) {
      let newCommissionStatus = commission.status;
      let shouldCreateStorno = false;

      if (new_status === 'active' && commission.status === 'pending') {
        newCommissionStatus = 'earned';
      } else if (new_status === 'cancelled' && commission.status !== 'cancelled') {
        newCommissionStatus = 'cancelled';
        shouldCreateStorno = true;
      }
      // expired: no change

      if (newCommissionStatus !== commission.status) {
        await base44.entities.CommissionEntry.update(commission.id, { status: newCommissionStatus });
        console.log(`[syncCommissionOnPolicyChange] ✅ Commission ${commission.id}: ${commission.status} → ${newCommissionStatus}`);
      }

      if (shouldCreateStorno) {
        // Guard: commission_amount must be a valid number
        const commissionAmount = Number(commission.commission_amount);
        if (!isNaN(commissionAmount) && commissionAmount !== 0) {
          await base44.entities.AccountingEntry.create({
            entry_date: new Date().toISOString().split('T')[0],
            entry_type: 'storno',
            amount: -commissionAmount,
            advisor_id: commission.advisor_id,
            advisor_name: commission.advisor_name,
            organization_id: commission.organization_id,
            policy_id: commission.policy_id,
            policy_number: commission.policy_number,
            insurer: commission.insurer,
            customer_id: commission.customer_id,
            customer_name: commission.customer_name,
            status: 'booked',
            reference_type: 'commission_entry',
            reference_id: commission.id,
            notes: `Storno Commission für Policy ${commission.policy_number} (cancelled)`,
          });
          console.log(`[syncCommissionOnPolicyChange] ✅ Storno entry created amount=${-commissionAmount}`);
        } else {
          console.warn(`[syncCommissionOnPolicyChange] Skipped storno: invalid commission_amount=${commission.commission_amount}`);
        }
      }
    }

    return Response.json({
      success: true,
      policy_id,
      synced_commissions: commissions.length,
    });
  } catch (error) {
    console.error(`[syncCommissionOnPolicyChange] ERROR: ${error.message}`);
    return Response.json({ success: false, error: error.message }, { status: 500 });
  }
});