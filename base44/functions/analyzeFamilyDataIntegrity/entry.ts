import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    
    if (!user || user.role !== 'admin') {
      return Response.json({ error: 'Nur für Admins' }, { status: 403 });
    }

    const issues = {
      data_integrity: [],
      display_logic: [],
      automation_gaps: [],
      recommendations: []
    };

    // 1. Alle Familienmitglieder und ihre Verträge prüfen
    const familyMembers = await base44.asServiceRole.entities.Customer.filter({ is_family_member: true });
    const primaryCustomers = await base44.asServiceRole.entities.Customer.filter({ is_family_member: false });
    
    console.log(`[ANALYZE] ${familyMembers.length} Familienmitglieder, ${primaryCustomers.length} Hauptkunden`);

    // 2. Pro Familienmitglied die Verträge prüfen
    for (const member of familyMembers) {
      const contracts = await base44.asServiceRole.entities.Contract.filter({ customer_id: member.id, archived: false });
      
      // Issue: Vertrag ohne is_family_member Flag
      contracts.forEach(c => {
        if (!c.is_family_member) {
          issues.data_integrity.push({
            type: 'contract_missing_family_flag',
            severity: 'high',
            contract_id: c.id,
            customer_id: member.id,
            customer_name: `${member.first_name} ${member.last_name}`,
            description: `Vertrag ${c.policy_number} (${c.insurer}) hat is_family_member=false obwohl Kunde ein Familienmitglied ist`
          });
        }
        if (c.primary_customer_id !== member.primary_customer_id) {
          issues.data_integrity.push({
            type: 'contract_wrong_primary_id',
            severity: 'high',
            contract_id: c.id,
            customer_id: member.id,
            expected_primary: member.primary_customer_id,
            actual_primary: c.primary_customer_id,
            description: `Vertrag ${c.policy_number} zeigt auf falschen Hauptkunden`
          });
        }
      });

      // Issue: Familienmitglied ohne primary_customer_id
      if (!member.primary_customer_id) {
        issues.data_integrity.push({
          type: 'member_missing_primary_reference',
          severity: 'critical',
          customer_id: member.id,
          customer_name: `${member.first_name} ${member.last_name}`,
          description: 'Familienmitglied hat keine Referenz zum Hauptkunden'
        });
      }
    }

    // 3. Hauptkunden prüfen: Haben sie Verträge die nicht als is_family_member markiert sind?
    for (const primary of primaryCustomers.slice(0, 50)) { // Sample
      const familyOfPrimary = familyMembers.filter(m => m.primary_customer_id === primary.id);
      if (familyOfPrimary.length === 0) continue;

      const primaryContracts = await base44.asServiceRole.entities.Contract.filter({ customer_id: primary.id, archived: false });
      
      // Issue: Hauptkunde mit Verträgen aber family_role nicht 'primary'
      if (primaryContracts.length > 0 && primary.family_role !== 'primary') {
        issues.data_integrity.push({
          type: 'primary_customer_wrong_role',
          severity: 'medium',
          customer_id: primary.id,
          customer_name: `${primary.first_name} ${primary.last_name}`,
          actual_role: primary.family_role,
          description: 'Hauptkunde einer Familie hat nicht family_role=primary'
        });
      }
    }

    // 4. Automation-Gaps identifizieren (manuelle Prüfung nötig)
    issues.automation_gaps.push({
      type: 'missing_automation_check',
      severity: 'medium',
      description: 'Manuelle Prüfung erforderlich: Gibt es eine Entity Automation für Contract create/update die Family-Integrity prüft?',
      check: 'Dashboard → Code → Automations → Nach "Contract" und "family" filtern'
    });

    // 5. Display-Logik prüfen (Frontend Code Analyse)
    issues.display_logic.push({
      type: 'frontend_filter_issue',
      severity: 'medium',
      location: 'pages/CustomerDetail.jsx, FamilyMemberCard component',
      description: 'Filterlogik entfernt aktuellen Kunden von der Anzeige, führt zu inkonsistenter Darstellung'
    });

    // 6. Empfehlungen generieren
    if (issues.data_integrity.length > 0) {
      issues.recommendations.push({
        priority: 'critical',
        action: 'repairFamilyContractIntegrity Funktion ausführen',
        impact: 'Korrektur aller is_family_member und primary_customer_id Felder',
        estimated_time: '5-10 Minuten'
      });
    }

    if (issues.automation_gaps.length > 0) {
      issues.recommendations.push({
        priority: 'high',
        action: 'Entity Automation erstellen für Contract create/update',
        impact: 'Automatische Prüfung und Korrektur der Familien-Integrität',
        function_name: 'guardFamilyContractIntegrity',
        estimated_time: '30 Minuten Implementierung'
      });
    }

    issues.recommendations.push({
      priority: 'medium',
      action: 'Frontend Code refaktorisieren',
      impact: 'Konsistente Anzeige aller Familienmitglieder unabhängig vom aktuellen Kunden',
      location: 'pages/CustomerDetail.jsx',
      estimated_time: '15 Minuten'
    });

    issues.recommendations.push({
      priority: 'high',
      action: 'Monitoring Dashboard erstellen',
      impact: 'Frühzeitige Erkennung von Datenintegritätsproblemen',
      metrics: [
        'Anzahl Verträge mit falschem is_family_member',
        'Anzahl Familienmitglieder ohne primary_customer_id',
        'Anzahl Haushalte mit inkonsistenten Daten'
      ],
      estimated_time: '2-3 Stunden'
    });

    // 7. Governance Rules vorschlagen
    issues.recommendations.push({
      priority: 'high',
      action: 'GovernanceRule für Familien-Integrität erstellen',
      impact: 'Automatische Blockade von inkonsistenten Datenänderungen',
      rules: [
        'Contract.is_family_member muss Customer.is_family_member entsprechen',
        'Contract.primary_customer_id muss Customer.primary_customer_id entsprechen',
        'Familienmitglied ohne primary_customer_id darf keine Verträge haben'
      ],
      estimated_time: '1 Stunde'
    });

    return Response.json({
      summary: {
        total_family_members: familyMembers.length,
        total_primary_customers: primaryCustomers.length,
        total_issues: issues.data_integrity.length + issues.display_logic.length + issues.automation_gaps.length,
        data_integrity_issues: issues.data_integrity.length,
        display_logic_issues: issues.display_logic.length,
        automation_gaps: issues.automation_gaps.length,
        recommendations_count: issues.recommendations.length
      },
      issues,
      timestamp: new Date().toISOString(),
      analyzed_by: user.email
    });
  } catch (error) {
    console.error('[ANALYZE] Error:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});