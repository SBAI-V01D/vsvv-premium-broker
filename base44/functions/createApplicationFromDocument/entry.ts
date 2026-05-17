import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

/**
 * CREATE APPLICATION FROM DOCUMENT — Server-Side Only
 *
 * Erstellt nach manueller Bestätigung im UI:
 * 1. Optional: Neuen Kunden (Hauptkontakt oder Familienmitglied)
 * 2. Antrag mit Status "in_pruefung"
 * 3. Dokumentverknüpfung aktualisieren
 *
 * WICHTIG:
 * - Kein Vertrag wird hier erstellt (das macht onApplicationUpdate automatisch)
 * - Kein Frontend-Direktzugriff auf Contract-Erstellung
 * - Alle Duplikatprüfungen laufen serverseitig
 */

Deno.serve(async (req) => {
  const base44 = createClientFromRequest(req);

  try {
    const user = await base44.auth.me();
    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await req.json();
    const {
      documentId,
      documentSubtype,     // 'neuantrag' | 'aenderungsantrag' | 'erneuerungsantrag'
      customerAction,      // 'use_existing' | 'create_primary' | 'create_family_member'
      customerId,          // bei use_existing: existierende Kunden-ID
      primaryCustomerId,   // bei create_family_member: ID des Hauptkontakts
      newCustomerData,     // bei create_primary oder create_family_member: Kundendaten
      applicationData,     // Antragsdaten aus KI-Extraktion (vom User bestätigt)
    } = body;

    // ── Validierung ────────────────────────────────────────────────────────────
    if (!documentId) return Response.json({ error: 'documentId fehlt' }, { status: 400 });
    if (!customerAction) return Response.json({ error: 'customerAction fehlt' }, { status: 400 });
    if (!applicationData?.insurer) return Response.json({ error: 'Versicherer (insurer) ist Pflichtfeld' }, { status: 400 });

    // Lade das Dokument
    const docRecords = await base44.asServiceRole.entities.Document.filter({ id: documentId });
    if (!docRecords.length) return Response.json({ error: 'Dokument nicht gefunden' }, { status: 404 });
    const doc = docRecords[0];

    // Organisation ermitteln
    let orgId = applicationData.organization_id || null;
    if (!orgId) {
      const orgs = await base44.asServiceRole.entities.Organization.list('-created_date', 1);
      orgId = orgs?.[0]?.id || null;
    }
    if (!orgId) return Response.json({ error: 'Keine Organisation gefunden' }, { status: 400 });

    // ── Schritt 1: Kunden auflösen / erstellen ────────────────────────────────
    let resolvedCustomerId = null;
    let resolvedPrimaryCustomerId = null;
    let resolvedCustomerName = null;
    let isFamilyMember = false;

    if (customerAction === 'use_existing') {
      // Bestehender Kunde
      if (!customerId) return Response.json({ error: 'customerId fehlt für use_existing' }, { status: 400 });
      const customers = await base44.asServiceRole.entities.Customer.filter({ id: customerId });
      if (!customers.length) return Response.json({ error: 'Kunde nicht gefunden' }, { status: 404 });
      const customer = customers[0];
      resolvedCustomerId = customer.id;
      resolvedPrimaryCustomerId = customer.is_family_member
        ? (customer.primary_customer_id || customer.id)
        : customer.id;
      resolvedCustomerName = customer.company_name || `${customer.first_name || ''} ${customer.last_name || ''}`.trim();
      isFamilyMember = customer.is_family_member || false;

    } else if (customerAction === 'create_primary') {
      // Neuer Hauptkontakt
      if (!newCustomerData?.first_name || !newCustomerData?.last_name) {
        return Response.json({ error: 'Vorname und Nachname Pflicht für neuen Hauptkontakt' }, { status: 400 });
      }

      // Duplikatprüfung: gleiche E-Mail
      if (newCustomerData.email) {
        const emailCheck = await base44.asServiceRole.entities.Customer.filter({ email: newCustomerData.email });
        if (emailCheck.length > 0) {
          return Response.json({
            error: 'Kunde mit dieser E-Mail existiert bereits',
            existingCustomerId: emailCheck[0].id,
          }, { status: 409 });
        }
      }

      const email = newCustomerData.email || `${newCustomerData.first_name.toLowerCase()}.${newCustomerData.last_name.toLowerCase()}.${Date.now()}@placeholder.local`;
      const newCustomer = await base44.asServiceRole.entities.Customer.create({
        first_name: newCustomerData.first_name,
        last_name: newCustomerData.last_name,
        email,
        phone: newCustomerData.phone || null,
        birthdate: newCustomerData.birthdate || null,
        street: newCustomerData.street || null,
        zip_code: newCustomerData.zip_code || null,
        city: newCustomerData.city || null,
        organization_id: orgId,
        is_family_member: false,
        family_role: 'primary',
        status: 'active',
        mandate_status: 'pending',
      });

      resolvedCustomerId = newCustomer.id;
      resolvedPrimaryCustomerId = newCustomer.id;
      resolvedCustomerName = `${newCustomer.first_name} ${newCustomer.last_name}`;
      isFamilyMember = false;

      // Kundennummer generieren
      try {
        await base44.asServiceRole.functions.invoke('generateCustomerNumber', { customerId: newCustomer.id });
      } catch (e) {
        console.warn('[createApplicationFromDocument] Kundennummer-Generierung fehlgeschlagen:', e.message);
      }

    } else if (customerAction === 'create_family_member') {
      // Neues Familienmitglied
      if (!primaryCustomerId) return Response.json({ error: 'primaryCustomerId fehlt' }, { status: 400 });
      if (!newCustomerData?.first_name || !newCustomerData?.last_name) {
        return Response.json({ error: 'Vorname und Nachname Pflicht für Familienmitglied' }, { status: 400 });
      }

      // Hauptkontakt laden
      const primaryCustomers = await base44.asServiceRole.entities.Customer.filter({ id: primaryCustomerId });
      if (!primaryCustomers.length) return Response.json({ error: 'Hauptkontakt nicht gefunden' }, { status: 404 });
      const primary = primaryCustomers[0];

      // Duplikatprüfung: gleichnamiges Familienmitglied in dieser Familie
      const existingMembers = await base44.asServiceRole.entities.Customer.filter({ primary_customer_id: primaryCustomerId });
      const dupCheck = existingMembers.find(m =>
        m.first_name?.toLowerCase() === newCustomerData.first_name.toLowerCase() &&
        m.last_name?.toLowerCase() === newCustomerData.last_name.toLowerCase() &&
        (!newCustomerData.birthdate || !m.birthdate || m.birthdate === newCustomerData.birthdate)
      );
      if (dupCheck) {
        return Response.json({
          error: 'Familienmitglied mit diesem Namen existiert bereits',
          existingCustomerId: dupCheck.id,
        }, { status: 409 });
      }

      const familyEmail = newCustomerData.email || `${newCustomerData.first_name.toLowerCase()}.${newCustomerData.last_name.toLowerCase()}.${Date.now()}@placeholder.local`;
      const newMember = await base44.asServiceRole.entities.Customer.create({
        first_name: newCustomerData.first_name,
        last_name: newCustomerData.last_name,
        email: familyEmail,
        birthdate: newCustomerData.birthdate || null,
        ahv_number: newCustomerData.ahv_number || null,
        street: primary.street || null,
        zip_code: primary.zip_code || null,
        city: primary.city || null,
        organization_id: primary.organization_id || orgId,
        advisor_id: primary.advisor_id || null,
        is_family_member: true,
        family_role: newCustomerData.family_role || 'other',
        primary_customer_id: primaryCustomerId,
        status: 'active',
        mandate_status: 'pending',
      });

      resolvedCustomerId = newMember.id;
      resolvedPrimaryCustomerId = primaryCustomerId;
      resolvedCustomerName = `${newMember.first_name} ${newMember.last_name}`;
      isFamilyMember = true;

    } else {
      return Response.json({ error: `Unbekannte customerAction: ${customerAction}` }, { status: 400 });
    }

    // ── Schritt 2: Duplikatprüfung für Antrag ─────────────────────────────────
    if (applicationData.policy_number) {
      const existingApps = await base44.asServiceRole.entities.Application.filter({
        customer_id: resolvedCustomerId,
        policy_number: applicationData.policy_number,
      });
      const activeApp = existingApps.find(a => !a.archived);
      if (activeApp) {
        return Response.json({
          error: 'Antrag mit dieser Policennummer existiert bereits',
          existingApplicationId: activeApp.id,
        }, { status: 409 });
      }
    }

    // ── Schritt 3: Antrag erstellen (Status: in_pruefung) ─────────────────────
    const premiumMonthly = applicationData.premium_monthly || null;
    const premiumYearly = applicationData.premium_yearly
      || (premiumMonthly ? Math.round(premiumMonthly * 12 * 100) / 100 : null);

    const sparte = applicationData.sparte || applicationData.insurance_type || 'other';
    const sparteData = {
      franchise: applicationData.franchise ? String(applicationData.franchise) : null,
      model: applicationData.model || null,
      age_group: applicationData.coverage_type || null,
      product_type: applicationData.insurance_type?.toUpperCase() || null,
      zahlungsintervall: applicationData.payment_interval || null,
      health_declaration: applicationData.health_declaration_required ? 'Ja' : 'Nein',
    };

    const newApplication = await base44.asServiceRole.entities.Application.create({
      customer_id: resolvedCustomerId,
      customer_name: resolvedCustomerName,
      primary_customer_id: resolvedPrimaryCustomerId,
      is_family_member: isFamilyMember,
      organization_id: orgId,
      advisor_id: applicationData.advisor_id || null,
      kundentyp: 'privat',
      sparte,
      sparte_data: sparteData,
      insurance_type: applicationData.insurance_type || sparte,
      product: applicationData.product || null,
      insurer: applicationData.insurer,
      policy_number: applicationData.policy_number || null,
      estimated_premium_monthly: premiumMonthly,
      estimated_premium_yearly: premiumYearly,
      contract_start_date: applicationData.start_date || null,
      contract_end_date: applicationData.end_date || null,
      commission_estimate: applicationData.commission_estimate || null,
      assigned_broker: applicationData.broker_name || null,
      // Status: immer in_pruefung — Vertrag wird ERST nach manueller Statusänderung erstellt
      status: 'in_progress',
      custom_status: 'in_pruefung',
      status_changed_at: new Date().toISOString(),
      notes: `Aus Dokumenten-Upload erstellt (${documentSubtype || 'neuantrag'}). Dokument: ${doc.name}`,
    });

    // ── Schritt 4: Dokument verknüpfen ────────────────────────────────────────
    const subtypeToCategory = {
      neuantrag: 'application',
      aenderungsantrag: 'application',
      erneuerungsantrag: 'application',
    };

    await base44.asServiceRole.entities.Document.update(documentId, {
      customer_id: resolvedCustomerId,
      customer_name: resolvedCustomerName,
      primary_customer_id: resolvedPrimaryCustomerId,
      is_family_member: isFamilyMember,
      doc_type: 'antrag',
      category: subtypeToCategory[documentSubtype] || 'application',
      linked_application_id: newApplication.id,
      processing_stage: 'application_created',
      classification_status: 'klassifiziert',
    });

    // ── Schritt 5: Task für Antragsprüfung ────────────────────────────────────
    const dueDate = new Date();
    dueDate.setDate(dueDate.getDate() + 3);
    await base44.asServiceRole.entities.Task.create({
      title: `Antrag prüfen – ${resolvedCustomerName} (${applicationData.insurer})`,
      description: `Antrag aus Dokumenten-Upload erstellt. Typ: ${documentSubtype || 'neuantrag'}.\nVersicherer: ${applicationData.insurer}\nProdukt: ${applicationData.product || '–'}\nPolicennummer: ${applicationData.policy_number || '–'}\nJahresprämie: CHF ${premiumYearly || '–'}`,
      customer_id: resolvedCustomerId,
      customer_name: resolvedCustomerName,
      application_id: newApplication.id,
      status: 'open',
      priority: 'high',
      due_date: dueDate.toISOString().split('T')[0],
      task_type: 'onboarding',
    });

    // ── Systemlog ─────────────────────────────────────────────────────────────
    await base44.asServiceRole.entities.SystemLog.create({
      level: 'info',
      source: 'createApplicationFromDocument',
      message: `Antrag erstellt: ${resolvedCustomerName} | ${applicationData.insurer} | Status: in_pruefung | customerAction: ${customerAction}`,
      related_entity_type: 'Application',
      related_entity_id: newApplication.id,
      user_email: user.email,
    });

    return Response.json({
      success: true,
      applicationId: newApplication.id,
      customerId: resolvedCustomerId,
      primaryCustomerId: resolvedPrimaryCustomerId,
      customerName: resolvedCustomerName,
    });

  } catch (error) {
    console.error('[createApplicationFromDocument] ERROR:', error.message);
    try {
      await base44.asServiceRole.entities.SystemLog.create({
        level: 'error',
        source: 'createApplicationFromDocument',
        message: `Fehler: ${error.message}`,
      });
    } catch {}
    return Response.json({ error: error.message }, { status: 500 });
  }
});