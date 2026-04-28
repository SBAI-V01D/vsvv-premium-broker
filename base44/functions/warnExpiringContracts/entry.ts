import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    // 3 months from today
    const in90Days = new Date(today);
    in90Days.setDate(in90Days.getDate() + 90);
    const todayStr = today.toISOString().split('T')[0];
    const in90Str = in90Days.toISOString().split('T')[0];

    const contracts = await base44.asServiceRole.entities.Contract.filter({ status: 'aktiv' });
    const customers = await base44.asServiceRole.entities.Customer.list();

    // Find contracts expiring in the next 90 days
    const expiring = contracts.filter(c =>
      c.end_date && c.end_date >= todayStr && c.end_date <= in90Str
    );

    if (expiring.length === 0) {
      return Response.json({ message: 'Keine ablaufenden Verträge gefunden.' });
    }

    // Group by assigned broker
    const byBroker = {};
    for (const contract of expiring) {
      const customer = customers.find(c => c.id === contract.customer_id);
      const brokerEmail = customer?.assigned_broker;
      if (!brokerEmail) continue;

      if (!byBroker[brokerEmail]) byBroker[brokerEmail] = [];
      byBroker[brokerEmail].push({ contract, customer });
    }

    const results = [];

    for (const [brokerEmail, items] of Object.entries(byBroker)) {
      const rows = items
        .sort((a, b) => a.contract.end_date.localeCompare(b.contract.end_date))
        .map(({ contract, customer }) => {
          const daysLeft = Math.ceil((new Date(contract.end_date) - today) / (1000 * 60 * 60 * 24));
          const urgencyColor = daysLeft <= 30 ? '#ef4444' : daysLeft <= 60 ? '#f59e0b' : '#3b82f6';
          return `
            <tr>
              <td style="padding:8px 12px;border-bottom:1px solid #e2e8f0">${customer?.first_name || ''} ${customer?.last_name || ''}</td>
              <td style="padding:8px 12px;border-bottom:1px solid #e2e8f0">${contract.insurance_type}</td>
              <td style="padding:8px 12px;border-bottom:1px solid #e2e8f0">${contract.provider}</td>
              <td style="padding:8px 12px;border-bottom:1px solid #e2e8f0">${contract.end_date}</td>
              <td style="padding:8px 12px;border-bottom:1px solid #e2e8f0;color:${urgencyColor};font-weight:bold">${daysLeft} Tage</td>
              <td style="padding:8px 12px;border-bottom:1px solid #e2e8f0">CHF ${contract.premium_yearly?.toLocaleString('de-CH') || '–'}</td>
            </tr>
          `;
        }).join('');

      const body = `
        <p>Guten Tag,</p>
        <p>folgende <strong>${items.length} Versicherungspolice(n)</strong> laufen innerhalb der nächsten 3 Monate ab:</p>
        <table style="width:100%;border-collapse:collapse;font-size:14px;margin:16px 0">
          <thead>
            <tr style="background:#f1f5f9">
              <th style="padding:8px 12px;text-align:left;border-bottom:2px solid #e2e8f0">Kunde</th>
              <th style="padding:8px 12px;text-align:left;border-bottom:2px solid #e2e8f0">Versicherungsart</th>
              <th style="padding:8px 12px;text-align:left;border-bottom:2px solid #e2e8f0">Gesellschaft</th>
              <th style="padding:8px 12px;text-align:left;border-bottom:2px solid #e2e8f0">Ablaufdatum</th>
              <th style="padding:8px 12px;text-align:left;border-bottom:2px solid #e2e8f0">Restlaufzeit</th>
              <th style="padding:8px 12px;text-align:left;border-bottom:2px solid #e2e8f0">Jahresprämie</th>
            </tr>
          </thead>
          <tbody>${rows}</tbody>
        </table>
        <p>Bitte nehmen Sie rechtzeitig Kontakt mit den betroffenen Kunden auf, um die Verträge zu erneuern.</p>
        <p>Ihr BrokerCRM</p>
      `;

      await base44.asServiceRole.integrations.Core.SendEmail({
        to: brokerEmail,
        subject: `⚠️ ${items.length} Police(n) laufen in den nächsten 3 Monaten ab`,
        body,
      });

      results.push({ broker: brokerEmail, contracts: items.length });
    }

    return Response.json({ success: true, results });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});