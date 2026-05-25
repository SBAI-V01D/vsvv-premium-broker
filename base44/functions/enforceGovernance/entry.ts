/**
 * enforceGovernance — Minimal Viable Governance Core
 *
 * Design Principles:
 * - Governance Engine ONLY: validate, block, audit, classify
 * - NO Business Workflow logic
 * - NO recursive or cascading validator calls
 * - NO heavy data operations in request layer
 * - Execution Budget with Timeout Protection
 * - Async Audit Logging (fire-and-forget)
 * - Full Reproducibility: rule_version + enforcement_mode + simulate_only logged
 *
 * Payload:
 * {
 *   entity_type: string,
 *   event_type: "create"|"update"|"delete"|"read",
 *   data: object,           // current entity data
 *   entity_id?: string,
 *   actor_id?: string,
 *   actor_name?: string,
 *   dry_run?: boolean       // force simulate mode regardless of rule setting
 * }
 *
 * Response:
 * {
 *   allowed: boolean,
 *   blocked_by?: { rule_id, rule_name, rule_version, layer, enforcement_mode, simulate_only },
 *   violations: Array<{ rule_id, rule_name, rule_version, layer, enforcement_mode, simulate_only, error_message, resolution_guidance, execution_ms }>,
 *   warnings: Array<...same>,
 *   simulated_blocks: Array<...same>,  // would-have-blocked if simulate_only=false
 *   execution_ms: number,
 *   evaluated_rules: number,
 *   timed_out_rules: number
 * }
 */
import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

// Execution budgets per layer (ms)
const LAYER_TIMEOUTS = {
  WARNING:          20,
  VALIDATION:       50,
  GOVERNANCE_BLOCK: 100,
  SECURITY_BLOCK:   100,
};

// ─── Simple condition_json evaluator ───────────────────────────────────────────
// Supports ONLY: exists, not_exists, equals, not_equals, in, not_in, AND, OR
// NO complex DSL. NO business logic. NO nested function calls.

function evaluateCondition(condition, data) {
  if (!condition || typeof condition !== 'object') return true;

  // AND combinator
  if (Array.isArray(condition.AND)) {
    return condition.AND.every(c => evaluateCondition(c, data));
  }
  // OR combinator
  if (Array.isArray(condition.OR)) {
    return condition.OR.some(c => evaluateCondition(c, data));
  }

  const { field, op, value } = condition;
  if (!field || !op) return true; // malformed = skip

  // Safely resolve dot-path field
  const fieldValue = field.split('.').reduce((obj, key) => obj?.[key], data);

  switch (op) {
    case 'exists':     return fieldValue !== undefined && fieldValue !== null && fieldValue !== '';
    case 'not_exists': return fieldValue === undefined || fieldValue === null || fieldValue === '';
    case 'equals':     return fieldValue === value;
    case 'not_equals': return fieldValue !== value;
    case 'in':         return Array.isArray(value) && value.includes(fieldValue);
    case 'not_in':     return Array.isArray(value) && !value.includes(fieldValue);
    case 'truthy':     return !!fieldValue;
    case 'falsy':      return !fieldValue;
    default:           return true; // unknown op = skip (safe default)
  }
}

// ─── Async Audit Write (fire-and-forget, never blocks request) ─────────────────
function asyncAuditLog(sr, payload) {
  // Intentionally not awaited — governance decision must not wait for audit write
  sr.entities.AuditLog.create({
    audit_schema_version: '1.0',
    audit_id: `GOV-${Date.now()}-${Math.random().toString(36).slice(2, 8).toUpperCase()}`,
    audit_level: 3,
    audit_level_name: 'guard_decision',
    timestamp: new Date().toISOString(),
    trigger_type: 'api',
    trigger_source: 'enforceGovernance',
    actor_type: 'system',
    actor_id: payload.actor_id || 'system',
    actor_name: payload.actor_name || 'Governance Engine',
    entity_type: payload.entity_type,
    entity_id: payload.entity_id || 'unknown',
    action: payload.allowed ? 'allow' : 'block',
    guard_evaluated: payload.rule_name || 'governance_rule',
    guard_result: payload.allowed ? 'allowed' : (payload.simulated ? 'skipped' : 'blocked'),
    guard_reason: payload.error_message || '',
    decision_code: payload.decision_code || '',
    decision_logic: JSON.stringify({
      rule_id: payload.rule_id,
      rule_version: payload.rule_version,
      layer: payload.layer,
      enforcement_mode: payload.enforcement_mode,
      simulate_only: payload.simulate_only,
      execution_ms: payload.execution_ms,
    }),
    metadata: {
      governance_engine: 'enforceGovernance',
      data_snapshot: payload.data_snapshot || null,
    },
  }).catch(() => { /* audit write failure must never affect governance decision */ });
}

// ─── Update rule metrics (fire-and-forget) ────────────────────────────────────
function asyncUpdateRuleMetrics(sr, ruleId, violated, executionMs, wasSimulated) {
  sr.entities.GovernanceRule.update(ruleId, {
    last_execution_at: new Date().toISOString(),
    last_execution_ms: Math.round(executionMs),
  }).catch(() => {});

  if (violated || wasSimulated) {
    // Increment counters via read-then-write is not safe in concurrent env,
    // but acceptable for Observability metrics (approximate counts)
    sr.entities.GovernanceRule.get(ruleId).then(rule => {
      if (!rule) return;
      const updates = { execution_count: (rule.execution_count || 0) + 1 };
      if (violated && !wasSimulated) updates.violation_count = (rule.violation_count || 0) + 1;
      if (wasSimulated) updates.simulate_count = (rule.simulate_count || 0) + 1;
      sr.entities.GovernanceRule.update(ruleId, updates).catch(() => {});
    }).catch(() => {});
  }
}

// ─── Main Handler ──────────────────────────────────────────────────────────────

Deno.serve(async (req) => {
  const startTotal = Date.now();

  try {
    const base44 = createClientFromRequest(req);

    // Auth — allow authenticated users + internal service calls
    let actor = null;
    try {
      actor = await base44.auth.me();
    } catch { /* internal/scheduled call */ }

    const body = await req.json();
    const { entity_type, event_type, data, entity_id, dry_run } = body;
    const actor_id   = body.actor_id   || actor?.id    || 'system';
    const actor_name = body.actor_name || actor?.full_name || actor?.email || 'system';

    if (!entity_type || !event_type || !data) {
      return Response.json({ error: 'entity_type, event_type, and data are required' }, { status: 400 });
    }

    const sr = base44.asServiceRole;
    const now = new Date().toISOString();

    // Load ONLY active rules for this entity_type — lightweight query
    const allRules = await sr.entities.GovernanceRule.filter({
      entity_type,
      rule_status: 'active',
    }, '-effective_from', 50);

    // Filter: event_type match + effective date range
    const applicableRules = allRules.filter(rule => {
      if (!rule.event_types?.includes(event_type)) return false;
      if (rule.effective_from && now < rule.effective_from) return false;
      if (rule.effective_to   && now > rule.effective_to)   return false;
      return true;
    });

    const violations      = [];
    const warnings        = [];
    const simulated_blocks = [];
    let   timed_out_rules  = 0;
    let   hard_blocked_by  = null;

    for (const rule of applicableRules) {
      const ruleStart = Date.now();
      const budgetMs  = rule.timeout_ms || LAYER_TIMEOUTS[rule.layer] || 50;
      let   violated  = false;
      let   errorMsg  = rule.error_message;

      // ── Evaluate rule ──────────────────────────────────────────────────────
      try {
        if (rule.custom_validator_function_name) {
          // Complex rule via custom validator function
          // STRICT: no recursive enforceGovernance calls allowed
          const validatorTimeout = new Promise((_, reject) =>
            setTimeout(() => reject(new Error('TIMEOUT')), budgetMs)
          );
          const validatorCall = base44.functions.invoke(rule.custom_validator_function_name, {
            entity_type,
            event_type,
            data,
            entity_id,
            rule_id:   rule.id,
            rule_name: rule.name,
          });
          const result = await Promise.race([validatorCall, validatorTimeout]);
          // Validator must return { valid: boolean, message?: string }
          violated = result?.data?.valid === false;
          if (violated && result?.data?.message) errorMsg = result.data.message;

        } else if (rule.condition_json) {
          // Simple condition — evaluated synchronously, no DB calls
          const conditionViolated = !evaluateCondition(rule.condition_json, data);
          violated = conditionViolated;
        }
      } catch (err) {
        if (err.message === 'TIMEOUT') {
          timed_out_rules++;
          // Timeout: for SECURITY_BLOCK/GOVERNANCE_BLOCK → treat as violation (fail-safe)
          // For WARNING/VALIDATION → skip (fail-open)
          violated = ['SECURITY_BLOCK', 'GOVERNANCE_BLOCK'].includes(rule.layer);
          errorMsg = `Governance rule timed out after ${budgetMs}ms`;
        } else {
          // Unexpected error → skip rule, log but never crash request
          violated = false;
        }
      }

      const executionMs = Date.now() - ruleStart;

      if (!violated) {
        asyncUpdateRuleMetrics(sr, rule.id, false, executionMs, false);
        continue;
      }

      // ── Build violation record (for reproducibility) ───────────────────────
      const violationRecord = {
        rule_id:             rule.id,
        rule_name:           rule.name,
        rule_version:        rule.rule_version,
        layer:               rule.layer,
        business_criticality: rule.business_criticality,
        enforcement_mode:    rule.enforcement_mode,
        simulate_only:       rule.simulate_only,
        error_message:       errorMsg,
        resolution_guidance: rule.resolution_guidance || null,
        execution_ms:        Math.round(executionMs),
      };

      const isSimulated = dry_run || rule.simulate_only;

      // ── Async audit (fire-and-forget) ──────────────────────────────────────
      asyncAuditLog(sr, {
        entity_type,
        event_type,
        entity_id,
        actor_id,
        actor_name,
        rule_id:          rule.id,
        rule_name:        rule.name,
        rule_version:     rule.rule_version,
        layer:            rule.layer,
        enforcement_mode: rule.enforcement_mode,
        simulate_only:    isSimulated,
        error_message:    errorMsg,
        decision_code:    `${entity_type.toUpperCase()}_${event_type.toUpperCase()}_${rule.layer}${isSimulated ? '_SIMULATED' : '_BLOCKED'}`,
        allowed:          isSimulated || rule.layer === 'WARNING',
        simulated:        isSimulated,
        execution_ms:     Math.round(executionMs),
        data_snapshot:    null, // never log full data — privacy + performance
      });
      asyncUpdateRuleMetrics(sr, rule.id, true, executionMs, isSimulated);

      // ── Classify outcome ───────────────────────────────────────────────────
      if (rule.layer === 'WARNING') {
        warnings.push(violationRecord);

      } else if (isSimulated) {
        simulated_blocks.push(violationRecord);

      } else {
        // Real enforcement
        violations.push(violationRecord);

        // First GOVERNANCE_BLOCK or SECURITY_BLOCK wins (strict mode)
        if (!hard_blocked_by && ['GOVERNANCE_BLOCK', 'SECURITY_BLOCK', 'VALIDATION'].includes(rule.layer)) {
          if (rule.enforcement_mode === 'strict' ||
             (rule.enforcement_mode === 'enforce' && ['GOVERNANCE_BLOCK', 'SECURITY_BLOCK'].includes(rule.layer))) {
            hard_blocked_by = violationRecord;
          }
        }
      }
    }

    const totalMs = Date.now() - startTotal;
    const allowed = !hard_blocked_by;

    return Response.json({
      allowed,
      blocked_by:       hard_blocked_by || null,
      violations,
      warnings,
      simulated_blocks,
      execution_ms:     totalMs,
      evaluated_rules:  applicableRules.length,
      timed_out_rules,
    });

  } catch (error) {
    // Governance Engine failure must NEVER silently block all operations
    // Log error but default to ALLOW (fail-open) to prevent system lockout
    console.error('[enforceGovernance] Critical error:', error.message);
    return Response.json({
      allowed:          true,
      blocked_by:       null,
      violations:       [],
      warnings:         [],
      simulated_blocks: [],
      execution_ms:     Date.now() - startTotal,
      evaluated_rules:  0,
      timed_out_rules:  0,
      engine_error:     error.message, // surfaced for monitoring, never blocks
    });
  }
});