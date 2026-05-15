import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const payload = await req.json();
    const { contract_id, premium_yearly, commission_percentage, advisor_id, organization_id } = payload;

    if (!contract_id || !premium_yearly || !commission_percentage || !advisor_id || !organization_id) {
      return Response.json({ error: 'Alle Parameter erforderlich' }, { status: 400 });
    }

    // Fetch contract and advisor in parallel
    const [contract, advisor] = await Promise.all([
      base44.entities.Contract.get(contract_id),
      base44.entities.Advisor.get(advisor_id),
    ]);

    if (!contract) return Response.json({ error: `Contract ${contract_id} nicht gefunden` }, { status: 404 });
    if (!advisor) return Response.json({ error: `Advisor ${advisor_id} nicht gefunden` }, { status: 404 });

    // Idempotency: check if CommissionEntry already exists for this contract
    const existing = await base44.entities.CommissionEntry.filter({ policy_id: contract_id });
    const activeEntry = existing.find(e => !e.is_storno && e.status !== 'cancelled');
    if (activeEntry) {
      console.log(`[calculateCommissionAuto] Commission already exists for contract ${contract_id}: ${activeEntry.id}`);
      return Response.json({
        success: false,
        message: 'CommissionEntry bereits vorhanden',
        commission_entry_id: activeEntry.id,
      });
    }

    const commissionAmount = Math.round((premium_yearly * commission_percentage) / 100 * 100) / 100;

    console.log(`[calculateCommissionAuto] contract=${contract_id} premium=${premium_yearly} rate=${commission_percentage}% → commission=${commissionAmount}`);

    // Fetch teamlead name if applicable
    let teamleadName = null;
    if (advisor.teamlead_id) {
      try {
        const teamlead = await base44.entities.Advisor.get(advisor.teamlead_id);
        if (teamlead) teamleadName = `${teamlead.firstname} ${teamlead.lastname}`;
      } catch {
        teamleadName = null;
      }
    }

    // STEP 1: CommissionEntry
    const commissionEntry = await base44.entities.CommissionEntry.create({
      policy_id: contract_id,
      policy_number: contract.policy_number || 'N/A',
      advisor_id,
      advisor_name: `${advisor.firstname} ${advisor.lastname}`,
      organization_id,
      customer_id: contract.customer_id,
      customer_name: contract.customer_name,
      insurer: contract.insurer,
      product_category: contract.sparte || contract.insurance_type,
      premium_yearly,
      commission_percentage,
      commission_amount: commissionAmount,
      status: 'pending',
      entry_date: new Date().toISOString().split('T')[0],
      notes: `Auto-berechnet für ${contract.customer_name}`,
    });

    console.log(`[calculateCommissionAuto] CommissionEntry created: ${commissionEntry.id}`);

    // STEP 2: CommissionSplit (70/30)
    const advisorShare = Math.round(commissionAmount * 70) / 100;
    const teamleadShare = Math.round(commissionAmount * 30) / 100;

    const split = await base44.entities.CommissionSplit.create({
      commission_entry_id: commissionEntry.id,
      advisor_id,
      advisor_name: `${advisor.firstname} ${advisor.lastname}`,
      teamlead_id: advisor.teamlead_id || null,
      teamlead_name: teamleadName,
      organization_id,
      advisor_share_percent: 70,
      advisor_share_amount: advisorShare,
      teamlead_share_percent: 30,
      teamlead_share_amount: teamleadShare,
      total_amount: commissionAmount,
      status: 'pending',
    });

    // STEP 3: AccountingEntries in parallel
    const accountingEntries = [
      base44.entities.AccountingEntry.create({
        entry_date: new Date().toISOString().split('T')[0],
        entry_type: 'commission',
        amount: advisorShare,
        advisor_id,
        advisor_name: `${advisor.firstname} ${advisor.lastname}`,
        organization_id,
        policy_id: contract_id,
        policy_number: contract.policy_number,
        insurer: contract.insurer,
        customer_id: contract.customer_id,
        customer_name: contract.customer_name,
        status: 'pending',
        reference_type: 'commission_split',
        reference_id: split.id,
        notes: `Provision Advisor aus ${contract.policy_number}`,
      }),
    ];

    if (advisor.teamlead_id && teamleadName) {
      accountingEntries.push(base44.entities.AccountingEntry.create({
        entry_date: new Date().toISOString().split('T')[0],
        entry_type: 'commission',
        amount: teamleadShare,
        advisor_id: advisor.teamlead_id,
        advisor_name: teamleadName,
        organization_id,
        policy_id: contract_id,
        policy_number: contract.policy_number,
        insurer: contract.insurer,
        customer_id: contract.customer_id,
        customer_name: contract.customer_name,
        status: 'pending',
        reference_type: 'commission_split',
        reference_id: split.id,
        notes: `Provision Teamleiter aus ${contract.policy_number}`,
      }));
    }

    await Promise.all(accountingEntries);

    console.log(`[calculateCommissionAuto] ✅ AccountingEntries created`);

    return Response.json({
      success: true,
      commission_entry_id: commissionEntry.id,
      split_id: split.id,
      advisor_share: advisorShare,
      teamlead_share: teamleadShare,
      total_commission: commissionAmount,
    });
  } catch (error) {
    console.error(`[calculateCommissionAuto] ERROR: ${error.message}`);
    return Response.json({ error: error.message }, { status: 500 });
  }
});