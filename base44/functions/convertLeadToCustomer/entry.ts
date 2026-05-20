import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';
import { addMonths } from 'npm:date-fns@3';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const payload = await req.json();
    const { lead_id } = payload;

    if (!lead_id) return Response.json({ error: 'lead_id erforderlich' }, { status: 400 });

    console.log(`[convertLeadToCustomer] START lead=${lead_id}`);

    // Fetch lead
    const lead = await base44.entities.Lead.get(lead_id);
    if (!lead) return Response.json({ error: 'Lead nicht gefunden' }, { status: 404 });

    // Idempotency guard: already converted
    if (lead.customer_id) {
      return Response.json({
        success: false,
        message: 'Lead bereits konvertiert',
        customer_id: lead.customer_id,
      });
    }

    // Check via AutomationQueue to prevent race condition on double-click
    const existingJobs = await base44.entities.AutomationQueue.filter({
      related_entity_id: lead_id,
      job_type: 'lead_conversion',
      status: 'processing',
    });
    if (existingJobs.length > 0) {
      return Response.json({ success: false, message: 'Konvertierung läuft bereits' });
    }

    // Mark as processing
    const job = await base44.entities.AutomationQueue.create({
      job_type: 'lead_conversion',
      status: 'processing',
      related_entity_type: 'Lead',
      related_entity_id: lead_id,
      payload: JSON.stringify({ lead_id }),
    });

    // Safe name parsing: handle multi-part names
    const nameParts = (lead.name || '').trim().split(/\s+/);
    const firstName = nameParts.length > 1 ? nameParts.slice(0, -1).join(' ') : nameParts[0] || '';
    const lastName = nameParts.length > 1 ? nameParts[nameParts.length - 1] : '';

    // Create customer with organization_id inherited from lead
    const newCustomer = await base44.entities.Customer.create({
      first_name: firstName,
      last_name: lastName,
      email: lead.email,
      phone: lead.phone || '',
      company_name: lead.company || '',
      advisor_id: lead.advisor_id || '',
      organization_id: lead.organization_id || '',
      status: 'active',
      customer_type: lead.company ? 'business' : 'private',
      is_family_member: false,
      portal_enabled: false,
    });

    console.log(`[convertLeadToCustomer] ✅ Customer created: ${newCustomer.id}`);

    // AUTO-CREATE Verkaufschance basierend auf Lead-Daten
    const verkaufschanceData = {
      customer_id: newCustomer.id,
      customer_name: `${firstName} ${lastName}`.trim(),
      title: `Neugeschäft aus Lead ${lead.name || lead.email}`,
      sparte: 'krankenkasse', // Default, kann angepasst werden
      insurance_type: 'health',
      status: 'neu',
      priority: 'medium',
      estimated_value: 0, // Wird später aktualisiert
      expected_close_date: addMonths(new Date(), 3).toISOString().split('T')[0],
      assigned_broker: user.email,
      notes: `Automatisch erstellt aus Lead-Konvertierung. Original-Quelle: ${lead.source || 'manuell'}`,
    }

    const verkaufschance = await base44.entities.Verkaufschance.create(verkaufschanceData)
    console.log(`[convertLeadToCustomer] ✅ Verkaufschance created: ${verkaufschance.id}`)

    // Update lead + mark job done in parallel
    await Promise.all([
      base44.entities.Lead.update(lead_id, {
        status: 'converted',
        customer_id: newCustomer.id,
        converted_at: new Date().toISOString(),
      }),
      base44.entities.AutomationQueue.update(job.id, { status: 'completed' }),
    ]);

    console.log(`[convertLeadToCustomer] ✅ Lead converted`)

    return Response.json({
      success: true,
      lead_id,
      customer_id: newCustomer.id,
      verkaufschance_id: verkaufschance.id,
      message: 'Lead erfolgreich konvertiert zu Kunde + Verkaufschance erstellt',
    });
  } catch (error) {
    console.error(`[convertLeadToCustomer] ERROR: ${error.message}`);
    return Response.json({ success: false, error: error.message }, { status: 500 });
  }
});