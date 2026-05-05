import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

/**
 * APPROVE MUTATION REQUEST
 * 
 * Creates new policy version from approved mutation request.
 * Old policy → status = archived (never touched)
 * New policy → copy + version_number++
 */

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user?.role || !['admin', 'advisor'].includes(user.role)) {
      return Response.json({ error: 'Admin/Advisor access required' }, { status: 403 });
    }

    const payload = await req.json();
    const { mutation_request_id, notes } = payload;

    if (!mutation_request_id) {
      return Response.json({ error: 'mutation_request_id erforderlich' }, { status: 400 });
    }

    console.log(`[approveMutationRequest] START mutation_request=${mutation_request_id}`);

    // ─── FETCH MUTATION REQUEST ───
    const mutReq = await base44.entities.MutationRequest.get(mutation_request_id);
    if (!mutReq) {
      return Response.json({ error: 'Mutation request nicht gefunden' }, { status: 404 });
    }

    if (mutReq.status !== 'pending') {
      return Response.json(
        { error: `Cannot approve: status is "${mutReq.status}", not "pending"` },
        { status: 400 }
      );
    }

    // ─── FETCH OLD POLICY ───
    const oldPolicy = await base44.entities.Contract.get(mutReq.policy_id);
    if (!oldPolicy) {
      return Response.json({ error: 'Original policy nicht gefunden' }, { status: 404 });
    }

    if (oldPolicy.status !== 'active') {
      return Response.json(
        { error: `Original policy is ${oldPolicy.status}, not active` },
        { status: 400 }
      );
    }

    // ─── CREATE NEW POLICY VERSION ───
    const newPolicy = await base44.entities.Contract.create({
      customer_id: oldPolicy.customer_id,
      customer_name: oldPolicy.customer_name,
      primary_customer_id: oldPolicy.primary_customer_id,
      is_family_member: oldPolicy.is_family_member,
      organization_id: oldPolicy.organization_id,
      advisor_id: oldPolicy.advisor_id,
      insurer: oldPolicy.insurer,
      policy_number: oldPolicy.policy_number,
      version_number: (oldPolicy.version_number || 1) + 1,
      parent_policy_id: oldPolicy.id,
      insurance_type: oldPolicy.insurance_type,
      product: oldPolicy.product,
      premium_monthly: oldPolicy.premium_monthly,
      premium_yearly: oldPolicy.premium_yearly,
      start_date: oldPolicy.start_date,
      end_date: oldPolicy.end_date,
      renewal_date: oldPolicy.renewal_date,
      auto_renew: oldPolicy.auto_renew,
      cancellation_deadline: oldPolicy.cancellation_deadline,
      storno_period_months: oldPolicy.storno_period_months,
      status: 'active',
      custom_status: oldPolicy.custom_status,
      sparte: oldPolicy.sparte,
      sparte_data: oldPolicy.sparte_data,
      commission_rate: oldPolicy.commission_rate,
      commission_amount: oldPolicy.commission_amount,
      assigned_broker: oldPolicy.assigned_broker,
      policy_document_url: oldPolicy.policy_document_url,
      notes: `Mutation-Version aus Anfrage ${mutation_request_id}`,
    });

    console.log(`[approveMutationRequest] ✅ New policy created: ${newPolicy.id} (version ${newPolicy.version_number})`);

    // ─── ARCHIVE OLD POLICY ───
    await base44.entities.Contract.update(oldPolicy.id, {
      status: 'archived',
    });

    console.log(`[approveMutationRequest] ✅ Old policy archived: ${oldPolicy.id}`);

    // ─── UPDATE MUTATION REQUEST ───
    await base44.entities.MutationRequest.update(mutation_request_id, {
      status: 'approved',
      reviewed_by: user.email,
      reviewed_at: new Date().toISOString(),
      new_policy_id: newPolicy.id,
      notes: notes || '',
    });

    console.log(`[approveMutationRequest] ✅ Mutation request approved`);

    return Response.json({
      success: true,
      mutation_request_id,
      old_policy_id: oldPolicy.id,
      new_policy_id: newPolicy.id,
      new_policy_version: newPolicy.version_number,
      message: 'Mutation genehmigt – neue Policy-Version erstellt',
    });
  } catch (error) {
    console.error(`[approveMutationRequest] ERROR: ${error.message}`);
    return Response.json({ success: false, error: error.message }, { status: 500 });
  }
});