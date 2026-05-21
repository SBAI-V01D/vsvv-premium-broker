/**
 * useEnterpriseMonitoring — Performance- und Stabilitätsüberwachung
 *
 * Misst:
 *   - Render-Zeit kritischer Komponenten
 *   - Warnung bei >300ms Render
 *   - Warnung bei fehlenden Snapshots / nicht freigegebenen Dossiers
 *   - Logging via SystemLog (fire-and-forget)
 */
import { useEffect, useRef, useCallback } from 'react';
import { base44 } from '@/api/base44Client';

const RENDER_WARN_MS = 300;
const QUERY_WARN_MS  = 1000;

// Hilfsfunktion: loggt ohne await (fire & forget)
function logWarning(message, details = {}) {
  base44.entities.SystemLog.create({
    level:   'warn',
    source:  'enterprise_monitoring',
    message,
    details: JSON.stringify(details),
  }).catch(() => {/* silent */});
}

/**
 * Misst Render-Dauer einer Komponente und warnt bei Überschreitung.
 * @param {string} componentName
 */
export function useRenderPerformance(componentName) {
  const startRef = useRef(performance.now());

  useEffect(() => {
    const duration = Math.round(performance.now() - startRef.current);
    if (duration > RENDER_WARN_MS) {
      logWarning(`Langsamer Render: ${componentName}`, { duration_ms: duration, component: componentName });
    }
    startRef.current = performance.now(); // Reset für nächsten Render
  });
}

/**
 * Misst Query-Dauer und warnt bei Überschreitung.
 * @param {string} queryName
 * @returns {{ startTimer: () => void, stopTimer: () => void }}
 */
export function useQueryTimer(queryName) {
  const startRef = useRef(null);

  const startTimer = useCallback(() => {
    startRef.current = performance.now();
  }, []);

  const stopTimer = useCallback(() => {
    if (!startRef.current) return;
    const duration = Math.round(performance.now() - startRef.current);
    if (duration > QUERY_WARN_MS) {
      logWarning(`Langsame Query: ${queryName}`, { duration_ms: duration, query: queryName });
    }
    startRef.current = null;
  }, [queryName]);

  return { startTimer, stopTimer };
}

/**
 * Prüft Enterprise-Invarianten für ein Dossier und warnt bei Verletzungen.
 * @param {object} dossier
 */
export function useDossierIntegrityCheck(dossier) {
  useEffect(() => {
    if (!dossier?.id) return;

    const issues = [];

    if (dossier.advisor_approved && !dossier.approved_snapshot_id) {
      issues.push('Freigabe ohne Snapshot-Koppelung');
    }
    if (dossier.advisor_approved && !dossier.approved_by) {
      issues.push('Freigabe ohne approved_by');
    }
    if (dossier.advisor_approved && !dossier.approved_at) {
      issues.push('Freigabe ohne approved_at Timestamp');
    }
    if (dossier.final_pdf_version && !dossier.final_pdf_hash) {
      issues.push('PDF exportiert ohne Hash-Speicherung');
    }
    if (dossier.review_status === 'freigegeben' && !dossier.advisor_approved) {
      issues.push('review_status=freigegeben aber advisor_approved=false');
    }

    if (issues.length > 0) {
      logWarning('Dossier-Integritätswarnung', {
        dossier_id: dossier.id,
        issues,
        dossier_version: dossier.version,
      });
    }
  }, [dossier?.id, dossier?.advisor_approved, dossier?.approved_snapshot_id, dossier?.final_pdf_hash]);
}

/**
 * Loggt eine kritische Aktion im Audit-Trail (fire & forget).
 * Gedacht für: approval, revocation, export, role-change.
 */
export function useAuditAction() {
  const logAction = useCallback(async (action, entityId, entityType, meta = {}) => {
    try {
      const user = await base44.auth.me();
      await base44.entities.SystemLog.create({
        level:               'info',
        source:              'audit_action',
        message:             `${action}: ${entityType}/${entityId}`,
        details:             JSON.stringify({ action, entity_id: entityId, entity_type: entityType, user_id: user?.id, user_name: user?.full_name, ...meta }),
        related_entity_type: entityType,
        related_entity_id:   entityId,
        user_email:          user?.email,
      });
    } catch {/* nie den normalen Flow unterbrechen */}
  }, []);

  return logAction;
}