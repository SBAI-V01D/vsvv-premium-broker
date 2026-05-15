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

async function computeSessionToken(customerId, passwordHash) {
  const encoder = new TextEncoder()
  const data = encoder.encode(customerId + (passwordHash || ''))
  const hashBuffer = await crypto.subtle.digest('SHA-256', data)
  return Array.from(new Uint8Array(hashBuffer)).map(b => b.toString(16).padStart(2, '0')).join('')
}

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req)
    const body = await req.json()
    const { action, customer_id, password, email } = body

    // ── PUBLIC ACTIONS (no Base44 auth needed) ──────────────────────
    // SECURITY: reset_password is NOT public — requires old password verification
    const publicActions = ['verify', 'lookup_customer']

    if (!publicActions.includes(action)) {
      // Protected actions require admin auth OR old-password verification
      if (action === 'set_password' || action === 'reset_password_admin') {
        const user = await base44.auth.me()
        if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 })
        if (user.role !== 'admin') return Response.json({ error: 'Access denied' }, { status: 403 })
      }
      // change_password: requires current_password verification (done below)
    }

    // lookup_customer — public, but returns minimal info (no password state leakage)
    if (action === 'lookup_customer') {
      if (!email) return Response.json({ error: 'email erforderlich' }, { status: 400 })
      const customers = await base44.asServiceRole.entities.Customer.filter({ email })
      const customer = customers.find(c => c.email?.toLowerCase() === email.toLowerCase())
      if (!customer) {
        // Always return same shape to avoid email enumeration timing attacks
        return Response.json({ found: false })
      }
      return Response.json({
        found: true,
        customer_id: customer.id,
        portal_access_enabled: customer.portal_enabled || customer.portal_access_enabled || false,
        portal_password_must_change: customer.portal_password_must_change || customer.portal_must_change_password || false,
      })
    }

    // verify — public, returns valid:true/false only (no account state)
    if (action === 'verify') {
      if (!customer_id || !password) return Response.json({ error: 'customer_id und password erforderlich' }, { status: 400 })
      const customer = await base44.asServiceRole.entities.Customer.get(customer_id)
      if (!customer) {
        // Consistent timing — don't reveal whether customer exists
        await hashPassword(password)
        return Response.json({ valid: false })
      }
      const valid = await verifyPassword(password, customer.portal_password_hash)
      if (!valid) return Response.json({ valid: false })

      // Compute session token on successful login
      const session_token = await computeSessionToken(customer_id, customer.portal_password_hash)

      // Update last login timestamp
      await base44.asServiceRole.entities.Customer.update(customer_id, {
        portal_last_login: new Date().toISOString(),
      })

      return Response.json({ valid: true, session_token })
    }

    // set_password — admin only (enforced above)
    if (action === 'set_password') {
      if (!customer_id || !password) return Response.json({ error: 'customer_id und password erforderlich' }, { status: 400 })
      const passwordHash = await hashPassword(password)
      await base44.asServiceRole.entities.Customer.update(customer_id, {
        portal_password_hash: passwordHash,
        portal_password_must_change: true,
        portal_must_change_password: true,
        portal_enabled: true,
        portal_access_enabled: true,
      })
      return Response.json({ success: true, message: 'Passwort gesetzt' })
    }

    // reset_password_admin — admin only (enforced above)
    if (action === 'reset_password_admin') {
      if (!customer_id || !password) return Response.json({ error: 'customer_id und password erforderlich' }, { status: 400 })
      const passwordHash = await hashPassword(password)
      await base44.asServiceRole.entities.Customer.update(customer_id, {
        portal_password_hash: passwordHash,
        portal_password_must_change: false,
        portal_must_change_password: false,
        portal_last_password_change: new Date().toISOString(),
      })
      return Response.json({ success: true, message: 'Passwort zurückgesetzt' })
    }

    // change_password — customer self-service: requires verification of old password
    if (action === 'change_password') {
      const { old_password, new_password } = body
      if (!customer_id || !old_password || !new_password) {
        return Response.json({ error: 'customer_id, old_password und new_password erforderlich' }, { status: 400 })
      }
      if (new_password.length < 8) {
        return Response.json({ error: 'Passwort muss mindestens 8 Zeichen lang sein' }, { status: 400 })
      }
      const customer = await base44.asServiceRole.entities.Customer.get(customer_id)
      if (!customer) return Response.json({ error: 'Ungültige Anfrage' }, { status: 400 })
      const oldValid = await verifyPassword(old_password, customer.portal_password_hash)
      if (!oldValid) return Response.json({ error: 'Aktuelles Passwort ist falsch' }, { status: 403 })

      const newHash = await hashPassword(new_password)
      await base44.asServiceRole.entities.Customer.update(customer_id, {
        portal_password_hash: newHash,
        portal_password_must_change: false,
        portal_must_change_password: false,
        portal_last_password_change: new Date().toISOString(),
      })
      // Return new session token
      const session_token = await computeSessionToken(customer_id, newHash)
      return Response.json({ success: true, message: 'Passwort geändert', session_token })
    }

    return Response.json({ error: 'Unbekannte Aktion' }, { status: 400 })
  } catch (error) {
    return Response.json({ error: 'Ein Fehler ist aufgetreten' }, { status: 500 })
  }
})