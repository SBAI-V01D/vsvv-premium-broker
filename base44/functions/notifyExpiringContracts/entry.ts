import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);

    // Get all contracts
    const contracts = await base44.asServiceRole.entities.Contract.list();
    
    // Get all customers for lookup
    const customers = await base44.asServiceRole.entities.Customer.list();
    const customerMap = Object.fromEntries(customers.map(c => [c.id, c]));

    // Get sent notifications to avoid duplicates
    const sentNotifications = await base44.asServiceRole.entities.Notification.filter({
      type: 'contract_expiry'
    });
    const sentContractIds = new Set(sentNotifications.map(n => n.reference_id));

    const today = new Date();
    const threeMonthsFromNow = new Date(today.getTime() + 90 * 24 * 60 * 60 * 1000);
    const ninetyDaysFromNow = new Date(today.getTime() + 90 * 24 * 60 * 60 * 1000);

    let sentCount = 0;
    let failedCount = 0;

    // Filter contracts expiring in next 90 days
    const expiringContracts = contracts.filter(c => {
      if (!c.end_date || c.status === 'abgelaufen' || c.status === 'gekündigt') return false;
      const endDate = new Date(c.end_date);
      return endDate > today && endDate <= ninetyDaysFromNow;
    });

    for (const contract of expiringContracts) {
      // Skip if already notified
      if (sentContractIds.has(contract.id)) continue;

      const customer = customerMap[contract.customer_id];
      if (!customer || !customer.email) continue;

      const daysLeft = Math.ceil((new Date(contract.end_date) - today) / (1000 * 60 * 60 * 24));
      
      try {
        // Send email
        await base44.integrations.Core.SendEmail({
          to: customer.email,
          subject: `Wichtig: Versicherungsvertrag läuft bald ab (${daysLeft} Tage)`,
          body: `Liebe/r ${customer.first_name} ${customer.last_name},

Ihre ${contract.insurance_type}-Versicherung bei ${contract.provider} läuft am ${new Date(contract.end_date).toLocaleDateString('de-CH')} ab (in ${daysLeft} Tagen).

Wenn Sie diesen Versicherungsschutz beibehalten möchten, kontaktieren Sie uns bitte umgehend für eine Erneuerung.

Versicherungsart: ${contract.insurance_type}
Versicherer: ${contract.provider}
Policennummer: ${contract.policy_number || '–'}
Vertragslaufzeit: ${new Date(contract.start_date).toLocaleDateString('de-CH')} bis ${new Date(contract.end_date).toLocaleDateString('de-CH')}

Beste Grüße,
Ihr Versicherungsmakler`
        });

        // Log notification
        await base44.asServiceRole.entities.Notification.create({
          type: 'contract_expiry',
          recipient_email: customer.email,
          recipient_name: `${customer.first_name} ${customer.last_name}`,
          subject: `Versicherung läuft ab: ${contract.insurance_type}`,
          body: `Automatische Benachrichtigung für ${contract.insurance_type} bei ${contract.provider} (läuft in ${daysLeft} Tagen ab)`,
          reference_id: contract.id,
          reference_type: 'contract',
          sent_by: 'system',
          status: 'sent'
        });

        sentCount++;
      } catch (error) {
        failedCount++;
        console.error(`Failed to notify for contract ${contract.id}:`, error.message);
      }
    }

    return Response.json({
      success: true,
      message: `Benachrichtigungen gesendet: ${sentCount} erfolgreich, ${failedCount} fehlgeschlagen`,
      sentCount,
      failedCount,
      checkedContracts: expiringContracts.length
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});