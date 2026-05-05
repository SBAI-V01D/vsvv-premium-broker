import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

/**
 * LINEAR AUTOMATION PIPELINE (Punkt 5)
 * 
 * Reihenfolge (zwingend):
 * 1. upload → parsing
 * 2. entity detection → customer mapping
 * 3. application creation
 * 4. policy creation (contract)
 * 5. commission calculation
 * 
 * Jeder Schritt erst starten wenn vorheriger = completed
 */

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const payload = await req.json();
    const {
      document_id,
      file_url,
      file_name,
      organization_id, // Wird vom Document/KI bestimmt
    } = payload;

    if (!document_id || !file_url) {
      return Response.json(
        { error: 'document_id und file_url erforderlich' },
        { status: 400 }
      );
    }

    console.log(`[automationPipeline] START doc=${document_id} org=${organization_id}`);

    // ─── SCHRITT 1: Extraktion (bereits gemacht, aber queue-State setzen) ───
    await base44.entities.AutomationQueue.create({
      job_type: 'ki_extraction',
      status: 'pending',
      related_document_id: document_id,
      related_entity_type: 'Document',
      related_entity_id: document_id,
    });

    // ─── SCHRITT 2: Customer Mapping ───
    // (In DocumentReviewPanel bereits gemacht + customer_locked gesetzt)
    // Hier: Validierung dass customer_locked=true und customer_id vorhanden

    const doc = await base44.entities.Document.get(document_id);
    if (!doc.customer_id || !doc.customer_locked) {
      throw new Error('Document: customer_id oder customer_locked nicht gesetzt');
    }

    const customer = await base44.entities.Customer.get(doc.customer_id);
    if (!customer.organization_id) {
      throw new Error('Customer: organization_id fehlt');
    }

    console.log(`[automationPipeline] Customer mapped: ${customer.id} org=${customer.organization_id}`);

    // ─── SCHRITT 3: Application erstellen ───
    const application = await base44.entities.Application.create({
      customer_id: doc.customer_id,
      customer_name: doc.customer_name,
      organization_id: customer.organization_id,
      advisor_id: customer.advisor_id || null,
      status: 'submitted',
      custom_status: 'eingereicht',
      status_changed_at: new Date().toISOString(),
      notes: `Automatisch aus Dokument ${document_id} erstellt`,
    });

    console.log(`[automationPipeline] Application created: ${application.id}`);

    // ─── SCHRITT 4: Policy (Contract) erstellen ───
    // Faktuell: Contract = Police in der Domäne
    const contract = await base44.entities.Contract.create({
      customer_id: doc.customer_id,
      customer_name: doc.customer_name,
      organization_id: customer.organization_id,
      advisor_id: customer.advisor_id || null,
      source_application_id: application.id, // ← Verknüpfung
      status: 'active',
      insurer: application.insurer || 'Andere',
      insurance_type: application.insurance_type || 'other',
      notes: `Policy zur Application ${application.id}`,
    });

    console.log(`[automationPipeline] Contract created: ${contract.id}`);

    // ─── SCHRITT 5: Commission berechnen (später) ───
    // Für jetzt: Placeholder
    console.log(`[automationPipeline] Commission calculation queued`);

    // ─── Finales Update: Document → Anwendungsverknüpfung ───
    await base44.entities.Document.update(document_id, {
      linked_application_id: application.id,
      doc_type: 'antrag',
      classification_status: 'klassifiziert',
    });

    return Response.json({
      success: true,
      document_id,
      application_id: application.id,
      contract_id: contract.id,
      message: 'Pipeline abgeschlossen',
    });
  } catch (error) {
    console.error(`[automationPipeline] ERROR: ${error.message}`);
    return Response.json({ error: error.message }, { status: 500 });
  }
});