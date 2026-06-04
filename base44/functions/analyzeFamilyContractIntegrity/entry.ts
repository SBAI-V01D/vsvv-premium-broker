import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    
    if (!user || user.role !== 'admin') {
      return Response.json({ error: 'Nur für Admins' }, { status: 403 });
    }

    // 1. Alle Familienmitglieder laden
    const familyMembers = await base44.asServiceRole.entities.Customer.filter({ is_family_member: true });
    console.log(`[INTEGRITY_CHECK] Gefunden: ${familyMembers.length} Familienmitglieder`);

    const issues = [];
    const fixes = [];

    for (const member of familyMembers) {
      // 2. Alle Verträge des Familienmitglieds prüfen
      const memberContracts = await base44.asServiceRole.entities.Contract.filter({ customer_id: member.id });
      
      for (const contract of memberContracts) {
        // Prüfen ob is_family_member korrekt gesetzt ist
        if (contract.is_family_member !== true || contract.primary_customer_id !== member.primary_customer_id) {
          issues.push({
            contract_id: contract.id,
            customer_id: member.id,
            customer_name: `${member.first_name} ${member.last_name}`,
            current_is_family_member: contract.is_family_member,
            current_primary_customer_id: contract.primary_customer_id,
            expected_primary_customer_id: member.primary_customer_id,
            insurer: contract.insurer,
            policy_number: contract.policy_number
          });

          fixes.push({
            contract_id: contract.id,
            updates: {
              is_family_member: true,
              primary_customer_id: member.primary_customer_id
            }
          });
        }
      }
    }

    // 3. Zusätzliche Prüfung: Verträge mit primary_customer_id aber is_family_member=false
    const allContracts = await base44.asServiceRole.entities.Contract.list('-created_date', 1000);
    const orphanContracts = allContracts.filter(c => 
      c.primary_customer_id && 
      !c.is_family_member && 
      c.customer_id !== c.primary_customer_id
    );

    orphanContracts.forEach(c => {
      if (!issues.find(i => i.contract_id === c.id)) {
        issues.push({
          contract_id: c.id,
          customer_id: c.customer_id,
          issue_type: 'orphan_primary_reference',
          current_is_family_member: c.is_family_member,
          current_primary_customer_id: c.primary_customer_id
        });
      }
    });

    return Response.json({
      summary: {
        total_family_members: familyMembers.length,
        total_issues: issues.length,
        total_fixes_needed: fixes.length,
        orphan_contracts: orphanContracts.length
      },
      issues,
      fixes,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('[INTEGRITY_CHECK] Error:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});