/**
 * debugKKVLivePipeline
 * Führt die vollständige KKV-Datenfluss-Analyse mit den echten CRM-Daten von Peter Martin Adam durch.
 * Dokumentiert alle 5 Stufen: API → Mapping → Dedup → Filter → Render
 */
import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';

// Identisch zu MODEL_ALIAS_MAP im Frontend
const MODEL_ALIAS_MAP = {
  'standard': 'Standard', 'free_choice': 'Standard', 'freie_arztwahl': 'Standard',
  'telmed': 'Telmed', 'phone_first': 'Telmed', 'telemedicine': 'Telmed', 'tel': 'Telmed',
  'gp': 'Hausarzt', 'hausarzt': 'Hausarzt', 'family_doctor': 'Hausarzt', 'managed_care': 'Hausarzt',
  'hmo': 'HMO', 'group_practice': 'HMO',
  'other': 'Hausarzt',
};

function normalizeModel(model) {
  if (!model) return 'Standard';
  return MODEL_ALIAS_MAP[model.toLowerCase()] || model;
}

function matchesInsurer(a, b) {
  if (!a || !b) return false;
  const al = a.toLowerCase().trim();
  const bl = b.toLowerCase().trim();
  if (al === bl) return true;
  const aFirst = al.split(/[\s(,]/)[0];
  const bFirst = bl.split(/[\s(,]/)[0];
  if (aFirst.length > 3 && al.includes(aFirst) && bl.includes(aFirst)) return true;
  if (bFirst.length > 3 && al.includes(bFirst) && bl.includes(bFirst)) return true;
  return false;
}

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    // ── Live CRM-Parameter (Peter Martin Adam, K-504) ─────────────────────
    const CRM = {
      customer: 'Peter Martin Adam (K-504)',
      plz: '4055',
      yob: 1968,          // Geburtsdatum: 1968-10-07
      deductible: 2500,   // Franchise aus Vertrag sparte_data.franchise
      accident: false,
      aktuelle_kasse: 'Mutuel (Groupe Mutuel)',  // aus VergleichsAnalyse.ausgangslage.krankenkasse
      aktuelles_modell: 'Telmed',                // aus VergleichsAnalyse.ausgangslage.modell
      filterModelle: ['Standard', 'Hausarzt', 'HMO', 'Telmed'],
    };

    // ── STUFE 1: Rohdaten aus BAG-API ─────────────────────────────────────
    const params = new URLSearchParams({
      plz: CRM.plz, yob: String(CRM.yob),
      deductible: String(CRM.deductible), accident: String(CRM.accident), limit: '500',
    });
    const apiUrl = `https://api.primai.ch/v1/compare?${params}`;
    const res = await fetch(apiUrl, { headers: { 'Accept': 'application/json', 'User-Agent': 'VSVV-CRM-Debug/1.0' } });
    const json = await res.json();
    const stage1 = Array.isArray(json) ? json : (json.data || json.offers || []);

    // ── STUFE 2: Preis-Mapping ────────────────────────────────────────────
    const stage2 = stage1.map(o => ({
      insurer: o.insurer,
      model: o.model,
      model_raw: o.model,
      monthly_premium: o.price?.total ?? o.price?.base ?? o.monthly_premium ?? 0,
      deductible: o.deductible,
    })).filter(o => o.monthly_premium > 0 && o.insurer && o.model);

    // ── STUFE 3: Dedup (günstigste Zone pro Versicherer+Modell) ──────────
    const cheapestByKey = new Map();
    for (const o of stage2) {
      const key = `${o.insurer}|||${o.model}`;
      const existing = cheapestByKey.get(key);
      if (!existing || o.monthly_premium < existing.monthly_premium) {
        cheapestByKey.set(key, o);
      }
    }
    const stage3 = Array.from(cheapestByKey.values());

    // ── STUFE 4: Modell-Normalisierung + Filter ───────────────────────────
    const stage4_all = stage3.map(o => ({
      ...o,
      model_normalized: normalizeModel(o.model),
      passes_filter: CRM.filterModelle.includes(normalizeModel(o.model)),
      is_current_insurer: matchesInsurer(o.insurer, CRM.aktuelle_kasse),
    }));
    const stage4 = stage4_all.filter(o => o.passes_filter);

    // ── STUFE 5: Sortiert nach Preis (final gerendert) ────────────────────
    const stage5 = [...stage4].sort((a, b) => a.monthly_premium - b.monthly_premium);

    // ── Unique Modelle aus Rohdaten ────────────────────────────────────────
    const uniqueModels = [...new Set(stage1.map(o => o.model))].sort();
    const uniqueInsurers = [...new Set(stage1.map(o => o.insurer))].sort();

    // ── Watch: CSS, Assura, Mutuel in jeder Stufe ─────────────────────────
    const WATCH_KEYS = ['css', 'assura', 'mutuel'];
    const watchCheck = (arr) => {
      const found = {};
      for (const w of WATCH_KEYS) {
        const matches = arr.filter(o => o.insurer?.toLowerCase().includes(w));
        found[w] = matches.map(o => ({ insurer: o.insurer, model: o.model || o.model_normalized, price: o.monthly_premium }));
      }
      return found;
    };

    // ── Groupe Mutuel spezifisch: ist in Stage5 vorhanden? ────────────────
    const mutuelInStage5 = stage5.filter(o => matchesInsurer(o.insurer, CRM.aktuelle_kasse));

    // ── Blocks: Warum verschwindet ein Eintrag? ────────────────────────────
    const removedAtDedup = stage2.filter(o => {
      const key = `${o.insurer}|||${o.model}`;
      const kept = cheapestByKey.get(key);
      return kept && kept.monthly_premium !== o.monthly_premium;
    }).map(o => ({ insurer: o.insurer, model: o.model, price: o.monthly_premium, reason: 'Günstigere Zone bereits vorhanden' }));

    const removedAtFilter = stage4_all.filter(o => !o.passes_filter)
      .map(o => ({ insurer: o.insurer, model: o.model, model_normalized: o.model_normalized, price: o.monthly_premium, reason: `normalizeModel("${o.model}") = "${o.model_normalized}" nicht in [${CRM.filterModelle.join(',')}]` }));

    return Response.json({
      crm_params: CRM,
      api_url: apiUrl,
      summary: {
        stage1_raw: stage1.length,
        stage2_mapped: stage2.length,
        stage3_deduped: stage3.length,
        stage4_filtered: stage4.length,
        stage5_rendered: stage5.length,
        unique_models: uniqueModels,
        unique_insurers: uniqueInsurers,
      },
      watch: {
        stage1: watchCheck(stage1),
        stage2: watchCheck(stage2),
        stage3: watchCheck(stage3),
        stage4: watchCheck(stage4),
        stage5: watchCheck(stage5),
      },
      mutuel_in_stage5: mutuelInStage5,
      removed_at_dedup_sample: removedAtDedup.slice(0, 10),
      removed_at_filter: removedAtFilter,
      stage1_first10: stage1.slice(0, 10),
      stage3_full: stage3,
      stage5_full: stage5,
    });

  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});