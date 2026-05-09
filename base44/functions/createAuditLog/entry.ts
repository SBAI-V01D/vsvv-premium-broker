import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const {
      entity_type,
      entity_id,
      action,
      old_values,
      new_values,
      summary,
    } = await req.json();

    const auditLog = await base44.entities.AuditLog.create({
      entity_type,
      entity_id,
      action,
      changed_by: user.email,
      changed_at: new Date().toISOString(),
      old_values,
      new_values,
      summary,
    });

    return Response.json({ success: true, audit_id: auditLog.id });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});