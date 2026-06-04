import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    
    if (!user || user.role !== 'admin') {
      return Response.json({ error: 'Nur für Admins' }, { status: 403 });
    }

    const { dry_run = true, fix = false } = await req.json().catch(() => ({}));

    // 1. Alle Familienmitglieder laden
    const familyMembers = await base44.asServiceRole.entities.Customer.filter({ is_family_member: true });
    const primaryCustomers = await base44.asServiceRole.entities.Customer.filter({ is_family_member: false });
    
    const issues = [];
    const fixes = [];
    const stats = {
      total_households: 0,
      total_family_members: familyMembers.length,
      contracts_with_wrong_flag: 0,
      contracts_missing_primary_id: 0,
      orphan_contracts: 0
    };

    // 2. Pro Haushalt prüfen
    const householdMap = new Map();
    primaryCustomers.forEach(p => {
      householdMap.set(p.id, { primary: p, members: [], contracts: [] });
    });
    
    familyMembers.forEach(m => {
      if (!householdMap.has(m.primary_customer_id)) {
        householdMap.set(m.primary_customer_id, { primary: null, members: [], contracts: [] });
      }
      householdMap.get(m.primary_customer_id).members.push(m);
    });

    stats.total_households = householdMap.size;

    // 3. Alle Verträge laden und zuordnen
    for (const [primaryId, household] of householdMap) {
      const customerIds = [primaryId, ...household.members.map(m => m.id)];
      
      for (const cid of customerIds) {
        const contracts = await base44.asServiceRole.entities.Contract.filter({ customer_id: cid, archived: false });
        household.contracts.push(...contracts);
        
        for (const contract of contracts) {
          // Prüfen ob is_family_member korrekt gesetzt ist
          const isMember = household.members.find(m => m.id === cid);
          const shouldBeFamilyMember = !!isMember || cid !== primaryId;
          
          if (shouldBeFamilyMember && contract.is_family_member !== true) {
            stats.contracts_with_wrong_flag++;
            issues.push({
              type: 'wrong_family_flag',
              contract_id: contract.id,
              customer_id: cid,
              customer_name: isMember ? `${isMember.first_name} ${isMember.last_name}` : 'Unknown',
              current_is_family_member: contract.is_family_member,
              expected: true
            });
            
            if (fix) {
              fixes.push({
                type: 'fix_family_flag',
                contract_id: contract.id,
                updates: { is_family_member: true, primary_customer_id: primaryId }
              });
            }
          }
          
          // Prüfen ob primary_customer_id korrekt gesetzt ist
          if (shouldBeFamilyMember && contract.primary_customer_id !== primaryId) {
            stats.contracts_missing_primary_id++;
            issues.push({
              type: 'wrong_primary_id',
              contract_id: contract.id,
              customer_id: cid,
              current_primary_id: contract.primary_customer_id,
              expected_primary_id: primaryId
            });
            
            if (fix) {
              fixes.push({
                type: 'fix_primary_id',
                contract_id: contract.id,
                updates: { primary_customer_id: primaryId }
              });
            }
          }
        }
      }
    }

    // 4. Orphan contracts finden (Verträge mit primary_customer_id aber ohne Household-Zuordnung)
    const allContracts = await base44.asServiceRole.entities.Contract.list('-created_date', 2000);
    const allCustomerIds = new Set([...primaryCustomers.map(p => p.id), ...familyMembers.map(m => m.id)]);
    
    for (const contract of allContracts) {
      if (!allCustomerIds.has(contract.customer_id)) {
        stats.orphan_contracts++;
        issues.push({
          type: 'orphan_contract',
          contract_id: contract.id,
          customer_id: contract.customer_id,
          insurer: contract.insurer,
          policy_number: contract.policy_number
        });
      }
    }

    // 5. Wenn fix=true, Reparaturen durchführen
    if (fix && fixes.length > 0) {
      const repairResults = {
        success: 0,
        errors: 0,
        details: []
      };
      
      for (const fixItem of fixes) {
        try {
          await base44.asServiceRole.entities.Contract.update(fixItem.contract_id, fixItem.updates);
          
          // Audit-Log
          await base44.asServiceRole.entities.AuditLog.create({
            audit_schema_version: '1.0',
            audit_id: `AUD-${Date.now()}-${Math.random().toString(36).substr(2, 6).toUpperCase()}`,
            audit_level: 2,
            audit_level_name: 'lifecycle_transition',
            timestamp: new Date().toISOString(),
            trigger_type: 'manual',
            trigger_source: user.email,
            actor_type: 'user',
            actor_id: user.id,
            actor_name: user.full_name || user.email,
            process_id: `FAMILY-INTEGRITY-${Date.now()}`,
            process_type: 'family_data_integrity_repair',
            process_stage: 'contract_update',
            event_id: `EVT-${fixItem.contract_id}`,
            event_type: `contract_${fixItem.type}`,
            entity_type: 'contract',
            entity_id: fixItem.contract_id,
            action: 'update',
            decision_code: 'DATA_INTEGRITY_AUTO_FIX',
            decision_logic: 'Automatische Reparatur von Familien-Datenintegrität',
            new_state_summary: fixItem.updates,
            business_impact_description: 'Datenintegrität für Haushaltszuordnung korrigiert',
            metadata: { repaired_by: user.email, fix_type: fixItem.type }
          });
          
          repairResults.success++;
          repairResults.details.push({ contract_id: fixItem.contract_id, status: 'repaired' });
        } catch (error) {
          repairResults.errors++;
          repairResults.details.push({ contract_id: fixItem.contract_id, error: error.message });
        }
      }
      
      return Response.json({
        summary: {
          dry_run: false,
          fixes_applied: repairResults.success,
          errors: repairResults.errors,
          timestamp: new Date().toISOString()
        },
        stats,
        issues: issues.filter(i => !fixes.find(f => f.contract_id === i.contract_id)),
        repairs: repairResults
      });
    }

    return Response.json({
      summary: {
        dry_run,
        total_issues: issues.length,
        total_fixes_needed: fixes.length,
        timestamp: new Date().toISOString()
      },
      stats,
      issues,
      fixes: fix ? [] : fixes
    });
  } catch (error) {
    console.error('[FAMILY_INTEGRITY] Error:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});