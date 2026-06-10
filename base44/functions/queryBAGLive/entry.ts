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

    const { plz, yob, deductible, accident, limit = 200 } = await req.json();

    if (!plz || !yob || deductible === undefined) {
      return Response.json({ error: 'plz, yob und deductible sind Pflichtfelder' }, { status: 400 });
    }

    const params = new URLSearchParams({
      plz: String(plz),
      yob: String(yob),
      deductible: String(deductible),
      accident: String(accident ?? false),
      limit: String(limit),
    });

    const url = `https://api.primai.ch/v1/compare?${params.toString()}`;
    console.log('Calling PrimAI API:', url);

    const res = await fetch(url, {
      headers: { 'Accept': 'application/json', 'User-Agent': 'VSVV-CRM/1.0' }
    });

    if (!res.ok) {
      const errText = await res.text();
      console.error('PrimAI API error:', res.status, errText);
      return Response.json({ error: `PrimAI API Fehler: ${res.status}`, data: [] }, { status: 502 });
    }

    const data = await res.json();

    return Response.json({
      data: data.offers || [],
      count: (data.offers || []).length,
      region: data.region,
      age_band: data.age_band,
      currency: data.currency,
      source: 'primai.ch (BAG/FOPH offizielle Daten 2026)'
    });

  } catch (error) {
    console.error('queryBAGLive error:', error);
    return Response.json({ error: error.message, data: [] }, { status: 500 });
  }
});