import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

/**
 * Backend-Funktion: Liefert nur die Daten, auf die der Benutzer Zugriff hat
 * Verwendet für Dashboard, Listen, etc.
 */
Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const { entity, entityId } = await req.json();

    // Admin darf alles sehen
    if (user.role === 'admin') {
      if (entityId) {
        const data = await base44.entities[entity].get(entityId);
        return Response.json({ allowed: true, data });
      }
      const data = await base44.entities[entity].list();
      return Response.json({ allowed: true, data });
    }

    // Broker/Assistenz: Nur zugeteilte Kunden/Verträge
    if (entity === 'Customer') {
      if (entityId) {
        // Prüfe Kundenzuordnung
        const assignment = await base44.entities.CustomerAdvisor.filter({
          customer_id: entityId,
          advisor_id: user.id,
        });
        if (assignment.length === 0) {
          return Response.json({ allowed: false }, { status: 403 });
        }
        const data = await base44.entities.Customer.get(entityId);
        return Response.json({ allowed: true, data });
      }

      // Liste nur zugeteilte Kunden
      const assignments = await base44.entities.CustomerAdvisor.filter({
        advisor_id: user.id,
      });
      const customerIds = assignments.map(a => a.customer_id);
      const allCustomers = await base44.entities.Customer.list();
      const filtered = allCustomers.filter(c => customerIds.includes(c.id));
      return Response.json({ allowed: true, data: filtered });
    }

    if (entity === 'Contract') {
      if (entityId) {
        // Prüfe Vertragszuordnung
        const contractAssignment = await base44.entities.ContractAdvisor.filter({
          contract_id: entityId,
          advisor_id: user.id,
        });
        if (contractAssignment.length > 0) {
          const data = await base44.entities.Contract.get(entityId);
          return Response.json({ allowed: true, data });
        }

        // Fallback: Kunde zugeordnet?
        const contract = await base44.entities.Contract.get(entityId);
        const customerAssignment = await base44.entities.CustomerAdvisor.filter({
          customer_id: contract.customer_id,
          advisor_id: user.id,
        });
        if (customerAssignment.length > 0) {
          return Response.json({ allowed: true, data: contract });
        }

        return Response.json({ allowed: false }, { status: 403 });
      }

      // Liste nur zugeteilte Verträge
      const assignments = await base44.entities.ContractAdvisor.filter({
        advisor_id: user.id,
      });
      const contractIds = assignments.map(a => a.contract_id);
      const allContracts = await base44.entities.Contract.list();
      const filtered = allContracts.filter(c => contractIds.includes(c.id));
      return Response.json({ allowed: true, data: filtered });
    }

    return Response.json({ allowed: false }, { status: 403 });
  } catch (error) {
    console.error('Access Control Error:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});