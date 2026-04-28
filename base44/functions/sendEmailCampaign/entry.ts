import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (user?.role !== 'admin' && user?.role !== 'broker') {
      return Response.json({ error: 'Keine Berechtigung' }, { status: 403 });
    }

    const { campaign_id } = await req.json();
    if (!campaign_id) return Response.json({ error: 'campaign_id fehlt' }, { status: 400 });

    const campaign = await base44.asServiceRole.entities.EmailCampaign.get(campaign_id);
    if (!campaign) return Response.json({ error: 'Kampagne nicht gefunden' }, { status: 404 });

    // Build customer filter
    const customerFilter = {};
    if (campaign.filter_status && campaign.filter_status !== 'alle') {
      customerFilter.status = campaign.filter_status;
    }
    if (campaign.filter_canton) {
      customerFilter.canton = campaign.filter_canton;
    }
    if (campaign.filter_customer_type && campaign.filter_customer_type !== 'alle') {
      customerFilter.customer_type = campaign.filter_customer_type;
    }

    const customers = Object.keys(customerFilter).length > 0
      ? await base44.asServiceRole.entities.Customer.filter(customerFilter)
      : await base44.asServiceRole.entities.Customer.list();

    const eligibleCustomers = customers.filter(c => c.email);

    let sentCount = 0;
    let failedCount = 0;

    for (const customer of eligibleCustomers) {
      try {
        const personalizedBody = campaign.body
          .replace(/{{name}}/g, `${customer.first_name || ''} ${customer.last_name || ''}`.trim())
          .replace(/{{vorname}}/g, customer.first_name || '')
          .replace(/{{nachname}}/g, customer.last_name || '')
          .replace(/{{email}}/g, customer.email || '');

        await base44.asServiceRole.integrations.Core.SendEmail({
          to: customer.email,
          subject: campaign.subject,
          body: personalizedBody,
        });
        sentCount++;
      } catch {
        failedCount++;
      }
    }

    await base44.asServiceRole.entities.EmailCampaign.update(campaign_id, {
      status: 'gesendet',
      sent_at: new Date().toISOString(),
      recipients_count: eligibleCustomers.length,
      sent_count: sentCount,
      failed_count: failedCount,
    });

    return Response.json({ success: true, sent: sentCount, failed: failedCount, total: eligibleCustomers.length });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});