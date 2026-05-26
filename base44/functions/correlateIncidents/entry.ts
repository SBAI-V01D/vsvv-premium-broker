/**
 * correlateIncidents — Intelligent Incident Correlation Engine
 *
 * Gruppiert ähnliche offene Incidents nach Root Cause / Kategorie / Entity-Typ.
 * Hält 1 primären Incident pro Cluster offen, setzt überzählige auf 'accepted_risk'
 * mit Verweis auf den primären Incident (Cluster).
 *
 * Nur von Admin aufrufbar.
 */
import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (user?.role !== 'admin') {
      return Response.json({ error: 'Admin access required' }, { status: 403 });
    }

    const sr = base44.asServiceRole;
    const incidents = await sr.entities.EnterpriseIncident.list('-detected_at', 500);

    // Nur aktiv offene Incidents korrelieren
    const openIncidents = incidents.filter(i =>
      ['open', 'investigating', 'in_progress'].includes(i.status)
    );

    // Cluster-Key: category + entity_type (beide müssen übereinstimmen)
    const clusterMap = {};
    for (const inc of openIncidents) {
      const key = `${inc.category || 'other'}::${inc.entity_type || 'unknown'}`;
      if (!clusterMap[key]) clusterMap[key] = [];
      clusterMap[key].push(inc);
    }

    const results = {
      clusters_found: 0,
      incidents_correlated: 0,
      incidents_kept_primary: 0,
      cluster_summary: [],
    };

    for (const [key, group] of Object.entries(clusterMap)) {
      if (group.length < 2) continue; // kein Cluster — nur 1 Incident

      // Sortieren: neuestes zuerst (primary)
      group.sort((a, b) => new Date(b.detected_at || b.created_date) - new Date(a.detected_at || a.created_date));
      const primary = group[0];
      const related  = group.slice(1);

      const [category, entityType] = key.split('::');
      results.clusters_found++;
      results.incidents_kept_primary++;
      results.incidents_correlated += related.length;

      // Verwandte Incidents auf accepted_risk setzen mit Referenz auf Primary
      for (const rel of related) {
        await sr.entities.EnterpriseIncident.update(rel.id, {
          status: 'accepted_risk',
          resolution_notes: `[KORRELIERT] Zusammengefasst in Cluster: "${primary.title}" (ID: ${primary.id}). Kategorie: ${category}, Entity: ${entityType}. Automatisch korreliert durch correlateIncidents am ${new Date().toISOString()}.`,
          resolved_at: new Date().toISOString(),
          resolved_by: user.email,
        });
      }

      // Primary Incident mit Cluster-Info aktualisieren
      await sr.entities.EnterpriseIncident.update(primary.id, {
        title: `[CLUSTER] ${primary.title}`,
        description: `${primary.description}\n\n---\n[Cluster: ${group.length} verwandte Incidents. ${related.length} korreliert und geschlossen.]`,
      });

      results.cluster_summary.push({
        key,
        category,
        entity_type: entityType,
        total: group.length,
        primary_id: primary.id,
        primary_title: primary.title,
        related_closed: related.length,
      });
    }

    // Audit-Log
    await sr.entities.AuditLog.create({
      timestamp: new Date().toISOString(),
      action: 'incident_correlation',
      actor_type: 'user',
      actor_id: user.id,
      actor_name: user.full_name || user.email,
      details: JSON.stringify(results),
    }).catch(() => {});

    return Response.json({
      success: true,
      ...results,
      message: `${results.clusters_found} Cluster gefunden. ${results.incidents_correlated} Incidents korreliert und geschlossen.`,
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});