import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { base44 } from '@/api/base44Client';
import { Sparkles, Star, AlertTriangle, CheckCircle2, TrendingUp, Loader2, ChevronDown, ChevronUp } from 'lucide-react';

export default function KIEmpfehlung({ ausschreibung, offerten, onUpdate }) {
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(ausschreibung?.ki_analyse || null);
  const [expanded, setExpanded] = useState(false);

  const analyse = async () => {
    if (!offerten || offerten.length < 1) return;
    setLoading(true);
    try {
      const offertenSummary = offerten.map(o => ({
        versicherer: o.versicherer_name,
        praemie_jaehrlich: o.praemie_jaehrlich,
        selbstbehalt: o.selbstbehalt,
        deckung: o.deckung_beschreibung,
        zusatzleistungen: o.zusatzleistungen,
        ausschluesse: o.ausschluesse,
        laufzeit: o.laufzeit,
        besondere_bedingungen: o.besondere_bedingungen,
      }));

      const prompt = `Du bist ein erfahrener Schweizer Versicherungsmakler. Analysiere folgende Offerten für den Kunden "${ausschreibung.customer_name}" für die Ausschreibung "${ausschreibung.titel}" (${(ausschreibung.sparten||[]).join(', ')}).

OFFERTEN:
${JSON.stringify(offertenSummary, null, 2)}

LAUFENDE PRÄMIE: CHF ${ausschreibung.laufende_praemie || 'unbekannt'} p.a.

Analysiere und beantworte auf Deutsch:
1. Welches Angebot ist am günstigsten und welche Einsparung resultiert?
2. Welches bietet die beste Deckung?
3. Welches hat das beste Preis-Leistungs-Verhältnis?
4. Welche kritischen Ausschlüsse existieren?
5. Welche Deckungslücken bestehen?
6. Deine klare Broker-Empfehlung mit Begründung.
7. Zusammenfassung für den Kunden (verständlich, nicht-technisch).

Bewerte jeden Versicherer mit Scores (0-100): Preis, Deckung, Risiko, Service.
Identifiziere den empfohlenen Versicherer.

Antworte als JSON:
{
  "empfohlener_versicherer": "Name",
  "empfehlungs_begruendung": "...",
  "guenstigster_versicherer": "Name",
  "einsparung_chf": 0,
  "beste_deckung_versicherer": "Name",
  "kritische_ausschluesse": ["..."],
  "deckungsluecken": ["..."],
  "kundenzusammenfassung": "...",
  "broker_fazit": "...",
  "scores": {
    "VersichererName": {"preis": 80, "deckung": 75, "risiko": 70, "service": 85, "gesamt": 78}
  },
  "staerken_pro_versicherer": {"VersichererName": ["Stärke1", "Stärke2"]},
  "schwaechen_pro_versicherer": {"VersichererName": ["Schwäche1"]},
  "handlungsempfehlung": "Konkrete nächste Schritte..."
}`;

      const res = await base44.integrations.Core.InvokeLLM({ prompt, response_json_schema: { type: 'object', properties: { empfohlener_versicherer: { type: 'string' }, empfehlungs_begruendung: { type: 'string' }, guenstigster_versicherer: { type: 'string' }, einsparung_chf: { type: 'number' }, kritische_ausschluesse: { type: 'array', items: { type: 'string' } }, deckungsluecken: { type: 'array', items: { type: 'string' } }, kundenzusammenfassung: { type: 'string' }, broker_fazit: { type: 'string' }, scores: { type: 'object' }, handlungsempfehlung: { type: 'string' } } } });

      setResult(res);
      setExpanded(true);

      // Update Offerten with scores
      if (res.scores) {
        for (const o of offerten) {
          const sc = res.scores[o.versicherer_name];
          if (sc) {
            await base44.entities.Offerte.update(o.id, {
              ki_preis_score: sc.preis, ki_deckungs_score: sc.deckung,
              ki_risiko_score: sc.risiko, ki_service_score: sc.service,
              ki_score: sc.gesamt, ki_staerken: res.staerken_pro_versicherer?.[o.versicherer_name] || [],
              ki_schwaechen: res.schwaechen_pro_versicherer?.[o.versicherer_name] || [],
              ist_empfohlen: o.versicherer_name === res.empfohlener_versicherer,
              ist_guenstigste: o.versicherer_name === res.guenstigster_versicherer,
              status: 'analysiert',
            });
          }
        }
      }
      if (onUpdate) await onUpdate(res);
    } catch (err) {
      console.error('KI Analyse Fehler:', err);
    }
    setLoading(false);
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-subheading flex items-center gap-2"><Sparkles className="w-4 h-4 text-primary" />KI-Offertanalyse</h3>
          <p className="text-body-sm text-muted-foreground mt-0.5">{offerten.length} Offerten werden verglichen</p>
        </div>
        <Button onClick={analyse} disabled={loading || offerten.length < 1} className="gap-2">
          {loading ? <><Loader2 className="w-4 h-4 animate-spin" />Analysiere...</> : <><Sparkles className="w-4 h-4" />Mit KI analysieren</>}
        </Button>
      </div>

      {result && (
        <div className="space-y-4">
          <div className="grid grid-cols-3 gap-3">
            <div className="surface p-4 border-l-4 border-l-emerald-400">
              <p className="text-caption text-muted-foreground uppercase tracking-wide mb-1">Empfehlung</p>
              <p className="font-semibold text-emerald-700 flex items-center gap-1"><Star className="w-3.5 h-3.5" />{result.empfohlener_versicherer || '—'}</p>
            </div>
            <div className="surface p-4 border-l-4 border-l-blue-400">
              <p className="text-caption text-muted-foreground uppercase tracking-wide mb-1">Günstigste Option</p>
              <p className="font-semibold">{result.guenstigster_versicherer || '—'}</p>
              {result.einsparung_chf > 0 && <p className="text-xs text-emerald-600">Einsparung: CHF {result.einsparung_chf.toLocaleString('de-CH')}</p>}
            </div>
            <div className="surface p-4 border-l-4 border-l-amber-400">
              <p className="text-caption text-muted-foreground uppercase tracking-wide mb-1">Beste Deckung</p>
              <p className="font-semibold">{result.beste_deckung_versicherer || '—'}</p>
            </div>
          </div>

          <div className="surface p-4">
            <h4 className="font-semibold mb-2">Broker-Fazit</h4>
            <p className="text-sm text-slate-700 leading-relaxed">{result.broker_fazit}</p>
          </div>

          <button onClick={() => setExpanded(!expanded)} className="flex items-center gap-2 text-sm text-primary hover:underline">
            {expanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
            {expanded ? 'Weniger anzeigen' : 'Vollständige Analyse anzeigen'}
          </button>

          {expanded && (
            <div className="space-y-4">
              {result.kritische_ausschluesse?.length > 0 && (
                <div className="surface p-4">
                  <h4 className="font-semibold mb-2 flex items-center gap-2 text-amber-700"><AlertTriangle className="w-4 h-4" />Kritische Ausschlüsse</h4>
                  <ul className="space-y-1">{result.kritische_ausschluesse.map((x, i) => <li key={i} className="text-sm flex items-start gap-2"><span className="text-amber-500 mt-0.5">•</span>{x}</li>)}</ul>
                </div>
              )}
              {result.deckungsluecken?.length > 0 && (
                <div className="surface p-4">
                  <h4 className="font-semibold mb-2 flex items-center gap-2 text-rose-700"><AlertTriangle className="w-4 h-4" />Deckungslücken</h4>
                  <ul className="space-y-1">{result.deckungsluecken.map((x, i) => <li key={i} className="text-sm flex items-start gap-2"><span className="text-rose-500 mt-0.5">•</span>{x}</li>)}</ul>
                </div>
              )}
              <div className="surface p-4">
                <h4 className="font-semibold mb-2">Kundenzusammenfassung</h4>
                <p className="text-sm text-slate-700 leading-relaxed whitespace-pre-wrap">{result.kundenzusammenfassung}</p>
              </div>
              {result.handlungsempfehlung && (
                <div className="surface p-4 bg-blue-50/50">
                  <h4 className="font-semibold mb-2 flex items-center gap-2 text-blue-700"><TrendingUp className="w-4 h-4" />Handlungsempfehlung</h4>
                  <p className="text-sm text-slate-700">{result.handlungsempfehlung}</p>
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}