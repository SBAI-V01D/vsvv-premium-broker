import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

/**
 * GUARD: Duplicate Active Policy Check
 * 
 * RULE: IF active policy exists for customer + product
 *       → BLOCK creation of another active policy for same product
 * 
 * CRITICAL: Contract Safety
 */

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const payload = await req.json();
    const { customer_id, product } = payload;

    if (!customer_id || !product) {
      return Response.json(
        { error: 'customer_id and product erforderlich' },
        { status: 400 }
      );
    }

    console.log(
      `[guardDuplicatePolicy] CHECK customer=${customer_id} product=${product}`
    );

    // ─── FETCH ACTIVE POLICIES FOR CUSTOMER ───
    const activePolicies = await base44.entities.Contract.filter({
      customer_id: customer_id,
      status: 'active',
    });

    console.log(`[guardDuplicatePolicy] Found ${activePolicies.length} active policies`);

    // ─── CHECK FOR DUPLICATE PRODUCT ───
    const duplicatePolicy = activePolicies.find(p => p.product === product);

    if (duplicatePolicy) {
      console.error(
        `[guardDuplicatePolicy] ❌ BLOCKED: duplicate active policy ${duplicatePolicy.id} for product ${product}`
      );
      return Response.json({
        allowed: false,
        error: `Aktive Police für Produkt "${product}" existiert bereits`,
        existing_policy_id: duplicatePolicy.id,
        policy_number: duplicatePolicy.policy_number,
      });
    }

    console.log(
      `[guardDuplicatePolicy] ✅ SAFE: Kein Duplikat für Produkt ${product}`
    );

    return Response.json({
      allowed: true,
      customer_id,
      product,
      message: 'Neue Police kann erstellt werden',
    });
  } catch (error) {
    console.error(`[guardDuplicatePolicy] ERROR: ${error.message}`);
    return Response.json(
      { allowed: false, error: error.message },
      { status: 500 }
    );
  }
});