/**
 * ZENTRALE AUDIT HELPERS — Enterprise Audit Infrastructure v1.0
 * 
 * Diese Helper-Functions stellen sicher, dass alle Automationen
 * konsistente, korrelierte und standardisierte Audit-Logs schreiben.
 * 
 * WICHTIG: NICHT pro Automation kopieren — zentral verwenden!
 */

/**
 * Generiert eine lesbare Correlation-ID für Prozess-Ketten
 * 
 * Format: {PREFIX}-{YYYYMMDD}-{RANDOM}
 * Beispiele:
 * - CTL-20260518-789A1B (Contract Lifecycle)
 * - REN-20260518-456C3D (Renewal)
 * - COM-20260518-123E4F (Commission)
 * 
 * @param {string} processType - Typ des Prozesses (CTL, REN, COM, APP, TSK)
 * @param {string} entityId - Entity-ID für Referenz
 * @returns {string} Lesbare Correlation-ID
 */
export function generateCorrelationId(processType, entityId) {
  const date = new Date().toISOString().slice(0, 10).replace(/-/g, '');
  const random = Math.random().toString(36).slice(2, 8).toUpperCase();
  const entitySuffix = entityId ? entityId.slice(-3).toUpperCase() : '000';
  
  return `${processType}-${date}-${entitySuffix}${random}`;
}

/**
 * Generiert eine Process-ID für Lifecycle-Klammern
 * 
 * Format: {lifecycleType}_{entityId}_{timestamp}
 * Beispiele:
 * - contract_lifecycle_789_20260518T100000
 * - renewal_pipeline_456_20260518T110000
 * 
 * @param {string} lifecycleType - Typ des Lifecycles
 * @param {string} entityId - Entity-ID
 * @returns {string} Process-ID
 */
export function generateProcessId(lifecycleType, entityId) {
  const timestamp = new Date().toISOString().replace(/[:.]/g, '').slice(0, 15);
  return `${lifecycleType}_${entityId}_${timestamp}`;
}

/**
 * Generiert eine eindeutige Audit-ID
 * 
 * Format: AUD-{YYYYMMDD}-{RANDOM}
 * Beispiel: AUD-20260518-001A2B
 * 
 * @param {number} sequence - Optionale Sequenz-Nummer
 * @returns {string} Audit-ID
 */
export function generateAuditId(sequence = 1) {
  const date = new Date().toISOString().slice(0, 10).replace(/-/g, '');
  const seq = String(sequence).padStart(3, '0');
  const random = Math.random().toString(36).slice(2, 5).toUpperCase();
  
  return `AUD-${date}-${seq}${random}`;
}

/**
 * Generiert standardisierten Decision-Code
 * 
 * WICHTIG: Keine freien Texte — nur standardisierte Codes!
 * 
 * Beispiele:
 * - CONTRACT_CREATE_ALLOWED
 * - CONTRACT_CREATE_BLOCKED_DUPLICATE
 * - TASK_RENEWAL_CREATED
 * - TASK_RENEWAL_SKIPPED_EXISTING
 * - STORNO_BLOCKED_ALREADY_PROCESSED
 * - STORNO_ALLOWED_NO_EXISTING
 * 
 * @param {string} entity - Entity-Typ (CONTRACT, TASK, STORNO, etc.)
 * @param {string} action - Aktion (CREATE, UPDATE, BLOCK, SKIP, etc.)
 * @param {string} reason - Grund (ALLOWED, BLOCKED_DUPLICATE, SKIPPED_EXISTING, etc.)
 * @returns {string} Standardisierter Decision-Code
 */
export function generateDecisionCode(entity, action, reason) {
  return `${entity.toUpperCase()}_${action.toUpperCase()}_${reason.toUpperCase()}`;
}

/**
 * Bestimmt Audit-Level basierend auf Business-Relevanz
 * 
 * Level 1: Critical Business (Storno, Doppelvertrag, Payment)
 * Level 2: Lifecycle Transition (Status-Wechsel, Create/Delete)
 * Level 3: Guard Decision (allowed/blocked)
 * Level 4: Debug Verbose (nur temporär)
 * 
 * @param {string} eventType - Typ des Events
 * @param {string} guardResult - Guard-Ergebnis (allowed/blocked/error)
 * @param {number} financialImpactCHF - Finanzieller Impact in CHF
 * @returns {{level: number, name: string}} Audit-Level
 */
export function determineAuditLevel(eventType, guardResult, financialImpactCHF = 0) {
  // Level 1: Critical Business
  if (eventType.includes('storno') || 
      eventType.includes('duplicate') || 
      eventType.includes('payment') ||
      financialImpactCHF >= 1000) {
    return { level: 1, name: 'critical_business' };
  }
  
  // Level 2: Lifecycle Transition
  if (eventType.includes('created') || 
      eventType.includes('approved') || 
      eventType.includes('cancelled') ||
      eventType.includes('transition')) {
    return { level: 2, name: 'lifecycle_transition' };
  }
  
  // Level 3: Guard Decision
  if (guardResult === 'blocked' || guardResult === 'allowed') {
    return { level: 3, name: 'guard_decision' };
  }
  
  // Level 4: Debug
  return { level: 4, name: 'debug_verbose' };
}

/**
 * Bestimmt Business-Severity
 * 
 * @param {string} eventType - Typ des Events
 * @param {number} financialImpactCHF - Finanzieller Impact
 * @param {boolean} isComplianceRelevant - Compliance-relevant?
 * @returns {{type: string, level: string}} Business-Severity
 */
export function determineBusinessSeverity(eventType, financialImpactCHF = 0, isComplianceRelevant = false) {
  // Critical: Finanziell hoch oder Compliance
  if (financialImpactCHF >= 5000 || isComplianceRelevant) {
    return { type: 'financial', level: 'critical' };
  }
  
  // High: Mittlere Finanzen oder Customer-Impact
  if (financialImpactCHF >= 1000 || eventType.includes('customer')) {
    return { type: 'customer_impact', level: 'high' };
  }
  
  // Medium: Operational
  if (eventType.includes('task') || eventType.includes('reminder')) {
    return { type: 'operational', level: 'medium' };
  }
  
  // Low: Info
  return { type: 'operational', level: 'low' };
}

/**
 * Erstellt kompakte State-Snapshots (Snapshot Light)
 * 
 * WICHTIG: Nur relevante Business-Felder, nicht gesamte Entity!
 * 
 * @param {object} entity - Entity-Objekt
 * @param {array} fields - Relevante Felder für Snapshot
 * @returns {object} Kompakter State-Snapshot
 */
export function createSnapshot(entity, fields = []) {
  if (!entity) return {};
  
  const defaultFields = ['status', 'premium_yearly', 'commission_status', 'process_status'];
  const selectedFields = fields.length > 0 ? fields : defaultFields;
  
  const snapshot = {};
  selectedFields.forEach(field => {
    if (entity[field] !== undefined) {
      snapshot[field] = entity[field];
    }
  });
  
  return snapshot;
}

/**
 * Protokolliert Audit-Log (Async, Non-Blocking)
 * 
 * WICHTIG: Fire-and-Forget — blockiert NICHT Hauptprozess!
 * 
 * @param {object} base44 - Base44 SDK Client
 * @param {object} auditData - Audit-Daten gemäß Schema v1.0
 * @returns {Promise<string|null>} Audit-ID oder null bei Fehler
 */
export async function writeAuditLog(base44, auditData) {
  try {
    // Async schreiben — NICHT await für Hauptprozess!
    const auditEntry = {
      ...auditData,
      timestamp: new Date().toISOString(),
    };
    
    const result = await base44.entities.AuditLog.create(auditEntry);
    return result?.id || null;
  } catch (error) {
    // Audit-Fehler darf NICHT Hauptprozess beeinflussen!
    console.error('[AuditLog] Write failed (non-blocking):', error.message);
    return null;
  }
}

/**
 * Wrapper für Guard-Evaluation mit Audit-Tracking
 * 
 * @param {object} params - Parameter
 * @param {string} params.guardName - Name des Guards
 * @param {boolean} params.allowed - Guard-Ergebnis
 * @param {string} params.reason - Begründung
 * @param {object} params.context - Kontext (entity, financialImpact, etc.)
 * @returns {object} Guard-Result für Decision-Code
 */
export function evaluateGuard({ guardName, allowed, reason, context = {} }) {
  const decisionCode = generateDecisionCode(
    context.entityType || 'GUARD',
    allowed ? 'ALLOWED' : 'BLOCKED',
    reason.split(' ').slice(0, 3).join('_').toUpperCase()
  );
  
  return {
    guard_evaluated: guardName,
    guard_result: allowed ? 'allowed' : 'blocked',
    guard_reason: reason,
    decision_code: decisionCode,
    decision_logic: `Guard '${guardName}' evaluated: ${reason}`,
  };
}