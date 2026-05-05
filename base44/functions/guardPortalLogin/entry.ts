import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

/**
 * GUARD: Portal Login Validation
 * 
 * RULES (mcf001, mcf007, mcf010, mcf011):
 * 1. portal_enabled = true
 * 2. password_last_changed + 28 days < today → FORCE change
 * 3. must_change_password = true → FORCE change
 * 
 * CRITICAL: Portal Access Control
 */

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const { customer_id } = await req.json();

    if (!customer_id) {
      return Response.json({ error: 'customer_id erforderlich' }, { status: 400 });
    }

    console.log(`[guardPortalLogin] CHECK customer=${customer_id}`);

    // ─── FETCH CUSTOMER ───
    const customer = await base44.entities.Customer.get(customer_id);
    if (!customer) {
      return Response.json(
        { allowed: false, error: 'Kunde nicht gefunden' },
        { status: 404 }
      );
    }

    // ─── GUARD 1: portal_enabled ───
    if (!customer.portal_enabled) {
      console.error(`[guardPortalLogin] ❌ BLOCKED: portal_enabled=false`);
      return Response.json({
        allowed: false,
        error: 'Portal nicht aktiviert. Kontaktiere deinen Berater.',
        customer_id,
      });
    }

    // ─── GUARD 2: must_change_password (first login) ───
    if (customer.portal_must_change_password === true) {
      console.log(`[guardPortalLogin] ⚠️ FORCE: must_change_password=true (first login)`);
      return Response.json({
        allowed: true,
        customer_id,
        force_password_change: true,
        reason: 'first_login',
      });
    }

    // ─── GUARD 3: password rotation (28 days) ───
    if (customer.portal_password_last_changed) {
      const lastChanged = new Date(customer.portal_password_last_changed);
      const today = new Date();
      const daysSinceChange = Math.floor((today - lastChanged) / (1000 * 60 * 60 * 24));

      console.log(`[guardPortalLogin] Password last changed ${daysSinceChange} days ago`);

      if (daysSinceChange > 28) {
        console.log(`[guardPortalLogin] ⚠️ FORCE: password rotation (${daysSinceChange} days)`);
        return Response.json({
          allowed: true,
          customer_id,
          force_password_change: true,
          reason: 'password_rotation_28days',
          days_since_change: daysSinceChange,
        });
      }
    }

    console.log(`[guardPortalLogin] ✅ ALLOWED: Login OK`);

    return Response.json({
      allowed: true,
      customer_id,
      force_password_change: false,
    });
  } catch (error) {
    console.error(`[guardPortalLogin] ERROR: ${error.message}`);
    return Response.json(
      { allowed: false, error: error.message },
      { status: 500 }
    );
  }
});