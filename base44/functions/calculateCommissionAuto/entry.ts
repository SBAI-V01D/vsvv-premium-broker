import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

/**
 * PROVISIONSSYSTEM (Punkte 7–10)
 * 
 * Berechnet Commission für Policy + erstellt CommissionSplit (70/30) + bucht AccountingEntry
 * 
 * Triggert auf: Policy erstellt oder Prämie geändert
 */

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const payload = await req.json();
    const {
      contract_id,
      premium_yearly,
      commission_percentage,
      advisor_id,
      organization_id,
    } = payload;

    if (!contract_id || !premium_yearly || !commission_percentage || !advisor_id || !organization_id) {
      return Response.json(
        { error: 'Alle Parameter erforderlich' },
        { status: 400 }
      );
    }

    const contract = await base44.entities.Contract.get(contract_id);
    if (!contract) {
      throw new Error(`Contract ${contract_id} nicht gefunden`);
    }

    const advisor = await base44.entities.Advisor.get(advisor_id);
    if (!advisor) {
      throw new Error(`Advisor ${advisor_id} nicht gefunden`);
    }

    // ─── BERECHNUNG ───
    const commissioAmount = (premium_yearly * commission_percentage) / 100;

    console.log(
      `[calculateCommissionAuto] contract=${contract_id} premium=${premium_yearly} rate=${commission_percentage}% → commission=${commissioAmount}`
    );

    // ─── SCHRITT 1: CommissionEntry anlegen ───
    const commissionEntry = await base44.entities.CommissionEntry.create({
      policy_id: contract_id,
      policy_number: contract.policy_number || 'N/A',
      advisor_id,
      advisor_name: `${advisor.firstname} ${advisor.lastname}`,
      organization_id,
      organization_name: contract.organization_name || 'N/A',
      customer_id: contract.customer_id,
      customer_name: contract.customer_name,
      insurer: contract.insurer,
      product_category: contract.sparte || contract.insurance_type,
      premium_yearly,
      commission_percentage,
      commission_amount: commissioAmount,
      status: 'pending',
      entry_date: new Date().toISOString().split('T')[0],
      notes: `Auto-berechnet für ${contract.customer_name}`,
    });

    console.log(`[calculateCommissionAuto] CommissionEntry created: ${commissionEntry.id}`);

    // ─── SCHRITT 2: CommissionSplit (70/30 Advisor/Teamlead) ───
    const advisorShare = (commissioAmount * 70) / 100;
    const teamleadShare = (commissioAmount * 30) / 100;

    const split = await base44.entities.CommissionSplit.create({
      commission_entry_id: commissionEntry.id,
      advisor_id,
      advisor_name: `${advisor.firstname} ${advisor.lastname}`,
      teamlead_id: advisor.teamlead_id || null, // Teamleiter von Advisor, falls vorhanden
      teamlead_name: advisor.teamlead_id ? `TL-${advisor.teamlead_id}` : null, // Placeholder
      organization_id,
      advisor_share_percent: 70,
      advisor_share_amount: advisorShare,
      teamlead_share_percent: 30,
      teamlead_share_amount: teamleadShare,
      total_amount: commissioAmount,
      status: 'pending',
      created_date: new Date().toISOString(),
    });

    console.log(
      `[calculateCommissionAuto] CommissionSplit: Advisor ${advisorShare} | TL ${teamleadShare}`
    );

    // ─── SCHRITT 3: AccountingEntry buchen ───
    // Für Advisor
    await base44.entities.AccountingEntry.create({
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
    });

    // Für Teamleiter (falls vorhanden)
    if (advisor.teamlead_id) {
      await base44.entities.AccountingEntry.create({
        entry_date: new Date().toISOString().split('T')[0],
        entry_type: 'commission',
        amount: teamleadShare,
        advisor_id: advisor.teamlead_id,
        advisor_name: `TL-${advisor.teamlead_id}`,
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
      });
    }

    console.log(`[calculateCommissionAuto] AccountingEntries created`);

    // ─── SCHRITT 4: Bei Storno (optional später) ───
    // if (contract.status === 'cancelled') {
    //   create negative commission entries
    // }

    return Response.json({
      success: true,
      commission_entry_id: commissionEntry.id,
      split_id: split.id,
      advisor_share: advisorShare,
      teamlead_share: teamleadShare,
      total_commission: commissioAmount,
    });
  } catch (error) {
    console.error(`[calculateCommissionAuto] ERROR: ${error.message}`);
    return Response.json({ error: error.message }, { status: 500 });
  }
});