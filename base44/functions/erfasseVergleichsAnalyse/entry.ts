/**
 * erfasseVergleichsAnalyse
 * Speichert eine Krankenkassen-Beratungsanalyse in der VergleichsAnalyse Entity
 */
import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    
    if (!user) {
      return Response.json({ error: 'Authentication required' }, { status: 401 });
    }

    const { 
      customer_id, 
      customer_name, 
      organisation_id,
      analyse_datum,
      persoenliche_daten,
      ausgangslage,
      empfehlung,
      beratungsergebnis,
      notizen,
      generate_pdf = true
    } = await req.json();

    // Status setzen basierend auf Ergebnis
    let status = 'beratung_erfolgt';
    if (beratungsergebnis?.kunde_folgt_empfehlung) {
      status = 'umgesetzt';
    } else if (beratungsergebnis?.kunde_lehnt_ab) {
      status = 'abgelehnt';
    } else if (beratungsergebnis?.kunde_moechte_ueberpruefen) {
      status = 'ueberpruefung';
    }

    // Analyse speichern
    const analyseData = {
      customer_id,
      customer_name,
      advisor_id: user.id,
      advisor_name: user.full_name || user.email,
      organization_id: organisation_id || user.data?.organization_id,
      analyse_datum: analyse_datum || new Date().toISOString(),
      persoenliche_daten,
      ausgangslage,
      empfehlung,
      beratungsergebnis,
      status,
      notizen
    };

    const created = await base44.entities.VergleichsAnalyse.create(analyseData);

    return Response.json({ 
      success: true, 
      analyse_id: created.id,
      status
    });

  } catch (error) {
    console.error('erfasseVergleichsAnalyse error:', error);
    return Response.json({ 
      error: error.message,
      success: false
    }, { status: 500 });
  }
});