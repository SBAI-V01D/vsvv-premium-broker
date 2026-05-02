import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25'

// Einfacher Hash mit Deno's SubtleCrypto
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
    const user = await base44.auth.me()

    if (!user?.role || user.role !== 'admin') {
      return Response.json({ error: 'Admin access required' }, { status: 403 })
    }

    const { action, customer_id, password } = await req.json()

    if (action === 'set_password') {
      if (!customer_id || !password) {
        return Response.json({ error: 'customer_id und password erforderlich' }, { status: 400 })
      }

      const passwordHash = await hashPassword(password)
      
      await base44.entities.Customer.update(customer_id, {
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

      await base44.entities.Customer.update(customer_id, {
        portal_password_hash: passwordHash,
        portal_password_must_change: true,
      })

      return Response.json({ success: true, message: 'Passwort zurückgesetzt' })
    }

    if (action === 'verify') {
      if (!customer_id || !password) {
        return Response.json({ error: 'customer_id und password erforderlich' }, { status: 400 })
      }

      const customer = await base44.entities.Customer.get(customer_id)
      if (!customer) {
        return Response.json({ error: 'Kunde nicht gefunden' }, { status: 404 })
      }

      const valid = await verifyPassword(password, customer.portal_password_hash)
      return Response.json({ valid })
    }

    return Response.json({ error: 'Unbekannte Aktion' }, { status: 400 })
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 })
  }
})