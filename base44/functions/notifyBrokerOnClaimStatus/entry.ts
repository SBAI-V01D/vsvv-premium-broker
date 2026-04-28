import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

const STATUS_LABELS = {
  eingereicht: 'Eingereicht',
  in_pruefung: 'In Prüfung',
  genehmigt: 'Genehmigt',
  abgelehnt: 'Abgelehnt',
  ausbezahlt: 'Ausbezahlt',
};

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const payload = await req.json();

    const claim = payload.data;
    const oldClaim = payload.old_data;
    if (!claim || !oldClaim) return Response.json({ skipped: 'missing data' });
    if (claim.status === oldClaim.status) return Response.json({ skipped: 'status unchanged' });

    // Find the assigned broker via the customer
    const customers = await base44.asServiceRole.entities.Customer.filter({ id: claim.customer_id });
    const customer = customers[0];
    const brokerEmail = customer?.assigned_broker;
    if (!brokerEmail) return Response.json({ skipped: 'no assigned broker' });

    const oldLabel = STATUS_LABELS[oldClaim.status] || oldClaim.status;
    const newLabel = STATUS_LABELS[claim.status] || claim.status;

    await base44.asServiceRole.integrations.Core.SendEmail({
      to: brokerEmail,
      subject: `Schadensstatus geändert: ${claim.title}`,
      body: `
Guten Tag,

Der Status einer Schadensmeldung Ihres Kunden ${claim.customer_name || claim.customer_id} hat sich geändert:

📋 Schaden: ${claim.title}
🔄 Alter Status: ${oldLabel}
✅ Neuer Status: ${newLabel}
${claim.claim_number ? `🔢 Schadennummer: ${claim.claim_number}` : ''}
${claim.amount_approved ? `💰 Genehmigter Betrag: CHF ${claim.amount_approved.toLocaleString('de-CH')}` : ''}

Bitte melden Sie sich in Ihrem BrokerCRM an, um weitere Details einzusehen.

Mit freundlichen Grüssen
BrokerCRM
      `.trim(),
    });

    // Log notification
    await base44.asServiceRole.entities.Notification.create({
      type: 'claim_status',
      recipient_email: brokerEmail,
      recipient_name: brokerEmail,
      subject: `Schadensstatus geändert: ${claim.title}`,
      body: `Status von "${oldLabel}" zu "${newLabel}" geändert`,
      reference_id: claim.id,
      reference_type: 'claim',
      sent_by: 'system',
      status: 'sent',
    });

    return Response.json({ success: true, notified: brokerEmail, from: oldClaim.status, to: claim.status });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});