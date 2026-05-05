import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

/**
 * GUARD: Portal Data Access Control
 * 
 * RULE: app_user can ONLY see data WHERE:
 *       record.customer_id = app_user.customer_id
 * 
 * CRITICAL: Data Privacy Protection
 */

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const payload = await req.json();
    const {
      entity_type, // 'Contract', 'Document', 'Application'
      entity_id,
      app_user_customer_id,
    } = payload;

    if (!entity_type || !entity_id || !app_user_customer_id) {
      return Response.json(
        {
          error: 'entity_type, entity_id, app_user_customer_id erforderlich',
        },
        { status: 400 }
      );
    }

    console.log(
      `[guardPortalAccess] CHECK ${entity_type}=${entity_id} for customer=${app_user_customer_id}`
    );

    // ─── FETCH ENTITY ───
    let entity;
    try {
      entity = await base44.entities[entity_type].get(entity_id);
    } catch {
      return Response.json(
        { allowed: false, error: `${entity_type} nicht gefunden` },
        { status: 404 }
      );
    }

    // ─── CHECK customer_id MATCH ───
    if (entity.customer_id !== app_user_customer_id) {
      console.error(
        `[guardPortalAccess] ❌ BLOCKED: ${entity_type}=${entity_id} belongs to customer ${entity.customer_id}, not ${app_user_customer_id}`
      );
      return Response.json({
        allowed: false,
        error: 'Zugriff verweigert: Diese Daten gehören nicht zu dir',
        entity_type,
        entity_id,
      });
    }

    console.log(
      `[guardPortalAccess] ✅ SAFE: ${entity_type}=${entity_id} gehört zu customer=${app_user_customer_id}`
    );

    return Response.json({
      allowed: true,
      entity_type,
      entity_id,
      message: 'Zugriff erlaubt',
    });
  } catch (error) {
    console.error(`[guardPortalAccess] ERROR: ${error.message}`);
    return Response.json(
      { allowed: false, error: error.message },
      { status: 500 }
    );
  }
});