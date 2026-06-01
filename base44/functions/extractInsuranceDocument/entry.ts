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
          versicherer: { type: 'string' },
          dokument_typ: { type: 'string', description: 'police / offerte / rechnung / korrespondenz / antrag' },
          dokument_datum: { type: 'string' },
          gesamt_konfidenz: { type: 'number' },
          unsichere_felder: { type: 'array', items: { type: 'string' }, description: 'Felder mit Konfidenz < 0.7' },
          persons: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                rolle: { type: 'string', description: 'versicherungsnehmer / versicherte_person / beide' },
                vorname: { type: 'string' },
                nachname: { type: 'string' },
                geburtsdatum: { type: 'string' },
                geschlecht: { type: 'string' },
                ahv_nr: { type: 'string' },
                strasse: { type: 'string' },
                plz: { type: 'string' },
                ort: { type: 'string' },
                kundennummer: { type: 'string' },
                tarifregion: { type: 'string' },
                konfidenz: { type: 'number' },
              }
            }
          },
          policies: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                person_index: { type: 'number', description: 'Index in persons[]' },
                typ: { type: 'string', description: 'kvg / vvg' },
                produkt_name: { type: 'string' },
                produkt_code: { type: 'string' },
                modell: { type: 'string', description: 'Standard / HMO / HAM / Telmed / Callmed / FreieArztwahl' },
                polnummer: { type: 'string' },
                franchise: { type: 'number', description: 'Nur für KVG' },
                selbstbehalt_prozent: { type: 'number' },
                selbstbehalt_max_chf: { type: 'number' },
                praemie_brutto: { type: 'number' },
                praemie_netto: { type: 'number', description: 'Nach Rabatt/Abzügen' },
                unfall_gedeckt: { type: 'boolean' },
                unfall_abzug_chf: { type: 'number' },
                bonus_stufe: { type: 'number' },
                familienrabatt_chf: { type: 'number' },
                kollektivrabatt_chf: { type: 'number' },
                gueltig_ab: { type: 'string' },
                gueltig_bis: { type: 'string' },
                konfidenz: { type: 'number' },
              }
            }
          },
          total_praemie_monatlich: { type: 'number' },
          total_praemie_jaehrlich: { type: 'number' },
          notizen: { type: 'string' },
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