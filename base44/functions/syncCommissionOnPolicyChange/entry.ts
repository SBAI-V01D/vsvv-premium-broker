import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

/**
 * COMMISSION SYNC ON POLICY CHANGE
 * 
 * Triggert wenn Contract (Policy) geändert wird.
 * Synchronisiert Commission-Status basierend auf Policy-Status:
 * 
 * - policy.status = active → commission.status = earned
 * - policy.status = cancelled → commission.status = cancelled + negative entry
 * - policy.status = expired → commission.status = earned (already paid)
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
      policy_id,
      old_status,
      new_status,
    } = payload;

    if (!policy_id) {
      return Response.json({ error: 'policy_id erforderlich' }, { status: 400 });
    }

    console.log(
      `[syncCommissionOnPolicyChange] START policy=${policy_id} ${old_status}→${new_status}`
    );

    // ─── FETCH POLICY ───
    const policy = await base44.entities.Contract.get(policy_id);
    if (!policy) {
      return Response.json({ error: 'Policy nicht gefunden' }, { status: 404 });
    }

    // ─── FETCH COMMISSIONS for this policy ───
    const commissions = await base44.entities.CommissionEntry.filter({
      policy_id: policy_id,
    });

    if (commissions.length === 0) {
      console.log('[syncCommissionOnPolicyChange] No commissions found for policy');
      return Response.json({
        success: true,
        message: 'No commissions to sync',
      });
    }

    // ─── SYNC LOGIC ───
    for (const commission of commissions) {
      let newCommissionStatus = commission.status;
      let shouldCreateStorno = false;

      if (new_status === 'active') {
        // Policy aktiv → Commission earned (unless already paid)
        if (commission.status === 'pending') {
          newCommissionStatus = 'earned';
          console.log(
            `[syncCommissionOnPolicyChange] Commission ${commission.id}: pending → earned`
          );
        }
      } else if (new_status === 'cancelled') {
        // Policy storniert → Commission cancelled + negative entry
        if (commission.status !== 'cancelled') {
          newCommissionStatus = 'cancelled';
          shouldCreateStorno = true;
          console.log(
            `[syncCommissionOnPolicyChange] Commission ${commission.id}: ${commission.status} → cancelled (storno)`
          );
        }
      } else if (new_status === 'expired') {
        // Policy abgelaufen → Commission bleibt earned (bereits bezahlt)
        console.log(
          `[syncCommissionOnPolicyChange] Commission ${commission.id}: expired policy, status unchanged`
        );
        newCommissionStatus = commission.status;
      }

      // ─── UPDATE Commission ───
      if (newCommissionStatus !== commission.status) {
        await base44.entities.CommissionEntry.update(commission.id, {
          status: newCommissionStatus,
        });

        // Read-After-Write verification
        const reloadedCommission = await base44.entities.CommissionEntry.get(
          commission.id
        );
        if (reloadedCommission.status !== newCommissionStatus) {
          throw new Error(
            `Commission status update failed: expected ${newCommissionStatus}, got ${reloadedCommission.status}`
          );
        }

        console.log(
          `[syncCommissionOnPolicyChange] ✅ Commission ${commission.id} status updated to ${newCommissionStatus}`
        );
      }

      // ─── CREATE STORNO ENTRY if cancellation ───
      if (shouldCreateStorno) {
        const stornoAmount = -commission.commission_amount; // Negative

        // Create negative accounting entry
        const stornoEntry = await base44.entities.AccountingEntry.create({
          entry_date: new Date().toISOString().split('T')[0],
          entry_type: 'storno',
          amount: stornoAmount,
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
          reference_id: commission.id,
          notes: `Storno Commission für Policy ${commission.policy_number} (cancelled)`,
        });

        console.log(
          `[syncCommissionOnPolicyChange] ✅ Storno entry created: ${stornoEntry.id} amount=${stornoAmount}`
        );
      }
    }

    console.log(
      `[syncCommissionOnPolicyChange] ✅ SYNC COMPLETE: policy=${policy_id}`
    );

    return Response.json({
      success: true,
      policy_id,
      synced_commissions: commissions.length,
      message: 'Commissions synced successfully',
    });
  } catch (error) {
    console.error(`[syncCommissionOnPolicyChange] ERROR: ${error.message}`);
    return Response.json(
      { success: false, error: error.message },
      { status: 500 }
    );
  }
});