import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

/**
 * Synchronisiert organization_id und advisor_id auf alle Anträge und Verträge
 * wenn der Kunde geändert wird.
 */

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const payload = await req.json();
    const { customer_id, organization_id, advisor_id } = payload;

    if (!customer_id) return Response.json({ error: 'customer_id erforderlich' }, { status: 400 });

    console.log(`[syncApplicationOnCustomerChange] START customer=${customer_id} org=${organization_id} advisor=${advisor_id}`);

    // Fetch applications and contracts in parallel
    const [applications, contracts] = await Promise.all([
      base44.entities.Application.filter({ customer_id }),
      base44.entities.Contract.filter({ customer_id }),
    ]);

    console.log(`[syncApplicationOnCustomerChange] Found ${applications.length} applications, ${contracts.length} contracts`);

    const updateData = {};
    if (organization_id !== undefined) updateData.organization_id = organization_id;
    if (advisor_id !== undefined) updateData.advisor_id = advisor_id || null;

    if (Object.keys(updateData).length === 0) {
      return Response.json({ success: true, message: 'Nichts zu synchronisieren', synced: { applications: 0, contracts: 0 } });
    }

    // Update all in parallel
    await Promise.all([
      ...applications.map(app => base44.entities.Application.update(app.id, updateData)),
      ...contracts.map(contract => base44.entities.Contract.update(contract.id, updateData)),
    ]);

    console.log(`[syncApplicationOnCustomerChange] ✅ Sync complete`);

    return Response.json({
      success: true,
      synced: {
        applications: applications.length,
        contracts: contracts.length,
      },
    });
  } catch (error) {
    console.error(`[syncApplicationOnCustomerChange] ERROR: ${error.message}`);
    return Response.json({ error: error.message }, { status: 500 });
  }
});