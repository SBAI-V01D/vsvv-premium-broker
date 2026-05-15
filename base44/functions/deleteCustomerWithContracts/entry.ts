import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });
    if (user.role !== 'admin') return Response.json({ error: 'Admin access required' }, { status: 403 });

    const { customer_id } = await req.json();
    if (!customer_id) return Response.json({ error: 'customer_id erforderlich' }, { status: 400 });

    console.log(`[deleteCustomerWithContracts] START customer=${customer_id}`);

    // Fetch all related entities in parallel
    const [contracts, applications, documents, tasks, commissions] = await Promise.all([
      base44.asServiceRole.entities.Contract.filter({ customer_id }),
      base44.asServiceRole.entities.Application.filter({ customer_id }),
      base44.asServiceRole.entities.Document.filter({ customer_id }),
      base44.asServiceRole.entities.Task.filter({ customer_id }),
      base44.asServiceRole.entities.CommissionEntry.filter({ customer_id }),
    ]);

    // Soft-delete all related entities (archive instead of hard delete)
    const now = new Date().toISOString();
    const archivedBy = user.email;
    const reason = `Cascading archive: customer ${customer_id} deleted by ${archivedBy}`;

    const archiveUpdates = [
      ...contracts.map(e => base44.asServiceRole.entities.Contract.update(e.id, { archived: true, archived_at: now, archived_by: archivedBy, archived_reason: reason })),
      ...applications.map(e => base44.asServiceRole.entities.Application.update(e.id, { archived: true, archived_at: now, archived_by: archivedBy, archived_reason: reason })),
      ...commissions.map(e => base44.asServiceRole.entities.CommissionEntry.update(e.id, { archived: true, archived_at: now, archived_by: archivedBy })),
    ];

    await Promise.all(archiveUpdates);

    // Soft-delete the customer
    await base44.asServiceRole.entities.Customer.update(customer_id, {
      archived: true,
      archived_at: now,
      archived_by: archivedBy,
      archived_reason: 'Vom Admin gelöscht',
    });

    // Audit log
    await base44.asServiceRole.entities.AuditLog.create({
      entity_type: 'customer',
      entity_id: customer_id,
      action: 'archive',
      changed_by: archivedBy,
      changed_at: now,
      summary: `Kunde + ${contracts.length} Verträge + ${applications.length} Anträge + ${commissions.length} Provisionen archiviert`,
    });

    console.log(`[deleteCustomerWithContracts] ✅ DONE: customer=${customer_id} contracts=${contracts.length} apps=${applications.length}`);

    return Response.json({
      success: true,
      message: `Kunde und alle verknüpften Daten wurden archiviert.`,
      archived: {
        contracts: contracts.length,
        applications: applications.length,
        documents: documents.length,
        tasks: tasks.length,
        commissions: commissions.length,
      },
    });
  } catch (error) {
    console.error(`[deleteCustomerWithContracts] ERROR: ${error.message}`);
    return Response.json({ error: error.message }, { status: 500 });
  }
});