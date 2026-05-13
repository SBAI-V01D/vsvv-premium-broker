import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

/**
 * Universal Access Control Guard
 * Prüft, ob Benutzer auf Kunden/Verträge/Dokumente zugreifen darf
 */
Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ allowed: false }, { status: 401 });

    const { entityType, entityId } = await req.json();

    // Admin darf immer
    if (user.role === 'admin') {
      return Response.json({ allowed: true, reason: 'admin' });
    }

    // Customer Access Control
    if (entityType === 'Customer') {
      const customer = await base44.asServiceRole.entities.Customer.get(entityId);
      if (!customer) return Response.json({ allowed: false }, { status: 404 });

      // Prüfe primary_advisor_id (normalize: email oder ID)
      const userIdentifier = user.id || user.email;
      if (customer.primary_advisor_id === userIdentifier) {
        return Response.json({ allowed: true, reason: 'primary_advisor' });
      }

      // Prüfe assigned_advisors
      if ((customer.assigned_advisors || []).includes(userIdentifier)) {
        return Response.json({ allowed: true, reason: 'assigned_advisor' });
      }

      // Prüfe assigned_assistants
      if ((customer.assigned_assistants || []).includes(userIdentifier)) {
        return Response.json({ allowed: true, reason: 'assigned_assistant' });
      }

      // Family member access: if user has access to primary, they see family members too
      if (customer.is_family_member && customer.primary_customer_id) {
        const primaryCustomer = await base44.asServiceRole.entities.Customer.get(customer.primary_customer_id);
        if (primaryCustomer && (primaryCustomer.primary_advisor_id === userIdentifier || 
            (primaryCustomer.assigned_advisors || []).includes(userIdentifier))) {
          return Response.json({ allowed: true, reason: 'via_primary_family' });
        }
      }

      return Response.json({ allowed: false }, { status: 403 });
    }

    // Contract Access Control
    if (entityType === 'Contract') {
      const contract = await base44.asServiceRole.entities.Contract.get(entityId);
      if (!contract) return Response.json({ allowed: false }, { status: 404 });

      const userIdentifier = user.id || user.email;

      // Prüfe primary_broker_id
      if (contract.primary_broker_id === userIdentifier) {
        return Response.json({ allowed: true, reason: 'primary_broker' });
      }

      // Prüfe assigned_brokers
      if ((contract.assigned_brokers || []).includes(userIdentifier)) {
        return Response.json({ allowed: true, reason: 'assigned_broker' });
      }

      // Prüfe assigned_team
      if ((contract.assigned_team || []).includes(userIdentifier)) {
        return Response.json({ allowed: true, reason: 'assigned_team' });
      }

      // Fallback: Kundenzuordnung
      const customer = await base44.asServiceRole.entities.Customer.get(contract.customer_id);
      if (customer && (customer.primary_advisor_id === userIdentifier || 
          (customer.assigned_advisors || []).includes(userIdentifier))) {
        return Response.json({ allowed: true, reason: 'via_customer' });
      }

      return Response.json({ allowed: false }, { status: 403 });
    }

    // Document Access Control
    if (entityType === 'Document') {
      const doc = await base44.asServiceRole.entities.Document.get(entityId);
      if (!doc) return Response.json({ allowed: false }, { status: 404 });

      const userIdentifier = user.id || user.email;

      // Prüfe access_advisors
      if ((doc.access_advisors || []).includes(userIdentifier)) {
        return Response.json({ allowed: true, reason: 'in_access_list' });
      }

      // Prüfe access_teams
      if ((doc.access_teams || []).includes(userIdentifier)) {
        return Response.json({ allowed: true, reason: 'in_team' });
      }

      // Fallback: Kundenzuordnung
      const customer = await base44.asServiceRole.entities.Customer.get(doc.customer_id);
      if (customer && (customer.primary_advisor_id === userIdentifier || 
          (customer.assigned_advisors || []).includes(userIdentifier))) {
        return Response.json({ allowed: true, reason: 'via_customer' });
      }

      return Response.json({ allowed: false }, { status: 403 });
    }

    return Response.json({ allowed: false }, { status: 400 });
  } catch (error) {
    console.error('Access Guard Error:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});