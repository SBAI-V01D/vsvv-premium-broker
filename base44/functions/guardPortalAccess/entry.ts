import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

/**
 * GUARD: Portal Data Access Control
 * FIXED: user_role is NEVER accepted from client payload — always use authenticated user.role
 */

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const payload = await req.json();
    const { entity_type, entity_id, app_user_customer_id } = payload;
    // SECURITY: NEVER use user_role from payload — always derive from authenticated session
    const user_role = user.role;

    if (!entity_type || !entity_id || !app_user_customer_id) {
      return Response.json({ error: 'entity_type, entity_id, app_user_customer_id erforderlich' }, { status: 400 });
    }

    console.log(`[guardPortalAccess] CHECK ${entity_type}=${entity_id} for customer=${app_user_customer_id}, role=${user_role}`);

    // Admin bypass
    if (user_role === 'admin') {
      return Response.json({ allowed: true, entity_type, entity_id, message: 'Admin – Unlimited access' });
    }

    // Fetch entity using service role
    let entity;
    try {
      entity = await base44.asServiceRole.entities[entity_type].get(entity_id);
    } catch {
      return Response.json({ allowed: false, error: `${entity_type} nicht gefunden` }, { status: 404 });
    }

    if (!entity) {
      return Response.json({ allowed: false, error: `${entity_type} nicht gefunden` }, { status: 404 });
    }

    // Advisor: check customer is assigned to this advisor
    if (user_role === 'advisor') {
      const ownerCustomer = await base44.asServiceRole.entities.Customer.get(entity.customer_id);
      if (ownerCustomer?.advisor_id === user.id ||
          ownerCustomer?.primary_advisor_id === user.id ||
          (ownerCustomer?.assigned_advisors || []).includes(user.id)) {
        return Response.json({ allowed: true, entity_type, entity_id, message: 'Zugriff erlaubt (zugewiesener Kunde)' });
      }
      return Response.json({ allowed: false, error: 'Dieser Kunde ist dir nicht zugewiesen', entity_type, entity_id }, { status: 403 });
    }

    // Customer: strict customer_id match
    if (user_role === 'customer') {
      if (entity.customer_id !== app_user_customer_id && entity.primary_customer_id !== app_user_customer_id) {
        return Response.json({ allowed: false, error: 'Zugriff verweigert: Diese Daten gehören nicht zu dir', entity_type, entity_id }, { status: 403 });
      }
      return Response.json({ allowed: true, entity_type, entity_id, message: 'Zugriff erlaubt' });
    }

    return Response.json({ allowed: false, error: 'Unbekannte Benutzerrolle' }, { status: 403 });
  } catch (error) {
    console.error(`[guardPortalAccess] ERROR: ${error.message}`);
    return Response.json({ allowed: false, error: 'Interner Fehler' }, { status: 500 });
  }
});