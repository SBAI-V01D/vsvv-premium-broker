import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25'

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req)
    const user = await base44.auth.me()

    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Only admins can run this
    if (user.role !== 'admin') {
      return Response.json({ error: 'Forbidden: Admin only' }, { status: 403 })
    }

    // Fetch all applications
    const applications = await base44.asServiceRole.entities.Application.list()
    const appCustomerIds = new Set(applications.map(a => a.customer_id).filter(Boolean))

    // Fetch all contracts
    const contracts = await base44.asServiceRole.entities.Contract.list()
    const contractCustomerIds = new Set(contracts.map(c => c.customer_id).filter(Boolean))

    // Merge all customer IDs
    const allCustomerIds = new Set([...appCustomerIds, ...contractCustomerIds])
    const customerIds = Array.from(allCustomerIds)

    console.log(`[syncCustomerStatusToActive] Found ${customerIds.length} customers with applications/contracts`)

    let updated = 0
    let errors = 0

    // Update each customer
    for (const customerId of customerIds) {
      try {
        const customer = await base44.asServiceRole.entities.Customer.get(customerId)
        
        if (customer.status !== 'active') {
          await base44.asServiceRole.entities.Customer.update(customerId, { status: 'active' })
          updated++
          console.log(`[syncCustomerStatusToActive] Updated ${customer.first_name} ${customer.last_name} (${customerId}) → active`)
        }
      } catch (err) {
        errors++
        console.error(`[syncCustomerStatusToActive] Error updating customer ${customerId}: ${err.message}`)
      }
    }

    return Response.json({
      success: true,
      total_customers: customerIds.length,
      updated,
      errors,
      message: `Synced ${updated} customers to active status`
    })
  } catch (error) {
    console.error('[syncCustomerStatusToActive] Error:', error.message)
    return Response.json({ error: error.message }, { status: 500 })
  }
})