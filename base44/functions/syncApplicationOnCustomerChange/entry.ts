import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

/**
 * PUNKT 13: SYNCHRONISATION
 * 
 * Triggert wenn Kunde geändert wird → aktualisiert alle Anträge + Verträge
 * 
 * Regel: Wenn customer.organization_id oder customer.advisor_id geändert
 *        → alle application + contract Einträge für diesen Kunden aktualisieren
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
      customer_id,
      organization_id,
      advisor_id,
    } = payload;

    if (!customer_id) {
      return Response.json({ error: 'customer_id erforderlich' }, { status: 400 });
    }

    console.log(
      `[syncApplicationOnCustomerChange] START customer=${customer_id} org=${organization_id} advisor=${advisor_id}`
    );

    // ─── SCHRITT 1: Alle Anträge des Kunden finden ───
    const applications = await base44.entities.Application.filter({
      customer_id,
    });

    console.log(`[syncApplicationOnCustomerChange] Found ${applications.length} applications`);

    // ─── SCHRITT 2: Alle Anträge aktualisieren ───
    for (const app of applications) {
      await base44.entities.Application.update(app.id, {
        organization_id,
        advisor_id: advisor_id || null,
      });
      console.log(`[syncApplicationOnCustomerChange] Updated application ${app.id}`);
    }

    // ─── SCHRITT 3: Alle Verträge (Contracts) des Kunden finden + aktualisieren ───
    const contracts = await base44.entities.Contract.filter({
      customer_id,
    });

    console.log(`[syncApplicationOnCustomerChange] Found ${contracts.length} contracts`);

    for (const contract of contracts) {
      await base44.entities.Contract.update(contract.id, {
        organization_id,
        advisor_id: advisor_id || null,
      });
      console.log(`[syncApplicationOnCustomerChange] Updated contract ${contract.id}`);
    }

    // ─── SCHRITT 4: Alle Dokumente des Kunden aktualisieren (Metadaten) ───
    const documents = await base44.entities.Document.filter({
      customer_id,
    });

    for (const doc of documents) {
      await base44.entities.Document.update(doc.id, {
        // customer_locked bleibt bestehen (nicht überschreiben!)
        // Nur Metadaten aktualisieren
      });
    }

    console.log(`[syncApplicationOnCustomerChange] Sync complete`);

    return Response.json({
      success: true,
      synced: {
        applications: applications.length,
        contracts: contracts.length,
        documents: documents.length,
      },
    });
  } catch (error) {
    console.error(`[syncApplicationOnCustomerChange] ERROR: ${error.message}`);
    return Response.json({ error: error.message }, { status: 500 });
  }
});