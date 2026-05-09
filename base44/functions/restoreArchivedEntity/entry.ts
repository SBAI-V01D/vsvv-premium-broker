import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user?.email) return Response.json({ error: 'Unauthorized' }, { status: 401 });
    if (user.role !== 'admin') return Response.json({ error: 'Admin access required' }, { status: 403 });

    const { entity_type, entity_id } = await req.json();
    
    const allowedEntities = ['customer', 'application', 'contract', 'commission_entry'];
    if (!allowedEntities.includes(entity_type)) {
      return Response.json({ error: 'Invalid entity type' }, { status: 400 });
    }

    // Map entity names
    const entityMap = {
      'customer': 'Customer',
      'application': 'Application',
      'contract': 'Contract',
      'commission_entry': 'CommissionEntry'
    };

    const sdkName = entityMap[entity_type];
    
    await base44.entities[sdkName].update(entity_id, {
      archived: false,
      archived_at: null,
      archived_by: null,
      archived_reason: null
    });

    // Audit log
    await base44.entities.AuditLog.create({
      entity_type,
      entity_id,
      action: 'restore',
      changed_by: user.email,
      changed_at: new Date().toISOString(),
      summary: `Restored ${entity_type}`
    });

    return Response.json({ success: true });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});