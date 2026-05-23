import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

const PETER_ADAM_ADVISOR_ID = '69f9ed07e6b5f5aa755e897b';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user || user.role !== 'admin') {
      return Response.json({ error: 'Forbidden: Admin only' }, { status: 403 });
    }

    const body = await req.json().catch(() => ({}));
    const dryRun = body.dry_run === true;

    // Fetch all customers that were touched by the bulk op
    const customers = await base44.asServiceRole.entities.Customer.list('-created_date', 5000);

    const touched = customers.filter(c =>
      (c.assigned_advisors || []).includes(PETER_ADAM_ADVISOR_ID) &&
      c.mandate_status === 'invalid' &&
      c.advisor_id === PETER_ADAM_ADVISOR_ID
    );

    // Revert ALL touched customers to original state
    if (!dryRun) {
      for (const c of touched) {
        await base44.asServiceRole.entities.Customer.update(c.id, {
          mandate_status: 'pending',
          advisor_id: null,
          primary_advisor_id: null,
          assigned_advisors: [],
          assigned_broker: null,
        });
      }
    }

    return Response.json({
      dry_run: dryRun,
      total_reverted: touched.length,
      reverted: touched.map(c => ({ name: `${c.first_name} ${c.last_name}`, is_family_member: c.is_family_member })),
      message: dryRun
        ? `DRY RUN: ${touched.length} Kunden werden vollständig zurückgesetzt`
        : `${touched.length} Kunden erfolgreich zurückgesetzt (mandate_status=pending, kein Berater)`,
    });

  } catch (error) {
    console.error('[revertBulkMandateChange] ERROR:', error.message);
    return Response.json({ error: error.message }, { status: 500 });
  }
});