import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

/**
 * MUTATE POLICY (Policy Changes)
 * 
 * Handles: premium changes, coverage changes, address changes
 * 
 * CRITICAL:
 * - Original policy → status = pending_change
 * - New version created → status = active
 * - Version history preserved
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
      changes, // { premium_yearly, product, sparte_data, ... }
      mutation_reason = 'Policy change',
    } = payload;

    if (!policy_id || !changes) {
      return Response.json(
        { error: 'policy_id and changes erforderlich' },
        { status: 400 }
      );
    }

    console.log(`[mutatePolicy] START policy=${policy_id} reason=${mutation_reason}`);

    // ─── FETCH ORIGINAL POLICY ───
    const originalPolicy = await base44.entities.Contract.get(policy_id);
    if (!originalPolicy) {
      return Response.json({ error: 'Policy nicht gefunden' }, { status: 404 });
    }

    if (originalPolicy.status !== 'active') {
      return Response.json(
        { error: `Cannot mutate policy with status ${originalPolicy.status}` },
        { status: 400 }
      );
    }

    // ─── MARK ORIGINAL AS PENDING_CHANGE ───
    await base44.entities.Contract.update(policy_id, {
      status: 'pending_change',
    });

    console.log(`[mutatePolicy] ✅ Original policy marked pending_change`);

    // ─── CREATE NEW VERSION ───
    const newVersion = originalPolicy.version_number + 1;

    // Merge changes with original data
    const mergedData = {
      ...originalPolicy,
      ...changes,
      version_number: newVersion,
      parent_policy_id: policy_id,
      policy_number: `${originalPolicy.policy_number}-${newVersion}`,
      status: 'active', // New version is active
      notes: `${originalPolicy.notes || ''}\n[v${newVersion}] ${mutation_reason}`,
    };

    // Remove id to create new record
    delete mergedData.id;
    delete mergedData.created_date;
    delete mergedData.updated_date;
    delete mergedData.created_by;

    const newPolicy = await base44.entities.Contract.create(mergedData);

    console.log(`[mutatePolicy] ✅ New policy version created: ${newPolicy.id} v${newVersion}`);

    // ─── COPY COMMISSIONS IF PREMIUM CHANGED ───
    if (changes.premium_yearly && changes.premium_yearly !== originalPolicy.premium_yearly) {
      const commissions = await base44.entities.CommissionEntry.filter({
        policy_id: policy_id,
        status: 'earned',
      });

      for (const comm of commissions) {
        const newCommAmount =
          (changes.premium_yearly * comm.commission_percentage) / 100;

        await base44.entities.CommissionEntry.create({
          ...comm,
          policy_id: newPolicy.id,
          policy_number: newPolicy.policy_number,
          commission_amount: newCommAmount,
          premium_yearly: changes.premium_yearly,
          status: 'pending',
          notes: `Mutation: premium changed from ${originalPolicy.premium_yearly} to ${changes.premium_yearly}`,
        });
      }

      console.log(
        `[mutatePolicy] ✅ ${commissions.length} commissions recalculated for new premium`
      );
    }

    console.log(
      `[mutatePolicy] ✅ COMPLETE: Policy mutated (v${newVersion}), ${mutation_reason}`
    );

    return Response.json({
      success: true,
      original_policy_id: policy_id,
      new_policy_id: newPolicy.id,
      new_policy_number: newPolicy.policy_number,
      version_number: newVersion,
      mutation_reason,
      message: 'Policy mutated',
    });
  } catch (error) {
    console.error(`[mutatePolicy] ERROR: ${error.message}`);
    return Response.json(
      { success: false, error: error.message },
      { status: 500 }
    );
  }
});