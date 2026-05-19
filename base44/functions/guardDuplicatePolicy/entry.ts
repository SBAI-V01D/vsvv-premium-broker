import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

/**
 * GUARD: Intelligent Duplicate Policy Check
 *
 * BUSINESS RULE (fachlich):
 * Ein Duplikat liegt vor wenn ALLE dieser Kriterien gleichzeitig erfüllt sind:
 *   1. gleicher customer_id
 *   2. gleiche policy_number  (nicht leer)
 *   3. gleicher insurer
 *   4. gleiche sparte
 *   5. gleicher start_date
 *   6. gleiche source_application_id (falls vorhanden → Race-Condition-Schutz)
 *
 * NICHT als Duplikat gilt:
 *   - Gleiche Sparte, anderer Versicherer   → Multi-Insurer-Portfolio
 *   - Gleiche Sparte, anderes Fahrzeug      → Multi-Vehicle-Portfolio (MF)
 *   - Gleiche Sparte, anderes start_date    → Folgevertrag / Neuabschluss
 *   - Gleiche Sparte, andere policy_number  → Separater Vertrag
 *
 * Race-Condition-Schutz:
 *   - Wenn source_application_id übergeben → harte Idempotenz-Prüfung
 *   - Verhindert Doppel-Trigger (Δt < 1ms) wie bei Primus Kristijan
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
      policy_number,
      insurer,
      sparte,
      start_date,
      source_application_id,
      // Legacy-Feld — wird noch geprüft aber ist nicht mehr primäres Kriterium
      product,
    } = payload;

    if (!customer_id) {
      return Response.json({ error: 'customer_id erforderlich' }, { status: 400 });
    }

    console.log(`[guardDuplicatePolicy] CHECK customer=${customer_id} policy=${policy_number} insurer=${insurer} sparte=${sparte} start=${start_date} source_app=${source_application_id}`);

    // ─── FETCH ALL NON-ARCHIVED CONTRACTS FOR CUSTOMER ───
    const existingContracts = await base44.asServiceRole.entities.Contract.filter({
      customer_id,
      archived: false,
    });

    console.log(`[guardDuplicatePolicy] Found ${existingContracts.length} existing contracts for customer`);

    // ─── RACE-CONDITION GUARD (höchste Priorität) ───
    // Wenn source_application_id bekannt → prüfe ob bereits ein Vertrag aus demselben Antrag existiert
    if (source_application_id) {
      const raceConflict = existingContracts.find(c =>
        c.source_application_id === source_application_id &&
        c.status !== 'cancelled' &&
        c.status !== 'expired'
      );
      if (raceConflict) {
        console.error(`[guardDuplicatePolicy] ❌ RACE-CONDITION BLOCKED: Contract ${raceConflict.id} already exists from application ${source_application_id}`);
        return Response.json({
          allowed: false,
          reason: 'RACE_CONDITION_DUPLICATE',
          error: `Vertrag aus Antrag ${source_application_id} wurde bereits erstellt (Race-Condition Schutz).`,
          existing_contract_id: raceConflict.id,
          existing_policy_number: raceConflict.policy_number,
          decision_code: 'CONTRACT_CREATE_BLOCKED_RACE_CONDITION',
        });
      }
    }

    // ─── FACHLICHE DUPLIKAT-PRÜFUNG ───
    // Alle fünf Kriterien müssen erfüllt sein → kein False Positive
    if (policy_number && insurer && sparte) {
      const exactDuplicate = existingContracts.find(c => {
        const samePolicy  = c.policy_number === policy_number;
        const sameInsurer = c.insurer?.toLowerCase() === insurer?.toLowerCase();
        const sameSparte  = c.sparte === sparte;
        const sameStart   = !start_date || !c.start_date || c.start_date === start_date;
        const notCancelled = c.status !== 'cancelled' && c.status !== 'expired';
        return samePolicy && sameInsurer && sameSparte && sameStart && notCancelled;
      });

      if (exactDuplicate) {
        console.error(`[guardDuplicatePolicy] ❌ BLOCKED: Exact duplicate found — policy=${policy_number} insurer=${insurer} sparte=${sparte}`);
        return Response.json({
          allowed: false,
          reason: 'EXACT_POLICY_DUPLICATE',
          error: `Vertrag mit Police ${policy_number} (${insurer}/${sparte}) existiert bereits.`,
          existing_contract_id: exactDuplicate.id,
          existing_policy_number: exactDuplicate.policy_number,
          decision_code: 'CONTRACT_CREATE_BLOCKED_DUPLICATE',
          note: 'Fachliches Duplikat: gleiche Police + Versicherer + Sparte + Beginn.',
        });
      }
    }

    // ─── LEGACY PRODUCT CHECK (weicher, nur warnen) ───
    // Behalten für Abwärtskompatibilität — aber KEIN harter Block ohne policy_number
    let warning = null;
    if (product && !policy_number) {
      const productConflict = existingContracts.find(c =>
        c.product === product && c.status === 'active'
      );
      if (productConflict) {
        warning = `Hinweis: Aktiver Vertrag für Produkt "${product}" bereits vorhanden (ID: ${productConflict.id}). Bitte manuell prüfen.`;
        console.warn(`[guardDuplicatePolicy] ⚠️  SOFT WARNING: ${warning}`);
      }
    }

    console.log(`[guardDuplicatePolicy] ✅ ALLOWED — kein Duplikat gefunden`);
    return Response.json({
      allowed: true,
      customer_id,
      policy_number,
      insurer,
      sparte,
      message: 'Neuer Vertrag kann erstellt werden.',
      warning: warning || null,
    });

  } catch (error) {
    console.error(`[guardDuplicatePolicy] ERROR: ${error.message}`);
    return Response.json({ allowed: false, error: error.message }, { status: 500 });
  }
});