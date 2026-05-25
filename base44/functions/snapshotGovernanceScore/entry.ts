/**
 * snapshotGovernanceScore — Daily Governance Score Snapshot
 * 
 * Ruft calculateGovernanceRiskScore auf, persistiert das Ergebnis
 * als GovernanceScoreSnapshot mit Trend-Berechnung gegenüber Vortag.
 * 
 * Läuft täglich 06:00 Zürich-Zeit via Scheduled Automation.
 * Kann manuell von Admin ausgelöst werden.
 */
import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);

    // Allow scheduled calls (no user auth) or admin calls
    let callerEmail = 'scheduler';
    try {
      const user = await base44.auth.me();
      if (user) {
        if (user.role !== 'admin') {
          return Response.json({ error: 'Forbidden: Admin access required' }, { status: 403 });
        }
        callerEmail = user.email;
      }
    } catch {
      // Scheduled call — service role only
    }

    // 1. Compute fresh score — use passthrough auth (forwards user token for admin check)
    const scoreResult = await base44.functions.invoke('calculateGovernanceRiskScore', {});
    const score = scoreResult?.overall !== undefined ? scoreResult : null;

    if (!score) {
      return Response.json({ error: 'calculateGovernanceRiskScore returned no data' }, { status: 500 });
    }

    // 2. Load yesterday's snapshot for trend
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    const allSnapshots = await base44.asServiceRole.entities.GovernanceScoreSnapshot.list('-computed_at', 5);
    const previousSnapshot = allSnapshots[0] || null;
    const previousOverall = previousSnapshot?.overall || null;

    let trend = 'stable';
    let trendDelta = 0;
    if (previousOverall !== null) {
      trendDelta = score.overall - previousOverall;
      if (trendDelta > 1) trend = 'up';
      else if (trendDelta < -1) trend = 'down';
    }

    // 3. Persist snapshot
    const today = new Date().toISOString().split('T')[0];
    const snapshot = await base44.asServiceRole.entities.GovernanceScoreSnapshot.create({
      snapshot_date: today,
      overall: score.overall,
      risk_level: score.risk_level,
      domains: score.domains,
      alerts: score.alerts || [],
      weights: score.weights || {},
      computed_at: new Date().toISOString(),
      computed_by: callerEmail,
      previous_overall: previousOverall,
      trend,
      trend_delta: Math.round(trendDelta * 10) / 10,
    });

    return Response.json({
      success: true,
      snapshot_id: snapshot.id,
      overall: score.overall,
      risk_level: score.risk_level,
      trend,
      trend_delta: trendDelta,
      computed_at: snapshot.computed_at,
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});