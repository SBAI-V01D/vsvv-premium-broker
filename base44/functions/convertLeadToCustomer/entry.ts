import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

/**
 * CONVERT LEAD TO CUSTOMER
 * 
 * Triggered when lead.status = converted
 * Creates new customer from lead data
 */

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const payload = await req.json();
    const { lead_id } = payload;

    if (!lead_id) {
      return Response.json({ error: 'lead_id erforderlich' }, { status: 400 });
    }

    console.log(`[convertLeadToCustomer] START lead=${lead_id}`);

    // ─── FETCH LEAD ───
    const lead = await base44.entities.Lead.get(lead_id);
    if (!lead) {
      return Response.json({ error: 'Lead nicht gefunden' }, { status: 404 });
    }

    // ─── Check if already converted ───
    if (lead.customer_id) {
      return Response.json({
        success: false,
        message: 'Lead bereits konvertiert',
        customer_id: lead.customer_id,
      });
    }

    // ─── CREATE CUSTOMER ───
    const newCustomer = await base44.entities.Customer.create({
      first_name: lead.name.split(' ')[0] || lead.name,
      last_name: lead.name.split(' ').slice(1).join(' ') || '',
      email: lead.email,
      phone: lead.phone || '',
      company_name: lead.company || '',
      advisor_id: lead.advisor_id || '',
      status: 'active',
      customer_type: lead.company ? 'business' : 'private',
      is_family_member: false,
      portal_enabled: false,
    });

    console.log(`[convertLeadToCustomer] ✅ Customer created: ${newCustomer.id}`);

    // ─── UPDATE LEAD ───
    await base44.entities.Lead.update(lead_id, {
      status: 'converted',
      customer_id: newCustomer.id,
      converted_at: new Date().toISOString(),
    });

    console.log(`[convertLeadToCustomer] ✅ Lead converted`);

    return Response.json({
      success: true,
      lead_id,
      customer_id: newCustomer.id,
      message: 'Lead erfolgreich konvertiert zu Kunde',
    });
  } catch (error) {
    console.error(`[convertLeadToCustomer] ERROR: ${error.message}`);
    return Response.json({ success: false, error: error.message }, { status: 500 });
  }
});