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
    
    try {
      // OPTIMIZED for Swiss insurance documents
      const response = await base44.integrations.Core.InvokeLLM({
        model: 'automatic',
        prompt: `Sie sind ein Experte für Schweizer Versicherungspolicen.

Extrahieren Sie alle Kundendaten und Vertragsinformationen aus diesem Dokument.

KRITISCH – ROLLEN MÜSSEN STRENG GETRENNT WERDEN:

**VERSICHERUNGSNEHMER (policy_holder_name)**
= MUSS auf Seite 1 oben unter "Frau / Herr ... Strasse PLZ Stadt" stehen
= ODER: Name in "Ihre Adresse" / "Versicherungsnehmer"
= Der Vertragspartner / Zahler
= Beispiel: "Samanta Albertin, Mühlesteigstrasse 30, 4125 Riehen"

**WICHTIG:** GANZ OBEN auf dem Dokument ZUERST nach Adressblock suchen!
Die Adresse ist IMMER am Anfang (z.B. "Frau Samanta Albertin ...")

**VERSICHERTE PERSON (first_name, last_name)**
= Name in "Versicherte Person" / "Versicherte Personen" 
= ODER: In Info-Box rechts oben "Versicherte Person: Joana Albertin"
= Die Person auf der Police (kann Kind sein!)
= Beispiel: "Joana Albertin" oder "Kyllian Adolf Albertin"

**WICHTIG:**
- Diese KÖNNEN unterschiedlich sein (z.B. Eltern als Versicherungsnehmer, Kind als Versicherte Person)
- ZUERST Adressblock (Versicherungsnehmer) extrahieren
- DANN Info-Box oder "Versicherte Person" extrahieren
- Nur echte Personen (keine "Baby" Placeholder)

PERSONENDATEN:
- policy_holder_name: VERSICHERUNGSNEHMER (Vertragspartner)
- first_name: VERSICHERTE PERSON (Person auf Police)
- last_name: VERSICHERTE PERSON
- birthdate: VERSICHERTE PERSON Geburtsdatum (YYYY-MM-DD)

ADRESSDATEN:
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
- insurance_type: Versicherungsart (z.B. "Krankenversicherung KVG", "Krankenzusatz VVG", "Motorfahrzeug", "Hausrat", "Haftpflicht", "Leben", "BVG")
- product: Produkt/Tarif-Bezeichnung (SEHR WICHTIG! z.B. "COMPACT", "STANDARD", "HMO", "Telmed", "TOP", "BASIC", "Comfort", "Vollkasko", "OPTIMA", "Natura", "SanaTel", "myFlex", "easy sana", "Smile")
  * Steht oft in GROSSBUCHSTABEN direkt neben oder unter dem Versicherungsnamen
  * Ist der Name des Versicherungsmodells, nicht die Sparte
  * Bei Gruppenversicherungen: Produkt-/Tarifname aus der Police extrahieren (z.B. "SanaTel", "HOSPITAL", "GLOBAL Care")
  * Beispiele: "CSS COMPACT", "Helsana TOP", "Swica OPTIMA", "Sanitas CASAMED HMO", "Groupe Mutuel SanaTel", "Mutuel OPTIMA"
  * IMMER aus dem Dokument extrahieren — nicht "KVG" oder "VVG" als Produkt verwenden, das ist die Versicherungsart
- model: Versicherungsmodell / Tarifmodell wenn vorhanden (z.B. "Hausarztmodell", "HMO", "Telmed", "freie Arztwahl", "Standardmodell")
- franchise: Franchise-Betrag falls vorhanden (z.B. "300", "500", "1000", "1500", "2000", "2500")
- age_group: Altersgruppe wenn erkennbar (z.B. "Erwachsener", "Kind (0–18 Jahre)", "jung (19–25 Jahre)")
- start_date: Versicherungsbeginn / Gültig ab (YYYY-MM-DD)
- end_date: Vertragsablauf / Gültig bis / Ende (YYYY-MM-DD)
- cancellation_deadline: Kündigungsfrist / Kündigung bis (YYYY-MM-DD) falls vorhanden
- renewal_date: Nächster Erneuerungstermin falls vorhanden (YYYY-MM-DD)
- premium_monthly: Monatsprämie (nur Zahl, kein CHF-Zeichen)
- premium_yearly: Jahresprämie (nur Zahl, kein CHF-Zeichen). Falls nur Monatsprämie: null setzen.
- payment_frequency: Zahlungsintervall ("monatlich", "jährlich", "halbjährlich", "vierteljährlich")

ERKENNUNGSREGELN FÜR SCHWEIZER POLICEN:
1. Achte auf typische Schweizer Formatierung (CHF, 4-stellige PLZ)
2. "Versicherungsnehmer" = Hauptkunde
3. "versicherte Person" kann anders sein als Versicherungsnehmer
4. Mehrere Personen? → Nur Hauptperson extrahieren
5. Adresse kann mehrzeilig sein → zusammenfassen
6. OCR Fehler (z.B. "O" statt "0") korrigieren
7. Sonderzeichen (ä, ö, ü) korrekt verarbeiten
8. Leerzeichen trimmen

AUSGABE:
- Rückgabe ein vollständiges JSON-Objekt
- Leere Werte als null (nicht als leerer String)
- Daten verfügbar? → Feld mit echtem Wert füllen
- Daten nicht verfügbar? → null setzen
- KEINE Erfindung von Daten
- KEINE Annahmen wenn nicht eindeutig

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
  "age_group": "Erwachsener" oder "Kind (0–18 Jahre)" oder null
}`,
        file_urls: [file_url],
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
            age_group: { type: ['string', 'null'] }
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
        notes: null
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