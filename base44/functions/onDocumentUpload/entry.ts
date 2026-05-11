import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

/**
 * ON DOCUMENT UPLOAD – Intelligent Auto-Pipeline Trigger
 * 
 * Triggered by entity automation on Document.create
 * 
 * 1. Classify document type (antrag / anlage / police / kündigung / etc.)
 * 2. Extract all customer & insurance data via LLM
 * 3. Duplicate detection (customer + policy)
 * 4. Auto-create or match customer
 * 5. Create Task for broker
 * 6. Log everything
 */

Deno.serve(async (req) => {
  const base44 = createClientFromRequest(req);

  try {
    const payload = await req.json();
    const documentId = payload?.event?.entity_id || payload?.data?.id;
    const docData = payload?.data;

    if (!documentId || !docData?.file_url) {
      return Response.json({ skipped: true, reason: 'No document_id or file_url' });
    }

    // Only process documents that haven't been processed yet
    if (docData.processing_stage && docData.processing_stage !== 'uploaded') {
      return Response.json({ skipped: true, reason: `Already at stage: ${docData.processing_stage}` });
    }

    console.log(`[onDocumentUpload] START doc=${documentId} file=${docData.name}`);

    // ── STEP 1: Deep AI Classification ───────────────────────────────────
    let classification = null;
    try {
      classification = await base44.asServiceRole.integrations.Core.InvokeLLM({
        prompt: `Analysiere dieses Versicherungsdokument präzise.

Erkenne:
1. document_category: Genauer Dokumententyp:
   - "police" (Versicherungspolice / Vertrag)
   - "antrag" (Antrag / Offerte zur Unterschrift)
   - "offerte" (Angebot ohne Unterschrift)
   - "kuendigung" (Kündigung)
   - "rechnung" (Rechnung / Prämienrechnung)
   - "schadensmeldung" (Schadenmeldung)
   - "gesundheitsdeklaration" (Gesundheitsdeklaration)
   - "vollmacht" (Vollmacht / Maklervollmacht)
   - "mahnung" (Mahnung / Zahlungserinnerung)
   - "korrespondenz" (sonstige Korrespondenz)

2. customer_data: Alle Kundendaten die du findest
3. insurance_data: Alle Versicherungsdaten

Dateiname: "${docData.name || ''}"`,
        file_urls: [docData.file_url],
        response_json_schema: {
          type: 'object',
          properties: {
            document_category: { type: 'string' },
            confidence: { type: 'number' },
            customer_data: {
              type: 'object',
              properties: {
                first_name: { type: ['string', 'null'] },
                last_name: { type: ['string', 'null'] },
                company_name: { type: ['string', 'null'] },
                email: { type: ['string', 'null'] },
                phone: { type: ['string', 'null'] },
                street: { type: ['string', 'null'] },
                zip_code: { type: ['string', 'null'] },
                city: { type: ['string', 'null'] },
                birthdate: { type: ['string', 'null'] },
                ahv_number: { type: ['string', 'null'] },
              }
            },
            insurance_data: {
              type: 'object',
              properties: {
                insurer: { type: ['string', 'null'] },
                policy_number: { type: ['string', 'null'] },
                insurance_type: { type: ['string', 'null'] },
                product: { type: ['string', 'null'] },
                premium_monthly: { type: ['number', 'null'] },
                premium_yearly: { type: ['number', 'null'] },
                start_date: { type: ['string', 'null'] },
                end_date: { type: ['string', 'null'] },
                franchise: { type: ['string', 'null'] },
              }
            },
            summary: { type: 'string' }
          },
          required: ['document_category', 'confidence']
        },
        model: 'gemini_3_flash'
      });
    } catch (aiErr) {
      console.warn(`[onDocumentUpload] AI classification failed: ${aiErr.message}`);
    }

    const category = classification?.document_category || 'korrespondenz';
    const confidence = classification?.confidence || 0;
    const customerData = classification?.customer_data || {};
    const insuranceData = classification?.insurance_data || {};

    // ── STEP 2: Update document with classification ──────────────────────
    const classificationStatus = confidence >= 0.85 ? 'klassifiziert' : 'pruefung_erforderlich';
    await base44.asServiceRole.entities.Document.update(documentId, {
      doc_type: ['antrag', 'offerte'].includes(category) ? 'antrag' : 'anlage',
      classification_status: classificationStatus,
      classification_confidence: confidence,
      classification_reason: classification?.summary || `Automatisch klassifiziert als: ${category}`,
      processing_stage: 'parsed',
    });

    console.log(`[onDocumentUpload] Classified as: ${category} (confidence=${confidence})`);

    // ── STEP 3: Duplicate Detection (targeted queries, no full list load) ───
    let matchedCustomer = null;

    // Match by email first (fastest)
    if (customerData.email) {
      const emailMatches = await base44.asServiceRole.entities.Customer.filter({
        email: customerData.email
      });
      if (emailMatches.length > 0) matchedCustomer = emailMatches[0];
    }

    // Match by policy number
    if (!matchedCustomer && insuranceData.policy_number) {
      const [matchingContracts] = await Promise.all([
        base44.asServiceRole.entities.Contract.filter({ policy_number: insuranceData.policy_number })
      ]);
      if (matchingContracts.length > 0) {
        const byId = await base44.asServiceRole.entities.Customer.filter({ id: matchingContracts[0].customer_id });
        if (byId.length > 0) matchedCustomer = byId[0];
      }
    }

    // Match by name only if needed (limit to 200)
    if (!matchedCustomer && customerData.first_name && customerData.last_name) {
      const nameMatches = await base44.asServiceRole.entities.Customer.filter({
        first_name: customerData.first_name,
        last_name: customerData.last_name,
      });
      if (nameMatches.length > 0) {
        matchedCustomer = nameMatches.find(c =>
          !customerData.birthdate || !c.birthdate || c.birthdate === customerData.birthdate
        ) || nameMatches[0];
      }
    }

    // ── STEP 4: Link to customer if found ────────────────────────────────
    if (matchedCustomer) {
      await base44.asServiceRole.entities.Document.update(documentId, {
        customer_id: matchedCustomer.id,
        customer_name: matchedCustomer.company_name || `${matchedCustomer.first_name || ''} ${matchedCustomer.last_name || ''}`.trim(),
        processing_stage: 'customer_mapped',
      });
      console.log(`[onDocumentUpload] Customer matched: ${matchedCustomer.id}`);
    }

    // ── STEP 5: Create broker task ────────────────────────────────────────
    // Extracted name from document (even if no customer exists yet)
    const extractedName = customerData.company_name ||
      (customerData.first_name && customerData.last_name
        ? `${customerData.first_name} ${customerData.last_name}`.trim()
        : null);

    const resolvedCustomerName = matchedCustomer
      ? (matchedCustomer.company_name || `${matchedCustomer.first_name || ''} ${matchedCustomer.last_name || ''}`.trim())
      : extractedName;

    // Include customer name in task title if known
    const nameInTitle = resolvedCustomerName ? ` (${resolvedCustomerName})` : ` (${insuranceData.insurer || docData.name})`;

    const taskTitleMap = {
      police: `📄 Neue Police prüfen${nameInTitle}`,
      antrag: `📋 Antrag prüfen & verarbeiten${nameInTitle}`,
      kuendigung: `⚠️ Kündigung bearbeiten${nameInTitle}`,
      schadensmeldung: `🚨 Schadenmeldung prüfen${nameInTitle}`,
      gesundheitsdeklaration: `🏥 Gesundheitsdeklaration prüfen${nameInTitle}`,
      rechnung: `💰 Rechnung prüfen${nameInTitle}`,
      mahnung: `🔴 Mahnung dringend bearbeiten${nameInTitle}`,
      offerte: `💡 Offerte prüfen${nameInTitle}`,
    };

    const taskTitle = taskTitleMap[category] || `📎 Dokument prüfen: ${docData.name}`;
    const isUrgent = ['kuendigung', 'mahnung', 'schadensmeldung'].includes(category);
    const dueDate = new Date();
    dueDate.setDate(dueDate.getDate() + (isUrgent ? 1 : 3));

    // Für Anträge: versuche verknüpften Antrag zu finden
    let linkedApplicationId = null;
    let linkedApplicationName = null;
    if (['antrag', 'offerte'].includes(category) && matchedCustomer) {
      const apps = await base44.asServiceRole.entities.Application.filter({ customer_id: matchedCustomer.id });
      const openApp = apps.find(a => !['archived'].includes(a.status));
      if (openApp) {
        linkedApplicationId = openApp.id;
        linkedApplicationName = `${openApp.insurer || ''} – ${openApp.sparte || openApp.insurance_type || ''}`.trim();
      }
    }

    await base44.asServiceRole.entities.Task.create({
      title: taskTitle,
      description: `Automatisch erstellt bei Dokumenten-Upload.\nKategorie: ${category}\nKonfidenz: ${Math.round(confidence * 100)}%\n${classification?.summary || ''}`,
      customer_id: matchedCustomer?.id || null,
      customer_name: resolvedCustomerName || null,
      application_id: linkedApplicationId,
      application_name: linkedApplicationName,
      status: 'open',
      priority: isUrgent ? 'urgent' : confidence < 0.7 ? 'high' : 'medium',
      due_date: dueDate.toISOString().split('T')[0],
      task_type: category === 'gesundheitsdeklaration' ? 'health_declaration' : category === 'antrag' ? 'onboarding' : 'general',
      notes: JSON.stringify({
        document_id: documentId,
        category,
        insurer: insuranceData.insurer,
        policy_number: insuranceData.policy_number,
        confidence,
      }),
    });

    // Bei Kündigung: automatisch Verkaufschance erstellen
    if (category === 'kuendigung' && matchedCustomer) {
      const contracts = await base44.asServiceRole.entities.Contract.filter({ customer_id: matchedCustomer.id });
      const activeContract = contracts.find(c => c.status === 'active');
      if (activeContract) {
        await base44.asServiceRole.entities.Verkaufschance.create({
          customer_id: matchedCustomer.id,
          customer_name: resolvedCustomerName,
          organization_id: matchedCustomer.organization_id,
          sparte: activeContract.sparte || activeContract.insurance_type,
          status: 'neu',
          linked_contract_id: activeContract.id,
          title: `Kündigung — Ersatz suchen (${resolvedCustomerName})`,
          estimated_value: activeContract.premium_yearly || 0,
          notes: `Automatisch aus Kündigung erstellt via Dokument-Upload.`,
        });
      }
    }

    // ── STEP 6: Log ───────────────────────────────────────────────────────
    await base44.asServiceRole.entities.SystemLog.create({
      level: classificationStatus === 'klassifiziert' ? 'info' : 'warn',
      source: 'onDocumentUpload',
      message: `Dokument klassifiziert: ${docData.name} → ${category} (${Math.round(confidence * 100)}%)${matchedCustomer ? ` → Kunde: ${matchedCustomer.id}` : ' → Kein Kunde gefunden'}`,
      related_entity_type: 'Document',
      related_entity_id: documentId,
    });

    console.log(`[onDocumentUpload] ✅ COMPLETE doc=${documentId} category=${category} customer=${matchedCustomer?.id || 'none'}`);

    return Response.json({
      success: true,
      document_id: documentId,
      category,
      confidence,
      classification_status: classificationStatus,
      matched_customer_id: matchedCustomer?.id || null,
      task_created: true,
    });

  } catch (error) {
    console.error(`[onDocumentUpload] ERROR: ${error.message}`);

    // Log the error
    try {
      await base44.asServiceRole.entities.SystemLog.create({
        level: 'error',
        source: 'onDocumentUpload',
        message: `Fehler beim Dokument-Upload: ${error.message}`,
        details: error.stack || error.message,
      });
    } catch {}

    return Response.json({ success: false, error: error.message }, { status: 500 });
  }
});