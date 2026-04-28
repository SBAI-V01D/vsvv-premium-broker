import { base44 } from '@/api/base44Client';

/**
 * Send an email notification and log it to the Notification entity.
 */
export async function sendNotification({ type, recipientEmail, recipientName, subject, body, referenceId, referenceType, sentBy }) {
  await base44.integrations.Core.SendEmail({
    to: recipientEmail,
    subject,
    body,
  });

  await base44.entities.Notification.create({
    type,
    recipient_email: recipientEmail,
    recipient_name: recipientName || '',
    subject,
    body,
    reference_id: referenceId || '',
    reference_type: referenceType || '',
    sent_by: sentBy || '',
    status: 'sent',
  });
}

export function claimStatusEmailBody({ customerName, claimTitle, newStatus, brokerNotes, claimNumber }) {
  const statusLabels = {
    in_pruefung: 'In Prüfung',
    genehmigt: 'Genehmigt ✅',
    abgelehnt: 'Abgelehnt ❌',
    ausbezahlt: 'Ausbezahlt 💶',
    eingereicht: 'Eingereicht',
  };
  return `Guten Tag ${customerName},

Ihr Schadenfall "${claimTitle}" (${claimNumber || 'ohne Nummer'}) wurde aktualisiert.

Neuer Status: ${statusLabels[newStatus] || newStatus}

${brokerNotes ? `Nachricht Ihres Brokers:\n${brokerNotes}\n` : ''}
Sie können den aktuellen Stand jederzeit in Ihrem Kundenportal einsehen.

Mit freundlichen Grüssen
Ihr Versicherungsbroker`;
}

export function contractExpiryEmailBody({ customerName, insuranceType, provider, endDate }) {
  return `Guten Tag ${customerName},

Wir möchten Sie darauf hinweisen, dass Ihr Versicherungsvertrag bald ausläuft:

Versicherungsart: ${insuranceType}
Anbieter: ${provider}
Vertragsende: ${endDate}

Bitte kontaktieren Sie uns, falls Sie den Vertrag erneuern oder anpassen möchten.

Mit freundlichen Grüssen
Ihr Versicherungsbroker`;
}

export function newDocumentEmailBody({ customerName, insuranceType, provider }) {
  return `Guten Tag ${customerName},

Ein neues Dokument wurde in Ihrem Kundenportal hinterlegt:

Versicherungsart: ${insuranceType}
Anbieter: ${provider}

Sie können das Dokument jederzeit in Ihrem Kundenportal herunterladen.

Mit freundlichen Grüssen
Ihr Versicherungsbroker`;
}