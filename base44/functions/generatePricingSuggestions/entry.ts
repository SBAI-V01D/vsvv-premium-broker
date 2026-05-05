import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

/**
 * GENERATE PRICING SUGGESTIONS
 * 
 * 1. Finde alle Policies mit pricing_status = high
 * 2. Erstelle PricingSuggestion für jede
 * 3. Berechne Einsparpotenzial
 * 4. Setze Priorität
 * 
 * Läuft täglich nach detectHighPricing
 */

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user?.role || user.role !== 'admin') {
      return Response.json({ error: 'Admin access required' }, { status: 403 });
    }

    console.log(`[generatePricingSuggestions] START`);

    // ─── FETCH HIGH PRICING POLICIES ───
    const highPricingPolicies = await base44.entities.Contract.filter(
      { pricing_status: 'high', status: 'active' }
    );

    let created = 0;

    for (const policy of highPricingPolicies) {
      // ─── SKIP IF SUGGESTION ALREADY EXISTS ───
      if (policy.pricing_suggestion_id) continue;

      const savingAmount = policy.premium_current - policy.premium_benchmark;
      const savingPercent = (savingAmount / policy.premium_current) * 100;

      // ─── PRIORITY LOGIC ───
      let priority = 'low';
      if (savingPercent > 20) {
        priority = 'high';
      } else if (savingPercent > 10) {
        priority = 'medium';
      }

      // ─── CREATE SUGGESTION ───
      const suggestion = await base44.entities.PricingSuggestion.create({
        policy_id: policy.id,
        policy_number: policy.policy_number,
        customer_id: policy.customer_id,
        customer_name: policy.customer_name,
        insurer: policy.insurer,
        product: policy.sparte || policy.product,
        premium_current: policy.premium_current,
        premium_benchmark: policy.premium_benchmark,
        premium_suggested: policy.premium_benchmark, // = Benchmark als Vorschlag
        saving_amount: savingAmount,
        saving_percent: Math.round(savingPercent * 100) / 100,
        priority,
        status: 'pending',
        renewal_opportunity: policy.renewal_priority === 'high', // Flag für Renewal-Integration
        notes: `Automatisch generiert: ${savingPercent.toFixed(1)}% unter Durchschnitt`,
      });

      // ─── LINK SUGGESTION TO POLICY ───
      await base44.entities.Contract.update(policy.id, {
        pricing_suggestion_id: suggestion.id,
      });

      created += 1;
    }

    console.log(`[generatePricingSuggestions] ✅ ${created} pricing suggestions created`);

    return Response.json({
      success: true,
      message: 'Pricing suggestions generated',
      created,
    });
  } catch (error) {
    console.error(`[generatePricingSuggestions] ERROR: ${error.message}`);
    return Response.json(
      { success: false, error: error.message },
      { status: 500 }
    );
  }
});