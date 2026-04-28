import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25'

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req)
    const user = await base44.auth.me()

    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { campaign_id } = await req.json()

    if (!campaign_id) {
      return Response.json({ error: 'campaign_id required' }, { status: 400 })
    }

    // Fetch campaign
    const campaigns = await base44.entities.EmailCampaign.list()
    const campaign = campaigns.find(c => c.id === campaign_id)

    if (!campaign) {
      return Response.json({ error: 'Campaign not found' }, { status: 404 })
    }

    // Fetch customers based on filters
    const customers = await base44.entities.Customer.list()
    let recipients = customers

    if (campaign.filter_status !== 'all') {
      recipients = recipients.filter(c => c.status === campaign.filter_status)
    }

    if (campaign.filter_canton) {
      recipients = recipients.filter(c => c.canton === campaign.filter_canton)
    }

    // Send emails
    let sent_count = 0
    let failed_count = 0

    for (const customer of recipients) {
      try {
        await base44.integrations.Core.SendEmail({
          to: customer.email,
          subject: campaign.subject.replace(/{{customer_name}}/g, `${customer.first_name} ${customer.last_name}`),
          body: campaign.body.replace(/{{customer_name}}/g, `${customer.first_name} ${customer.last_name}`),
        })
        sent_count++
      } catch (error) {
        failed_count++
        console.error(`Failed to send email to ${customer.email}:`, error.message)
      }
    }

    // Update campaign
    await base44.entities.EmailCampaign.update(campaign_id, {
      status: 'sent',
      sent_at: new Date().toISOString(),
      sent_count,
      failed_count,
    })

    return Response.json({ success: true, sent_count, failed_count })
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 })
  }
})