import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user || user.role !== 'admin') {
      return Response.json({ error: 'Forbidden: Admin only' }, { status: 403 });
    }

    const body = await req.json().catch(() => ({}));
    const dryRun = body.dry_run !== false; // default: dry_run = true

    // Find Peter Martin Adam in Advisor entity
    const advisors = await base44.asServiceRole.entities.Advisor.list('-created_date', 200);
    const peterAdvisor = advisors.find(a =>
      `${a.firstname || ''} ${a.lastname || ''}`.toLowerCase().includes('peter') &&
      `${a.firstname || ''} ${a.lastname || ''}`.toLowerCase().includes('adam')
    );

    if (!peterAdvisor) {
      return Response.json({ error: 'Peter Adam nicht in Advisor-Tabelle gefunden' }, { status: 404 });
    }

    // Also find Peter Adam as a User (for advisor_id on Customer)
    const allCustomers = await base44.asServiceRole.entities.Customer.list('-created_date', 1000);

    // Find primary customers with no advisor assigned at all
    const unassigned = allCustomers.filter(c =>
      !c.is_family_member &&
      !c.advisor_id &&
      !c.primary_advisor_id &&
      !(c.assigned_advisors || []).length
    );

    const results = {
      dry_run: dryRun,
      peter_advisor_id: peterAdvisor.id,
      peter_name: `${peterAdvisor.firstname} ${peterAdvisor.lastname}`,
      total_unassigned: unassigned.length,
      updated: 0,
      backup: [],
      details: [],
    };

    for (const c of unassigned) {
      results.backup.push({
        id: c.id,
        name: `${c.first_name} ${c.last_name}`,
        advisor_id_before: c.advisor_id || null,
        primary_advisor_id_before: c.primary_advisor_id || null,
        assigned_advisors_before: c.assigned_advisors || [],
        mandate_status_before: c.mandate_status,
      });

      if (!dryRun) {
        await base44.asServiceRole.entities.Customer.update(c.id, {
          advisor_id: peterAdvisor.id,
          primary_advisor_id: peterAdvisor.id,
          assigned_advisors: [peterAdvisor.id],
        });
      }

      results.updated++;
      results.details.push({
        name: `${c.first_name} ${c.last_name}`,
        action: dryRun ? 'would assign Peter Adam' : 'assigned Peter Adam',
        mandate_status: c.mandate_status,
      });
    }

    // Save backup to SystemLog before changes
    if (!dryRun && results.backup.length > 0) {
      await base44.asServiceRole.entities.SystemLog.create({
        level: 'info',
        source: 'assignPeterAdamToUnassigned',
        message: `Peter Adam als Berater zugewiesen für ${results.updated} Kunden`,
        details: JSON.stringify(results.backup),
        user_email: user.email,
      });
    }

    return Response.json({
      ...results,
      message: dryRun
        ? `DRY RUN: ${results.updated} Kunden würden Peter Adam zugewiesen`
        : `${results.updated} Kunden Peter Adam zugewiesen. Backup in SystemLog gespeichert.`,
    });

  } catch (error) {
    console.error('[assignPeterAdamToUnassigned] ERROR:', error.message);
    return Response.json({ error: error.message }, { status: 500 });
  }
});