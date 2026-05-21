/**
 * dossierSnapshot.js — Phase 4
 * Snapshot-Serialisierung für Beratungsdossiers.
 *
 * ISOLIERT: Reine Funktionen, keine Seiteneffekte, kein CRM-Write.
 * Dossier-Snapshot = vollständiger, versionierter, reproduzierbarer Datenzustand.
 */

export const SNAPSHOT_SCHEMA_VERSION = '1.0';

/**
 * Erstellt einen vollständigen Snapshot-Datensatz aus allen Dossier-Daten.
 * Dieser Blob kann in DossierSnapshot.snapshot_data (JSON-String) gespeichert werden.
 *
 * @param {object} params
 * @param {object}   params.dossier        - AdvisoryDossier record
 * @param {object}   params.customer       - Hauptkunde (Customer)
 * @param {Array}    params.familyMembers  - Familienmitglieder (Customer[])
 * @param {Array}    params.contracts      - Verträge (Contract[])
 * @param {Array}    params.entries        - ComparisonEntry[]
 * @param {object}   params.verkaufschance - Verkaufschance (optional)
 * @param {string}   params.createdByName  - Name des Erstellers
 * @returns {object} Snapshot-Objekt
 */
export function buildSnapshot({
  dossier,
  customer,
  familyMembers = [],
  contracts = [],
  entries = [],
  verkaufschance = null,
  createdByName = '',
}) {
  return {
    schema_version: SNAPSHOT_SCHEMA_VERSION,
    snapshot_created_at: new Date().toISOString(),
    created_by_name: createdByName,
    dossier_version: dossier.version ?? 1,

    dossier: {
      id:                       dossier.id,
      title:                    dossier.title,
      dossier_type:             dossier.dossier_type,
      status:                   dossier.status,
      version:                  dossier.version ?? 1,
      valid_from:               dossier.valid_from ?? null,
      valid_until:              dossier.valid_until ?? null,
      recommendation_notes:     dossier.recommendation_notes ?? null,
      total_current_premium:    dossier.total_current_premium ?? null,
      total_proposed_premium:   dossier.total_proposed_premium ?? null,
      savings_monthly:          dossier.savings_monthly ?? null,
      notes:                    dossier.notes ?? null,
      // IDs für Live-Fallback
      advisor_id:               dossier.advisor_id ?? null,
      organization_id:          dossier.organization_id ?? null,
      // Historisierte Absenderdaten (snap_* Felder)
      snap_org_name:            dossier.snap_org_name ?? null,
      snap_org_street:          dossier.snap_org_street ?? null,
      snap_org_zip:             dossier.snap_org_zip ?? null,
      snap_org_city:            dossier.snap_org_city ?? null,
      snap_org_phone:           dossier.snap_org_phone ?? null,
      snap_org_email:           dossier.snap_org_email ?? null,
      snap_org_website:         dossier.snap_org_website ?? null,
      snap_org_finma:           dossier.snap_org_finma ?? null,
      snap_adv_firstname:       dossier.snap_adv_firstname ?? null,
      snap_adv_lastname:        dossier.snap_adv_lastname ?? null,
      snap_adv_function:        dossier.snap_adv_function ?? null,
      snap_adv_phone:           dossier.snap_adv_phone ?? null,
      snap_adv_email:           dossier.snap_adv_email ?? null,
      snap_adv_finma:           dossier.snap_adv_finma ?? null,
      snap_adv_vbv:             dossier.snap_adv_vbv ?? null,
    },

    customer: customer ? {
      id:            customer.id,
      first_name:    customer.first_name,
      last_name:     customer.last_name,
      email:         customer.email,
      phone:         customer.phone ?? null,
      mobile:        customer.mobile ?? null,
      street:        customer.street ?? null,
      zip_code:      customer.zip_code ?? null,
      city:          customer.city ?? null,
      canton:        customer.canton ?? null,
      birthdate:     customer.birthdate ?? null,
      ahv_number:    customer.ahv_number ?? null,
      civil_status:  customer.civil_status ?? null,
      profession:    customer.profession ?? null,
      nationality:   customer.nationality ?? null,
    } : null,

    family_members: familyMembers.map(m => ({
      id:           m.id,
      first_name:   m.first_name,
      last_name:    m.last_name,
      birthdate:    m.birthdate ?? null,
      family_role:  m.family_role ?? null,
      civil_status: m.civil_status ?? null,
    })),

    contracts: contracts.map(c => ({
      id:              c.id,
      insurer:         c.insurer,
      product:         c.product ?? null,
      insurance_type:  c.insurance_type,
      sparte:          c.sparte ?? null,
      policy_number:   c.policy_number ?? null,
      status:          c.status,
      premium_yearly:  c.premium_yearly ?? null,
      premium_monthly: c.premium_monthly ?? null,
      start_date:      c.start_date ?? null,
      renewal_date:    c.renewal_date ?? null,
      end_date:        c.end_date ?? null,
      customer_name:   c.customer_name ?? null,
    })),

    comparison_entries: entries.map(e => ({
      id:                e.id,
      person_name:       e.person_name,
      gruppe:            e.gruppe ?? 'manuell',
      gruppe_label:      e.gruppe_label ?? null,
      section:           e.section,
      gesellschaft:      e.gesellschaft,
      product_name:      e.product_name ?? null,
      praemie_monatlich: e.praemie_monatlich ?? null,
      franchise:         e.franchise ?? null,
      modell:            e.modell ?? null,
      deckung_details:   e.deckung_details ?? null,
      leistungs_score:   e.leistungs_score ?? null,
      is_current:        e.is_current ?? false,
      is_recommended:    e.is_recommended ?? false,
    })),

    verkaufschance: verkaufschance ? {
      id:             verkaufschance.id,
      title:          verkaufschance.title ?? null,
      sparte:         verkaufschance.sparte ?? null,
      status:         verkaufschance.status ?? null,
      gesellschaften: verkaufschance.gesellschaften ?? [],
    } : null,
  };
}

/**
 * Serialisiert Snapshot zu JSON-String für DossierSnapshot.snapshot_data.
 */
export function serializeSnapshot(snapshot) {
  return JSON.stringify(snapshot, null, 2);
}

/**
 * Deserialisiert Snapshot aus DossierSnapshot.snapshot_data.
 * @returns {object|null}
 */
export function deserializeSnapshot(jsonString) {
  if (!jsonString) return null;
  try {
    return JSON.parse(jsonString);
  } catch {
    return null;
  }
}

/**
 * Berechnet die nächste stabile Snapshot-Versionsnummer aus bestehenden Snapshots.
 * @param {Array} existingSnapshots - DossierSnapshot[]
 * @returns {number}
 */
export function nextSnapshotVersion(existingSnapshots = []) {
  if (!Array.isArray(existingSnapshots) || existingSnapshots.length === 0) return 1;
  const max = Math.max(...existingSnapshots.map(s => Number(s.version) || 0));
  return max + 1;
}

/**
 * Gibt Snapshot-Metadaten für die Listenansicht zurück.
 */
export function getSnapshotMeta(snapshot) {
  if (!snapshot) return null;
  return {
    version:    snapshot.dossier_version,
    created_at: snapshot.snapshot_created_at,
    created_by: snapshot.created_by_name,
    title:      snapshot.dossier?.title,
    customer:   snapshot.customer
      ? `${snapshot.customer.first_name} ${snapshot.customer.last_name}`.trim()
      : '—',
    entry_count: (snapshot.comparison_entries ?? []).length,
    schema:      snapshot.schema_version,
  };
}