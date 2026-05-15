import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25'

/**
 * Portal Data Endpoint — SECURED
 * Validates portal session token before returning any data.
 * Portal session = { customer_id, token } stored in localStorage.
 * Token is SHA-256(customer_id + portal_password_hash) — set on login.
 */

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req)
    const body = await req.json()
    const { customer_id, session_token, action, update_data } = body

    if (!customer_id) {
      return Response.json({ error: 'customer_id erforderlich' }, { status: 400 })
    }

    // ── SESSION VALIDATION ──────────────────────────────────────────
    // Validate that the session_token matches the one stored on the customer record
    if (!session_token) {
      return Response.json({ error: 'Nicht authentifiziert' }, { status: 401 })
    }

    const customer = await base44.asServiceRole.entities.Customer.get(customer_id)
    if (!customer) {
      return Response.json({ error: 'Kunde nicht gefunden' }, { status: 404 })
    }

    // Verify portal is enabled for this customer
    if (!customer.portal_enabled && !customer.portal_access_enabled) {
      return Response.json({ error: 'Portal-Zugriff nicht aktiviert' }, { status: 403 })
    }

    // Validate session token: must match SHA-256(customer_id + password_hash)
    const encoder = new TextEncoder()
    const sessionData = encoder.encode(customer_id + (customer.portal_password_hash || ''))
    const hashBuffer = await crypto.subtle.digest('SHA-256', sessionData)
    const expectedToken = Array.from(new Uint8Array(hashBuffer))
      .map(b => b.toString(16).padStart(2, '0')).join('')

    if (session_token !== expectedToken) {
      return Response.json({ error: 'Ungültige Sitzung. Bitte erneut anmelden.' }, { status: 401 })
    }

    // ── UPDATE ACTION ───────────────────────────────────────────────
    if (action === 'update_customer') {
      // Whitelist of fields the customer may update on their own record
      const ALLOWED_FIELDS = ['phone', 'mobile', 'street', 'zip_code', 'city', 'birthdate', 'civil_status', 'nationality', 'profession']
      const safeData = {}
      for (const key of ALLOWED_FIELDS) {
        if (update_data && key in update_data) safeData[key] = update_data[key]
      }
      // Explicitly block sensitive fields
      delete safeData.ahv_number
      delete safeData.email
      delete safeData.portal_password_hash
      delete safeData.portal_enabled
      delete safeData.organization_id
      delete safeData.advisor_id

      if (Object.keys(safeData).length > 0) {
        await base44.asServiceRole.entities.Customer.update(customer_id, safeData)
      }
      return Response.json({ success: true })
    }

    // ── LOAD ALL DATA ───────────────────────────────────────────────
    const [directContracts, primaryContracts, directDocs, primaryDocs, directApps, primaryApps] = await Promise.all([
      base44.asServiceRole.entities.Contract.filter({ customer_id }),
      base44.asServiceRole.entities.Contract.filter({ primary_customer_id: customer_id }),
      base44.asServiceRole.entities.Document.filter({ customer_id }),
      base44.asServiceRole.entities.Document.filter({ primary_customer_id: customer_id }),
      base44.asServiceRole.entities.Application.filter({ customer_id }),
      base44.asServiceRole.entities.Application.filter({ primary_customer_id: customer_id }),
    ])

    function mergeById(a, b) {
      const map = {}
      ;[...(a || []), ...(b || [])].forEach(x => { map[x.id] = x })
      return Object.values(map)
    }

    const contracts = mergeById(directContracts, primaryContracts)
    const documents = mergeById(directDocs, primaryDocs).filter(d => d.visible_in_portal !== false)
    const applications = mergeById(directApps, primaryApps)

    // Strip sensitive internal fields from customer before returning
    const { portal_password_hash, portal_must_change_password, ...safeCustomer } = customer

    return Response.json({ customer: safeCustomer, contracts, documents, applications })
  } catch (error) {
    console.error('[getPortalData] ERROR:', error.message)
    return Response.json({ error: error.message || 'Ein Fehler ist aufgetreten' }, { status: 500 })
  }
})