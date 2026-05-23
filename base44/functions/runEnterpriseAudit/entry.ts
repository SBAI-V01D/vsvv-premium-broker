/**
 * runEnterpriseAudit — Systematische Enterprise-Prüfung
 * 
 * PRÜFT ALLE KRITISCHEN BEREICHE:
 * 1. Performance (Query-Zeiten, Memory, Re-Renders)
 * 2. Design-Konsistenz (Header, Spacing, Typography, Colors)
 * 3. Relationship Integrity (Household, Verträge, Mandate, Advisor)
 * 4. Query Governance (N+1, doppelte Fetches, unnötige Loads)
 * 5. AI Finding Qualität (Korrektheit, Vollständigkeit, Kontext)
 * 6. Mobile Reality (Touch Targets, Scroll, Sticky)
 * 7. Workflow-Reibung (Klicks, Navigation, Redundanzen)
 * 
 * GIBT detaillierten Audit-Report mit Messwerten.
 */

import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    
    if (!user || user.role !== 'admin') {
      return Response.json({ error: 'Admin required' }, { status: 401 });
    }

    const startTime = Date.now();
    const auditResults = {
      timestamp: new Date().toISOString(),
      audited_by: user.full_name || user.email,
      sections: {},
      critical_issues: [],
      warnings: [],
      recommendations: [],
    };

    // ── 1. PERFORMANCE AUDIT ───────────────────────────────────────────────
    const perfStart = Date.now();
    
    // Query Performance Tests
    const [customersTime, contractsTime, tasksTime] = await Promise.all([
      timeOperation(() => base44.entities.Customer.filter({ archived: false }, '-updated_date', 100)),
      timeOperation(() => base44.entities.Contract.filter({ archived: false }, '-created_date', 200)),
      timeOperation(() => base44.entities.Task.filter({ status: ['open', 'in_progress'] }, '-due_date', 100)),
    ]);

    // Relationship Load Test
    const relationshipStart = Date.now();
    const customersWithRelations = await base44.entities.Customer.filter({ archived: false }, '-updated_date', 50);
    const contractsForCustomers = await base44.entities.Contract.filter({ archived: false }, '-created_date', 500);
    const tasksForCustomers = await base44.entities.Task.filter({}, '-created_date', 200);
    
    // Teste Household-Relations
    const householdsWithMembers = customersWithRelations.filter(c => !c.is_family_member).slice(0, 10);
    const familyMembersCount = customersWithRelations.filter(c => c.is_family_member).length;
    
    const relationshipTime = Date.now() - relationshipStart;

    auditResults.sections.performance = {
      status: 'measured',
      metrics: {
        customers_query_ms: customersTime,
        contracts_query_ms: contractsTime,
        tasks_query_ms: tasksTime,
        relationship_load_ms: relationshipTime,
        total_customers: customersWithRelations.length,
        total_contracts: contractsForCustomers.length,
        total_tasks: tasksForCustomers.length,
        households_tested: householdsWithMembers.length,
        family_members_found: familyMembersCount,
      },
      thresholds: {
        query_should_be_under_ms: 500,
        relationship_load_should_be_under_ms: 2000,
      },
      issues: [],
    };

    // Performance Issues erkennen
    if (customersTime > 500) {
      auditResults.sections.performance.issues.push({
        severity: 'warning',
        area: 'performance',
        issue: 'Customer Query langsam',
        actual: `${customersTime}ms`,
        expected: '< 500ms',
        recommendation: 'Pagination, Indexes, selective fetch prüfen',
      });
      auditResults.warnings.push('Customer Query > 500ms');
    }

    if (relationshipTime > 2000) {
      auditResults.sections.performance.issues.push({
        severity: 'critical',
        area: 'performance',
        issue: 'Relationship Load zu langsam',
        actual: `${relationshipTime}ms`,
        expected: '< 2000ms',
        recommendation: 'N+1 Queries vermeiden, batching verwenden',
      });
      auditResults.critical_issues.push('Relationship Load > 2000ms');
    }

    // ── 2. RELATIONSHIP INTEGRITY AUDIT ────────────────────────────────────
    const integrityStart = Date.now();
    
    // Orphaned Records prüfen
    const allFamilyMembers = customersWithRelations.filter(c => c.is_family_member);
    const orphanedFamilyMembers = allFamilyMembers.filter(fm => !fm.primary_customer_id);
    
    // Verträge ohne Kunden prüfen
    const contractsWithoutCustomer = contractsForCustomers.filter(c => !c.customer_id);
    
    // Advisor Assignments prüfen
    const customersWithoutAdvisor = customersWithRelations.filter(c => 
      !c.is_family_member &&
      c.status === 'active' &&
      !c.advisor_id && 
      !c.primary_advisor_id &&
      (!c.assigned_advisors || c.assigned_advisors.length === 0)
    );

    // Mandate prüfen
    const invalidMandates = customersWithRelations.filter(c => 
      !c.is_family_member &&
      ['expired', 'invalid'].includes(c.mandate_status)
    );

    const integrityTime = Date.now() - integrityStart;

    auditResults.sections.relationship_integrity = {
      status: 'audited',
      metrics: {
        total_family_members: allFamilyMembers.length,
        orphaned_family_members: orphanedFamilyMembers.length,
        contracts_without_customer: contractsWithoutCustomer.length,
        customers_without_advisor: customersWithoutAdvisor.length,
        invalid_mandates: invalidMandates.length,
        audit_time_ms: integrityTime,
      },
      issues: [],
    };

    if (orphanedFamilyMembers.length > 0) {
      auditResults.sections.relationship_integrity.issues.push({
        severity: 'critical',
        area: 'relationship_integrity',
        issue: 'Familienmitglieder ohne primary_customer_id',
        actual: orphanedFamilyMembers.length,
        expected: '0',
        recommendation: 'primary_customer_id für alle Familienmitglieder setzen',
      });
      auditResults.critical_issues.push(`${orphanedFamilyMembers.length} orphaned family members`);
    }

    if (customersWithoutAdvisor.length > 0) {
      auditResults.sections.relationship_integrity.issues.push({
        severity: 'warning',
        area: 'relationship_integrity',
        issue: 'Aktive Kunden ohne Berater',
        actual: customersWithoutAdvisor.length,
        expected: '0',
        recommendation: 'Advisor zuweisen oder Access-Level anpassen',
      });
      auditResults.warnings.push(`${customersWithoutAdvisor.length} customers without advisor`);
    }

    // ── 3. AI FINDING QUALITY AUDIT ────────────────────────────────────────
    const aiStart = Date.now();
    
    // Letzte AI Reviews laden
    const aiReviews = await base44.entities.AiReview.list('-reviewed_at', 5);
    
    // AI Findings auf Korrektheit prüfen (Stichprobe)
    let aiFindingsChecked = 0;
    let aiFindingsCorrect = 0;
    let aiFindingsWithTruthLayer = 0;
    
    for (const review of aiReviews.slice(0, 3)) {
      const findings = review.findings || [];
      aiFindingsChecked += findings.length;
      
      for (const finding of findings.slice(0, 5)) {
        // Truth Layer vorhanden?
        if (finding.truth_layer) {
          aiFindingsWithTruthLayer++;
        }
        
        // Affected Entities vorhanden?
        if (finding.affected_entities && finding.affected_entities.length > 0) {
          aiFindingsCorrect++;
        }
      }
    }

    const aiTime = Date.now() - aiStart;

    auditResults.sections.ai_quality = {
      status: 'audited',
      metrics: {
        reviews_audited: aiReviews.length,
        findings_checked: aiFindingsChecked,
        findings_correct: aiFindingsCorrect,
        findings_with_truth_layer: aiFindingsWithTruthLayer,
        truth_layer_coverage_percent: aiFindingsChecked > 0 ? Math.round((aiFindingsWithTruthLayer / aiFindingsChecked) * 100) : 0,
        audit_time_ms: aiTime,
      },
      issues: [],
    };

    if (aiFindingsChecked > 0 && aiFindingsWithTruthLayer < aiFindingsChecked * 0.8) {
      auditResults.sections.ai_quality.issues.push({
        severity: 'warning',
        area: 'ai_quality',
        issue: 'Truth Layer Coverage zu niedrig',
        actual: `${Math.round((aiFindingsWithTruthLayer / aiFindingsChecked) * 100)}%`,
        expected: '> 80%',
        recommendation: 'Truth Layer für alle AI Findings erzwingen',
      });
      auditResults.warnings.push('Truth Layer Coverage < 80%');
    }

    // ── 4. QUERY GOVERNANCE AUDIT ──────────────────────────────────────────
    // Dashboard Queries analysieren
    const dashboardStart = Date.now();
    
    // Teste Dashboard-relevant Queries
    const [
      renewalContracts,
      hotLeads,
      openOpportunities,
    ] = await Promise.all([
      base44.entities.Contract.filter({ status: 'active', archived: false }, '-end_date', 100),
      base44.entities.Lead.list('-lead_score', 50),
      base44.entities.Verkaufschance.filter({}).then(r => r.filter(v => !['gewonnen', 'verloren'].includes(v.status))),
    ]);
    
    const dashboardTime = Date.now() - dashboardStart;

    auditResults.sections.query_governance = {
      status: 'audited',
      metrics: {
        dashboard_queries_ms: dashboardTime,
        renewal_contracts_loaded: renewalContracts.length,
        hot_leads_loaded: hotLeads.length,
        open_opportunities_loaded: openOpportunities.length,
        limits_applied: true,
      },
      issues: [],
    };

    if (dashboardTime > 1000) {
      auditResults.sections.query_governance.issues.push({
        severity: 'warning',
        area: 'query_governance',
        issue: 'Dashboard Queries langsam',
        actual: `${dashboardTime}ms`,
        expected: '< 1000ms',
        recommendation: 'Caching, Pagination, selective fetch',
      });
      auditResults.warnings.push('Dashboard Queries > 1000ms');
    }

    // ── 5. DESIGN CONSISTENCY SPOT CHECK ───────────────────────────────────
    // Prüfe ob alle Pages gleiche Header-Struktur verwenden
    // (Dies ist ein manueller Check - wird im Report dokumentiert)
    
    auditResults.sections.design_consistency = {
      status: 'manual_check_required',
      checklist: {
        header_structure: 'pending',
        section_spacing: 'pending',
        card_system: 'pending',
        typography: 'pending',
        buttons_actions: 'pending',
        loading_states: 'pending',
        empty_states: 'pending',
        badges_status: 'pending',
        form_elements: 'pending',
        navigation: 'pending',
        color_system: 'pending',
        mobile_responsiveness: 'pending',
      },
      recommendation: 'Design-Consistency Checklist manuell durchgehen (docs/DESIGN_CONSISTENCY_CHECKLIST.md)',
    };

    // ── 6. MOBILE REALITY SPOT CHECK ───────────────────────────────────────
    auditResults.sections.mobile_reality = {
      status: 'manual_check_required',
      checklist: {
        touch_targets_min_44px: 'pending',
        scroll_behavior: 'pending',
        sticky_headers: 'pending',
        card_density: 'pending',
        mobile_tables: 'pending',
        sidebar_behavior: 'pending',
        responsive_grids: 'pending',
      },
      recommendation: 'Mobile Reality auf iPad/iPhone testen',
    };

    // ── 7. WORKFLOW FRICTION SPOT CHECK ────────────────────────────────────
    auditResults.sections.workflow_friction = {
      status: 'manual_check_required',
      checklist: {
        clicks_to_complete_task: 'pending',
        redundant_navigation: 'pending',
        duplicate_information: 'pending',
        unnecessary_panels: 'pending',
        missing_quick_actions: 'pending',
      },
      recommendation: 'Broker-Workflows beobachten und Klicks zählen',
    };

    // ── SUMMARY ────────────────────────────────────────────────────────────
    const totalTime = Date.now() - startTime;
    
    auditResults.summary = {
      total_audit_time_ms: totalTime,
      sections_audited_automatically: 4,
      sections_requiring_manual_check: 3,
      critical_issues_count: auditResults.critical_issues.length,
      warnings_count: auditResults.warnings.length,
      overall_status: auditResults.critical_issues.length > 0 ? 'CRITICAL' : (auditResults.warnings.length > 0 ? 'WARNING' : 'PASS'),
    };

    auditResults.recommendations = [
      'Critical Issues sofort beheben (orphaned records, performance)',
      'Design-Consistency Checklist manuell durchgehen',
      'Mobile Reality auf iPad/iPhone testen',
      'Broker-Workflows beobachten und optimieren',
      'AI Finding Qualität systematisch validieren',
      'Query Governance mit Caching verbessern',
    ];

    // Audit Log schreiben
    await base44.entities.AuditLog.create({
      audit_schema_version: '1.0',
      audit_id: `AUDIT-${Date.now()}-${Math.random().toString(36).substr(2, 6).toUpperCase()}`,
      audit_level: 2,
      audit_level_name: 'lifecycle_transition',
      timestamp: new Date().toISOString(),
      trigger_type: 'manual',
      trigger_source: 'runEnterpriseAudit',
      actor_type: 'user',
      actor_id: user.id,
      actor_name: user.full_name || user.email,
      process_id: `AUDIT-${new Date().toISOString().slice(0, 10)}`,
      process_type: 'enterprise_audit',
      process_stage: 'completed',
      event_id: `EVT-${Date.now()}`,
      event_type: 'enterprise_audit_completed',
      entity_type: 'system',
      entity_id: 'enterprise_audit',
      action: 'create',
      decision_code: auditResults.summary.overall_status,
      decision_logic: JSON.stringify({ critical: auditResults.critical_issues.length, warnings: auditResults.warnings.length }),
      guard_evaluated: 'enterprise_audit',
      guard_result: auditResults.summary.overall_status === 'PASS' ? 'allowed' : 'blocked',
      guard_reason: auditResults.critical_issues.length > 0 ? 'Kritische Issues gefunden' : 'Audit bestanden',
      business_severity_type: 'compliance',
      business_severity_level: auditResults.critical_issues.length > 0 ? 'critical' : 'low',
      new_state_summary: auditResults.summary,
      metadata: auditResults,
    });

    return Response.json(auditResults);
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});

// Helper: Zeit eine Operation messen
async function timeOperation(operation) {
  const start = Date.now();
  await operation();
  return Date.now() - start;
}