import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const { entity_type, entity_id, reason } = await req.json();
    
    const allowedEntities = ['customer', 'application', 'contract', 'commission_entry'];
    if (!allowedEntities.includes(entity_type)) {
      return Response.json({ error: 'Invalid entity type' }, { status: 400 });
    }

    // Map entity names to SDK names
    const entityMap = {
      'customer': 'Customer',
      'application': 'Application',
      'contract': 'Contract',
      'commission_entry': 'CommissionEntry'
    };

    const sdkName = entityMap[entity_type];
    
    await base44.entities[sdkName].update(entity_id, {
      archived: true,
      archived_at: new Date().toISOString(),
      archived_by: user.email,
      archived_reason: reason || 'No reason provided'
    });

    // Create audit log
    await base44.entities.AuditLog.create({
      entity_type,
      entity_id,
      action: 'archive',
      changed_by: user.email,
      changed_at: new Date().toISOString(),
      summary: `Archived ${entity_type}: ${reason || 'No reason provided'}`
    });

    return Response.json({ success: true });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});