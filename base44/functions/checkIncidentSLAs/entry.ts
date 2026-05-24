/**
 * checkIncidentSLAs — Automatische SLA-Überwachung & Eskalation
 * 
 * Läuft als Scheduled Job alle 30 Minuten.
 * Prüft offene Incidents gegen ihre SLA-Fristen.
 * Eskaliert überfällige Incidents automatisch.
 * 
 * SLA-Regeln:
 *  - blocking: 2h → warning, 4h → breached
 *  - critical:  4h → warning, 8h → breached
 *  - warning:  24h → warning, 48h → breached
 *  - info:     72h → warning, 168h → breached
 */
import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

const SLA_HOURS = {
  blocking: { warning: 2, breach: 4 },
  critical: { warning: 4, breach: 8 },
  warning:  { warning: 24, breach: 48 },
  info:     { warning: 72, breach: 168 },
};

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);

    // Allow scheduled calls (no user) or admin calls
    let isAdmin = false;
    try {
      const user = await base44.auth.me();
      if (user?.role === 'admin') isAdmin = true;
    } catch {
      // scheduled call — allow via service role
      isAdmin = true;
    }

    if (!isAdmin) {
      return Response.json({ error: 'Forbidden' }, { status: 403 });
    }

    const now = new Date();
    const OPEN_STATUSES = ['open', 'investigating', 'in_progress'];

    // Fetch all open/in_progress incidents
    const incidents = await base44.asServiceRole.entities.EnterpriseIncident.list('-detected_at', 200);
    const openIncidents = incidents.filter(i => OPEN_STATUSES.includes(i.status));

    const updated = [];
    const escalated = [];

    for (const incident of openIncidents) {
      const detectedAt = incident.detected_at ? new Date(incident.detected_at) : new Date(incident.created_date);
      const ageHours = (now - detectedAt) / (1000 * 60 * 60);
      const sla = SLA_HOURS[incident.severity] || SLA_HOURS.warning;

      let newSlaStatus = 'ok';
      let shouldEscalate = false;

      if (ageHours >= sla.breach) {
        newSlaStatus = 'breached';
        if (!incident.sla_escalated) {
          shouldEscalate = true;
        }
      } else if (ageHours >= sla.warning) {
        newSlaStatus = 'warning';
      }

      const updates = {};
      let changed = false;

      // Set sla_due_at if not set
      if (!incident.sla_due_at) {
        updates.sla_due_at = new Date(detectedAt.getTime() + sla.breach * 60 * 60 * 1000).toISOString();
        changed = true;
      }

      if (newSlaStatus !== incident.sla_status) {
        updates.sla_status = newSlaStatus;
        changed = true;
      }

      if (shouldEscalate) {
        updates.sla_escalated = true;
        updates.sla_escalated_at = now.toISOString();
        updates.priority = 'critical'; // Auto-elevate priority on breach

        // Append to incident audit log
        const auditEntry = {
          timestamp: now.toISOString(),
          user_id: 'system',
          user_name: 'SLA Automation',
          action: 'sla_escalated',
          previous_status: incident.status,
          new_status: incident.status,
          comment: `SLA überschritten: ${Math.round(ageHours)}h seit Erkennung (SLA: ${sla.breach}h). Priorität auf CRITICAL erhöht.`,
        };
        updates.incident_audit_log = [
          ...(incident.incident_audit_log || []),
          auditEntry,
        ];

        // Create notification in SystemLog
        await base44.asServiceRole.entities.SystemLog.create({
          level: 'critical',
          source: 'checkIncidentSLAs',
          message: `SLA-BREACH: Incident "${incident.title}" — ${Math.round(ageHours)}h offen (SLA: ${sla.breach}h)`,
          details: JSON.stringify({
            incident_id: incident.id,
            severity: incident.severity,
            age_hours: Math.round(ageHours),
            sla_hours: sla.breach,
            category: incident.category,
          }),
          related_entity_type: 'EnterpriseIncident',
          related_entity_id: incident.id,
        });

        escalated.push({ id: incident.id, title: incident.title, age_hours: Math.round(ageHours) });
        changed = true;
      }

      if (changed) {
        await base44.asServiceRole.entities.EnterpriseIncident.update(incident.id, updates);
        updated.push(incident.id);
      }
    }

    // Summary stats
    const stats = {
      total_open: openIncidents.length,
      sla_ok: openIncidents.filter(i => !i.sla_status || i.sla_status === 'ok').length,
      sla_warning: openIncidents.filter(i => i.sla_status === 'warning').length,
      sla_breached: openIncidents.filter(i => i.sla_status === 'breached').length,
    };

    return Response.json({
      success: true,
      timestamp: now.toISOString(),
      incidents_checked: openIncidents.length,
      incidents_updated: updated.length,
      escalations_triggered: escalated.length,
      escalated_incidents: escalated,
      stats,
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});