import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

/**
 * extractInsuranceDocument
 * Verbesserte Extraktion mit expliziter KVG/VVG-Trennung,
 * Konfidenz-Bewertung und Schweizer Versicherungs-Spezialregeln.
 * Input: { file_url, file_name }
 */
Deno.serve(async (req) => {
  const base44 = createClientFromRequest(req);

  try {
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const { file_url, file_name } = await req.json();
    if (!file_url) return Response.json({ error: 'file_url erforderlich' }, { status: 400 });

    console.log('[extractInsuranceDocument] START user=' + user.email + ' file=' + file_name);

    const extracted = await base44.integrations.Core.InvokeLLM({
      model: 'claude_sonnet_4_6',
      file_urls: [file_url],
      prompt: `Du bist eine präzise Schweizer Versicherungs-Extraktionsmaschine. Analysiere das Dokument und extrahiere alle Daten strukturiert.

=== PFLICHTREGELN ===
1. ZAHLEN: Alle Prämien, Franchisen als Zahl (nicht String). "300.–" → 300
2. DATUM: Immer YYYY-MM-DD. "01.01.2026" → "2026-01-01"
3. KVG vs VVG STRIKT TRENNEN:
   - KVG = Krankenversicherung gemäss KVG (Grundversicherung): Standard, HMO, HAM, Telmed, Callmed
   - VVG = Zusatzversicherung gemäss VVG: Spital, Ambulant, Dental, Global, Komplementär, Taggeld
   - NIEMALS KVG-Produkte als VVG klassieren oder umgekehrt
4. UNFALL: Immer prüfen ob Unfalldeckung sistiert (typisch bei Erwerbstätigen). unfall_gedeckt=false wenn "ohne Unfall" oder Abzug sichtbar
5. BONUS/RABATT: bonus_stufe (0-10) wenn vorhanden. Familienrabatt und Kollektivrabatt separat erfassen
6. VERSICHERUNGSNEHMER vs VERSICHERTE PERSON: Adressblock = Versicherungsnehmer. Policenzeile "für [Name]" = versicherte Person
7. MEHRERE PERSONEN: Jede Person als eigenes Objekt in persons[]. Jede Police in policies[] mit person_index
8. POLNUMMER: Exakt wie im Dokument, inkl. Punkte/Bindestriche
9. FRANCHISE NUR FÜR KVG: VVG-Produkte haben keine Franchise
10. KONFIDENZ: 1.0=exakt lesbar, 0.8=klar ableitbar, 0.6=wahrscheinlich, <0.6=unsicher

=== VERSICHERER-WISSEN ===
GROUPE MUTUEL KVG-Codes: RT=SanaTel(TelMed), RF=SanaFlex(FreieArztwahl), RS=SanaStart, RM=SanaMed(Hausarzt), RH=SanaHAM, RC=SanaCare(HMO)
GROUPE MUTUEL VVG-Codes: GO=GlobalSmart, KH=H-Capital, MU=Mundo, SP=Supra, HO=Hospi, CO=Complementa, DE=Denta, BH=Taggeld
CSS/myFlex VVG: myFlex Spital (Balance/Comfort/Premium), myFlex Ambulant, myFlex Dental
HELSANA VVG: TOP, OMNI (stationär), SANA (ambulant), DENTA, VITA
SWICA VVG: HOSPITA, COMPLETA, DENTA
"Monatlicher Abzug" / "Kombinationsrabatt" = Rabatt, KEIN Produkt!
"Monatsprämie gemäss KVG/VVG" = Subtotal, KEIN Produkt!

Antworte NUR mit JSON, keine Erklärungen.`,
      response_json_schema: {
        type: 'object',
        properties: {
          versicherer: { type: ['string', 'null'] },
          dokument_typ: { type: ['string', 'null'], description: 'police / offerte / rechnung / korrespondenz / antrag' },
          dokument_datum: { type: ['string', 'null'] },
          gesamt_konfidenz: { type: ['number', 'null'] },
          unsichere_felder: { type: 'array', items: { type: 'string' }, description: 'Felder mit Konfidenz < 0.7' },
          persons: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                rolle: { type: ['string', 'null'], description: 'versicherungsnehmer / versicherte_person / beide' },
                vorname: { type: ['string', 'null'] },
                nachname: { type: ['string', 'null'] },
                geburtsdatum: { type: ['string', 'null'] },
                geschlecht: { type: ['string', 'null'] },
                ahv_nr: { type: ['string', 'null'] },
                strasse: { type: ['string', 'null'] },
                plz: { type: ['string', 'null'] },
                ort: { type: ['string', 'null'] },
                kundennummer: { type: ['string', 'null'] },
                tarifregion: { type: ['string', 'null'] },
                konfidenz: { type: ['number', 'null'] },
              }
            }
          },
          policies: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                person_index: { type: ['number', 'null'], description: 'Index in persons[]' },
                typ: { type: ['string', 'null'], description: 'kvg / vvg' },
                produkt_name: { type: ['string', 'null'] },
                produkt_code: { type: ['string', 'null'] },
                modell: { type: ['string', 'null'], description: 'Standard / HMO / HAM / Telmed / Callmed / FreieArztwahl' },
                polnummer: { type: ['string', 'null'] },
                franchise: { type: ['number', 'null'], description: 'Nur für KVG' },
                selbstbehalt_prozent: { type: ['number', 'null'] },
                selbstbehalt_max_chf: { type: ['number', 'null'] },
                praemie_brutto: { type: ['number', 'null'] },
                praemie_netto: { type: ['number', 'null'], description: 'Nach Rabatt/Abzügen' },
                unfall_gedeckt: { type: ['boolean', 'null'] },
                unfall_abzug_chf: { type: ['number', 'null'] },
                bonus_stufe: { type: ['number', 'null'] },
                familienrabatt_chf: { type: ['number', 'null'] },
                kollektivrabatt_chf: { type: ['number', 'null'] },
                gueltig_ab: { type: ['string', 'null'] },
                gueltig_bis: { type: ['string', 'null'] },
                konfidenz: { type: ['number', 'null'] },
              }
            }
          },
          total_praemie_monatlich: { type: ['number', 'null'] },
          total_praemie_jaehrlich: { type: ['number', 'null'] },
          notizen: { type: ['string', 'null'] },
        }
      }
    });

    if (!extracted || typeof extracted !== 'object') {
      return Response.json({ success: false, error: 'KI hat kein gültiges JSON zurückgegeben' });
    }

    // Unsichere Felder sammeln
    const unsichereFelder = extracted.unsichere_felder || [];
    (extracted.policies || []).forEach((p, i) => {
      if ((p.konfidenz || 1) < 0.7) {
        unsichereFelder.push(`policy[${i}].produkt_name`);
      }
    });

    console.log('[extractInsuranceDocument] OK: ' + (extracted.policies || []).length + ' Polices, Konfidenz=' + extracted.gesamt_konfidenz);

    return Response.json({
      success: true,
      data: extracted,
      unsichere_felder: [...new Set(unsichereFelder)],
    });

  } catch (error) {
    console.error('[extractInsuranceDocument] ERROR:', error.message);
    return Response.json({ success: false, error: error.message }, { status: 500 });
  }
});