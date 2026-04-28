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

    // Send welcome email with password setup link
    const appUrl = Deno.env.get('APP_URL') || 'https://app.example.com';
    const setupLink = `${appUrl}/portal/setup?email=${encodeURIComponent(customer_email)}`;
    
    await base44.integrations.Core.SendEmail({
      to: customer_email,
      subject: 'Kundenportal-Zugang einrichten',
      body: `Hallo ${customer_name || 'Kunde'},

wir freuen uns, Sie ins Kundenportal einzuladen. Dort können Sie Ihre Verträge, Schadensmeldungen, Dokumente und mehr einsehen.

PASSWORT EINRICHTEN:
Bitte klicken Sie auf den Link unten, um Ihr Passwort zu setzen und auf das Portal zuzugreifen:

${setupLink}

Der Link ist 24 Stunden lang gültig.

PASSWORT ZURÜCKSETZEN:
Falls Sie Ihr Passwort vergessen haben, können Sie es jederzeit unter folgender Adresse zurücksetzen:
${appUrl}/portal/reset-password

FRAGEN?
Bei Fragen wenden Sie sich bitte an Ihren Versicherungsmakler.

Viele Grüße,
Ihr Versicherungsmakler-Team`,
      from_name: 'Kundenportal'
    });

    return Response.json({
      success: true,
      message: `Einladung an ${customer_email} versendet`
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});