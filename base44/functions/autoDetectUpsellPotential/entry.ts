import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Fetch all active contracts
    const contracts = await base44.entities.Contract.filter(
      { status: 'active' },
      '-premium_yearly',
      1000
    );

    const updates = [];

    for (const contract of contracts) {
      let reason = null;
      let potentialValue = 0;
      let potentialPercent = 0;

      // 1. Check for high pricing (pricing_status = "high")
      if (contract.pricing_status === 'high' && contract.premium_current && contract.premium_benchmark) {
        const difference = contract.premium_current - contract.premium_benchmark;
        if (difference > 0) {
          reason = 'high_pricing';
          potentialValue = Math.round(difference * 0.3); // Estimate 30% savings potential
          potentialPercent = Math.round((difference / contract.premium_current) * 100);
        }
      }

      // 2. Check for renewal approaching (< 60 days)
      if (!reason && contract.end_date) {
        const daysLeft = Math.floor(
          (new Date(contract.end_date) - new Date()) / (1000 * 60 * 60 * 24)
        );
        if (daysLeft > 0 && daysLeft < 60) {
          // Opportunity to improve coverage or switch providers
          reason = 'renewal_approaching';
          potentialValue = Math.round((contract.premium_yearly || 0) * 0.15); // 15% potential
          potentialPercent = 15;
        }
      }

      // 3. Check for product gaps (missing coverage types)
      // This is simplified - in reality, you'd compare against similar customers
      if (!reason && contract.insurance_type === 'life') {
        // Example: Life insurance customers often lack health coverage
        reason = 'product_gap';
        potentialValue = Math.round((contract.premium_yearly || 0) * 0.25); // 25% potential
        potentialPercent = 25;
      }

      // Only update if we identified a potential
      if (reason && potentialValue > 0) {
        // Only set if not already in pipeline (prevent overwriting)
        if (!contract.upsell_identified_reason) {
          await base44.entities.Contract.update(contract.id, {
            upsell_identified_reason: reason,
            upsell_potential_value: potentialValue,
            upsell_potential_percent: potentialPercent,
            upsell_stage: 'identified',
            upsell_stage_updated: new Date().toISOString(),
          });
          updates.push({
            id: contract.id,
            reason,
            potentialValue,
            potentialPercent,
          });
        }
      }
    }

    return Response.json({
      success: true,
      identified: updates.length,
      details: updates,
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});