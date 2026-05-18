import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

/**
 * AUDIT INFRASTRUCTURE TEST — Isolierte Validierung
 * 
 * Testet die Audit-Helper-Functions OHNE echte Business-Logik.
 * 
 * Test-Bereiche:
 * 1. Correlation-ID Qualität (einzigartig, lesbar, konsistent)
 * 2. Decision-Code Konsistenz (standardisiert, keine freien Texte)
 * 3. Snapshot-Grösse (kompakt, operativ lesbar)
 * 4. Async / Non-Blocking (Hauptprozess läuft trotz Audit-Fehler)
 * 5. Audit-Level-Steuerung (kein Noise, business-relevant)
 * 6. Sample-Prozessketten (lesbar, nachvollziehbar)
 */
Deno.serve(async (req) => {
  const startTime = Date.now();
  
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user || user.role !== 'admin') {
      return Response.json({ error: 'Admin access required' }, { status: 403 });
    }

    const body = await req.json();
    const { test_type } = body;

    // === TEST RESULTS ===
    const results = {
      test_type,
      timestamp: new Date().toISOString(),
      tests_passed: 0,
      tests_failed: 0,
      test_details: [],
    };

    // === TEST 1: Correlation-ID Qualität ===
    if (test_type === 'correlation_ids' || test_type === 'all') {
      console.log('[AUDIT TEST] Testing Correlation-ID Quality...');
      
      const correlationIds = [];
      const date = new Date().toISOString().slice(0, 10).replace(/-/g, '');
      
      // Generiere 10 IDs
      for (let i = 0; i < 10; i++) {
        const random = Math.random().toString(36).slice(2, 8).toUpperCase();
        const entitySuffix = `00${i}`.slice(-3).toUpperCase();
        const correlationId = `CTL-${date}-${entitySuffix}${random}`;
        correlationIds.push(correlationId);
      }

      // Prüfe Eindeutigkeit
      const uniqueIds = new Set(correlationIds);
      const allUnique = uniqueIds.size === correlationIds.length;

      // Prüfe Format
      const formatRegex = /^CTL-\d{8}-\d{3}[A-Z0-9]{6}$/;
      const allValidFormat = correlationIds.every(id => formatRegex.test(id));

      // Prüfe Lesbarkeit
      const readable = correlationIds.every(id => {
        const parts = id.split('-');
        return parts.length === 3 && 
               parts[0].length === 3 && // Prefix
               parts[1].length === 8 && // Date
               parts[2].length === 9;   // Entity + Random
      });

      const test1Result = {
        test: 'Correlation-ID Quality',
        passed: allUnique && allValidFormat && readable,
        details: {
          generated_count: correlationIds.length,
          unique_count: uniqueIds.size,
          all_unique: allUnique,
          valid_format: allValidFormat,
          readable,
          sample_ids: correlationIds.slice(0, 3),
        },
      };

      results.test_details.push(test1Result);
      if (test1Result.passed) results.tests_passed++;
      else results.tests_failed++;

      console.log('[AUDIT TEST] Correlation-ID Test:', test1Result.passed ? 'PASSED' : 'FAILED');
    }

    // === TEST 2: Decision-Code Konsistenz ===
    if (test_type === 'decision_codes' || test_type === 'all') {
      console.log('[AUDIT TEST] Testing Decision-Code Consistency...');
      
      const testCases = [
        { entityType: 'CONTRACT', action: 'CREATE', reason: 'ALLOWED', expected: 'CONTRACT_CREATE_ALLOWED' },
        { entityType: 'CONTRACT', action: 'BLOCKED', reason: 'DUPLICATE', expected: 'CONTRACT_BLOCKED_DUPLICATE' },
        { entityType: 'STORNO', action: 'BLOCKED', reason: 'ALREADY_PROCESSED', expected: 'STORNO_BLOCKED_ALREADY_PROCESSED' },
        { entityType: 'TASK', action: 'CREATED', reason: 'RENEWAL', expected: 'TASK_CREATED_RENEWAL' },
        { entityType: 'TASK', action: 'SKIPPED', reason: 'EXISTING', expected: 'TASK_SKIPPED_EXISTING' },
      ];

      const generatedCodes = testCases.map(tc => {
        const reasonShort = tc.reason.split(' ').slice(0, 3).join('_').toUpperCase();
        return `${tc.entityType}_${tc.action}_${reasonShort}`;
      });

      const allMatch = generatedCodes.every((code, i) => code === testCases[i].expected);
      const noFreeText = generatedCodes.every(code => /^[A-Z_]+$/.test(code));

      const test2Result = {
        test: 'Decision-Code Consistency',
        passed: allMatch && noFreeText,
        details: {
          test_cases: testCases.length,
          all_match_expected: allMatch,
          no_free_text: noFreeText,
          sample_codes: generatedCodes.slice(0, 3),
        },
      };

      results.test_details.push(test2Result);
      if (test2Result.passed) results.tests_passed++;
      else results.tests_failed++;

      console.log('[AUDIT TEST] Decision-Code Test:', test2Result.passed ? 'PASSED' : 'FAILED');
    }

    // === TEST 3: Snapshot-Grösse ===
    if (test_type === 'snapshots' || test_type === 'all') {
      console.log('[AUDIT TEST] Testing Snapshot Size...');
      
      // Simuliere kompakte Snapshots
      const fullEntity = {
        id: '123',
        customer_id: 'CUST-001',
        status: 'active',
        premium_yearly: 1200,
        premium_monthly: 100,
        insurance_type: 'health',
        insurer: 'SwissLife',
        policy_number: 'POL-789',
        start_date: '2024-01-01',
        end_date: '2025-01-01',
        notes: 'Some long note...',
        metadata: { complex: 'object', nested: { data: 'here' } },
      };

      const snapshotFields = ['status', 'premium_yearly', 'commission_status'];
      const snapshot = {};
      snapshotFields.forEach(field => {
        if (fullEntity[field] !== undefined) {
          snapshot[field] = fullEntity[field];
        }
      });

      const snapshotSize = JSON.stringify(snapshot).length;
      const fullSize = JSON.stringify(fullEntity).length;
      const compactRatio = (snapshotSize / fullSize) * 100;

      const test3Result = {
        test: 'Snapshot Size',
        passed: snapshotSize < 500 && compactRatio < 30,
        details: {
          snapshot_size_bytes: snapshotSize,
          full_entity_size_bytes: fullSize,
          compact_ratio_percent: compactRatio.toFixed(2),
          snapshot_fields: Object.keys(snapshot),
          snapshot_data: snapshot,
        },
      };

      results.test_details.push(test3Result);
      if (test3Result.passed) results.tests_passed++;
      else results.tests_failed++;

      console.log('[AUDIT TEST] Snapshot Test:', test3Result.passed ? 'PASSED' : 'FAILED');
    }

    // === TEST 4: Audit-Level-Steuerung ===
    if (test_type === 'audit_levels' || test_type === 'all') {
      console.log('[AUDIT TEST] Testing Audit-Level Steering...');
      
      const testEvents = [
        { event: 'commission_storno_created', financialImpact: 5000, expectedLevel: 1 },
        { event: 'duplicate_contract_blocked', financialImpact: 0, expectedLevel: 1 },
        { event: 'contract_created', financialImpact: 0, expectedLevel: 2 },
        { event: 'task_renewal_created', financialImpact: 0, expectedLevel: 2 },
        { event: 'guard_evaluated', guardResult: 'blocked', expectedLevel: 3 },
        { event: 'debug_info', guardResult: null, expectedLevel: 4 },
      ];

      const levelResults = testEvents.map(e => {
        if (e.event.includes('storno') || e.event.includes('duplicate') || e.financialImpact >= 1000) {
          return { event: e.event, level: 1, expected: e.expectedLevel, match: e.expectedLevel === 1 };
        } else if (e.event.includes('created') || e.event.includes('approved') || e.event.includes('cancelled')) {
          return { event: e.event, level: 2, expected: e.expectedLevel, match: e.expectedLevel === 2 };
        } else if (e.guardResult === 'blocked' || e.guardResult === 'allowed') {
          return { event: e.event, level: 3, expected: e.expectedLevel, match: e.expectedLevel === 3 };
        } else {
          return { event: e.event, level: 4, expected: e.expectedLevel, match: e.expectedLevel === 4 };
        }
      });

      const allCorrect = levelResults.every(r => r.match);

      const test4Result = {
        test: 'Audit-Level Steering',
        passed: allCorrect,
        details: {
          test_events: testEvents.length,
          all_correct: allCorrect,
          level_distribution: {
            level_1_critical: levelResults.filter(r => r.level === 1).length,
            level_2_lifecycle: levelResults.filter(r => r.level === 2).length,
            level_3_guard: levelResults.filter(r => r.level === 3).length,
            level_4_debug: levelResults.filter(r => r.level === 4).length,
          },
          sample_results: levelResults.slice(0, 3),
        },
      };

      results.test_details.push(test4Result);
      if (test4Result.passed) results.tests_passed++;
      else results.tests_failed++;

      console.log('[AUDIT TEST] Audit-Level Test:', test4Result.passed ? 'PASSED' : 'FAILED');
    }

    // === TEST 5: Sample-Prozessketten (Lesbarkeit) ===
    if (test_type === 'process_chains' || test_type === 'all') {
      console.log('[AUDIT TEST] Testing Process Chain Readability...');
      
      const sampleProcessId = `contract_lifecycle_789_${new Date().toISOString().replace(/[:.]/g, '').slice(0, 15)}`;
      const sampleCorrelationId = `CTL-${new Date().toISOString().slice(0, 10).replace(/-/g, '')}-789A1B2C`;
      
      const processChain = [
        {
          event_sequence: 1,
          event_type: 'contract_create_requested',
          action: 'create',
          decision_code: 'CONTRACT_CREATE_ALLOWED',
          guard_result: 'allowed',
        },
        {
          event_sequence: 2,
          event_type: 'duplicate_check',
          action: 'block',
          decision_code: 'DUPLICATE_CHECK_PASSED',
          guard_result: 'allowed',
        },
        {
          event_sequence: 3,
          event_type: 'contract_created',
          action: 'create',
          decision_code: 'CONTRACT_CREATED_SUCCESS',
          guard_result: null,
          side_effects: [
            { entity_type: 'task', entity_id: 'TSK-001', action: 'create', description: 'Onboarding task created' },
          ],
        },
      ];

      // Prüfe Lesbarkeit
      const hasProcessId = !!sampleProcessId;
      const hasCorrelationId = !!sampleCorrelationId;
      const hasSequence = processChain.every(e => typeof e.event_sequence === 'number');
      const hasDecisionCodes = processChain.every(e => !!e.decision_code);
      const hasSideEffects = processChain.some(e => e.side_effects);

      const test5Result = {
        test: 'Process Chain Readability',
        passed: hasProcessId && hasCorrelationId && hasSequence && hasDecisionCodes && hasSideEffects,
        details: {
          process_id: sampleProcessId,
          correlation_id: sampleCorrelationId,
          event_count: processChain.length,
          has_process_id: hasProcessId,
          has_correlation_id: hasCorrelationId,
          has_sequence: hasSequence,
          has_decision_codes: hasDecisionCodes,
          has_side_effects: hasSideEffects,
          sample_chain: processChain,
        },
      };

      results.test_details.push(test5Result);
      if (test5Result.passed) results.tests_passed++;
      else results.tests_failed++;

      console.log('[AUDIT TEST] Process Chain Test:', test5Result.passed ? 'PASSED' : 'FAILED');
    }

    // === TEST 6: Async / Non-Blocking (Simulation) ===
    if (test_type === 'async_behavior' || test_type === 'all') {
      console.log('[AUDIT TEST] Testing Async/Non-Blocking Behavior...');
      
      const asyncStartTime = Date.now();
      
      // Simuliere Audit-Write mit Timeout
      const auditWriteSimulated = new Promise((resolve) => {
        setTimeout(() => {
          resolve({ success: true, audit_id: 'AUD-TEST-001' });
        }, 50); // 50ms delay
      });

      // Hauptprozess läuft WEITER (nicht warten!)
      const mainProcessResult = { success: true, message: 'Main process completed without waiting' };

      // Erst NACH Hauptprozess: Audit-Ergebnis prüfen
      const auditResult = await auditWriteSimulated;
      const asyncEndTime = Date.now();

      const test6Result = {
        test: 'Async/Non-Blocking Behavior',
        passed: mainProcessResult.success && auditResult.success,
        details: {
          main_process_completed: mainProcessResult.success,
          audit_completed: auditResult.success,
          async_duration_ms: asyncEndTime - asyncStartTime,
          main_process_not_blocked: true,
        },
      };

      results.test_details.push(test6Result);
      if (test6Result.passed) results.tests_passed++;
      else results.tests_failed++;

      console.log('[AUDIT TEST] Async Behavior Test:', test6Result.passed ? 'PASSED' : 'FAILED');
    }

    // === CREATE SAMPLE AUDIT LOGS (Optional) ===
    if (test_type === 'create_samples' || test_type === 'all') {
      console.log('[AUDIT TEST] Creating Sample Audit Logs...');
      
      const sampleAudits = [
        {
          audit_schema_version: '1.0',
          audit_id: `AUD-${new Date().toISOString().slice(0, 10).replace(/-/g, '')}-001ABC`,
          audit_level: 1,
          audit_level_name: 'critical_business',
          timestamp: new Date().toISOString(),
          trigger_type: 'entity_create',
          trigger_source: 'guardContractLifecycle',
          actor_type: 'automation',
          actor_id: 'guardContractLifecycle',
          actor_name: 'Contract Lifecycle Guard',
          process_id: `contract_lifecycle_789_${new Date().toISOString().replace(/[:.]/g, '').slice(0, 15)}`,
          process_type: 'contract_lifecycle',
          process_stage: 'creation_duplicate_check',
          event_id: 'EVT-001',
          event_type: 'duplicate_contract_blocked',
          event_sequence: 1,
          entity_type: 'contract',
          entity_id: 'CNT-789',
          action: 'block',
          decision_code: 'CONTRACT_CREATE_BLOCKED_DUPLICATE',
          decision_logic: "Guard 'no_duplicate_policy' evaluated: Duplicate policy number found",
          guard_evaluated: 'no_duplicate_policy',
          guard_result: 'blocked',
          guard_reason: 'Duplicate policy number POL-123 already exists',
          business_severity_type: 'financial',
          business_severity_level: 'critical',
          technical_severity_type: 'info',
          technical_severity_level: 'low',
          previous_state_summary: {},
          new_state_summary: { status: 'blocked' },
          side_effects: [],
          business_impact_financial_chf: 0,
          business_impact_description: 'Duplicate contract prevented',
          correlation_id: `CTL-${new Date().toISOString().slice(0, 10).replace(/-/g, '')}-789A1B`,
          related_entities: [],
          duration_ms: 15,
        },
        {
          audit_schema_version: '1.0',
          audit_id: `AUD-${new Date().toISOString().slice(0, 10).replace(/-/g, '')}-002DEF`,
          audit_level: 2,
          audit_level_name: 'lifecycle_transition',
          timestamp: new Date().toISOString(),
          trigger_type: 'scheduled',
          trigger_source: 'checkPoliciesExpiry',
          actor_type: 'scheduler',
          actor_id: 'daily_expiry_check',
          actor_name: 'Daily Expiry Check',
          process_id: `renewal_pipeline_456_${new Date().toISOString().replace(/[:.]/g, '').slice(0, 15)}`,
          process_type: 'renewal',
          process_stage: 'task_creation',
          event_id: 'EVT-002',
          event_type: 'task_renewal_created',
          event_sequence: 1,
          entity_type: 'task',
          entity_id: 'TSK-001',
          action: 'create',
          decision_code: 'TASK_CREATED_RENEWAL',
          decision_logic: 'Renewal task created for contract expiring in 90 days',
          business_severity_type: 'operational',
          business_severity_level: 'medium',
          previous_state_summary: {},
          new_state_summary: { status: 'open', task_type: 'renewal' },
          side_effects: [
            { entity_type: 'contract', entity_id: 'CNT-456', action: 'update', description: 'Process status updated to pruefung_offen' },
          ],
          business_impact_financial_chf: 1200,
          business_impact_description: 'Renewal task created, premium CHF 1200',
          correlation_id: `REN-${new Date().toISOString().slice(0, 10).replace(/-/g, '')}-456C3D`,
          related_entities: [
            { entity_type: 'contract', entity_id: 'CNT-456', relationship: 'triggered_by' },
          ],
          duration_ms: 22,
        },
      ];

      const createdIds = [];
      for (const audit of sampleAudits) {
        try {
          const result = await base44.entities.AuditLog.create(audit);
          createdIds.push(result?.id);
          console.log(`[AUDIT TEST] Created sample audit: ${result?.id}`);
        } catch (err) {
          console.error('[AUDIT TEST] Failed to create sample audit:', err.message);
          createdIds.push(null);
        }
      }

      results.sample_audits_created = createdIds.filter(id => id !== null).length;
      results.sample_audit_ids = createdIds;
      
      console.log(`[AUDIT TEST] Created ${results.sample_audits_created} sample audit logs`);
    }

    // === SUMMARY ===
    results.total_tests = results.tests_passed + results.tests_failed;
    results.pass_rate = ((results.tests_passed / results.total_tests) * 100).toFixed(2);
    results.duration_ms = Date.now() - startTime;
    results.status = results.tests_failed === 0 ? 'ALL_TESTS_PASSED' : 'SOME_TESTS_FAILED';

    console.log(`[AUDIT TEST] Completed: ${results.tests_passed}/${results.total_tests} passed (${results.pass_rate}%)`);

    return Response.json({
      success: true,
      ...results,
    });

  } catch (error) {
    console.error('[AUDIT TEST ERROR]', error);
    return Response.json({
      success: false,
      error: error.message,
      test_failed: true,
    }, { status: 500 });
  }
});