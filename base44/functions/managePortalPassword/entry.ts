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
    const base44 = createClientFromRequest(req)
    const body = await req.json()
    const { action, customer_id, password, email } = body

    // Public actions (no auth required — used by portal login / password change)
    const publicActions = ['verify', 'lookup_customer', 'reset_password']

    if (!publicActions.includes(action)) {
      const user = await base44.auth.me()
      if (!user) {
        return Response.json({ error: 'Unauthorized' }, { status: 401 })
      }
      if (user.role !== 'admin') {
        return Response.json({ error: 'Access denied' }, { status: 403 })
      }
    }

    // Lookup customer by email — public, used by portal login before we have customer_id
    if (action === 'lookup_customer') {
      if (!email) {
        return Response.json({ error: 'email erforderlich' }, { status: 400 })
      }
      const customers = await base44.asServiceRole.entities.Customer.filter({ email })
      const customer = customers.find(c => c.email?.toLowerCase() === email.toLowerCase())
      if (!customer) {
        return Response.json({ found: false })
      }
      return Response.json({
        found: true,
        customer_id: customer.id,
        portal_access_enabled: customer.portal_access_enabled,
        portal_password_must_change: customer.portal_password_must_change,
        portal_last_login: customer.portal_last_login,
      })
    }

    if (action === 'verify') {
      if (!customer_id || !password) {
        return Response.json({ error: 'customer_id und password erforderlich' }, { status: 400 })
      }
      const customer = await base44.asServiceRole.entities.Customer.get(customer_id)
      if (!customer) {
        return Response.json({ error: 'Kunde nicht gefunden' }, { status: 404 })
      }
      const valid = await verifyPassword(password, customer.portal_password_hash)
      return Response.json({ valid })
    }

    if (action === 'set_password') {
      if (!customer_id || !password) {
        return Response.json({ error: 'customer_id und password erforderlich' }, { status: 400 })
      }
      const passwordHash = await hashPassword(password)
      await base44.asServiceRole.entities.Customer.update(customer_id, {
        portal_password_hash: passwordHash,
        portal_password_must_change: true,
        portal_access_enabled: true,
      })
      return Response.json({ success: true, message: 'Passwort gesetzt' })
    }

    if (action === 'reset_password') {
      if (!customer_id || !password) {
        return Response.json({ error: 'customer_id und password erforderlich' }, { status: 400 })
      }
      const passwordHash = await hashPassword(password)
      await base44.asServiceRole.entities.Customer.update(customer_id, {
        portal_password_hash: passwordHash,
        portal_password_must_change: true,
      })
      return Response.json({ success: true, message: 'Passwort zurückgesetzt' })
    }

    return Response.json({ error: 'Unbekannte Aktion' }, { status: 400 })
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 })
  }
})