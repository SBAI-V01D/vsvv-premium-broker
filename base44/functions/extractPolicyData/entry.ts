import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

// Swiss postal code to canton mapping
const CANTON_MAP = {
  '1': 'GE', '2': 'NE', '3': 'BE', '4': 'BL', '5': 'AG', '6': 'LU',
  '7': 'GR', '8': 'ZH', '9': 'SG'
};

function cantonFromZip(zip) {
  if (!zip || typeof zip !== 'string' || zip.length < 1) return null;
  return CANTON_MAP[zip.charAt(0)] || null;
}

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const { file_url, file_name } = await req.json();
    if (!file_url) return Response.json({ error: 'Missing file_url' }, { status: 400 });

    console.log(`[extractPolicyData] START file=${file_name}`);

    let extractedData = {};

    // Pass file URL directly to LLM (Gemini supports external PDF URLs)
    const fileInput = file_url;
    console.log(`[extractPolicyData] Using file_url for LLM: ${file_url.substring(0, 80)}...`);
    
    try {
      // OPTIMIZED for Swiss insurance documents
      const response = await base44.integrations.Core.InvokeLLM({
        model: 'gemini_3_flash',
        prompt: `Sie sind ein Experte für Schweizer Versicherungspolicen.

Extrahieren Sie alle Kundendaten und Vertragsinformationen aus diesem Dokument.

═══════════════════════════════════════════════════════
KRITISCH: ROLLEN PRÄZISE UNTERSCHEIDEN
═══════════════════════════════════════════════════════

**SCHRITT 1 — VERSICHERTE PERSON (first_name, last_name) ZUERST:**
= Die Person, FÜR DIE die Police gilt
= Suche: "VERSICHERUNGSPOLICE für [Name]", "für [Vorname Nachname]", Info-Box mit Geburtsdatum
= Oder: Abschnitt "Versicherte Person" / "Versicherter"
= DIESE PERSON ist der Hauptkunde → first_name + last_name
= Beispiel CSS: "VERSICHERUNGSPOLICE für Thomas Leuenberger" → first_name=Thomas, last_name=Leuenberger
= Beispiel: Infobox "Thomas Leuenberger / Geburtsdatum: 05.02.1966" → Thomas Leuenberger

**SCHRITT 2 — PRÄMIENZAHLER / ADRESSEMPFÄNGER (policy_holder_name):**
= Die Person im ADRESSBLOCK oben links/rechts ("Frau/Herr Name, Strasse, PLZ Ort")
= ODER: Abschnitt "Prämienzahler" / "Rechnungsempfänger"
= Kann IDENTISCH mit versicherter Person sein → dann policy_holder_name = null
= Kann UNTERSCHIEDLICH sein (z.B. Mutter zahlt für Kind, Frau zahlt für Mann)
= Beispiel CSS: Adressblock zeigt "Daniela Leuenberger" → policy_holder_name="Daniela Leuenberger"

**ADRESSE (street, zip_code, city):**
= IMMER die Adresse der VERSICHERTEN PERSON verwenden
= Falls versicherte Person keine eigene Adresse hat → Adresse des Prämienzahlers

═══════════════════════════════════════════════════════
KRITISCH: VERSICHERUNGSART KORREKT KLASSIFIZIEREN
═══════════════════════════════════════════════════════

**insurance_type REGELN — DIESE REGELN HABEN HÖCHSTE PRIORITÄT:**

REGEL 1: Suche nach den Abschnittsüberschriften im Dokument:
- Gibt es "Versicherungen nach Versicherungsvertragsgesetz (VVG)" OHNE KVG-Abschnitt? → "Krankenzusatz VVG"
- Gibt es "Versicherungen nach KVG" / "Grundversicherung" / "Obligatorische Krankenversicherung"? → "Krankenversicherung KVG"
- Gibt es BEIDE Abschnitte? → "Krankenversicherung KVG" (für KVG-Hauptprodukt)

REGEL 2: Produktname als Indikator:
- "Spitalversicherung" (egal welche Variante: myFlex, mySelect, Balance, Halbprivat, Privat) = IMMER VVG!
- "Zusatzversicherung" = IMMER VVG!
- "Grundversicherung" / "Obligatorische KV" = IMMER KVG!
- "Unfallausschluss" allein ändert die Klassifizierung NICHT

REGEL 3: Total-Zeile als Kontrollcheck:
- Steht nur "Total Nettoprämie VVG" (kein KVG)? → zwingend "Krankenzusatz VVG"
- Steht "Total Nettoprämie KVG"? → zwingend "Krankenversicherung KVG"

KONKRETES BEISPIEL CSS SPITALVERSICHERUNG:
Dokument zeigt: "VVG Spitalversicherung myFlex", "Total Nettoprämie VVG: 63.10"
→ insurance_type = "Krankenzusatz VVG" (NICHT KVG!)
→ product = "Spitalversicherung myFlex"
→ premium_monthly = 63.10 (Nettobetrag nach Rabatt)

PERSONENDATEN:
- policy_holder_name: PRÄMIENZAHLER (nur wenn ABWEICHEND von versicherter Person, sonst null)
- first_name: VERSICHERTE PERSON (Person auf Police)
- last_name: VERSICHERTE PERSON
- birthdate: VERSICHERTE PERSON Geburtsdatum (YYYY-MM-DD)

ADRESSDATEN (der versicherten Person):
- street: Straßenname und Nummer (z.B. "Musterstrasse 42")
- zip_code: Postleitzahl (4-stellig)
- city: Ortschaft
- country: Land (CH oder leer)

KONTAKTDATEN:
- phone: Telefonnummer (mit oder ohne Ländercode)
- mobile: Mobilnummer (mit oder ohne Ländercode)
- email: E-Mail-Adresse

VERSICHERUNGSDATEN:
- insurer: Versicherungsgesellschaft (z.B. "Allianz", "CSS", "Generali", "Helsana", "Swica", "Sanitas", "KPT", "Concordia", "ÖKK")
- policy_number: Policen-Nummer / Vertragsnummer (WICHTIG: vollständige Nummer extrahieren)
- insurance_type: Versicherungsart — siehe REGELN oben
- product: Produkt/Tarif-Bezeichnung (SEHR WICHTIG!)
  * z.B. "Spitalversicherung myFlex", "COMPACT", "HMO", "TOP", "myFlex Balance"
  * IMMER aus dem Dokument extrahieren — nicht "KVG" oder "VVG" als Produkt verwenden
- model: Tarifmodell wenn vorhanden (z.B. "Hausarztmodell", "HMO", "Telmed", "Balance")
- franchise: Franchise-Betrag falls vorhanden (z.B. "300", "500", "1000", "2500")
- age_group: Altersgruppe wenn erkennbar (z.B. "Erwachsener", "56 - 60 Jahre", "Kind")
- start_date: Versicherungsbeginn / Gültig ab (YYYY-MM-DD)
- end_date: Vertragsablauf / Gültig bis (YYYY-MM-DD)
- cancellation_deadline: Kündigungsfrist / Kündigung bis (YYYY-MM-DD) falls vorhanden
- renewal_date: Nächster Erneuerungstermin falls vorhanden (YYYY-MM-DD)
- premium_monthly: NETTO Monatsprämie nach allen Rabatten (nur Zahl, kein CHF-Zeichen)
- premium_yearly: Jahresprämie (nur Zahl). Falls nur Monatsprämie vorhanden: null setzen.
- payment_frequency: Zahlungsintervall ("monatlich", "jährlich", "halbjährlich", "vierteljährlich")

ALLGEMEINE ERKENNUNGSREGELN:
1. Schweizer Formatierung: CHF, 4-stellige PLZ
2. OCR-Fehler (z.B. "O" statt "0") korrigieren
3. Sonderzeichen (ä, ö, ü) korrekt verarbeiten
4. Leerzeichen trimmen
5. KEINE Erfindung von Daten — bei Unsicherheit null setzen

DOKUMENTTYP (document_type):
Erkenne den Typ anhand des Inhalts:
- "Police" = aktiver Versicherungsvertrag / Policendokument
- "Offerte" = Angebot / Offerte
- "Rechnung" = Prämienrechnung
- "Schaden" = Schadensmeldung
- "Kündigung" = Kündigungsschreiben
- "Leistungsabrechnung" = Abrechnungsdokument
- "Unbekannt" = nicht zuordbar

CONFIDENCE SCORES (field_confidences):
Für jedes extrahierte Feld einen Wert 0.0–1.0 zurückgeben:
- 0.95–1.0: explizit und eindeutig im Dokument
- 0.80–0.94: klar ableitbar, keine Ambiguität
- 0.65–0.79: plausibel, aber mehrere Interpretationen möglich
- 0.40–0.64: unsicher, nur Annahme
- < 0.40: nicht gefunden oder sehr unsicher → Feld = null

AUSGABE:
- Rückgabe ein vollständiges JSON-Objekt
- Leere Werte als null (nicht als leerer String)
- KEINE Erfindung von Daten

Rückgabe EXAKT als JSON:
{
  "policy_holder_name": "Vollständiger Name des Versicherungsnehmers" oder null,
  "first_name": "Vorname der versicherten Person",
  "last_name": "Nachname der versicherten Person",
  "birthdate": "YYYY-MM-DD" oder null,
  "gender": "M" oder "W" oder null,
  "role": "Versicherungsnehmer" oder "Ehepartner" oder "Kind" oder null,
  "street": "Strassenname Hausnummer",
  "zip_code": "1234" oder null,
  "city": "Ortsname",
  "country": "CH" oder null,
  "phone": "Telefonnummer" oder null,
  "mobile": "Mobilnummer" oder null,
  "email": "email@example.com" oder null,
  "insurer": "Name der Versicherungsgesellschaft",
  "policy_number": "Policen-/Vertragsnummer",
  "insurance_type": "Krankenversicherung KVG" oder "Krankenzusatz VVG" oder "Motorfahrzeug" etc.,
  "product": "COMPACT" oder "HMO" oder "TOP" oder "Vollkasko" etc. - IMMER EXTRAHIEREN wenn sichtbar,
  "start_date": "YYYY-MM-DD" oder null,
  "end_date": "YYYY-MM-DD" oder null,
  "cancellation_deadline": "YYYY-MM-DD" oder null,
  "renewal_date": "YYYY-MM-DD" oder null,
  "premium_monthly": 100.50 oder null,
  "premium_yearly": 1200.00 oder null,
  "payment_frequency": "monatlich" oder "jährlich" oder null,
  "model": "Hausarztmodell" oder "HMO" oder "Telmed" oder null,
  "franchise": "300" oder "1500" oder null,
  "age_group": "Erwachsener" oder "Kind (0–18 Jahre)" oder null,
  "document_type": "Police" oder "Offerte" oder "Rechnung" oder "Schaden" oder "Kündigung" oder "Leistungsabrechnung" oder "Unbekannt",
  "field_confidences": {
    "policy_holder_name": 0.0,
    "first_name": 0.0,
    "last_name": 0.0,
    "birthdate": 0.0,
    "insurer": 0.0,
    "policy_number": 0.0,
    "insurance_type": 0.0,
    "product": 0.0,
    "premium_monthly": 0.0,
    "start_date": 0.0,
    "end_date": 0.0,
    "street": 0.0
  }
}`,
        add_context_from_internet: false,
        file_urls: [fileInput],
        response_json_schema: {
          type: 'object',
          properties: {
            policy_holder_name: { type: ['string', 'null'] },
            first_name: { type: ['string', 'null'] },
            last_name: { type: ['string', 'null'] },
            birthdate: { type: ['string', 'null'] },
            gender: { type: ['string', 'null'] },
            role: { type: ['string', 'null'] },
            street: { type: ['string', 'null'] },
            zip_code: { type: ['string', 'null'] },
            city: { type: ['string', 'null'] },
            country: { type: ['string', 'null'] },
            phone: { type: ['string', 'null'] },
            mobile: { type: ['string', 'null'] },
            email: { type: ['string', 'null'] },
            insurer: { type: ['string', 'null'] },
            policy_number: { type: ['string', 'null'] },
            insurance_type: { type: ['string', 'null'] },
            product: { type: ['string', 'null'] },
            start_date: { type: ['string', 'null'] },
            end_date: { type: ['string', 'null'] },
            cancellation_deadline: { type: ['string', 'null'] },
            renewal_date: { type: ['string', 'null'] },
            premium_monthly: { type: ['number', 'null'] },
            premium_yearly: { type: ['number', 'null'] },
            payment_frequency: { type: ['string', 'null'] },
            model: { type: ['string', 'null'] },
            franchise: { type: ['string', 'null'] },
            age_group: { type: ['string', 'null'] },
            document_type: { type: ['string', 'null'] },
            field_confidences: { type: ['object', 'null'], additionalProperties: { type: 'number' } }
          }
        }
      });

      if (response && typeof response === 'object') {
        extractedData = response;
      }
    } catch (llmErr) {
      const msg = llmErr instanceof Error ? llmErr.message : String(llmErr);
      console.warn(`[extractPolicyData] LLM extraction warning: ${msg}`);
    }

    // Normalize and clean data
    const firstName = (extractedData.first_name || '').trim() || null;
    const lastName = (extractedData.last_name || '').trim() || null;
    const birthdate = (extractedData.birthdate || '').trim() || null;
    const gender = (extractedData.gender || '').trim() || null;
    const role = (extractedData.role || '').trim() || null;
    
    const street = (extractedData.street || '').trim() || null;
    let zipCode = (extractedData.zip_code || '').trim() || null;
    let city = (extractedData.city || '').trim() || null;
    let canton = null;

    // Normalize zip code
    if (zipCode) {
      zipCode = zipCode.replace(/\D/g, '');
      while (zipCode.length < 4) zipCode = '0' + zipCode;
      zipCode = zipCode.slice(0, 4);
      if (zipCode.length !== 4) zipCode = null;
      
      if (!canton && zipCode) canton = cantonFromZip(zipCode);
    }

    const phone = (extractedData.phone || '').trim() || null;
    const mobile = (extractedData.mobile || '').trim() || null;
    const email = (extractedData.email || '').trim() || null;
    
    const insurer = (extractedData.insurer || '').trim() || null;
    const policyNumber = (extractedData.policy_number || '').trim() || null;
    const insuranceType = (extractedData.insurance_type || '').trim() || null;
    const product = (extractedData.product || '').trim() || null;
    
    const startDate = (extractedData.start_date || '').trim() || null;
    const endDate = (extractedData.end_date || '').trim() || null;
    const cancellationDeadline = (extractedData.cancellation_deadline || '').trim() || null;
    const renewalDate = (extractedData.renewal_date || '').trim() || null;
    
    let premiumMonthly = Number(extractedData.premium_monthly) || null;
    let premiumYearly = Number(extractedData.premium_yearly) || null;

    // Auto-calculate yearly from monthly
    if (premiumMonthly && !premiumYearly) {
      premiumYearly = Math.round(premiumMonthly * 12 * 100) / 100;
    }

    // Build sparte_data from extracted fields
    const sparteData = {};
    if (extractedData.model) sparteData.model = extractedData.model;
    if (extractedData.franchise) sparteData.franchise = extractedData.franchise;
    if (extractedData.age_group) sparteData.age_group = extractedData.age_group;
    if (extractedData.payment_frequency) sparteData.zahlungsintervall = extractedData.payment_frequency;

    console.log(`[extractPolicyData] SUCCESS: insurer=${insurer}, product=${product}, name=${firstName} ${lastName}, zip=${zipCode}, role=${role}`);

    return Response.json({
      success: true,
      extractedData: {
        policy_holder_name: (extractedData.policy_holder_name || '').trim() || null,
        first_name: firstName,
        last_name: lastName,
        birthdate: birthdate,
        gender: gender,
        role: role,
        street: street,
        zip_code: zipCode,
        city: city,
        canton: canton,
        phone: phone,
        mobile: mobile,
        email: email,
        insurer: insurer,
        policy_number: policyNumber,
        insurance_type: insuranceType,
        product: product,
        start_date: startDate,
        end_date: endDate,
        cancellation_deadline: cancellationDeadline,
        renewal_date: renewalDate,
        premium_monthly: premiumMonthly,
        premium_yearly: premiumYearly,
        payment_frequency: extractedData.payment_frequency || null,
        sparte_data: sparteData,
        additional_products: [],
        notes: null,
        document_type: (extractedData.document_type || 'Unbekannt'),
        field_confidences: extractedData.field_confidences || {}
      }
    });

  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : String(error);
    console.error(`[extractPolicyData] ERROR: ${errorMsg}`);

    // Always return success with empty data to prevent upload failure
    return Response.json({
      success: true,
      extractedData: {
        policy_holder_name: null,
        first_name: null,
        last_name: null,
        birthdate: null,
        gender: null,
        role: null,
        street: null,
        zip_code: null,
        city: null,
        canton: null,
        phone: null,
        mobile: null,
        email: null,
        insurer: null,
        policy_number: null,
        insurance_type: null,
        product: null,
        start_date: null,
        end_date: null,
        renewal_date: null,
        premium_monthly: null,
        premium_yearly: null,
        payment_frequency: null,
        sparte_data: {},
        additional_products: [],
        notes: `Datei konnte nicht vollständig analysiert werden. Bitte manuell überprüfen.`
      }
    });
  }
});