import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

/**
 * Filter Alle Daten nach Benutzerrechten
 * Für Dashboards, Listen, etc.
 */
Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const { entityType, limit = 100 } = await req.json();

    // Admin sieht alles
    if (user.role === 'admin') {
      if (entityType === 'Customer') {
        const data = await base44.asServiceRole.entities.Customer.list(null, limit);
        return Response.json({ data, total: data.length });
      }
      if (entityType === 'Contract') {
        const data = await base44.asServiceRole.entities.Contract.list(null, limit);
        return Response.json({ data, total: data.length });
      }
      if (entityType === 'Document') {
        const data = await base44.asServiceRole.entities.Document.list(null, limit);
        return Response.json({ data, total: data.length });
      }
    }

    // Broker: Nur zugewiesene Kunden
    if (entityType === 'Customer') {
      const allCustomers = await base44.asServiceRole.entities.Customer.list(null, limit);
      const visibleCustomers = allCustomers.filter(c => 
        c.primary_advisor_id === user.id ||
        c.assigned_advisors?.includes(user.id) ||
        c.assigned_assistants?.includes(user.id)
      );
      return Response.json({ data: visibleCustomers, total: visibleCustomers.length });
    }

    // Broker: Nur zugewiesene Verträge
    if (entityType === 'Contract') {
      const allContracts = await base44.asServiceRole.entities.Contract.list(null, limit);
      const visibleContracts = allContracts.filter(c => 
        c.primary_broker_id === user.id ||
        c.assigned_brokers?.includes(user.id) ||
        c.assigned_team?.includes(user.id)
      );
      return Response.json({ data: visibleContracts, total: visibleContracts.length });
    }

    // Broker: Nur zugewiesene Dokumente
    if (entityType === 'Document') {
      const allDocs = await base44.asServiceRole.entities.Document.list(null, limit);
      const visibleDocs = allDocs.filter(d => 
        d.access_advisors?.includes(user.id) ||
        d.access_teams?.includes(user.id)
      );
      return Response.json({ data: visibleDocs, total: visibleDocs.length });
    }

    return Response.json({ error: 'Unknown entity type' }, { status: 400 });
  } catch (error) {
    console.error('Get Visible Data Error:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});