import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

/**
 * Automated daily Wiedervorlage reminder function.
 * Sends broker reminder emails for contracts expiring within 7, 30, or 60 days.
 * Intended to be called by a scheduled automation.
 */
Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);

    // This runs as a scheduled job – use service role
    const contracts = await base44.asServiceRole.entities.Contract.list();
    const customers = await base44.asServiceRole.entities.Customer.list();
    const sentNotifications = await base44.asServiceRole.entities.Notification.list('-created_date', 500);

    const today = new Date();
    const THRESHOLDS = [7, 30, 60]; // days before expiry to send reminders

    let sent = 0;
    const errors = [];

    for (const contract of contracts) {
      if (contract.status !== 'aktiv') continue;

      const datesToCheck = [];
      if (contract.end_date) datesToCheck.push({ date: contract.end_date, type: 'Vertragsverlängerung' });
      if (contract.cancellation_deadline) datesToCheck.push({ date: contract.cancellation_deadline, type: 'Kündigungsfrist' });

      for (const { date, type } of datesToCheck) {
        const daysLeft = Math.ceil((new Date(date) - today) / 86400000);
        if (!THRESHOLDS.includes(daysLeft)) continue;

        const customer = customers.find(c => c.id === contract.customer_id);
        const brokerEmail = customer?.assigned_broker || contract.assigned_broker;
        if (!brokerEmail) continue;

        // Avoid duplicate for same contract + type + threshold today
        const dedupeKey = `${contract.id}_${type}_${daysLeft}T`;
        const alreadySent = sentNotifications.some(n =>
          n.reference_id === contract.id &&
          n.subject?.includes(type) &&
          n.created_date &&
          new Date(n.created_date).toDateString() === today.toDateString()
        );
        if (alreadySent) continue;

        const body = `Guten Tag,

dies ist eine automatische Wiedervorlage-Erinnerung:

Kunde:            ${contract.customer_name}
Versicherungsart: ${contract.insurance_type}
Anbieter:         ${contract.provider}
${type === 'Kündigungsfrist' ? `Kündigungsfrist:  ${date}` : `Vertragsende:     ${date}`}
Noch ${daysLeft} Tag(e) verbleibend.

Bitte kontaktieren Sie den Kunden zeitnah.

Mit freundlichen Grüssen
BrokerCRM – Automatisches Wiedervorlage-System`;

        await base44.asServiceRole.integrations.Core.SendEmail({
          to: brokerEmail,
          subject: `⏰ Wiedervorlage (${daysLeft}T): ${type} – ${contract.customer_name} (${contract.insurance_type})`,
          body,
        });

        await base44.asServiceRole.entities.Notification.create({
          type: 'contract_expiry',
          recipient_email: brokerEmail,
          recipient_name: brokerEmail,
          subject: `⏰ Wiedervorlage (${daysLeft}T): ${type} – ${contract.customer_name} (${contract.insurance_type})`,
          body,
          reference_id: contract.id,
          reference_type: 'contract',
          status: 'sent',
        });

        sent++;
      }
    }

    return Response.json({ success: true, sent, message: `${sent} Wiedervorlage-Erinnerungen gesendet` });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});