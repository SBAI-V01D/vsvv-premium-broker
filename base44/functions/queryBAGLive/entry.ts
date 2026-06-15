/**
 * queryBAGLive
 * Proxy zur offiziellen PrimAI API (api.primai.ch) — echte BAG-Prämiendaten 2026.
 * Keine Authentifizierung erforderlich (öffentliche API, MIT-Lizenz).
 * Quelle: primai.ch — "Premiums from FOPH/Priminfo via PrimAI Open Technology"
 */
import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) {
      return Response.json({ error: 'Authentication required' }, { status: 401 });
    }

    let body = {};
    try { body = await req.json(); } catch { body = {}; }
    const { plz, yob, deductible, accident, limit = 500, all_deductibles = false } = body;

    if (!plz || !yob || deductible === undefined) {
      return Response.json({ error: 'plz, yob und deductible sind Pflichtfelder' }, { status: 400 });
    }

    // Wenn all_deductibles=true: hole Daten für ALLE Franchisen (für Vergleichsansicht)
    const FRANCHISEN = [0, 100, 200, 300, 400, 500, 600, 1000, 1500, 2000, 2500];
    const targetDeductibles = all_deductibles ? FRANCHISEN : [deductible];

    const allOffers = [];
    for (const ded of targetDeductibles) {
      const params = new URLSearchParams({
        plz: String(plz),
        yob: String(yob),
        deductible: String(ded),
        accident: String(accident ?? false),
        limit: String(limit),
      });

      const url = `https://api.primai.ch/v1/compare?${params.toString()}`;
      console.log('Calling PrimAI API:', url);

      const res = await fetch(url, {
        headers: { 'Accept': 'application/json', 'User-Agent': 'VSVV-CRM/1.0' }
      });

      if (res.ok) {
        const data = await res.json();
        // PrimAI API gibt offers entweder direkt als Array, oder in data.offers / data.data
        const items = Array.isArray(data) ? data : (data.offers || data.data || []);
        allOffers.push(...items);
      } else {
        const errText = await res.text();
        console.error('PrimAI API error for deductible', ded, res.status, errText);
      }
    }

    return Response.json({
      data: allOffers,
      count: allOffers.length,
      source: 'primai.ch (BAG/FOPH offizielle Daten 2026)'
    });

  } catch (error) {
    console.error('queryBAGLive error:', error);
    return Response.json({ error: error.message, data: [] }, { status: 500 });
  }
});