import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { primaryCustomerId, primaryCustomerName, firstName, lastName, familyRole, birthdate, gender, email, street, zip_code, city } = await req.json();

    // Validierung
    if (!primaryCustomerId || !firstName || !familyRole) {
      return Response.json({ error: 'Missing required fields' }, { status: 400 });
    }
    
    if (!lastName) {
      return Response.json({ error: 'Last name required' }, { status: 400 });
    }

    // Primärkunde laden
    const customers = await base44.entities.Customer.filter({ id: primaryCustomerId });
    if (customers.length === 0) {
      return Response.json({ error: 'Primary customer not found' }, { status: 404 });
    }

    const primaryCustomer = customers[0];

    // Dublettenprüfung: Prüfe ob Name + Geburtsdatum schon existiert
    const duplicates = await base44.entities.Customer.filter({
      primary_customer_id: primaryCustomerId,
      first_name: firstName,
      is_family_member: true,
    });
    
    if (duplicates.length > 0 && birthdate) {
      const exactMatch = duplicates.find(d => d.birthdate === birthdate);
      if (exactMatch) {
        return Response.json({ 
          error: `Familienmitglied "${firstName}" mit diesem Geburtsdatum existiert bereits`, 
          duplicate: true 
        }, { status: 409 });
      }
    }

    // Neues Familienmitglied erstellen
    // Nur ausgewählte Felder duplizieren
    const familyMember = {
      first_name: firstName,
      last_name: lastName,
      email: email || primaryCustomer.email || `noemail.${Date.now()}@family.local`,
      phone: primaryCustomer.phone,
      mobile: primaryCustomer.mobile,
      street: street || primaryCustomer.street,
      zip_code: zip_code || primaryCustomer.zip_code,
      city: city || primaryCustomer.city,
      canton: primaryCustomer.canton,
      nationality: primaryCustomer.nationality,
      birthdate: birthdate || null,
      civil_status: primaryCustomer.civil_status || 'single',
      
      // Familienstruktur
      is_family_member: true,
      primary_customer_id: primaryCustomerId,
      family_role: familyRole, // 'spouse', 'child', 'parent', 'other'
      
      // Organisatorische Daten übernehmen
      organization_id: primaryCustomer.organization_id,
      advisor_id: primaryCustomer.advisor_id,
      primary_advisor_id: primaryCustomer.primary_advisor_id || primaryCustomer.advisor_id,
      assigned_advisors: primaryCustomer.assigned_advisors || (primaryCustomer.advisor_id ? [primaryCustomer.advisor_id] : []),
      assigned_assistants: primaryCustomer.assigned_assistants || [],
      access_level: primaryCustomer.access_level || 'assigned_advisors_only',
      assigned_broker: primaryCustomer.assigned_broker,
      
      // Kundentypologien
      customer_type: primaryCustomer.customer_type || 'private',
      status: 'active',
      
      // Weitere Felder
      profession: primaryCustomer.profession || '',
      mandate_status: 'valid',
      portal_enabled: false,
      portal_must_change_password: true,
      
      // Tracking
      notes: `Familienmitglied von ${primaryCustomerName}. Beziehung: ${familyRole}`,
    };

    // Geschlecht hinzufügen falls vorhanden
    if (gender) {
      familyMember.gender = gender;
    }

    // Speichern
    const result = await base44.entities.Customer.create(familyMember);

    // Audit Log
    await base44.entities.AuditLog.create({
      entity_type: 'customer',
      entity_id: result.id,
      action: 'create',
      changed_by: user.email,
      changed_at: new Date().toISOString(),
      summary: `Familienmitglied erstellt: ${firstName} (Beziehung: ${familyRole})`,
      new_values: {
        first_name: firstName,
        family_role: familyRole,
        primary_customer_id: primaryCustomerId,
        is_family_member: true,
      },
    });

    return Response.json({
      success: true,
      familyMemberId: result.id,
      familyMember: result,
    });
  } catch (error) {
    console.error('Error creating family member:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});