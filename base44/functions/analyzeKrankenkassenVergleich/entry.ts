import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { vergleichId } = await req.json();
    
    const vergleiche = await base44.entities.KrankenkassenVergleich.filter({ id: vergleichId });
    const vergleich = vergleiche[0];
    
    if (!vergleich) {
      return Response.json({ error: 'Vergleich nicht gefunden' }, { status: 404 });
    }

    const ergebnisse = vergleich.vergleichsergebnisse || [];
    const aktuelle = vergleich.aktuelle_versicherung;
    
    const besteOption = ergebnisse.find(e => e.ist_empfohlen) || ergebnisse[0];
    
    if (!besteOption) {
      return Response.json({ error: 'Keine Ergebnisse für Analyse' }, { status: 400 });
    }

    const sparpotenzial = besteOption.ersparnis_jaehrlich || 0;
    const wechselEmpfohlen = sparpotenzial > 500;
    
    let empfehlungText = '';
    
    if (wechselEmpfohlen) {
      empfehlungText = `Der Kunde kann durch einen Wechsel von ${aktuelle.krankenkasse} ${aktuelle.modell} zu ${besteOption.krankenkasse} ${besteOption.modell} CHF ${sparpotenzial.toLocaleString('de-CH')} pro Jahr einsparen. `;
      
      if (aktuelle.franchise > besteOption.franchise) {
        empfehlungText += `Die tiefere Franchise von CHF ${besteOption.franchise} führt zu höheren monatlichen Kosten, bietet aber besseren Schutz bei Behandlungsbedarf. `;
      }
      
      if (aktuelle.modell === 'standard' && ['telmed', 'hausarzt', 'hmo'].includes(besteOption.modell)) {
        empfehlungText += `Das ${besteOption.modell}-Modell erfordert eine Erstberatung per Telefon/Hausarzt, spart aber jährlich CHF ${sparpotenzial.toLocaleString('de-CH')}. `;
      }
      
      empfehlungText += `Aufgrund des Alters, Wohnortes und bisherigen Versicherungsverhaltens erscheint ein Wechsel empfehlenswert.`;
    } else {
      empfehlungText = `Die aktuelle Versicherung bei ${aktuelle.krankenkasse} ist bereits gut positioniert. `;
      empfehlungText += `Ein Wechsel würde nur CHF ${sparpotenzial.toLocaleString('de-CH')} pro Jahr einsparen, was den Aufwand eines Versicherungswechsels möglicherweise nicht rechtfertigt. `;
      empfehlungText += `Bei der nächsten Prämienanpassung sollte jedoch erneut geprüft werden.`;
    }

    const kiAnalyse = {
      sparpotenzial,
      wechsel_empfohlen: wechselEmpfohlen,
      franschise_optimierung: aktuelle.franchise > 1000 
        ? 'Eine tiefere Franchise könnte die Prämie weiter senken' 
        : aktuelle.franchise < 500 
          ? 'Die aktuelle Franchise ist bereits sehr tief - gut für Personen mit regelmässigen Arztkonsultationen'
          : 'Franchise ist optimal gewählt für das Nutzungsprofil',
      modell_optimierung: aktuelle.modell === 'standard'
        ? 'Ein Telmed- oder Hausarztmodell könnte Prämien sparen (CHF 40-60/Monat)'
        : aktuelle.modell === 'telmed'
          ? 'Telmed-Modell ist gewählt - prüfen ob Hausarztmodell noch günstiger wäre'
          : 'Alternatives Modell ist bereits gewählt - gut optimiert',
      empfehlung_text: empfehlungText,
      empfohlene_krankenkasse: besteOption.krankenkasse,
      empfohlenes_modell: besteOption.modell,
      analyse_datum: new Date().toISOString()
    };

    await base44.entities.KrankenkassenVergleich.update(vergleichId, {
      ki_analyse: kiAnalyse
    });

    return Response.json({ kiAnalyse });

  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});