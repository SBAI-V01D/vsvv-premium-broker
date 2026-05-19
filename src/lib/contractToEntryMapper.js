/**
 * contractToEntryMapper.js — Phase 5.3
 * Mappt ein CRM-Contract-Objekt auf ein ComparisonEntry-Formular-Objekt.
 * ISOLIERT: Nur Lesen, kein Write. Reine Transformationsfunktion.
 * Kein direktes Speichern — Benutzer bestätigt immer zuerst.
 */

/**
 * Mappt ein Contract-Objekt auf ein vorbefülltes ComparisonEntry-Formular.
 * @param {object} contract - CRM Contract record
 * @param {string} personName - Name der versicherten Person
 * @returns {object} Vorbefülltes Formular-Objekt (noch nicht gespeichert)
 */
export function mapContractToEntry(contract, personName) {
  // Monatsprämie berechnen
  const praemie_monatlich =
    contract.premium_monthly != null
      ? contract.premium_monthly
      : contract.premium_yearly != null
        ? Math.round((contract.premium_yearly / 12) * 100) / 100
        : '';

  // Franchise aus sparte_data extrahieren (wenn vorhanden)
  const franchise =
    contract.sparte_data?.franchise ??
    contract.sparte_data?.Franchise ??
    '';

  // Modell aus sparte_data (z.B. KVG)
  const modell =
    contract.sparte_data?.model ??
    contract.sparte_data?.modell ??
    contract.sparte_data?.Modell ??
    '';

  // Sektion ableiten: health → grundversicherung, sonst zusatzversicherung
  const section = contract.insurance_type === 'health'
    ? 'grundversicherung'
    : 'zusatzversicherung';

  // Produkt-Bezeichnung
  const product_name = contract.product || contract.sparte || '';

  return {
    person_name:       personName,
    section,
    gesellschaft:      contract.insurer || '',
    product_name,
    praemie_monatlich: praemie_monatlich !== '' ? Number(praemie_monatlich) : '',
    franchise:         franchise !== '' ? Number(franchise) : '',
    modell,
    deckung_details:   '',
    leistungs_score:   '',
    is_current:        true,   // aus CRM übernommen → als "Aktuelle Police" markieren
    is_recommended:    false,
    // Meta: woher die Daten stammen (nicht gespeichert, nur für UI-Anzeige)
    _source_contract_id: contract.id,
    _source_policy_number: contract.policy_number || '',
  };
}

/**
 * Gibt eine menschenlesbare Beschreibung der gemappten Felder zurück.
 * Für UI-Anzeige (welche Felder wurden vorbefüllt).
 */
export function getImportSummary(contract) {
  const fields = [];
  if (contract.insurer) fields.push('Gesellschaft');
  if (contract.product || contract.sparte) fields.push('Produkt');
  if (contract.premium_monthly || contract.premium_yearly) fields.push('Prämie');
  if (contract.sparte_data?.franchise) fields.push('Franchise');
  if (contract.sparte_data?.model || contract.sparte_data?.modell) fields.push('Modell');
  return fields;
}