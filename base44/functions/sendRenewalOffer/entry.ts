import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

/**
 * SEND RENEWAL OFFER
 * 
 * Berater sendet Angebot:
 * 1. Aktualisiere Angebots-Details (optional)
 * 2. Setze renewal_offer_status = sent
 * 3. Speichere Versand-Datum
 * 
 * Triggered: manuell von Berater
 */

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user?.role || !['admin', 'advisor'].includes(user.role)) {
      return Response.json({ error: 'Unauthorized' }, { status: 403 });
    }

    const { contract_id, offer_adjustments } = await req.json();
    if (!contract_id) {
      return Response.json({ error: 'contract_id required' }, { status: 400 });
    }

    console.log(`[sendRenewalOffer] START for policy ${contract_id}`);

    // ─── FETCH POLICY + OFFER ───
    const policy = await base44.entities.Contract.get(contract_id);
    if (!policy) {
      return Response.json({ error: 'Policy not found' }, { status: 404 });
    }

    if (!policy.renewal_offer_policy_id) {
      return Response.json({ 
        error: 'No offer prepared yet' 
      }, { status: 400 });
    }

    const offerPolicy = await base44.entities.Contract.get(policy.renewal_offer_policy_id);

    // ─── APPLY ADJUSTMENTS (OPTIONAL) ───
    if (offer_adjustments) {
      // z.B. { premium_monthly: 150 } oder { sparte_data: {...} }
      await base44.entities.Contract.update(offerPolicy.id, offer_adjustments);
    }

    // ─── SEND & MARK AS SENT ───
    await base44.entities.Contract.update(contract_id, {
      renewal_offer_status: 'sent',
      renewal_last_reminder: new Date().toISOString().split('T')[0],
    });

    console.log(`[sendRenewalOffer] ✅ Offer sent for policy ${policy.policy_number}`);

    return Response.json({
      success: true,
      message: 'Renewal offer sent',
      offer_status: 'sent',
      customer_id: policy.customer_id,
      customer_name: policy.customer_name,
    });
  } catch (error) {
    console.error(`[sendRenewalOffer] ERROR: ${error.message}`);
    return Response.json(
      { success: false, error: error.message },
      { status: 500 }
    );
  }
});