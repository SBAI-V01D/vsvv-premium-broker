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

    // ── STEP 3: Duplicate Detection ──────────────────────────────────────
    let matchedCustomer = null;

    if (customerData.email || customerData.phone || insuranceData.policy_number) {
      const allCustomers = await base44.asServiceRole.entities.Customer.list();

      // Match by email
      if (customerData.email) {
        matchedCustomer = allCustomers.find(c =>
          c.email?.toLowerCase() === customerData.email?.toLowerCase()
        );
      }

      // Match by policy number
      if (!matchedCustomer && insuranceData.policy_number) {
        const matchingContracts = await base44.asServiceRole.entities.Contract.filter({
          policy_number: insuranceData.policy_number
        });
        if (matchingContracts.length > 0) {
          matchedCustomer = allCustomers.find(c => c.id === matchingContracts[0].customer_id);
        }
      }

      // Match by name + birthdate
      if (!matchedCustomer && customerData.first_name && customerData.last_name) {
        const nameLower = `${customerData.first_name} ${customerData.last_name}`.toLowerCase();
        matchedCustomer = allCustomers.find(c => {
          const cName = `${c.first_name || ''} ${c.last_name || ''}`.toLowerCase();
          const nameMatch = cName === nameLower;
          if (!nameMatch) return false;
          if (customerData.birthdate && c.birthdate) {
            return c.birthdate === customerData.birthdate;
          }
          return nameMatch;
        });
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
    const taskTitleMap = {
      police: `📄 Neue Police prüfen: ${insuranceData.insurer || docData.name}`,
      antrag: `📋 Antrag prüfen & verarbeiten: ${insuranceData.insurer || docData.name}`,
      kuendigung: `⚠️ Kündigung bearbeiten: ${insuranceData.insurer || docData.name}`,
      schadensmeldung: `🚨 Schadenmeldung prüfen: ${docData.name}`,
      gesundheitsdeklaration: `🏥 Gesundheitsdeklaration prüfen: ${docData.name}`,
      rechnung: `💰 Rechnung prüfen: ${insuranceData.insurer || docData.name}`,
      mahnung: `🔴 Mahnung dringend bearbeiten: ${docData.name}`,
      offerte: `💡 Offerte prüfen: ${insuranceData.insurer || docData.name}`,
    };

    const taskTitle = taskTitleMap[category] || `📎 Dokument prüfen: ${docData.name}`;
    const isUrgent = ['kuendigung', 'mahnung', 'schadensmeldung'].includes(category);
    const dueDate = new Date();
    dueDate.setDate(dueDate.getDate() + (isUrgent ? 1 : 3));

    await base44.asServiceRole.entities.Task.create({
      title: taskTitle,
      description: `Automatisch erstellt bei Dokumenten-Upload.\nKategorie: ${category}\nKonfidenz: ${Math.round(confidence * 100)}%\n${classification?.summary || ''}`,
      customer_id: matchedCustomer?.id || null,
      customer_name: matchedCustomer
        ? (matchedCustomer.company_name || `${matchedCustomer.first_name || ''} ${matchedCustomer.last_name || ''}`.trim())
        : null,
      status: 'open',
      priority: isUrgent ? 'urgent' : confidence < 0.7 ? 'high' : 'medium',
      due_date: dueDate.toISOString().split('T')[0],
      task_type: category === 'gesundheitsdeklaration' ? 'health_declaration' : 'general',
      notes: JSON.stringify({
        document_id: documentId,
        category,
        insurer: insuranceData.insurer,
        policy_number: insuranceData.policy_number,
        confidence,
      }),
    });

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