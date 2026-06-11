/**
 * debugBAGInsurers - gibt nur die eindeutigen Versicherernamen + Modelle zurück
 */
import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Auth required' }, { status: 401 });

    const { plz = '4304', yob = 1968, deductible = 300 } = await req.json().catch(() => ({}));

    const url = `https://api.primai.ch/v1/compare?plz=${plz}&yob=${yob}&deductible=${deductible}&accident=false&limit=500`;
    const res = await fetch(url, { headers: { 'Accept': 'application/json' } });
    const data = await res.json();
    const items = Array.isArray(data) ? data : (data.offers || data.data || []);

    // Nur eindeutige Versicherernamen + Modelle
    const uniqueInsurerModels = [...new Map(
      items.map(o => [`${o.insurer}|${o.model}`, { insurer: o.insurer, model: o.model, price: o.price?.total }])
    ).values()].sort((a, b) => a.insurer.localeCompare(b.insurer));

    const uniqueInsurers = [...new Set(items.map(o => o.insurer))].sort();

    return Response.json({
      total_raw: items.length,
      unique_insurers: uniqueInsurers,
      unique_insurer_models: uniqueInsurerModels,
    });
  } catch (e) {
    return Response.json({ error: e.message }, { status: 500 });
  }
});