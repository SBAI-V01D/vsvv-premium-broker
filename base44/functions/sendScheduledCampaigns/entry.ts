import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);

    const now = new Date();
    const campaigns = await base44.asServiceRole.entities.EmailCampaign.filter({ status: 'geplant' });
    const due = campaigns.filter(c => c.scheduled_at && new Date(c.scheduled_at) <= now);

    const results = [];
    for (const campaign of due) {
      const customerFilter = {};
      if (campaign.filter_status && campaign.filter_status !== 'alle') customerFilter.status = campaign.filter_status;
      if (campaign.filter_canton) customerFilter.canton = campaign.filter_canton;
      if (campaign.filter_customer_type && campaign.filter_customer_type !== 'alle') customerFilter.customer_type = campaign.filter_customer_type;

      const customers = Object.keys(customerFilter).length > 0
        ? await base44.asServiceRole.entities.Customer.filter(customerFilter)
        : await base44.asServiceRole.entities.Customer.list();

      const eligible = customers.filter(c => c.email);
      let sent = 0, failed = 0;

      for (const customer of eligible) {
        try {
          const body = campaign.body
            .replace(/{{name}}/g, `${customer.first_name || ''} ${customer.last_name || ''}`.trim())
            .replace(/{{vorname}}/g, customer.first_name || '')
            .replace(/{{nachname}}/g, customer.last_name || '')
            .replace(/{{email}}/g, customer.email || '');

          await base44.asServiceRole.integrations.Core.SendEmail({
            to: customer.email,
            subject: campaign.subject,
            body,
          });
          sent++;
        } catch {
          failed++;
        }
      }

      await base44.asServiceRole.entities.EmailCampaign.update(campaign.id, {
        status: 'gesendet',
        sent_at: new Date().toISOString(),
        recipients_count: eligible.length,
        sent_count: sent,
        failed_count: failed,
      });

      results.push({ id: campaign.id, name: campaign.name, sent, failed });
    }

    return Response.json({ processed: results.length, results });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});