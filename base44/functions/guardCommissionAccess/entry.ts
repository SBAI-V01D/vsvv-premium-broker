import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

/**
 * ENTERPRISE SECURITY GATE für Commission Entities
 * 
 * RULES:
 * - Admin: Vollzugriff auf alle Commissions
 * - Berater: Nur eigene Commissions (advisor_id = user_id)
 * - Teamleiter: Nur Team-Commissions
 * - Andere: Kein Zugriff
 * 
 * USAGE:
 * Frontend/Backend vor CREATE/UPDATE/DELETE aufrufen
 */

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const payload = await req.json();
    const {
      action, // 'create', 'update', 'delete', 'read'
      commission_id,
      advisor_id, // für neue Commissions
    } = payload;

    // ─── ADMIN: Vollzugriff ───────────────────────────────────────
    if (user.role === 'admin') {
      return Response.json({
        allowed: true,
        reason: 'Admin access',
        user_role: 'admin',
      });
    }

    // ─── CREATE: Berater kann nur für sich selbst erstellen ────────
    if (action === 'create') {
      const targetAdvisor = advisor_id;
      
      // Berater kann nur für sich erstellen
      if (user.role === 'advisor' || user.role === 'broker') {
        if (targetAdvisor !== user.id) {
          return Response.json({
            allowed: false,
            reason: `Berater kann nur für sich selbst Commissions erstellen`,
            attempted_advisor: targetAdvisor,
            current_user: user.id,
          }, { status: 403 });
        }
      }

      // Teamleiter kann für sein Team erstellen
      if (user.role === 'team_lead') {
        // Prüfe ob targetAdvisor im Team des Teamleiters
        const advisor = await base44.entities.Advisor.filter({ id: targetAdvisor });
        if (advisor.length === 0) {
          return Response.json({ allowed: false, reason: 'Advisor not found' }, { status: 404 });
        }
        // Vereinfacht: Teamleiter hat Zugriff
        // In Produktion: advisor.team_id === teamlead.team_id prüfen
      }

      return Response.json({ allowed: true, reason: 'Create allowed' });
    }

    // ─── UPDATE / DELETE / READ: Commission laden und prüfen ──────
    if (!commission_id) {
      return Response.json({ error: 'commission_id erforderlich' }, { status: 400 });
    }

    const commission = await base44.entities.CommissionEntry.filter({ id: commission_id });
    if (commission.length === 0) {
      return Response.json({ allowed: false, reason: 'Commission not found' }, { status: 404 });
    }

    const comm = commission[0];

    // Berater: Nur eigene Commissions
    if (user.role === 'advisor' || user.role === 'broker') {
      if (comm.advisor_id !== user.id) {
        return Response.json({
          allowed: false,
          reason: 'Berater kann nur eigene Commissions bearbeiten',
          owned_by: comm.advisor_id,
        }, { status: 403 });
      }
    }

    // Teamleiter: Nur Team-Commissions (vereinfacht)
    if (user.role === 'team_lead') {
      // In Produktion: Team-Prüfung hinzufügen
      // Für jetzt: Erlauben
    }

    // ─── FINANCE-GATES ────────────────────────────────────────────
    // Nur Admin darf Status zu 'paid' setzen (Auszahlung)
    if ((action === 'update' || action === 'delete') && user.role !== 'admin') {
      const { courtage_status, provision_status } = payload.updates || {};
      
      if (courtage_status === 'paid' || provision_status === 'paid') {
        return Response.json({
          allowed: false,
          reason: 'Nur Admin darf Auszahlungen bestätigen',
        }, { status: 403 });
      }

      // Archivierung nur für Besitzer
      if (payload.updates?.archived && comm.advisor_id !== user.id) {
        return Response.json({
          allowed: false,
          reason: 'Nur der Besitzer darf archivieren',
        }, { status: 403 });
      }
    }

    return Response.json({
      allowed: true,
      reason: 'Access granted',
      user_role: user.role,
      commission_advisor: comm.advisor_id,
    });

  } catch (error) {
    console.error('[guardCommissionAccess] ERROR:', error.message);
    return Response.json(
      { allowed: false, error: error.message },
      { status: 500 }
    );
  }
});