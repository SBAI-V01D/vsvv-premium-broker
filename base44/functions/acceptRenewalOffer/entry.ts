import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

/**
 * ACCEPT RENEWAL OFFER
 * 
 * Kunde akzeptiert Angebot:
 * 1. Aktiviere Angebots-Policy
 * 2. Setze alte Policy auf "renewed"
 * 3. Erstelle CommissionEntry für neue Policy
 * 4. renewal_status = completed
 * 
 * Triggered: manuell (Kunde/Berater) oder API
 */

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { contract_id } = await req.json();
    if (!contract_id) {
      return Response.json({ error: 'contract_id required' }, { status: 400 });
    }

    console.log(`[acceptRenewalOffer] START for policy ${contract_id}`);

    // ─── FETCH POLICIES ───
    const policy = await base44.entities.Contract.get(contract_id);
    if (!policy) {
      return Response.json({ error: 'Policy not found' }, { status: 404 });
    }

    if (!policy.renewal_offer_policy_id) {
      return Response.json({ 
        error: 'No renewal offer prepared' 
      }, { status: 400 });
    }

    const offerPolicy = await base44.entities.Contract.get(policy.renewal_offer_policy_id);
    if (!offerPolicy) {
      return Response.json({ 
        error: 'Offer policy not found' 
      }, { status: 404 });
    }

    // ─── ACTIVATE NEW POLICY (offer → active) ───
    await base44.entities.Contract.update(offerPolicy.id, {
      status: 'active',
      policy_number: offerPolicy.policy_number || `AUTO-${Date.now()}`,
    });

    // ─── MARK OLD POLICY AS RENEWED ───
    await base44.entities.Contract.update(contract_id, {
      status: 'renewed',
      renewal_status: 'completed',
      renewal_customer_accepted: true,
      renewal_accepted_date: new Date().toISOString().split('T')[0],
      renewal_offer_status: 'accepted',
    });

    // ─── CREATE COMMISSION ENTRY (IF APPLICABLE) ───
    if (policy.commission_rate && offerPolicy.premium_yearly) {
      try {
        await base44.entities.CommissionEntry.create({
          policy_id: offerPolicy.id,
          policy_number: offerPolicy.policy_number,
          advisor_id: policy.advisor_id,
          organization_id: policy.organization_id,
          customer_id: policy.customer_id,
          customer_name: policy.customer_name,
          insurer: policy.insurer,
          product_category: policy.sparte || policy.insurance_type,
          premium_yearly: offerPolicy.premium_yearly,
          commission_percentage: policy.commission_rate,
          commission_amount: (offerPolicy.premium_yearly * policy.commission_rate) / 100,
          status: 'pending',
          entry_date: new Date().toISOString().split('T')[0],
        });
      } catch (e) {
        console.warn(`[acceptRenewalOffer] Commission creation skipped: ${e.message}`);
      }
    }

    console.log(`[acceptRenewalOffer] ✅ Renewal accepted - new policy active`);

    return Response.json({
      success: true,
      message: 'Renewal offer accepted - new policy activated',
      new_policy_id: offerPolicy.id,
      old_policy_id: contract_id,
      status: 'completed',
    });
  } catch (error) {
    console.error(`[acceptRenewalOffer] ERROR: ${error.message}`);
    return Response.json(
      { success: false, error: error.message },
      { status: 500 }
    );
  }
});