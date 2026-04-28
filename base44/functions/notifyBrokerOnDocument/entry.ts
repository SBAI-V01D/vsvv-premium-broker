import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const payload = await req.json();

    const doc = payload.data;
    if (!doc) return Response.json({ skipped: 'no data' });

    // Only notify when uploaded by a customer
    if (doc.uploaded_by_role !== 'customer') {
      return Response.json({ skipped: 'uploaded by broker' });
    }

    // Find the customer to get the assigned broker
    const customers = await base44.asServiceRole.entities.Customer.filter({ id: doc.customer_id });
    const customer = customers[0];
    if (!customer?.assigned_broker) {
      return Response.json({ skipped: 'no assigned broker' });
    }

    await base44.asServiceRole.integrations.Core.SendEmail({
      to: customer.assigned_broker,
      subject: `Neues Dokument von ${doc.customer_name || 'Kunde'}`,
      body: `
Guten Tag,

Ihr Kunde ${doc.customer_name || doc.customer_id} hat ein neues Dokument hochgeladen:

📄 Dokument: ${doc.name}
📂 Kategorie: ${doc.category || '–'}
📅 Datum: ${new Date().toLocaleDateString('de-CH')}

Bitte melden Sie sich in Ihrem BrokerCRM an, um das Dokument zu überprüfen.

Mit freundlichen Grüssen
BrokerCRM
      `.trim(),
    });

    // Log notification
    await base44.asServiceRole.entities.Notification.create({
      type: 'new_document',
      recipient_email: customer.assigned_broker,
      recipient_name: customer.assigned_broker,
      subject: `Neues Dokument von ${doc.customer_name || 'Kunde'}`,
      body: `Dokument "${doc.name}" hochgeladen`,
      reference_id: doc.id,
      reference_type: 'document',
      sent_by: 'system',
      status: 'sent',
    });

    return Response.json({ success: true, notified: customer.assigned_broker });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});