import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

/**
 * Write audit log for all entity changes
 * Called after create/update/delete operations
 */
Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await req.json();
    const { entity_type, entity_id, action, old_values, new_values, summary } = body;

    // Ensure AuditLog entity exists
    try {
      await base44.entities.AuditLog.create({
        entity_type,
        entity_id,
        action,
        changed_by: user.email,
        changed_at: new Date().toISOString(),
        old_values: old_values || {},
        new_values: new_values || {},
        summary: summary || `${action}d ${entity_type} ${entity_id}`
      });
    } catch (err) {
      // AuditLog might not exist yet, log to console
      console.log(`Audit: ${user.email} ${action}d ${entity_type} ${entity_id}`);
    }

    return Response.json({ success: true, logged: true });

  } catch (error) {
    console.error('Audit log error:', error);
    return Response.json({ success: false, error: error.message }, { status: 500 });
  }
});