/**
 * repairDossierOrgIds — Auto-Repair: organization_id auf Dossiers nachtragen
 *
 * Priorität:
 *   1. customer.organization_id (aus verknüpftem Kunden)
 *   2. advisor.organization_id  (aus verknüpftem Berater)
 *   3. created_by → User-Profil (falls Advisor/Customer leer)
 *
 * Admin-only. Gibt repaired/skipped/failed zurück.
 */
import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });
    if (user.role !== 'admin') return Response.json({ error: 'Forbidden: Admin only' }, { status: 403 });

    // Optional: einzelnes Dossier per entity_id (aus Automation oder Incident-Repair)
    let payload = {};
    try { payload = await req.json(); } catch (_) {}
    const singleId = payload?.entity_id || payload?.dossierId || null;

    // Alle Dossiers ohne organization_id laden (oder nur das eine)
    let affected;
    if (singleId) {
      const single = await base44.asServiceRole.entities.AdvisoryDossier.get(singleId);
      affected = single && !single.organization_id ? [single] : [];
    } else {
      const dossiers = await base44.asServiceRole.entities.AdvisoryDossier.list('-created_date', 500);
      affected = dossiers.filter(d => !d.organization_id);
    }

    if (affected.length === 0) {
      return Response.json({ repaired: 0, skipped: 0, failed: 0, message: 'Alle Dossiers haben bereits eine organization_id.' });
    }

    // Lookup-Caches (vermeidet doppelte DB-Anfragen)
    const customerCache = {};
    const advisorCache = {};

    let repaired = 0;
    let skipped = 0;
    const failed = [];

    for (const dossier of affected) {
      let orgId = null;
      let source = null;

      // Weg 1: organization_id vom Kunden
      if (dossier.customer_id) {
        if (!customerCache[dossier.customer_id]) {
          try {
            customerCache[dossier.customer_id] = await base44.asServiceRole.entities.Customer.get(dossier.customer_id);
          } catch (_) {
            customerCache[dossier.customer_id] = null;
          }
        }
        const customer = customerCache[dossier.customer_id];
        if (customer?.organization_id) {
          orgId = customer.organization_id;
          source = 'customer';
        }
      }

      // Weg 2: organization_id vom Berater
      if (!orgId && dossier.advisor_id) {
        if (!advisorCache[dossier.advisor_id]) {
          try {
            const advisors = await base44.asServiceRole.entities.Advisor.filter({ organization_id: { $exists: true } }, '-created_date', 1);
            // Direkt per ID holen
            try {
              advisorCache[dossier.advisor_id] = await base44.asServiceRole.entities.Advisor.get(dossier.advisor_id);
            } catch (_) {
              advisorCache[dossier.advisor_id] = null;
            }
          } catch (_) {
            advisorCache[dossier.advisor_id] = null;
          }
        }
        const advisor = advisorCache[dossier.advisor_id];
        if (advisor?.organization_id) {
          orgId = advisor.organization_id;
          source = 'advisor';
        }
      }

      // Weg 3: organization_id vom erstellenden User (falls Advisor-Profil vorhanden)
      if (!orgId && dossier.created_by) {
        try {
          const users = await base44.asServiceRole.entities.User.filter({ email: dossier.created_by });
          const creatorUser = users[0];
          if (creatorUser?.data?.organization_id) {
            orgId = creatorUser.data.organization_id;
            source = 'creator_user';
          }
        } catch (_) {}
      }

      if (orgId) {
        try {
          await base44.asServiceRole.entities.AdvisoryDossier.update(dossier.id, { organization_id: orgId });
          repaired++;
        } catch (e) {
          failed.push({ id: dossier.id, title: dossier.title, error: e.message });
        }
      } else {
        skipped++;
      }
    }

    // SystemLog
    await base44.asServiceRole.entities.SystemLog.create({
      level: failed.length > 0 ? 'warn' : 'info',
      source: 'repairDossierOrgIds',
      message: `Auto-Repair organization_id: ${repaired} repariert, ${skipped} nicht zuordenbar, ${failed.length} Fehler`,
      details: JSON.stringify({ repaired, skipped, failed: failed.slice(0, 10) }),
      user_email: user.email,
    });

    return Response.json({
      repaired,
      skipped,
      failed: failed.length,
      failed_details: failed,
      message: `${repaired} Dossier(s) repariert, ${skipped} konnten nicht zugeordnet werden (kein Kunde/Berater mit org_id gefunden).`,
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});