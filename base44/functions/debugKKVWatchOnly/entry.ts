/**
 * debugKKVWatchOnly — Kompakte Ausgabe: nur Watch-Versicherer + Entfernungsgrund
 */
import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';

const MODEL_ALIAS_MAP = {
  'standard': 'Standard', 'free_choice': 'Standard', 'freie_arztwahl': 'Standard',
  'telmed': 'Telmed', 'phone_first': 'Telmed', 'telemedicine': 'Telmed', 'tel': 'Telmed',
  'gp': 'Hausarzt', 'hausarzt': 'Hausarzt', 'family_doctor': 'Hausarzt', 'managed_care': 'Hausarzt',
  'hmo': 'HMO', 'group_practice': 'HMO', 'other': 'Hausarzt',
};

function normalizeModel(m) {
  if (!m) return 'Standard';
  return MODEL_ALIAS_MAP[m.toLowerCase()] || m;
}

function matchesInsurer(a, b) {
  if (!a || !b) return false;
  const al = a.toLowerCase().trim(), bl = b.toLowerCase().trim();
  if (al === bl) return true;
  const aFirst = al.split(/[\s(,]/)[0], bFirst = bl.split(/[\s(,]/)[0];
  if (aFirst.length > 3 && al.includes(aFirst) && bl.includes(aFirst)) return true;
  if (bFirst.length > 3 && al.includes(bFirst) && bl.includes(bFirst)) return true;
  return false;
}

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    // Echte CRM-Parameter Peter Martin Adam K-504
    const plz = '4055', yob = 1968, deductible = 2500, accident = false;
    const aktuelle_kasse = 'Mutuel (Groupe Mutuel)';
    const filterModelle = ['Standard', 'Hausarzt', 'HMO', 'Telmed'];

    const url = `https://api.primai.ch/v1/compare?plz=${plz}&yob=${yob}&deductible=${deductible}&accident=${accident}&limit=500`;
    const res = await fetch(url, { headers: { Accept: 'application/json' } });
    const json = await res.json();
    const stage1 = Array.isArray(json) ? json : (json.data || json.offers || []);

    // Stage 2: mapping
    const stage2 = stage1.map(o => ({
      insurer: o.insurer, model: o.model,
      price: o.price?.total ?? o.price?.base ?? 0,
    })).filter(o => o.price > 0 && o.insurer && o.model);

    // Stage 3: dedup
    const map3 = new Map();
    for (const o of stage2) {
      const k = `${o.insurer}|||${o.model}`;
      if (!map3.has(k) || o.price < map3.get(k).price) map3.set(k, o);
    }
    const stage3 = Array.from(map3.values());

    // Stage 4: normalize + filter
    const stage4_with_norm = stage3.map(o => ({
      ...o,
      model_norm: normalizeModel(o.model),
      is_current: matchesInsurer(o.insurer, aktuelle_kasse),
    }));
    const stage4 = stage4_with_norm.filter(o => filterModelle.includes(o.model_norm));

    // Stage 5: sorted
    const stage5 = [...stage4].sort((a, b) => a.price - b.price);

    // Unique models
    const uniqueModels = [...new Set(stage1.map(o => o.model))].sort();

    // Watch-Versicherer durch alle Stufen
    const WATCH = ['css', 'assura', 'mutuel'];

    const watchStage = (arr, priceKey = 'price') => {
      const out = {};
      for (const w of WATCH) {
        out[w] = arr.filter(o => o.insurer?.toLowerCase().includes(w))
          .map(o => `${o.insurer} | ${o.model || o.model_norm} | CHF ${o[priceKey]}`);
      }
      return out;
    };

    // Alle Einträge die beim Filter rausfallen
    const filtered_out = stage4_with_norm.filter(o => !filterModelle.includes(o.model_norm))
      .map(o => `${o.insurer} | model="${o.model}" → norm="${o.model_norm}" → GEFILTERT`);

    // Mutuel spezifisch: Suche überall
    const mutuelInAll = stage3.filter(o => matchesInsurer(o.insurer, aktuelle_kasse));
    const mutuelInStage5 = stage5.filter(o => matchesInsurer(o.insurer, aktuelle_kasse));

    return Response.json({
      api_url: url,
      counts: { s1: stage1.length, s2: stage2.length, s3: stage3.length, s4: stage4.length, s5: stage5.length },
      unique_models_from_api: uniqueModels,
      watch_s1: watchStage(stage2),
      watch_s3: watchStage(stage3),
      watch_s4: watchStage(stage4, 'price'),
      watch_s5: watchStage(stage5, 'price'),
      filtered_out,
      mutuel_in_stage3: mutuelInAll.map(o => `${o.insurer} | ${o.model} | CHF ${o.price}`),
      mutuel_in_stage5: mutuelInStage5.map(o => `${o.insurer} | ${o.model_norm} | CHF ${o.price}`),
      stage5_full: stage5.map(o => `${o.insurer} | ${o.model_norm} | CHF ${(o.price - 5.15).toFixed(2)} netto`),
    });

  } catch (err) {
    return Response.json({ error: err.message }, { status: 500 });
  }
});