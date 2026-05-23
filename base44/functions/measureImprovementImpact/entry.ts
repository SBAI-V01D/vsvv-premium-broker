/**
 * measureImprovementImpact — Automatisierte Impact-Messung
 * 
 * Führt automatische Tests durch um den tatsächlichen Impact von
 * implementierten Verbesserungen zu messen.
 * 
 * UNTERSTÜTZTE METRIKEN:
 * - Performance (Query-Zeiten, Ladezeiten)
 * - Datenqualität (Vollständigkeit, Konsistenz)
 * - Prozess-Effizienz (Task-Durchlaufzeiten)
 * - UX (Klicks, Interaktionen)
 */

import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    
    if (!user || user.role !== 'admin') {
      return Response.json({ error: 'Admin required' }, { status: 401 });
    }

    const body = await req.json();
    const { improvement_id } = body;

    if (!improvement_id) {
      return Response.json({ error: 'Improvement ID required' }, { status: 400 });
    }

    // Improvement laden
    const improvement = await base44.entities.EnterpriseImprovement.get(improvement_id);
    if (!improvement) {
      return Response.json({ error: 'Improvement not found' }, { status: 404 });
    }

    if (improvement.status !== 'implemented') {
      return Response.json({ 
        error: 'Can only measure implemented improvements',
        current_status: improvement.status
      }, { status: 400 });
    }

    // ── AUTOMATISCHE MESSUNG basierend auf Area ─────────────────────────────
    const measurements = {};
    const measurementLogs = [];

    // Performance-Messungen
    if (improvement.area === 'performance') {
      // Query-Performance messen
      const startTime = Date.now();
      
      // Beispiel: Customer Query Performance
      if (improvement.affected_entities?.includes('Customer')) {
        const queryStart = performance.now();
        const customers = await base44.entities.Customer.filter({ archived: false }, '-updated_date', 100);
        const queryEnd = performance.now();
        
        measurements.customer_query_time_ms = Math.round(queryEnd - queryStart);
        measurementLogs.push({
          metric: 'customer_query_time_ms',
          value: measurements.customer_query_time_ms,
          timestamp: new Date().toISOString(),
        });
      }

      // Contract Query Performance
      if (improvement.affected_entities?.includes('Contract')) {
        const queryStart = performance.now();
        const contracts = await base44.entities.Contract.filter({ archived: false }, '-created_date', 100);
        const queryEnd = performance.now();
        
        measurements.contract_query_time_ms = Math.round(queryEnd - queryStart);
        measurementLogs.push({
          metric: 'contract_query_time_ms',
          value: measurements.contract_query_time_ms,
          timestamp: new Date().toISOString(),
        });
      }

      // Total measurement time
      measurements.total_measurement_time_ms = Date.now() - startTime;
    }

    // Datenqualität-Messungen
    if (improvement.area === 'relationship_integrity' || improvement.area === 'ai_quality') {
      const customers = await base44.entities.Customer.filter({ archived: false }, '-created_date', 500);
      
      // Vollständigkeit messen
      const withAdvisor = customers.filter(c => c.advisor_id || c.primary_advisor_id).length;
      const withMandate = customers.filter(c => c.mandate_status === 'valid').length;
      const withEmail = customers.filter(c => c.email).length;
      
      measurements.advisor_coverage_percent = Math.round((withAdvisor / customers.length) * 100);
      measurements.mandate_valid_percent = Math.round((withMandate / customers.length) * 100);
      measurements.email_coverage_percent = Math.round((withEmail / customers.length) * 100);
      
      measurementLogs.push({
        metric: 'data_quality_scores',
        value: {
          advisor_coverage: measurements.advisor_coverage_percent,
          mandate_valid: measurements.mandate_valid_percent,
          email_coverage: measurements.email_coverage_percent,
        },
        timestamp: new Date().toISOString(),
      });
    }

    // Prozess-Effizienz
    if (improvement.area === 'workflow') {
      const tasks = await base44.entities.Task.filter({}, '-created_date', 200);
      
      const openTasks = tasks.filter(t => t.status === 'open' || t.status === 'in_progress').length;
      const completedTasks = tasks.filter(t => t.status === 'completed').length;
      const overdueTasks = tasks.filter(t => {
        if (!t.due_date) return false;
        return new Date(t.due_date) < new Date() && t.status !== 'completed';
      }).length;
      
      measurements.task_completion_rate_percent = Math.round((completedTasks / tasks.length) * 100);
      measurements.overdue_task_count = overdueTasks;
      measurements.open_task_count = openTasks;
      
      measurementLogs.push({
        metric: 'workflow_efficiency',
        value: {
          completion_rate: measurements.task_completion_rate_percent,
          overdue_count: measurements.overdue_task_count,
          open_count: measurements.open_task_count,
        },
        timestamp: new Date().toISOString(),
      });
    }

    // ── KI-BEWERTUNG: Ist der Vorschlag erfolgreich? ─────────────────────────
    const targetMetrics = improvement.success_metrics;
    let success = false;
    let successReason = '';

    if (targetMetrics?.target_ms && measurements.customer_query_time_ms) {
      // Performance-Ziel erreicht?
      const actualImprovement = ((targetMetrics.before_ms - measurements.customer_query_time_ms) / targetMetrics.before_ms) * 100;
      success = measurements.customer_query_time_ms <= targetMetrics.target_ms;
      successReason = success 
        ? `Ziel erreicht: ${measurements.customer_query_time_ms}ms ≤ ${targetMetrics.target_ms}ms (${actualImprovement.toFixed(1)}% Verbesserung)`
        : `Ziel verfehlt: ${measurements.customer_query_time_ms}ms > ${targetMetrics.target_ms}ms`;
    } else if (improvement.area === 'relationship_integrity') {
      // Datenqualität verbessert?
      const currentQuality = (measurements.advisor_coverage_percent + measurements.mandate_valid_percent) / 2;
      success = currentQuality > 80; // Threshold
      successReason = `Datenqualität: ${currentQuality.toFixed(1)}% (Target: >80%)`;
    } else {
      // Default: Messung erfolgreich durchgeführt
      success = Object.keys(measurements).length > 0;
      successReason = `${Object.keys(measurements).length} Metriken erfolgreich gemessen`;
    }

    // ── ERGEBNISSE speichern ─────────────────────────────────────────────────
    const actualImpact = {
      measured_at: new Date().toISOString(),
      measured_by: user.full_name || user.email,
      measurements: measurements,
      measurement_logs: measurementLogs,
      success: success,
      success_reason: successReason,
      target_metrics: targetMetrics,
    };

    // Improvement Record updaten
    await base44.entities.EnterpriseImprovement.update(improvement_id, {
      actual_impact: actualImpact,
      status: success ? 'verified' : 'implemented', // Bei Erfolg → verified, sonst bleibt implemented für Nachbesserung
      verified_at: success ? new Date().toISOString() : null,
      verified_by: success ? (user.full_name || user.email) : null,
    });

    // ── LERNENDE KI: Neue Vorschläge ableiten ────────────────────────────────
    let newSuggestions = [];
    
    if (success) {
      // Erfolgreiche Verbesserung → KI kann ähnliche Vorschläge generieren
      const learnPrompt = `Diese Verbesserung war erfolgreich:
      
${JSON.stringify({
  title: improvement.title,
  area: improvement.area,
  before: targetMetrics?.before_ms,
  after: measurements.customer_query_time_ms,
  improvement_percent: targetMetrics?.before_ms ? ((targetMetrics.before_ms - measurements.customer_query_time_ms) / targetMetrics.before_ms * 100).toFixed(1) : 'N/A',
  success_reason: successReason,
}, null, 2)}

Generiere 2-3 ähnliche Verbesserungsvorschläge für andere Bereiche des Systems, die denselben Erfolgsansatz nutzen könnten.`;

      const learnResult = await base44.integrations.Core.InvokeLLM({
        prompt: learnPrompt,
        response_json_schema: {
          type: 'object',
          properties: {
            new_suggestions: {
              type: 'array',
              items: {
                type: 'object',
                properties: {
                  title: { type: 'string' },
                  area: { type: 'string' },
                  estimated_impact: { type: 'string' },
                  approach: { type: 'string' },
                },
              },
            },
          },
        },
      });

      newSuggestions = learnResult.new_suggestions || [];
    }

    return Response.json({
      improvement_id: improvement_id,
      measurement_successful: Object.keys(measurements).length > 0,
      measurements: measurements,
      measurement_logs: measurementLogs,
      success: success,
      success_reason: successReason,
      actual_impact: actualImpact,
      status_updated: success ? 'verified' : 'implemented',
      new_suggestions: newSuggestions,
      learned_from_success: newSuggestions.length > 0,
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});