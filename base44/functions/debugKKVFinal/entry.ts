/**
 * debugKKVFinal — Nur stage5_full + mutuel_details + filtered_out
 */
import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';

const MODEL_ALIAS_MAP = {
  'standard': 'Standard', 'telmed': 'Telmed', 'gp': 'Hausarzt', 'hausarzt': 'Hausarzt',
  'hmo': 'HMO', 'other': 'Hausarzt', 'free_choice': 'Standard', 'managed_care': 'Hausarzt',
};
function normalizeModel(m) { return MODEL_ALIAS_MAP[m?.toLowerCase()] || m; }
function matchesInsurer(a, b) {
  if (!a || !b) return false;
  const al = a.toLowerCase(), bl = b.toLowerCase();
  if (al === bl) return true;
  const aF = al.split(/[\s(,]/)[0], bF = bl.split(/[\s(,]/)[0];
  if (aF.length > 3 && al.includes(aF) && bl.includes(aF)) return true;
  if (bF.length > 3 && al.includes(bF) && bl.includes(bF)) return true;
  return false;
}

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const url = `https://api.primai.ch/v1/compare?plz=4055&yob=1968&deductible=2500&accident=false&limit=500`;
    const res = await fetch(url, { headers: { Accept: 'application/json' } });
    const json = await res.json();
    const stage1 = Array.isArray(json) ? json : (json.data || json.offers || []);

    const stage2 = stage1.map(o => ({
      insurer: o.insurer, model: o.model,
      price: o.price?.total ?? o.price?.base ?? 0,
    })).filter(o => o.price > 0 && o.insurer && o.model);

    const map3 = new Map();
    for (const o of stage2) {
      const k = `${o.insurer}|||${o.model}`;
      if (!map3.has(k) || o.price < map3.get(k).price) map3.set(k, o);
    }
    const stage3 = Array.from(map3.values());

    const filterModelle = ['Standard', 'Hausarzt', 'HMO', 'Telmed'];
    const aktuelle_kasse = 'Mutuel (Gruppe Mutuel)';

    const stage4_with_norm = stage3.map(o => ({
      ...o, model_norm: normalizeModel(o.model),
      passes: filterModelle.includes(normalizeModel(o.model)),
      is_current: matchesInsurer(o.insurer, aktuelle_kasse),
    }));
    const stage4 = stage4_with_norm.filter(o => o.passes);
    const stage5 = [...stage4].sort((a, b) => a.price - b.price);

    // Mutuel suchen mit KORREKTEM Namen wie er in der API kommt
    const mutuelActualName = 'Mutuel Krankenversicherung AG';
    const mutuelInStage3 = stage3.filter(o => o.insurer === mutuelActualName);
    const mutuelInStage4 = stage4.filter(o => o.insurer === mutuelActualName);
    const mutuelInStage5 = stage5.filter(o => o.insurer === mutuelActualName);

    // matchesInsurer-Test: CRM-Name vs API-Name
    const matchTest = {
      'Mutuel (Groupe Mutuel)': matchesInsurer('Mutuel Krankenversicherung AG', 'Mutuel (Groupe Mutuel)'),
      'Groupe Mutuel': matchesInsurer('Mutuel Krankenversicherung AG', 'Groupe Mutuel'),
      'Mutuel': matchesInsurer('Mutuel Krankenversicherung AG', 'Mutuel'),
    };

    const filtered_out = stage4_with_norm.filter(o => !o.passes)
      .map(o => `${o.insurer} | "${o.model}" → "${o.model_norm}" GEFILTERT`);

    return Response.json({
      FAZIT: {
        css_in_stage5: stage5.some(o => o.insurer === 'CSS'),
        assura_in_stage5: stage5.some(o => o.insurer === 'Assura-Basis SA'),
        mutuel_api_name: mutuelActualName,
        mutuel_in_stage3: mutuelInStage3.length,
        mutuel_in_stage4: mutuelInStage4.length,
        mutuel_in_stage5: mutuelInStage5.length,
        mutuel_matchesInsurer_tests: matchTest,
        filtered_out_count: filtered_out.length,
        filtered_out,
      },
      stage5_full: stage5.map((o, i) => `${i+1}. ${o.insurer} | ${o.model_norm} | CHF ${(o.price-5.15).toFixed(2)} netto (${o.price} brutto)`),
    });

  } catch (err) {
    return Response.json({ error: err.message }, { status: 500 });
  }
});