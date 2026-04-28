import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Fetch contracts, commission rates, and existing commissions
    const contracts = await base44.asServiceRole.entities.Contract.list();
    const commissionRates = await base44.asServiceRole.entities.CommissionRate.filter({ is_active: true });
    const existingCommissions = await base44.asServiceRole.entities.Commission.list();

    // Map for quick lookup
    const ratesMap = commissionRates.reduce((acc, rate) => {
      const key = `${rate.provider}|${rate.insurance_type}`;
      acc[key] = rate.commission_percentage;
      return acc;
    }, {});

    const existingCommissionKeys = new Set(
      existingCommissions.map(c => `${c.contract_id}`)
    );

    // Calculate commissions for active contracts
    let created = 0;
    const errors = [];

    for (const contract of contracts) {
      if (contract.status !== 'aktiv' || !contract.premium_yearly) continue;
      
      // Skip if already has a commission
      if (existingCommissionKeys.has(contract.id)) continue;

      const rateKey = `${contract.provider}|${contract.insurance_type}`;
      const commissionPercentage = ratesMap[rateKey];

      if (!commissionPercentage) {
        errors.push(`Kein Satz für ${contract.provider}/${contract.insurance_type}`);
        continue;
      }

      const amount = Math.round((contract.premium_yearly * commissionPercentage / 100) * 100) / 100;

      try {
        await base44.asServiceRole.entities.Commission.create({
          contract_id: contract.id,
          customer_id: contract.customer_id,
          customer_name: contract.customer_name,
          broker_email: user.email,
          broker_name: user.full_name,
          type: 'wiederkehrend',
          amount,
          insurance_type: contract.insurance_type,
          provider: contract.provider,
          date: new Date().toISOString().split('T')[0],
          status: 'offen',
        });
        created++;
      } catch (err) {
        errors.push(`Fehler bei Vertrag ${contract.id}: ${err.message}`);
      }
    }

    return Response.json({
      success: true,
      created,
      errors: errors.length > 0 ? errors : null,
      message: `${created} Provisionen berechnet${errors.length > 0 ? ` (${errors.length} Fehler)` : ''}`,
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});