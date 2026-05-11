import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

/**
 * ON DOCUMENT UPLOAD — Entity Automation (Document.create)
 *
 * Pipeline:
 * 1. KI-Klassifizierung (Dokumenttyp + Kundendaten)
 * 2. Kundenzuordnung (E-Mail → Policen-Nr → Name/GD)
 * 3. EINE Broker-Aufgabe (Duplikatschutz: max 1 offene Task pro Dokument)
 * 4. Bei Kündigung: Verkaufschance (nur wenn keine mit contract verknüpft)
 * 5. Systemlog
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

    // Nur neue Dokumente (nicht schon verarbeitet)
    if (docData.processing_stage && docData.processing_stage !== 'uploaded') {
      return Response.json({ skipped: true, reason: `Already at stage: ${docData.processing_stage}` });
    }

    console.log(`[onDocumentUpload] START doc=${documentId} file=${docData.name}`);

    // ── STEP 1: KI-Klassifizierung ────────────────────────────────────────
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
              }
            },
            summary: { type: 'string' }
          },
          required: ['document_category', 'confidence']
        },
        model: 'gemini_3_flash'
      });
    } catch (aiErr) {
      console.warn(`[onDocumentUpload] AI failed: ${aiErr.message}`);
    }

    const category = classification?.document_category || 'korrespondenz';
    const confidence = classification?.confidence || 0;
    const customerData = classification?.customer_data || {};
    const insuranceData = classification?.insurance_data || {};

    // ── STEP 2: Dokument aktualisieren ───────────────────────────────────
    const classificationStatus = confidence >= 0.85 ? 'klassifiziert' : 'pruefung_erforderlich';
    await base44.asServiceRole.entities.Document.update(documentId, {
      doc_type: ['antrag', 'offerte'].includes(category) ? 'antrag' : 'anlage',
      classification_status: classificationStatus,
      classification_confidence: confidence,
      classification_reason: classification?.summary || `Automatisch klassifiziert als: ${category}`,
      processing_stage: 'parsed',
    });

    // ── STEP 3: Kundenzuordnung (E-Mail → Policen-Nr → Name) ────────────
    let matchedCustomer = null;

    if (customerData.email) {
      const res = await base44.asServiceRole.entities.Customer.filter({ email: customerData.email });
      if (res.length > 0) matchedCustomer = res[0];
    }

    if (!matchedCustomer && insuranceData.policy_number) {
      const contracts = await base44.asServiceRole.entities.Contract.filter({ policy_number: insuranceData.policy_number });
      if (contracts.length > 0 && contracts[0].customer_id) {
        const res = await base44.asServiceRole.entities.Customer.filter({ id: contracts[0].customer_id });
        if (res.length > 0) matchedCustomer = res[0];
      }
    }

    if (!matchedCustomer && customerData.first_name && customerData.last_name) {
      const res = await base44.asServiceRole.entities.Customer.filter({
        first_name: customerData.first_name,
        last_name: customerData.last_name,
      });
      if (res.length > 0) {
        matchedCustomer = res.find(c => !customerData.birthdate || !c.birthdate || c.birthdate === customerData.birthdate) || res[0];
      }
    }

    if (matchedCustomer) {
      const customerName = matchedCustomer.company_name ||
        `${matchedCustomer.first_name || ''} ${matchedCustomer.last_name || ''}`.trim();
      await base44.asServiceRole.entities.Document.update(documentId, {
        customer_id: matchedCustomer.id,
        customer_name: customerName,
        processing_stage: 'customer_mapped',
      });
    }

    // ── STEP 4: EINE Broker-Aufgabe (Duplikatschutz) ─────────────────────
    // Prüfe ob bereits eine offene Task für dieses Dokument existiert
    const existingDocTask = await base44.asServiceRole.entities.Task.filter({
      customer_id: matchedCustomer?.id || null,
    }).then(tasks => tasks.filter(t =>
      t.status !== 'completed' &&
      t.notes?.includes(documentId)
    )).catch(() => []);

    if (existingDocTask.length === 0) {
      const resolvedName = matchedCustomer
        ? (matchedCustomer.company_name || `${matchedCustomer.first_name || ''} ${matchedCustomer.last_name || ''}`.trim())
        : (customerData.company_name || (customerData.first_name && customerData.last_name
            ? `${customerData.first_name} ${customerData.last_name}`.trim()
            : insuranceData.insurer || docData.name));

      const nameInTitle = resolvedName ? ` (${resolvedName})` : '';
      const taskTitleMap = {
        police:               `Police prüfen${nameInTitle}`,
        antrag:               `Antrag prüfen & verarbeiten${nameInTitle}`,
        kuendigung:           `Kündigung bearbeiten${nameInTitle}`,
        schadensmeldung:      `Schadenmeldung prüfen${nameInTitle}`,
        gesundheitsdeklaration: `Gesundheitsdeklaration prüfen${nameInTitle}`,
        rechnung:             `Rechnung prüfen${nameInTitle}`,
        mahnung:              `Mahnung dringend bearbeiten${nameInTitle}`,
        offerte:              `Offerte prüfen${nameInTitle}`,
      };

      const isUrgent = ['kuendigung', 'mahnung', 'schadensmeldung'].includes(category);
      const dueDate = new Date();
      dueDate.setDate(dueDate.getDate() + (isUrgent ? 1 : 3));

      // Antrag: verknüpfte Application suchen
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
        title: taskTitleMap[category] || `Dokument prüfen: ${docData.name}`,
        description: `Automatisch bei Dokumenten-Upload erstellt.\nKategorie: ${category} | Konfidenz: ${Math.round(confidence * 100)}%\n${classification?.summary || ''}`,
        customer_id: matchedCustomer?.id || null,
        customer_name: resolvedName || null,
        application_id: linkedApplicationId,
        application_name: linkedApplicationName,
        status: 'open',
        priority: isUrgent ? 'urgent' : confidence < 0.7 ? 'high' : 'medium',
        due_date: dueDate.toISOString().split('T')[0],
        task_type: category === 'gesundheitsdeklaration' ? 'health_declaration'
          : category === 'antrag' ? 'onboarding' : 'general',
        notes: JSON.stringify({
          document_id: documentId,
          category,
          insurer: insuranceData.insurer,
          policy_number: insuranceData.policy_number,
          confidence,
        }),
      });
    } else {
      console.log(`[onDocumentUpload] Task already exists for doc=${documentId}, skipping`);
    }

    // ── STEP 5: Bei Kündigung → Verkaufschance (nur wenn nicht schon vorhanden) ─
    if (category === 'kuendigung' && matchedCustomer) {
      const contracts = await base44.asServiceRole.entities.Contract.filter({ customer_id: matchedCustomer.id });
      const activeContract = contracts.find(c => c.status === 'active');
      if (activeContract) {
        // Duplikatschutz: kein offener VS mit diesem Vertrag
        const existingVs = await base44.asServiceRole.entities.Verkaufschance.filter({
          linked_contract_id: activeContract.id,
        });
        const hasOpenVs = existingVs.some(v => !['gewonnen', 'verloren'].includes(v.status));
        if (!hasOpenVs) {
          const resolvedName = matchedCustomer.company_name ||
            `${matchedCustomer.first_name || ''} ${matchedCustomer.last_name || ''}`.trim();
          await base44.asServiceRole.entities.Verkaufschance.create({
            customer_id: matchedCustomer.id,
            customer_name: resolvedName,
            organization_id: matchedCustomer.organization_id,
            sparte: activeContract.sparte || activeContract.insurance_type,
            status: 'neu',
            linked_contract_id: activeContract.id,
            title: `Kündigung — Ersatz suchen (${resolvedName})`,
            estimated_value: activeContract.premium_yearly || 0,
            notes: `Automatisch aus Kündigung erstellt (Dokument-Upload).`,
          });
        }
      }
    }

    // ── STEP 6: SystemLog ─────────────────────────────────────────────────
    await base44.asServiceRole.entities.SystemLog.create({
      level: classificationStatus === 'klassifiziert' ? 'info' : 'warn',
      source: 'onDocumentUpload',
      message: `${docData.name} → ${category} (${Math.round(confidence * 100)}%)${matchedCustomer ? ` | Kunde: ${matchedCustomer.id}` : ' | Kein Kunde gefunden'}`,
      related_entity_type: 'Document',
      related_entity_id: documentId,
    });

    return Response.json({
      success: true,
      document_id: documentId,
      category,
      confidence,
      classification_status: classificationStatus,
      matched_customer_id: matchedCustomer?.id || null,
    });

  } catch (error) {
    console.error(`[onDocumentUpload] ERROR: ${error.message}`);
    try {
      await base44.asServiceRole.entities.SystemLog.create({
        level: 'error',
        source: 'onDocumentUpload',
        message: `Fehler: ${error.message}`,
      });
    } catch {}
    return Response.json({ success: false, error: error.message }, { status: 500 });
  }
});