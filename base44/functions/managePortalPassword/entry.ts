import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25'

async function hashPassword(password) {
  const encoder = new TextEncoder()
  const data = encoder.encode(password)
  const hashBuffer = await crypto.subtle.digest('SHA-256', data)
  const hashArray = Array.from(new Uint8Array(hashBuffer))
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('')
}

async function verifyPassword(password, hash) {
  const newHash = await hashPassword(password)
  return newHash === hash
}

Deno.serve(async (req) => {
  try {
    // Always create the client — it works for asServiceRole even without a user token
    const base44 = createClientFromRequest(req)
    const body = await req.json()
    const { action, customer_id, password, email } = body

    // Public actions — used by portal login (no Base44 user auth available)
    const publicActions = ['verify', 'lookup_customer', 'reset_password']

    if (!publicActions.includes(action)) {
      // Admin-only: require authenticated Base44 user
      const user = await base44.auth.me()
      if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 })
      if (user.role !== 'admin') return Response.json({ error: 'Access denied' }, { status: 403 })
    }

    if (action === 'lookup_customer') {
      if (!email) return Response.json({ error: 'email erforderlich' }, { status: 400 })
      const customers = await base44.asServiceRole.entities.Customer.filter({ email })
      const customer = customers.find(c => c.email?.toLowerCase() === email.toLowerCase())
      if (!customer) return Response.json({ found: false })

      const FOUR_WEEKS_MS = 28 * 24 * 60 * 60 * 1000
      const lastChange = customer.portal_last_password_change ? new Date(customer.portal_last_password_change) : null
      const passwordExpired = lastChange ? (Date.now() - lastChange.getTime()) > FOUR_WEEKS_MS : false
      const mustChange = customer.portal_password_must_change || passwordExpired

      return Response.json({
        found: true,
        customer_id: customer.id,
        portal_access_enabled: customer.portal_access_enabled,
        portal_password_must_change: mustChange,
        portal_last_login: customer.portal_last_login,
      })
    }

    if (action === 'verify') {
      if (!customer_id || !password) return Response.json({ error: 'customer_id und password erforderlich' }, { status: 400 })
      const customer = await base44.asServiceRole.entities.Customer.get(customer_id)
      if (!customer) return Response.json({ error: 'Kunde nicht gefunden' }, { status: 404 })
      const valid = await verifyPassword(password, customer.portal_password_hash)
      return Response.json({ valid })
    }

    if (action === 'set_password') {
      if (!customer_id || !password) return Response.json({ error: 'customer_id und password erforderlich' }, { status: 400 })
      const passwordHash = await hashPassword(password)
      await base44.asServiceRole.entities.Customer.update(customer_id, {
        portal_password_hash: passwordHash,
        portal_password_must_change: true,
        portal_access_enabled: true,
      })
      return Response.json({ success: true, message: 'Passwort gesetzt' })
    }

    if (action === 'reset_password') {
      if (!customer_id || !password) return Response.json({ error: 'customer_id und password erforderlich' }, { status: 400 })
      const passwordHash = await hashPassword(password)
      await base44.asServiceRole.entities.Customer.update(customer_id, {
        portal_password_hash: passwordHash,
        portal_password_must_change: false,
        portal_last_password_change: new Date().toISOString(),
      })
      return Response.json({ success: true, message: 'Passwort zurückgesetzt' })
    }

    return Response.json({ error: 'Unbekannte Aktion' }, { status: 400 })
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 })
  }
})