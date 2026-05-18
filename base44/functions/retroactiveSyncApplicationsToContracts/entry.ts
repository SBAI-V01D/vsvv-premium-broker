import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

/**
 * Vollständiger Abgleich: Anträge ↔ Verträge ↔ Kunden
 *
 * Logik:
 * 1. Alle angenommenen/polizierten Anträge laden
 * 2. Für jeden Antrag: suche existierenden Vertrag via source_application_id ODER linked_contract_id
 * 3. Prüfe ob gefundener Vertrag archived=true → de-archivieren statt neu erstellen
 * 4. Falls kein Vertrag: neu erstellen mit korrekten Verknüpfungen
 * 5. Verknüpfungen auf beiden Seiten sicherstellen (Application.linked_contract_id ↔ Contract.source_application_id)
 * 6. Detailliertes Report-Logging
 */

const ACCEPTED_STATUSES = [
  'angenommen', 'policiert', 'approved', 'angenommen_vorbehalt',
  'conditional_approved', 'aktiv', 'bewilligung_erteilt', 'vorbehalt'
];

function buildContractNotes(app) {
  return [
    'Automatisch erstellt aus Antrag (rückwirkender Sync).',
    app.sparte_data?.franchise ? `Franchise: CHF ${app.sparte_data.franchise}` : null,
    app.sparte_data?.model ? `Modell: ${app.sparte_data.model}` : null,
    app.sparte_data?.age_group ? `Kategorie: ${app.sparte_data.age_group}` : null,
    app.notes || null,
  ].filter(Boolean).join(' | ');
}

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (user?.role !== 'admin') {
      return Response.json({ error: 'Admin access required' }, { status: 403 });
    }

    const report = {
      total_accepted_apps: 0,
      already_ok: 0,               // Antrag + Vertrag korrekt verknüpft, Vertrag aktiv
      relinked: 0,                  // Vertrag existierte, Verknüpfung war aber verloren
      unarchived: 0,                // Vertrag war archiviert → de-archiviert
      created: 0,                   // Neuer Vertrag erstellt
      skipped_no_customer: 0,       // Kein customer_id auf Antrag
      skipped_no_org: 0,            // Kein organization_id
      errors: [],
      details: [],
    };

    // ── 1. Alle Anträge laden ─────────────────────────────────────────────────
    const allApps = await base44.asServiceRole.entities.Application.filter({ archived: false }, '-created_date', 500);
    const acceptedApps = allApps.filter(app => {
      const st = (app.custom_status || app.status || '').toLowerCase().trim();
      return ACCEPTED_STATUSES.includes(st);
    });

    report.total_accepted_apps = acceptedApps.length;
    console.log(`[sync] ${acceptedApps.length} angenommene Anträge gefunden`);

    // ── 2. Alle existierenden Verträge (inkl. archivierte) laden ─────────────
    // Wir laden alles auf einmal um N+1 Queries zu vermeiden
    const allContracts = await base44.asServiceRole.entities.Contract.list('-created_date', 1000);
    // Index: source_application_id → contract
    const contractByAppId = {};
    // Index: contract.id → contract
    const contractById = {};
    for (const c of allContracts) {
      contractById[c.id] = c;
      if (c.source_application_id) {
        if (!contractByAppId[c.source_application_id]) {
          contractByAppId[c.source_application_id] = [];
        }
        contractByAppId[c.source_application_id].push(c);
      }
    }

    // ── 3. Pro Antrag auflösen ────────────────────────────────────────────────
    for (const app of acceptedApps) {
      try {
        if (!app.customer_id) {
          report.skipped_no_customer++;
          report.details.push({ app_id: app.id, customer: app.customer_name, result: 'SKIP_NO_CUSTOMER' });
          continue;
        }

        // organization_id ermitteln (Fallback: vom Kunden laden)
        let orgId = (app.organization_id && app.organization_id.trim()) ? app.organization_id : null;
        if (!orgId) {
          const customerRec = await base44.asServiceRole.entities.Customer.filter({ id: app.customer_id })
            .then(r => r[0] || null).catch(() => null);
          orgId = customerRec?.organization_id || null;
          if (orgId) {
            await base44.asServiceRole.entities.Application.update(app.id, { organization_id: orgId });
          }
        }
        if (!orgId) {
          report.skipped_no_org++;
          report.details.push({ app_id: app.id, customer: app.customer_name, result: 'SKIP_NO_ORG' });
          continue;
        }

        // ── Schritt A: Vorhandenen Vertrag suchen ────────────────────────────
        // Priorität: 1) via linked_contract_id auf Antrag, 2) via source_application_id auf Vertrag
        let existingContract = null;

        if (app.linked_contract_id && contractById[app.linked_contract_id]) {
          existingContract = contractById[app.linked_contract_id];
        }

        if (!existingContract && contractByAppId[app.id] && contractByAppId[app.id].length > 0) {
          // Bei mehreren: nehme den neuesten nicht-archivierten, sonst den neuesten archivierten
          const candidates = contractByAppId[app.id];
          existingContract = candidates.find(c => !c.archived) || candidates[candidates.length - 1];
        }

        // ── Schritt B: Entscheidungsbaum ──────────────────────────────────────
        if (existingContract) {
          const needsUpdate = {};
          let action = 'ALREADY_OK';

          // De-archivieren falls nötig
          if (existingContract.archived) {
            needsUpdate.archived = false;
            needsUpdate.archived_at = null;
            needsUpdate.archived_by = null;
            needsUpdate.archived_reason = null;
            needsUpdate.status = 'active';
            action = 'UNARCHIVED';
            report.unarchived++;
          }

          // Sicherstellen: source_application_id gesetzt
          if (!existingContract.source_application_id) {
            needsUpdate.source_application_id = app.id;
          }

          // customer_id sicherstellen
          if (!existingContract.customer_id && app.customer_id) {
            needsUpdate.customer_id = app.customer_id;
            needsUpdate.customer_name = app.customer_name;
          }

          // organization_id sicherstellen
          if (!existingContract.organization_id) {
            needsUpdate.organization_id = orgId;
          }

          if (Object.keys(needsUpdate).length > 0) {
            await base44.asServiceRole.entities.Contract.update(existingContract.id, needsUpdate);
            if (action === 'ALREADY_OK') action = 'RELINKED';
          }

          // Antrag verlinken falls nötig
          if (app.linked_contract_id !== existingContract.id) {
            await base44.asServiceRole.entities.Application.update(app.id, {
              linked_contract_id: existingContract.id,
            });
            if (action === 'ALREADY_OK') { action = 'RELINKED'; report.relinked++; }
          } else if (action === 'ALREADY_OK') {
            report.already_ok++;
          }

          report.details.push({ app_id: app.id, contract_id: existingContract.id, customer: app.customer_name, insurer: app.insurer, result: action });

        } else {
          // ── Schritt C: Neuen Vertrag erstellen ────────────────────────────
          const premiumMonthly = app.estimated_premium_monthly || null;
          const premiumYearly = app.estimated_premium_yearly || (premiumMonthly ? Math.round(premiumMonthly * 12 * 100) / 100 : null);

          const newContract = await base44.asServiceRole.entities.Contract.create({
            customer_id: app.customer_id,
            customer_name: app.customer_name,
            primary_customer_id: app.primary_customer_id || app.customer_id,
            is_family_member: app.is_family_member || false,
            organization_id: orgId,
            source_application_id: app.id,
            insurer: app.insurer,
            insurance_type: app.insurance_type || app.sparte || 'other',
            sparte: app.sparte || app.insurance_type || '',
            sparte_data: app.sparte_data || {},
            product: app.product || app.sparte || '',
            policy_number: app.policy_number || '',
            premium_yearly: premiumYearly,
            premium_monthly: premiumMonthly,
            start_date: app.contract_start_date || app.requested_start_date || '',
            end_date: app.contract_end_date || '',
            assigned_broker: app.assigned_broker || '',
            advisor_id: app.advisor_id || null,
            custom_status: 'aktiv',
            status: 'active',
            commission_amount: app.commission_estimate || null,
            notes: buildContractNotes(app),
          });

          // Antrag verlinken
          await base44.asServiceRole.entities.Application.update(app.id, {
            linked_contract_id: newContract.id,
          });

          // In lokalen Index aufnehmen (verhindert Doppelanlage im selben Lauf)
          contractById[newContract.id] = newContract;
          if (!contractByAppId[app.id]) contractByAppId[app.id] = [];
          contractByAppId[app.id].push(newContract);

          report.created++;
          report.details.push({ app_id: app.id, contract_id: newContract.id, customer: app.customer_name, insurer: app.insurer, result: 'CREATED' });
          console.log(`[sync] NEU erstellt: ${app.customer_name} | ${app.insurer}`);
        }

      } catch (appErr) {
        report.errors.push({ app_id: app.id, customer: app.customer_name, error: appErr.message });
        console.error(`[sync] Fehler bei Antrag ${app.id}:`, appErr.message);
      }
    }

    // ── 4. System-Log ─────────────────────────────────────────────────────────
    await base44.asServiceRole.entities.SystemLog.create({
      level: report.errors.length > 0 ? 'warn' : 'info',
      source: 'retroactiveSyncApplicationsToContracts',
      message: `Sync abgeschlossen: ${report.created} erstellt, ${report.unarchived} de-archiviert, ${report.relinked} neu verlinkt, ${report.already_ok} OK, ${report.errors.length} Fehler`,
      details: JSON.stringify({ summary: report, timestamp: new Date().toISOString() }),
      user_email: user?.email || 'admin',
    });

    return Response.json({
      ok: true,
      summary: {
        total_accepted_apps: report.total_accepted_apps,
        already_ok: report.already_ok,
        relinked: report.relinked,
        unarchived: report.unarchived,
        created: report.created,
        skipped_no_customer: report.skipped_no_customer,
        skipped_no_org: report.skipped_no_org,
        errors: report.errors.length,
      },
      errors: report.errors,
      details: report.details,
    });

  } catch (error) {
    console.error('[retroactiveSyncApplicationsToContracts] FATAL:', error.message);
    return Response.json({ error: error.message }, { status: 500 });
  }
});