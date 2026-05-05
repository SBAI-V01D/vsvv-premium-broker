import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

/**
 * RENEW POLICY
 * 
 * Creates new policy version from renewal_due policy
 * 
 * CRITICAL RULES:
 * - Original policy → status = renewed
 * - New policy → status = active, version_number++, parent_policy_id = original.id
 * - Duplicates commissions from original → new policy
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
      new_end_date, // YYYY-MM-DD (usually +1 year from current end_date)
      new_premium_yearly = null, // Optional: new premium if changed
    } = payload;

    if (!policy_id || !new_end_date) {
      return Response.json(
        { error: 'policy_id and new_end_date erforderlich' },
        { status: 400 }
      );
    }

    console.log(`[renewPolicy] START policy=${policy_id} new_end=${new_end_date}`);

    // ─── FETCH ORIGINAL POLICY ───
    const originalPolicy = await base44.entities.Contract.get(policy_id);
    if (!originalPolicy) {
      return Response.json({ error: 'Policy nicht gefunden' }, { status: 404 });
    }

    if (originalPolicy.status !== 'renewal_due') {
      return Response.json(
        {
          error: `Policy status ${originalPolicy.status} is not renewal_due. Cannot renew.`,
        },
        { status: 400 }
      );
    }

    // ─── CHECK DUPLICATE RENEWAL ───
    const existingRenewal = await base44.entities.Contract.filter({
      parent_policy_id: policy_id,
      status: 'active',
    });

    if (existingRenewal.length > 0) {
      return Response.json(
        { error: 'Renewal für diese Policy existiert bereits' },
        { status: 400 }
      );
    }

    // ─── CREATE NEW POLICY VERSION ───
    const newVersion = originalPolicy.version_number + 1;
    const newStartDate = new Date(originalPolicy.end_date);
    newStartDate.setDate(newStartDate.getDate() + 1); // Start next day
    const newStartDateStr = newStartDate.toISOString().split('T')[0];

    // Calculate renewal_date (30 days before new end_date)
    const renewalDateObj = new Date(new_end_date);
    renewalDateObj.setDate(renewalDateObj.getDate() - 30);
    const newRenewalDate = renewalDateObj.toISOString().split('T')[0];

    const newPremiumYearly = new_premium_yearly ?? originalPolicy.premium_yearly;
    const newPremiumMonthly = newPremiumYearly / 12;

    const newPolicy = await base44.entities.Contract.create({
      customer_id: originalPolicy.customer_id,
      customer_name: originalPolicy.customer_name,
      primary_customer_id: originalPolicy.primary_customer_id,
      is_family_member: originalPolicy.is_family_member,
      organization_id: originalPolicy.organization_id,
      advisor_id: originalPolicy.advisor_id,
      insurer: originalPolicy.insurer,
      policy_number: `${originalPolicy.policy_number}-${newVersion}`, // Append version
      version_number: newVersion,
      parent_policy_id: policy_id, // LINK TO ORIGINAL
      insurance_type: originalPolicy.insurance_type,
      product: originalPolicy.product,
      premium_monthly: newPremiumMonthly,
      premium_yearly: newPremiumYearly,
      start_date: newStartDateStr,
      end_date: new_end_date,
      renewal_date: newRenewalDate,
      auto_renew: originalPolicy.auto_renew,
      storno_period_months: originalPolicy.storno_period_months,
      status: 'active', // New policy is active
      custom_status: 'aktiv',
      sparte: originalPolicy.sparte,
      sparte_data: originalPolicy.sparte_data,
      commission_rate: originalPolicy.commission_rate,
      commission_amount: newPremiumYearly * (originalPolicy.commission_rate || 0.1) / 100,
      assigned_broker: originalPolicy.assigned_broker,
      notes: `Renewal of policy v${originalPolicy.version_number} (${originalPolicy.policy_number})`,
    });

    console.log(`[renewPolicy] ✅ New policy version created: ${newPolicy.id}`);

    // ─── MARK ORIGINAL AS RENEWED ───
    await base44.entities.Contract.update(policy_id, {
      status: 'renewed',
    });

    console.log(`[renewPolicy] ✅ Original policy marked renewed`);

    // ─── FETCH COMMISSIONS FOR ORIGINAL POLICY ───
    const originalCommissions = await base44.entities.CommissionEntry.filter({
      policy_id: policy_id,
      status: 'earned', // Only copy earned commissions
    });

    // ─── CREATE NEW COMMISSIONS FOR NEW POLICY ───
    for (const origComm of originalCommissions) {
      const newCommAmount = newPremiumYearly * (origComm.commission_percentage || 10) / 100;

      await base44.entities.CommissionEntry.create({
        policy_id: newPolicy.id,
        policy_number: newPolicy.policy_number,
        advisor_id: origComm.advisor_id,
        advisor_name: origComm.advisor_name,
        organization_id: origComm.organization_id,
        organization_name: origComm.organization_name,
        customer_id: origComm.customer_id,
        customer_name: origComm.customer_name,
        insurer: origComm.insurer,
        product_category: origComm.product_category,
        premium_yearly: newPremiumYearly,
        commission_percentage: origComm.commission_percentage,
        commission_amount: newCommAmount,
        status: 'pending', // New commission starts pending
        entry_date: newStartDateStr,
        storno_period_months: originalPolicy.storno_period_months,
        storno_eligible_until: renewalDateObj.toISOString().split('T')[0],
        notes: `Renewal: new commission for policy v${newVersion}`,
      });

      console.log(`[renewPolicy] ✅ New commission created for advisor ${origComm.advisor_id}`);
    }

    console.log(
      `[renewPolicy] ✅ COMPLETE: Policy renewed (v${newVersion}), ${originalCommissions.length} commissions copied`
    );

    return Response.json({
      success: true,
      original_policy_id: policy_id,
      new_policy_id: newPolicy.id,
      new_policy_number: newPolicy.policy_number,
      version_number: newVersion,
      commissions_created: originalCommissions.length,
      message: 'Policy renewed',
    });
  } catch (error) {
    console.error(`[renewPolicy] ERROR: ${error.message}`);
    return Response.json(
      { success: false, error: error.message },
      { status: 500 }
    );
  }
});