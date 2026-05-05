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
      '-end_date',
      1000
    );

    const today = new Date();
    const updates = [];

    for (const contract of contracts) {
      if (!contract.end_date) continue;

      const daysLeft = Math.floor(
        (new Date(contract.end_date) - today) / (1000 * 60 * 60 * 24)
      );

      let newStage = contract.renewal_stage || 'early';
      let shouldUpdate = false;

      // Auto-assign stages based on days left
      if (contract.renewal_stage === 'renewed' || contract.renewal_stage === 'lost') {
        // Terminal states - don't change
        shouldUpdate = false;
      } else if (contract.renewal_offer_created && contract.renewal_offer_status === 'sent') {
        // Offer sent → negotiation
        if (newStage !== 'negotiation') {
          newStage = 'negotiation';
          shouldUpdate = true;
        }
      } else if (contract.renewal_offer_created) {
        // Offer exists but not sent → offer stage
        if (newStage !== 'offer') {
          newStage = 'offer';
          shouldUpdate = true;
        }
      } else if (daysLeft <= 0) {
        // Contract expired without renewal → lost
        newStage = 'lost';
        shouldUpdate = true;
      } else if (daysLeft < 60) {
        // < 60 days → contact (high priority)
        if (newStage !== 'contact') {
          newStage = 'contact';
          shouldUpdate = true;
        }
      } else if (daysLeft <= 120) {
        // 60-120 days → contact
        if (newStage !== 'contact') {
          newStage = 'contact';
          shouldUpdate = true;
        }
      } else if (daysLeft > 120) {
        // > 120 days → early
        if (newStage !== 'early') {
          newStage = 'early';
          shouldUpdate = true;
        }
      }

      if (shouldUpdate) {
        await base44.entities.Contract.update(contract.id, {
          renewal_stage: newStage,
          renewal_stage_updated: new Date().toISOString(),
        });
        updates.push({ id: contract.id, newStage });
      }
    }

    return Response.json({
      success: true,
      updated: updates.length,
      details: updates,
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});