import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

/**
 * GUARD: Portal Data Access Control + Role-Based
 * 
 * RULES:
 * - admin: kann ALLE Daten sehen
 * - advisor: kann Daten der zugewiesenen Kunden sehen (via advisor_id)
 * - customer: kann NUR eigene Daten sehen (record.customer_id = app_user.customer_id)
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
      user_role = user.role, // default to authenticated user's role
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
      `[guardPortalAccess] CHECK ${entity_type}=${entity_id} for customer=${app_user_customer_id}, user_role=${user_role}`
    );

    // ─── ADMIN BYPASS: Admins see everything ───
    if (user_role === 'admin') {
      console.log(`[guardPortalAccess] ✅ ADMIN: Unlimited access`);
      return Response.json({
        allowed: true,
        entity_type,
        entity_id,
        message: 'Admin – Unlimited access',
      });
    }

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

    // ─── ADVISOR: Check if customer is assigned to this advisor ───
    if (user_role === 'advisor') {
      const ownerCustomer = await base44.entities.Customer.get(entity.customer_id);
      if (ownerCustomer?.advisor_id === user.id) {
        console.log(
          `[guardPortalAccess] ✅ ADVISOR: Customer ${entity.customer_id} is assigned to you`
        );
        return Response.json({
          allowed: true,
          entity_type,
          entity_id,
          message: 'Zugriff erlaubt (zugewiesener Kunde)',
        });
      } else {
        console.error(
          `[guardPortalAccess] ❌ ADVISOR BLOCKED: Customer ${entity.customer_id} not assigned to advisor ${user.id}`
        );
        return Response.json({
          allowed: false,
          error: 'Dieser Kunde ist dir nicht zugewiesen',
          entity_type,
          entity_id,
        });
      }
    }

    // ─── CUSTOMER: Check customer_id MATCH ───
    if (user_role === 'customer') {
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
    }

    // Unknown role
    return Response.json({
      allowed: false,
      error: 'Unbekannte Benutzerrolle',
    }, { status: 403 });
  } catch (error) {
    console.error(`[guardPortalAccess] ERROR: ${error.message}`);
    return Response.json(
      { allowed: false, error: error.message },
      { status: 500 }
    );
  }
});