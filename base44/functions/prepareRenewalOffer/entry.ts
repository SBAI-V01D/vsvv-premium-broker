import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

/**
 * PREPARE RENEWAL OFFER
 * 
 * Automatische Angebots-Vorbereitung:
 * 1. Kopiere aktuelle Policy
 * 2. Setze neue Dates (+1 Jahr)
 * 3. renewal_offer_status = pending
 * 4. speichere als Entwurf
 * 
 * Triggered: when renewal_status = notified + offer not yet created
 */

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user?.role || user.role !== 'admin') {
      return Response.json({ error: 'Admin access required' }, { status: 403 });
    }

    const { contract_id } = await req.json();
    if (!contract_id) {
      return Response.json({ error: 'contract_id required' }, { status: 400 });
    }

    console.log(`[prepareRenewalOffer] START for policy ${contract_id}`);

    // ─── FETCH CURRENT POLICY ───
    const policy = await base44.entities.Contract.get(contract_id);
    if (!policy) {
      return Response.json({ error: 'Policy not found' }, { status: 404 });
    }

    // ─── GUARD: OFFER NOT YET CREATED ───
    if (policy.renewal_offer_created) {
      return Response.json({ 
        success: false, 
        message: 'Offer already created' 
      });
    }

    // ─── CALCULATE NEW DATES ───
    const oldEndDate = new Date(policy.end_date);
    const newStartDate = new Date(oldEndDate);
    newStartDate.setDate(newStartDate.getDate() + 1);
    const newEndDate = new Date(newStartDate);
    newEndDate.setFullYear(newEndDate.getFullYear() + 1);

    // ─── CREATE RENEWAL OFFER (DRAFT COPY) ───
    const offerPolicy = await base44.entities.Contract.create({
      customer_id: policy.customer_id,
      customer_name: policy.customer_name,
      primary_customer_id: policy.primary_customer_id,
      is_family_member: policy.is_family_member,
      organization_id: policy.organization_id,
      advisor_id: policy.advisor_id,
      insurer: policy.insurer,
      insurance_type: policy.insurance_type,
      product: policy.product,
      premium_monthly: policy.premium_monthly,
      premium_yearly: policy.premium_yearly,
      start_date: newStartDate.toISOString().split('T')[0],
      end_date: newEndDate.toISOString().split('T')[0],
      auto_renew: policy.auto_renew,
      cancellation_deadline: policy.cancellation_deadline,
      sparte: policy.sparte,
      sparte_data: policy.sparte_data,
      commission_rate: policy.commission_rate,
      assigned_broker: policy.assigned_broker,
      status: 'draft', // ← NICHT ACTIVE
      parent_policy_id: policy.id,
      version_number: (policy.version_number || 1) + 1,
      notes: `Renewal offer for policy ${policy.policy_number}`,
    });

    console.log(`[prepareRenewalOffer] ✅ Offer created: ${offerPolicy.id}`);

    // ─── UPDATE ORIGINAL POLICY ───
    await base44.entities.Contract.update(contract_id, {
      renewal_offer_created: true,
      renewal_offer_status: 'pending',
      renewal_offer_date: new Date().toISOString().split('T')[0],
      renewal_offer_policy_id: offerPolicy.id,
    });

    return Response.json({
      success: true,
      message: 'Renewal offer prepared',
      offer_policy_id: offerPolicy.id,
      offer_status: 'pending',
    });
  } catch (error) {
    console.error(`[prepareRenewalOffer] ERROR: ${error.message}`);
    return Response.json(
      { success: false, error: error.message },
      { status: 500 }
    );
  }
});