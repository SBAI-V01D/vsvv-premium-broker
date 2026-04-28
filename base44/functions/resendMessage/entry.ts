import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

Deno.serve(async (req) => {
  const base44 = createClientFromRequest(req);
  const { to, name, subject, content } = await req.json();

  await base44.asServiceRole.integrations.Core.SendEmail({
    to,
    subject: subject || 'Nachricht von Ihrem Versicherungsbroker',
    body: `<p>Sehr geehrte/r ${name},</p><p>${content}</p><p>Freundliche Grüsse<br/>VSVV</p>`,
    from_name: 'VSVV Versicherungsbroker',
  });

  return Response.json({ success: true });
});