import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25'

Deno.serve(async (req) => {
  try {
    const body = await req.json()
    const { customer_id } = body

    if (!customer_id) {
      return Response.json({ error: 'customer_id erforderlich' }, { status: 400 })
    }

    const base44 = createClientFromRequest(req)

    // Load all data in parallel using service role (portal has no Base44 auth)
    const [customer, directContracts, primaryContracts, directDocs, primaryDocs, directApps, primaryApps] = await Promise.all([
      base44.asServiceRole.entities.Customer.get(customer_id),
      base44.asServiceRole.entities.Contract.filter({ customer_id }),
      base44.asServiceRole.entities.Contract.filter({ primary_customer_id: customer_id }),
      base44.asServiceRole.entities.Document.filter({ customer_id }),
      base44.asServiceRole.entities.Document.filter({ primary_customer_id: customer_id }),
      base44.asServiceRole.entities.Application.filter({ customer_id }),
      base44.asServiceRole.entities.Application.filter({ primary_customer_id: customer_id }),
    ])

    if (!customer) {
      return Response.json({ error: 'Kunde nicht gefunden' }, { status: 404 })
    }

    // Merge & deduplicate by id
    function mergeById(a, b) {
      const map = {}
      ;[...(a || []), ...(b || [])].forEach(x => { map[x.id] = x })
      return Object.values(map)
    }

    const contracts = mergeById(directContracts, primaryContracts)
    const documents = mergeById(directDocs, primaryDocs)
    const applications = mergeById(directApps, primaryApps)

    return Response.json({
      customer,
      contracts,
      documents,
      applications,
    })
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 })
  }
})