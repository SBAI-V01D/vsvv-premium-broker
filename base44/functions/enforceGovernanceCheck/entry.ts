/**
 * enforceGovernanceCheck — Runtime Governance Enforcement
 * 
 * PRÜFT VOR JEDER KRITISCHEN ÄNDERUNG:
 * 1. Backup vorhanden?
 * 2. Validation erfolgreich?
 * 3. Change Summary erstellt?
 * 4. Admin Approval vorhanden?
 * 5. Audit Log erstellt?
 * 6. Rollback möglich?
 * 
 * BLOCKIERT Umsetzung wenn Checks fehlschlagen.
 */

import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    
    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await req.json();
    const {
      action_type,      // 'entity_write' | 'deployment' | 'refactoring' | 'automation_change' | 'ai_action'
      affected_entities, // Array von Entity-Namen
      change_summary,   // Textbeschreibung
      backup_id,        // ID des erstellten Backups
      validation_result, // { success: boolean, checks: [...] }
      admin_approval,   // { approved: boolean, approved_by: string, approved_at: string }
      rollback_plan,    // Textbeschreibung
    } = body;

    // ── CHECK 1: Admin Approval Required ─────────────────────────────────────
    if (!admin_approval || !admin_approval.approved) {
      return Response.json({
        governance_check: 'FAILED',
        violation: 'MISSING_ADMIN_APPROVAL',
        message: 'Admin-Freigabe erforderlich vor dieser Änderung',
        blocked: true,
      }, { status: 403 });
    }

    // ── CHECK 2: Mandatory Backup ────────────────────────────────────────────
    if (!backup_id) {
      return Response.json({
        governance_check: 'FAILED',
        violation: 'MISSING_BACKUP',
        message: 'Backup muss vor Änderung erstellt werden',
        blocked: true,
      }, { status: 403 });
    }

    // Backup-Existenz prüfen
    const backup = await base44.entities.BackupLog.filter({ backup_id }).then(r => r[0]);
    if (!backup) {
      return Response.json({
        governance_check: 'FAILED',
        violation: 'BACKUP_NOT_FOUND',
        message: `Backup ${backup_id} nicht gefunden`,
        blocked: true,
      }, { status: 403 });
    }

    // ── CHECK 3: Validation Before Deployment ────────────────────────────────
    if (!validation_result || !validation_result.success) {
      return Response.json({
        governance_check: 'FAILED',
        violation: 'VALIDATION_FAILED',
        message: 'Validierung muss erfolgreich sein',
        checks: validation_result?.checks || [],
        blocked: true,
      }, { status: 403 });
    }

    // ── CHECK 4: Change Summary Required ─────────────────────────────────────
    if (!change_summary || change_summary.trim() === '') {
      return Response.json({
        governance_check: 'FAILED',
        violation: 'MISSING_CHANGE_SUMMARY',
        message: 'Change Summary muss erstellt werden',
        blocked: true,
      }, { status: 403 });
    }

    // ── CHECK 5: Rollback Plan Required ──────────────────────────────────────
    if (!rollback_plan || rollback_plan.trim() === '') {
      return Response.json({
        governance_check: 'FAILED',
        violation: 'MISSING_ROLLBACK_PLAN',
        message: 'Rollback-Plan muss dokumentiert sein',
        blocked: true,
      }, { status: 403 });
    }

    // ── CHECK 6: Audit Trail Required ────────────────────────────────────────
    // Audit Log wird automatisch erstellt bei erfolgreicher Prüfung
    const auditLog = await base44.entities.AuditLog.create({
      audit_schema_version: '1.0',
      audit_id: `GOV-${Date.now()}-${Math.random().toString(36).substr(2, 6).toUpperCase()}`,
      audit_level: 1, // Critical Business
      audit_level_name: 'critical_business',
      timestamp: new Date().toISOString(),
      trigger_type: 'manual',
      trigger_source: 'governance_enforcement',
      actor_type: 'user',
      actor_id: user.id,
      actor_name: user.full_name || user.email,
      process_id: `GOV-${new Date().toISOString().slice(0, 10)}`,
      process_type: 'governance_enforcement',
      process_stage: 'pre_change_validation',
      event_id: `EVT-${Date.now()}`,
      event_type: 'governance_check_passed',
      event_sequence: 1,
      entity_type: 'system',
      entity_id: 'governance_layer',
      action: 'allow',
      decision_code: 'GOVERNANCE_CHECK_PASSED',
      decision_logic: 'Alle Governance-Checks erfolgreich bestanden',
      guard_evaluated: 'governance_enforcement_layer',
      guard_result: 'allowed',
      guard_reason: 'Backup, Validation, Admin Approval, Change Summary, Rollback Plan vorhanden',
      business_severity_type: 'compliance',
      business_severity_level: 'critical',
      technical_severity_type: 'info',
      technical_severity_level: 'low',
      previous_state_summary: { action_type, affected_entities },
      new_state_summary: { governance_check: 'PASSED', approved_by: admin_approval.approved_by },
      side_effects: [],
      business_impact_description: 'Governance-Enforcement sichert systemweite Compliance',
      metadata: {
        action_type,
        affected_entities,
        backup_id,
        validation_checks: validation_result.checks,
        admin_approval: admin_approval.approved_by,
      },
    });

    // ── ALL CHECKS PASSED ────────────────────────────────────────────────────
    return Response.json({
      governance_check: 'PASSED',
      message: 'Alle Governance-Checks erfolgreich',
      blocked: false,
      audit_log_id: auditLog.id,
      checks: {
        admin_approval: '✓',
        backup: '✓',
        validation: '✓',
        change_summary: '✓',
        rollback_plan: '✓',
        audit_trail: '✓',
      },
    });
  } catch (error) {
    return Response.json({
      governance_check: 'ERROR',
      error: error.message,
      blocked: true,
    }, { status: 500 });
  }
});