import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25'

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req)

    // Fetch all contracts
    const contracts = await base44.entities.Contract.list()
    const customers = await base44.entities.Customer.list()

    const today = new Date()
    const ninetyDaysFromNow = new Date(today.getTime() + 90 * 24 * 60 * 60 * 1000)

    let notified = 0

    for (const contract of contracts) {
      if (contract.status !== 'active' || !contract.end_date) continue

      const endDate = new Date(contract.end_date)

      if (endDate > today && endDate <= ninetyDaysFromNow) {
        const customer = customers.find(c => c.id === contract.customer_id)

        if (customer) {
          // Create notification
          await base44.entities.Notification.create({
            type: 'contract_expiry',
            recipient_email: customer.email,
            recipient_name: `${customer.first_name} ${customer.last_name}`,
            subject: `Versicherungsvertrag läuft ab: ${contract.insurance_type}`,
            body: `Ihr Versicherungsvertrag (${contract.insurance_type} bei ${contract.insurer}) läuft am ${contract.end_date} ab.`,
            reference_id: contract.id,
            reference_type: 'contract',
          })

          // Send email
          await base44.integrations.Core.SendEmail({
            to: customer.email,
            subject: `Versicherungsvertrag läuft ab: ${contract.insurance_type}`,
            body: `Liebe/r ${customer.first_name},\n\nIhr Versicherungsvertrag (${contract.insurance_type} bei ${contract.insurer}) mit der Policen-Nr. ${contract.policy_number || '–'} läuft am ${contract.end_date} ab.\n\nBitte kontaktieren Sie uns für eine Erneuerung.`,
          })

          notified++
        }
      }
    }

    return Response.json({ success: true, notified })
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 })
  }
})