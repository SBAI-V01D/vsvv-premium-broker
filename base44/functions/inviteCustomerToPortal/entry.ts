import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user || user.role !== 'admin') {
      return Response.json({ error: 'Nur Admins können Benutzer einladen' }, { status: 403 });
    }

    const { customer_email, customer_name } = await req.json();
    if (!customer_email) {
      return Response.json({ error: 'E-Mail erforderlich' }, { status: 400 });
    }

    // Invite customer as user
    await base44.users.inviteUser(customer_email, 'user');

    // Send welcome email
    await base44.integrations.Core.SendEmail({
      to: customer_email,
      subject: 'Willkommen im Kundenportal',
      body: `Hallo ${customer_name || 'Kunde'},\n\nwir freuen uns, Sie ins Kundenportal einzuladen. Sie können dort Ihre Verträge, Schadensmeldungen und Dokumente einsehen.\n\nBitte folgen Sie dem Link in der Einladungs-E-Mail, um Ihren Zugang einzurichten.\n\nBest regards,\nIhren Versicherungsmakler`,
      from_name: 'Versicherungsmakler'
    });

    return Response.json({
      success: true,
      message: `Einladung an ${customer_email} versendet`
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});