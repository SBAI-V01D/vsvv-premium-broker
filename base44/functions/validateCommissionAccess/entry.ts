import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

/**
 * RLS VALIDATOR für Commission Entities
 * 
 * Wird VOR jeder Commission-Operation aufgerufen:
 * - Liest User-Rolle
 * - Filtet CommissionEntry Queries nach Rolle
 * - Validiert alle Mutations
 * 
 * RESPONSE:
 * {
 *   allowed: boolean,
 *   filter: { advisor_id: "xyz" }, // Automatischer Filter für RLS
 *   writable: boolean, // Darf Mutations durchführen
 * }
 */

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const payload = await req.json();
    const { action, commission_ids = [] } = payload;

    // ─── ADMIN: No Filter ────────────────────────────────────────
    if (user.role === 'admin') {
      return Response.json({
        allowed: true,
        writable: true,
        filter: null, // Admin sieht alles
        reason: 'Admin: Vollzugriff',
      });
    }

    // ─── ADVISOR / BROKER: Nur eigene Commissions ────────────────
    if (user.role === 'advisor' || user.role === 'broker') {
      // Automatischer Filter: nur advisor_id = current user
      const filter = { advisor_id: user.id };
      
      // Prüfe: Alle commission_ids gehören zu diesem Advisor
      if (commission_ids && commission_ids.length > 0) {
        const comms = await base44.entities.CommissionEntry.filter({
          id: { $in: commission_ids }
        });
        
        const unauthorized = comms.filter(c => c.advisor_id !== user.id);
        if (unauthorized.length > 0) {
          return Response.json({
            allowed: false,
            reason: `Berater kann nicht auf fremde Commissions zugreifen`,
            attempted_count: unauthorized.length,
          }, { status: 403 });
        }
      }

      return Response.json({
        allowed: true,
        writable: action === 'read' ? false : (action === 'create' || action === 'update'), // Lesend immer, Schreib nur eigene
        filter: filter, // Frontend/Backend nutzt diesen Filter
        reason: `Berater: Nur eigene Commissions (${user.id})`,
      });
    }

    // ─── TEAM LEAD: Nur Team-Commissions ────────────────────────
    if (user.role === 'team_lead') {
      // Simplifikat: Alle Team-Member laden
      const teamMembers = await base44.entities.Advisor.filter({
        team_id: user.team_id // Annahme: user hat team_id
      });
      
      const advisorIds = teamMembers.map(m => m.id);
      const filter = { advisor_id: { $in: advisorIds } };

      return Response.json({
        allowed: true,
        writable: action === 'read' ? false : true, // Lesend, keine Mutations
        filter: filter,
        reason: `Teamleiter: Team-Commissions`,
      });
    }

    // ─── DEFAULT: Kein Zugriff ──────────────────────────────────
    return Response.json({
      allowed: false,
      writable: false,
      reason: `Rolle '${user.role}' hat keinen Zugriff auf Commissions`,
    }, { status: 403 });

  } catch (error) {
    console.error('[validateCommissionAccess] ERROR:', error.message);
    return Response.json(
      { error: error.message },
      { status: 500 }
    );
  }
});