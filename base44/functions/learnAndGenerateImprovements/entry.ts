/**
 * learnAndGenerateImprovements — Lernende KI für kontinuierliche Verbesserung
 * 
 * Analysiert erfolgreiche und gescheiterte Verbesserungen und generiert
 * automatisch neue, verbesserte Vorschläge basierend auf den Erkenntnissen.
 * 
 * LERN-MODI:
 * 1. Success Patterns: Was funktioniert hat → wiederholen
 * 2. Failure Analysis: Was gescheitert ist → vermeiden/verbessern
 * 3. Trend Detection: Wiederkehrende Muster → systematisch lösen
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
    const { mode = 'all', limit = 5 } = body;

    // ── HISTORIE LADEN: Alle verifizierten Verbesserungen ────────────────────
    const allImprovements = await base44.entities.EnterpriseImprovement.list('-verified_at', 200);
    
    const verified = allImprovements.filter(i => i.status === 'verified' && i.actual_impact);
    const rejected = allImprovements.filter(i => i.status === 'rejected');
    const implemented = allImprovements.filter(i => i.status === 'implemented' && !i.actual_impact);

    // ── SUCCESS PATTERNS analysieren ─────────────────────────────────────────
    const successPatterns = [];
    
    for (const imp of verified) {
      const impact = imp.actual_impact;
      if (!impact) continue;

      const pattern = {
        id: imp.id,
        title: imp.title,
        area: imp.area,
        priority: imp.priority,
        before: imp.success_metrics?.before_ms || imp.estimated_impact?.performance_improvement_percent,
        after: impact.measurements?.customer_query_time_ms || impact.measurements,
        improvement: impact.success_reason,
        approach: imp.ki_recommendation,
        implementation_steps: imp.implementation_steps,
        success_factors: [],
      };

      // Erfolgsfaktoren extrahieren
      if (impact.success) {
        if (impact.measurements?.customer_query_time_ms) {
          const improvementPercent = ((imp.success_metrics?.before_ms - impact.measurements.customer_query_time_ms) / imp.success_metrics?.before_ms * 100).toFixed(1);
          pattern.success_factors.push(`Performance-Verbesserung: ${improvementPercent}%`);
        }
        if (impact.measurements?.advisor_coverage_percent > 80) {
          pattern.success_factors.push('Datenqualität >80%');
        }
        if (imp.estimated_impact?.effort_level === 'low' && impact.success) {
          pattern.success_factors.push('Low Effort, High Impact');
        }
      }

      successPatterns.push(pattern);
    }

    // ── FAILURE ANALYSIS ─────────────────────────────────────────────────────
    const failurePatterns = [];
    
    for (const imp of rejected) {
      failurePatterns.push({
        id: imp.id,
        title: imp.title,
        area: imp.area,
        rejection_reason: imp.rejection_reason,
        lesson_learned: '', // Wird von KI extrahiert
      });
    }

    // ── TREND DETECTION: Wiederkehrende Probleme ─────────────────────────────
    const areaCounts = {};
    for (const imp of allImprovements) {
      areaCounts[imp.area] = (areaCounts[imp.area] || 0) + 1;
    }

    const trends = Object.entries(areaCounts)
      .filter(([_, count]) => count >= 3) // Mindestens 3 Vorkommen
      .map(([area, count]) => ({
        area,
        count,
        trend: count >= 5 ? 'systemic_issue' : 'recurring_pattern',
      }))
      .sort((a, b) => b.count - a.count);

    // ── KI-ANALYSE: Lernen und neue Vorschläge generieren ────────────────────
    const prompt = `Du bist lernende Enterprise KI. Analysiere erfolgreiche Verbesserungen und generiere neue Vorschläge.

SUCCESS PATTERNS (${successPatterns.length} erfolgreiche Verbesserungen):
${JSON.stringify(successPatterns.slice(0, 10), null, 2)}

FAILURE PATTERNS (${failurePatterns.length} abgelehnte Vorschläge):
${JSON.stringify(failurePatterns.slice(0, 5), null, 2)}

TREND DETECTION (wiederkehrende Muster):
${JSON.stringify(trends, null, 2)}

AUFGABE:
1. Analysiere SUCCESS PATTERNS: Was haben erfolgreiche Verbesserungen gemeinsam?
2. Analysiere FAILURE PATTERNS: Warum wurden Vorschläge abgelehnt?
3. Identifiziere TREND-basierte Chancen: Welche systematischen Probleme können gelöst werden?
4. Generiere ${limit} NEUE Verbesserungsvorschläge basierend auf den Erkenntnissen.

STRUKTUR PRO NEUEM VORSCHLAG:
{
  "title": "Prägnanter Titel",
  "priority": "critical|high|medium|low",
  "area": "performance|relationship_integrity|ai_quality|query_governance|design|workflow",
  "current_state": "Problem mit Zahlen",
  "target_state": "Messbares Ziel",
  "ki_recommendation": "Konkrete Empfehlung",
  "implementation_steps": ["Schritt 1", "Schritt 2"],
  "estimated_impact": {
    "performance_improvement_percent": 25,
    "effort_level": "low|medium|high",
    "estimated_hours": 4
  },
  "success_metrics": {
    "metric": "Metrik-Name",
    "before_ms": 500,
    "target_ms": 300,
    "how_to_measure": "Wie messen?"
  },
  "learning_source": "Welches Success Pattern wurde gelernt?",
  "confidence_score": 0.85 // 0-1, wie sicher ist die KI
}

ANTWORTE ALS JSON ARRAY mit neuen Vorschlägen.`;

    const result = await base44.integrations.Core.InvokeLLM({
      prompt,
      response_json_schema: {
        type: 'object',
        properties: {
          new_improvements: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                title: { type: 'string' },
                priority: { type: 'string', enum: ['critical', 'high', 'medium', 'low'] },
                area: { type: 'string' },
                current_state: { type: 'string' },
                target_state: { type: 'string' },
                ki_recommendation: { type: 'string' },
                implementation_steps: { type: 'array', items: { type: 'string' } },
                estimated_impact: {
                  type: 'object',
                  properties: {
                    performance_improvement_percent: { type: 'number' },
                    effort_level: { type: 'string', enum: ['low', 'medium', 'high'] },
                    estimated_hours: { type: 'number' },
                  },
                },
                success_metrics: {
                  type: 'object',
                  properties: {
                    metric: { type: 'string' },
                    before_ms: { type: 'number' },
                    target_ms: { type: 'number' },
                    how_to_measure: { type: 'string' },
                  },
                },
                learning_source: { type: 'string' },
                confidence_score: { type: 'number' },
              },
            },
          },
          analysis_summary: { type: 'string' },
          success_pattern_insights: { type: 'array', items: { type: 'string' } },
          failure_pattern_insights: { type: 'array', items: { type: 'string' } },
        },
      },
    });

    // ── NEUE VORSCHLÄGE speichern ────────────────────────────────────────────
    const improvementsWithMeta = result.new_improvements.map((imp, idx) => ({
      ...imp,
      audit_id: `LEARNED-${Date.now()}-${idx}`,
      status: 'proposed',
      proposed_by: user.full_name || user.email,
      proposed_at: new Date().toISOString(),
      learning_source: imp.learning_source,
      confidence_score: imp.confidence_score,
      is_learned_improvement: true, // Flag für learned improvements
    }));

    const createdImprovements = [];
    for (const imp of improvementsWithMeta) {
      const record = await base44.entities.EnterpriseImprovement.create(imp);
      createdImprovements.push(record);
    }

    // ── ANALYSE-ZUSAMMENFASSUNG ──────────────────────────────────────────────
    const analysisSummary = {
      total_learned_from: verified.length,
      success_patterns_analyzed: successPatterns.length,
      failure_patterns_analyzed: failurePatterns.length,
      trends_detected: trends.length,
      new_improvements_generated: createdImprovements.length,
      average_confidence: createdImprovements.length > 0
        ? (createdImprovements.reduce((sum, i) => sum + (i.confidence_score || 0), 0) / createdImprovements.length).toFixed(2)
        : 0,
    };

    return Response.json({
      new_improvements: createdImprovements,
      total_count: createdImprovements.length,
      analysis_summary: analysisSummary,
      success_pattern_insights: result.success_pattern_insights || [],
      failure_pattern_insights: result.failure_pattern_insights || [],
      trends_detected: trends,
      learning_mode: mode,
      analyzed_at: new Date().toISOString(),
      analyzed_by: user.full_name || user.email,
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});