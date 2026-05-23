import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

const PETER_ADAM_ADVISOR_ID = '69f9ed07e6b5f5aa755e897b';
const PETER_ADAM_EMAIL = 'p.adam@vsvv.ch';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user || user.role !== 'admin') {
      return Response.json({ error: 'Forbidden: Admin only' }, { status: 403 });
    }

    // Read optional params (dry_run = preview without saving)
    const body = await req.json().catch(() => ({}));
    const dryRun = body.dry_run === true;

    // Fetch all customers (paginated via large limit)
    const customers = await base44.asServiceRole.entities.Customer.list('-created_date', 5000);

    const results = { updated: 0, skipped: 0, errors: 0, details: [] };

    for (const customer of customers) {
      // ONLY primary customers (not family members)
      if (customer.is_family_member) {
        results.skipped++;
        continue;
      }

      const currentAdvisors = customer.assigned_advisors || [];
      const alreadyAssigned = currentAdvisors.includes(PETER_ADAM_ADVISOR_ID);
      const alreadyInactive = customer.mandate_status === 'invalid';

      if (alreadyAssigned && alreadyInactive) {
        results.skipped++;
        continue;
      }

      const updatedAdvisors = alreadyAssigned
        ? currentAdvisors
        : [...currentAdvisors, PETER_ADAM_ADVISOR_ID];

      const updates = {
        mandate_status: 'invalid',
        assigned_advisors: updatedAdvisors,
        advisor_id: customer.advisor_id || PETER_ADAM_ADVISOR_ID,
        primary_advisor_id: customer.primary_advisor_id || PETER_ADAM_ADVISOR_ID,
        assigned_broker: customer.assigned_broker || PETER_ADAM_EMAIL,
      };

      if (!dryRun) {
        await base44.asServiceRole.entities.Customer.update(customer.id, updates);
      }

      results.updated++;
      results.details.push({
        id: customer.id,
        name: `${customer.first_name} ${customer.last_name}`,
        was_assigned: alreadyAssigned,
        was_inactive: alreadyInactive,
      });
    }

    return Response.json({
      dry_run: dryRun,
      total: customers.length,
      ...results,
      message: dryRun
        ? `DRY RUN: ${results.updated} Kunden würden aktualisiert, ${results.skipped} bereits korrekt`
        : `${results.updated} Kunden aktualisiert, ${results.skipped} bereits korrekt`,
    });

  } catch (error) {
    console.error('[bulkSetMandateInactiveAndAdvisor] ERROR:', error.message);
    return Response.json({ error: error.message }, { status: 500 });
  }
});