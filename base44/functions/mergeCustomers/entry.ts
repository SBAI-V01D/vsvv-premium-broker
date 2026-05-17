import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

/**
 * MERGE CUSTOMERS — Enterprise Duplicate Resolution
 *
 * Verschmilzt einen Duplikat-Kunden mit dem Master-Datensatz.
 * 
 * Vorgang:
 * 1. Alle Beziehungen des Duplikats auf den Master umhängen
 *    (Contracts, Applications, Documents, Tasks, CommissionEntries, StatusHistory)
 * 2. Familienbeziehungen bereinigen
 * 3. Duplikat archivieren (KEIN physisches Löschen)
 * 4. Audit-Log schreiben
 *
 * Admin-only.
 */

Deno.serve(async (req) => {
  const base44 = createClientFromRequest(req);

  try {
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });
    if (user.role !== 'admin') return Response.json({ error: 'Nur Admins dürfen Kunden zusammenführen' }, { status: 403 });

    const { masterId, duplicateId, reason } = await req.json();

    if (!masterId || !duplicateId) {
      return Response.json({ error: 'masterId und duplicateId sind Pflicht' }, { status: 400 });
    }
    if (masterId === duplicateId) {
      return Response.json({ error: 'Master und Duplikat dürfen nicht identisch sein' }, { status: 400 });
    }

    // ── Kunden laden ──────────────────────────────────────────────────────────
    const [masterArr, dupArr] = await Promise.all([
      base44.asServiceRole.entities.Customer.filter({ id: masterId }),
      base44.asServiceRole.entities.Customer.filter({ id: duplicateId }),
    ]);

    if (!masterArr.length) return Response.json({ error: 'Master-Kunde nicht gefunden' }, { status: 404 });
    if (!dupArr.length) return Response.json({ error: 'Duplikat-Kunde nicht gefunden' }, { status: 404 });

    const master = masterArr[0];
    const dup = dupArr[0];
    const masterName = master.company_name || `${master.first_name || ''} ${master.last_name || ''}`.trim();
    const dupName = dup.company_name || `${dup.first_name || ''} ${dup.last_name || ''}`.trim();

    const stats = {
      contracts: 0,
      applications: 0,
      documents: 0,
      tasks: 0,
      commissions: 0,
      statusHistory: 0,
      familyMembers: 0,
    };

    // ── 1. Verträge umhängen ──────────────────────────────────────────────────
    const contracts = await base44.asServiceRole.entities.Contract.filter({ customer_id: duplicateId });
    await Promise.all(contracts.map(c =>
      base44.asServiceRole.entities.Contract.update(c.id, {
        customer_id: masterId,
        customer_name: masterName,
        primary_customer_id: master.is_family_member ? master.primary_customer_id : masterId,
        is_family_member: master.is_family_member || false,
      })
    ));
    stats.contracts = contracts.length;

    // ── 2. Anträge umhängen ───────────────────────────────────────────────────
    const applications = await base44.asServiceRole.entities.Application.filter({ customer_id: duplicateId });
    await Promise.all(applications.map(a =>
      base44.asServiceRole.entities.Application.update(a.id, {
        customer_id: masterId,
        customer_name: masterName,
        primary_customer_id: master.is_family_member ? master.primary_customer_id : masterId,
        is_family_member: master.is_family_member || false,
      })
    ));
    stats.applications = applications.length;

    // ── 3. Dokumente umhängen ─────────────────────────────────────────────────
    const documents = await base44.asServiceRole.entities.Document.filter({ customer_id: duplicateId });
    await Promise.all(documents.map(d =>
      base44.asServiceRole.entities.Document.update(d.id, {
        customer_id: masterId,
        customer_name: masterName,
        primary_customer_id: master.is_family_member ? master.primary_customer_id : masterId,
      })
    ));
    stats.documents = documents.length;

    // ── 4. Tasks umhängen ─────────────────────────────────────────────────────
    const tasks = await base44.asServiceRole.entities.Task.filter({ customer_id: duplicateId });
    await Promise.all(tasks.map(t =>
      base44.asServiceRole.entities.Task.update(t.id, {
        customer_id: masterId,
        customer_name: masterName,
      })
    ));
    stats.tasks = tasks.length;

    // ── 5. CommissionEntries umhängen ─────────────────────────────────────────
    const commissions = await base44.asServiceRole.entities.CommissionEntry.filter({ customer_id: duplicateId });
    await Promise.all(commissions.map(c =>
      base44.asServiceRole.entities.CommissionEntry.update(c.id, {
        customer_id: masterId,
        customer_name: masterName,
      })
    ));
    stats.commissions = commissions.length;

    // ── 6. StatusHistory umhängen ─────────────────────────────────────────────
    try {
      const statusHistory = await base44.asServiceRole.entities.StatusHistory.filter({ customer_id: duplicateId });
      await Promise.all(statusHistory.map(s =>
        base44.asServiceRole.entities.StatusHistory.update(s.id, {
          customer_id: masterId,
        })
      ));
      stats.statusHistory = statusHistory.length;
    } catch (e) {
      console.warn('[mergeCustomers] StatusHistory-Migration fehlgeschlagen (non-fatal):', e.message);
    }

    // ── 7. Familienmitglieder umhängen ────────────────────────────────────────
    const familyMembers = await base44.asServiceRole.entities.Customer.filter({ primary_customer_id: duplicateId });
    await Promise.all(familyMembers.map(fm =>
      base44.asServiceRole.entities.Customer.update(fm.id, {
        primary_customer_id: masterId,
      })
    ));
    stats.familyMembers = familyMembers.length;

    // ── 8. Duplikat archivieren (kein physisches Löschen) ─────────────────────
    await base44.asServiceRole.entities.Customer.update(duplicateId, {
      archived: true,
      archived_at: new Date().toISOString(),
      archived_by: user.email,
      archived_reason: `MERGE: Zusammengeführt mit Kunde ${masterId} (${masterName}). Grund: ${reason || 'kein Grund angegeben'}`,
      // Felder aus Master ergänzen falls beim Duplikat leer
      // (kein Überschreiben von Master-Feldern — nur Archivierung)
      notes: (dup.notes ? dup.notes + '\n' : '') +
        `[ARCHIVIERT ${new Date().toLocaleDateString('de-CH')}] Duplikat von ${masterId} (${masterName}). ` +
        `Alle Beziehungen wurden migriert (Verträge: ${stats.contracts}, Anträge: ${stats.applications}, Dokumente: ${stats.documents}).`,
    });

    // ── 9. Master-Kunde anreichern (fehlende Felder aus Duplikat ergänzen) ────
    const enrichUpdates = {};
    const fieldsToEnrich = ['phone', 'mobile', 'birthdate', 'ahv_number', 'street', 'zip_code', 'city', 'canton', 'nationality', 'email'];
    for (const field of fieldsToEnrich) {
      if (!master[field] && dup[field]) {
        enrichUpdates[field] = dup[field];
      }
    }
    if (Object.keys(enrichUpdates).length > 0) {
      await base44.asServiceRole.entities.Customer.update(masterId, enrichUpdates);
    }

    // ── 10. DuplicateAlert erstellen ──────────────────────────────────────────
    try {
      await base44.asServiceRole.entities.DuplicateAlert.create({
        entity_type: 'customer',
        primary_entity_id: masterId,
        duplicate_entity_id: duplicateId,
        match_criteria: ['name_birthdate'],
        confidence_score: 95,
        detected_at: new Date().toISOString(),
        detected_by: user.email,
        status: 'merged',
        action_taken: `Merge durchgeführt. Beziehungen migriert: ${JSON.stringify(stats)}. Duplikat archiviert.`,
        resolved_at: new Date().toISOString(),
      });
    } catch (e) {
      console.warn('[mergeCustomers] DuplicateAlert-Erstellung fehlgeschlagen (non-fatal):', e.message);
    }

    // ── 11. Audit-Log ─────────────────────────────────────────────────────────
    await base44.asServiceRole.entities.SystemLog.create({
      level: 'info',
      source: 'mergeCustomers',
      message: `MERGE: "${dupName}" (${duplicateId}) → "${masterName}" (${masterId}) | Migriert: V${stats.contracts} A${stats.applications} D${stats.documents} T${stats.tasks} P${stats.commissions} FM${stats.familyMembers}`,
      related_entity_type: 'Customer',
      related_entity_id: masterId,
      user_email: user.email,
    });

    return Response.json({
      success: true,
      masterId,
      duplicateId,
      masterName,
      duplicateName: dupName,
      enriched: Object.keys(enrichUpdates),
      migrated: stats,
    });

  } catch (error) {
    console.error('[mergeCustomers] ERROR:', error.message);
    return Response.json({ error: error.message }, { status: 500 });
  }
});