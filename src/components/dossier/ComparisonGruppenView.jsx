/**
 * ComparisonGruppenView — Lösungsorientierte Architektur
 *
 * Kernprinzip: Jede Gruppe = ein eigenständiges Beratungsangebot.
 * NICHT: Liste von Einträgen — SONDERN: Lösungscontainer.
 *
 * Struktur:
 *   Für jede Gruppe (Aktuelle Lösung / Optimiert / Angebot 1…):
 *     → Eigener Container mit Header, Farbe, Gesellschaftsidentität
 *     → Pro Person: KVG-Block + VVG-Block + Personen-Total
 *     → Gruppen-Gesamttotal (alle Personen)
 *     → Einsparung vs. Aktuelle Lösung
 */
import React, { useMemo, useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import {
  Trash2, Edit3, Check, X, AlertTriangle, ShieldCheck,
  Info, TrendingDown, TrendingUp, Minus, Star, ChevronDown, ChevronUp
} from 'lucide-react';
import { fmtCHF } from '@/lib/dossierCalc';
import InsurerLogo from '@/components/shared/InsurerLogo';

// ── Gruppen-Konfiguration (Farb-Identität pro Lösung) ─────────────────────────
const GRUPPE_CFG = {
  aktuelle_loesung: {
    label:      'Aktuelle Lösung',
    headerBg:   'bg-slate-700',
    headerText: 'text-white',
    border:     'border-slate-300',
    bg:         'bg-slate-50',
    accentBar:  'bg-slate-400',
    badgeBg:    'bg-slate-100 text-slate-700 border-slate-300',
    savingsCmp: false, // keine Einsparungszeile (das ist die Referenz)
  },
  optimiert: {
    label:      'Optimierte Lösung',
    headerBg:   'bg-blue-700',
    headerText: 'text-white',
    border:     'border-blue-300',
    bg:         'bg-blue-50/30',
    accentBar:  'bg-blue-500',
    badgeBg:    'bg-blue-50 text-blue-700 border-blue-200',
    savingsCmp: true,
  },
  angebot_1: {
    label:      'Angebot 1',
    headerBg:   'bg-emerald-700',
    headerText: 'text-white',
    border:     'border-emerald-300',
    bg:         'bg-emerald-50/20',
    accentBar:  'bg-emerald-500',
    badgeBg:    'bg-emerald-50 text-emerald-700 border-emerald-200',
    savingsCmp: true,
  },
  angebot_2: {
    label:      'Angebot 2',
    headerBg:   'bg-violet-700',
    headerText: 'text-white',
    border:     'border-violet-300',
    bg:         'bg-violet-50/20',
    accentBar:  'bg-violet-500',
    badgeBg:    'bg-violet-50 text-violet-700 border-violet-200',
    savingsCmp: true,
  },
  angebot_3: {
    label:      'Angebot 3',
    headerBg:   'bg-orange-600',
    headerText: 'text-white',
    border:     'border-orange-300',
    bg:         'bg-orange-50/20',
    accentBar:  'bg-orange-400',
    badgeBg:    'bg-orange-50 text-orange-700 border-orange-200',
    savingsCmp: true,
  },
  angebot_4: {
    label:      'Angebot 4',
    headerBg:   'bg-rose-700',
    headerText: 'text-white',
    border:     'border-rose-300',
    bg:         'bg-rose-50/20',
    accentBar:  'bg-rose-400',
    badgeBg:    'bg-rose-50 text-rose-700 border-rose-200',
    savingsCmp: true,
  },
  angebot_5: {
    label:      'Angebot 5',
    headerBg:   'bg-teal-700',
    headerText: 'text-white',
    border:     'border-teal-300',
    bg:         'bg-teal-50/20',
    accentBar:  'bg-teal-500',
    badgeBg:    'bg-teal-50 text-teal-700 border-teal-200',
    savingsCmp: true,
  },
  manuell: {
    label:      'Weitere Einträge',
    headerBg:   'bg-slate-500',
    headerText: 'text-white',
    border:     'border-border',
    bg:         'bg-muted/20',
    accentBar:  'bg-muted-foreground/40',
    badgeBg:    'bg-muted text-muted-foreground border-border',
    savingsCmp: false,
  },
};

const GRUPPE_ORDER = ['aktuelle_loesung', 'optimiert', 'angebot_1', 'angebot_2', 'angebot_3', 'angebot_4', 'angebot_5', 'manuell'];

// ── Confidence-Indikator ──────────────────────────────────────────────────────
function ConfidenceDot({ confidence }) {
  if (confidence == null) return null;
  if (confidence >= 0.8) return <ShieldCheck className="w-2.5 h-2.5 text-emerald-500" title={`KI ${Math.round(confidence*100)}%`} />;
  if (confidence >= 0.6) return <Info className="w-2.5 h-2.5 text-amber-500" title={`KI ${Math.round(confidence*100)}% — prüfen`} />;
  return <AlertTriangle className="w-2.5 h-2.5 text-red-500" title={`KI ${Math.round(confidence*100)}% — unsicher`} />;
}

// ── Einzel-Produkt-Zeile (inline edit) ───────────────────────────────────────
function ProductRow({ entry, dossierId, onDelete }) {
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState({});
  const qc = useQueryClient();

  const updateMutation = useMutation({
    mutationFn: (data) => base44.entities.ComparisonEntry.update(entry.id, data),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['dossier_comparison', dossierId] }); setEditing(false); },
  });

  const startEdit = () => {
    setForm({
      gesellschaft:      entry.gesellschaft,
      product_name:      entry.product_name || '',
      praemie_monatlich: entry.praemie_monatlich ?? '',
      franchise:         entry.franchise ?? '',
      modell:            entry.modell || '',
      deckung_details:   entry.deckung_details || '',
    });
    setEditing(true);
  };

  const save = () => updateMutation.mutate({
    ...form,
    praemie_monatlich: form.praemie_monatlich !== '' ? Number(form.praemie_monatlich) : null,
    franchise:         form.franchise !== '' ? Number(form.franchise) : null,
    manually_verified: true,
  });

  const inp = "border border-input bg-background rounded px-2 py-1 text-xs w-full focus:outline-none focus:ring-1 focus:ring-ring";

  if (editing) {
    return (
      <div className="bg-white border border-primary/20 rounded-lg p-3 space-y-2 my-1">
        <div className="grid grid-cols-2 gap-2">
          <div><label className="text-[10px] text-muted-foreground">Gesellschaft</label>
            <input className={inp} value={form.gesellschaft} onChange={e => setForm(f => ({ ...f, gesellschaft: e.target.value }))} /></div>
          <div><label className="text-[10px] text-muted-foreground">Produkt</label>
            <input className={inp} value={form.product_name} onChange={e => setForm(f => ({ ...f, product_name: e.target.value }))} /></div>
          <div><label className="text-[10px] text-muted-foreground">Prämie/Mt. CHF</label>
            <input className={inp} type="number" value={form.praemie_monatlich} onChange={e => setForm(f => ({ ...f, praemie_monatlich: e.target.value }))} /></div>
          <div><label className="text-[10px] text-muted-foreground">Franchise CHF</label>
            <input className={inp} type="number" value={form.franchise} onChange={e => setForm(f => ({ ...f, franchise: e.target.value }))} /></div>
          <div><label className="text-[10px] text-muted-foreground">Modell</label>
            <input className={inp} value={form.modell} onChange={e => setForm(f => ({ ...f, modell: e.target.value }))} /></div>
          <div><label className="text-[10px] text-muted-foreground">Deckung</label>
            <input className={inp} value={form.deckung_details} onChange={e => setForm(f => ({ ...f, deckung_details: e.target.value }))} /></div>
        </div>
        <div className="flex gap-2">
          <button onClick={save} disabled={updateMutation.isPending}
            className="flex items-center gap-1 px-3 py-1 bg-primary text-primary-foreground text-xs rounded-lg">
            <Check className="w-3 h-3" />{updateMutation.isPending ? '…' : 'Speichern'}
          </button>
          <button onClick={() => setEditing(false)}
            className="flex items-center gap-1 px-3 py-1 border border-border text-xs rounded-lg hover:bg-muted">
            <X className="w-3 h-3" />Abbrechen
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex items-center justify-between gap-2 py-1.5 group">
      <div className="flex items-center gap-2 flex-1 min-w-0">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5 flex-wrap">
            <span className="text-xs font-semibold text-foreground">{entry.gesellschaft}</span>
            {entry.product_name && <span className="text-[11px] text-muted-foreground">{entry.product_name}</span>}
            {entry.modell && <span className="text-[10px] text-muted-foreground italic">{entry.modell}</span>}
            {entry.ai_extracted && <ConfidenceDot confidence={entry.ai_confidence} />}
            {entry.is_recommended && <Star className="w-2.5 h-2.5 text-amber-500 fill-amber-400" />}
          </div>
          <div className="flex items-center gap-3 text-[11px] text-muted-foreground flex-wrap mt-0.5">
            {entry.franchise != null && entry.section === 'grundversicherung' && (
              <span>Franchise CHF {Number(entry.franchise).toLocaleString('de-CH')}</span>
            )}
            {entry.deckung_details && <span className="truncate max-w-xs">{entry.deckung_details}</span>}
          </div>
        </div>
      </div>
      <div className="flex items-center gap-2 shrink-0">
        {entry.praemie_monatlich != null && (
          <span className="text-xs font-bold text-foreground whitespace-nowrap">
            {fmtCHF(entry.praemie_monatlich)}<span className="text-[10px] font-normal text-muted-foreground">/Mt.</span>
          </span>
        )}
        <button onClick={startEdit} className="p-1 text-muted-foreground hover:text-foreground hover:bg-white rounded transition-colors">
          <Edit3 className="w-3 h-3" />
        </button>
        <button onClick={() => onDelete(entry.id)} className="p-1 text-muted-foreground hover:text-destructive hover:bg-destructive/10 rounded transition-colors">
          <Trash2 className="w-3 h-3" />
        </button>
      </div>
    </div>
  );
}

// ── Personen-Block innerhalb einer Lösung ─────────────────────────────────────
function PersonBlock({ person, entries, dossierId, onDelete }) {
  const kvg = entries.filter(e => e.section === 'grundversicherung');
  const vvgAll = entries.filter(e => e.section === 'zusatzversicherung');

  // VVG-Sortierung: Grundversicherer-VVG zuerst, dann andere Gesellschaften
  const kvgGesellschaft = kvg[0]?.gesellschaft || null;
  const vvgGrundversicherer = kvgGesellschaft
    ? vvgAll.filter(e => e.gesellschaft === kvgGesellschaft)
    : [];
  const vvgOther = vvgAll.filter(e => e.gesellschaft !== kvgGesellschaft);
  const vvg = [...vvgGrundversicherer, ...vvgOther];

  const total = entries.reduce((s, e) => s + (e.praemie_monatlich ?? 0), 0);
  const hasWarning = entries.some(e => e.ai_extracted && (e.ai_confidence ?? 1) < 0.6);

  return (
    <div className="bg-white/60 rounded-lg border border-white/80 p-3">
      {/* Person-Header */}
      <div className="flex items-center gap-2 mb-2.5">
        <div className="w-5 h-5 rounded-full bg-slate-200 flex items-center justify-center text-slate-600 text-[9px] font-bold shrink-0">
          {(person[0] || '?').toUpperCase()}
        </div>
        <span className="text-xs font-semibold text-foreground">{person}</span>
        {hasWarning && (
          <span className="flex items-center gap-0.5 text-[9px] text-red-600 ml-auto">
            <AlertTriangle className="w-2.5 h-2.5" />Prüfen
          </span>
        )}
      </div>

      {/* KVG */}
      {kvg.length > 0 && (
        <div className="mb-2">
          <div className="flex items-center gap-1.5 mb-1">
            <span className="text-[9px] font-bold text-blue-700 bg-blue-50 border border-blue-100 px-1.5 py-0.5 rounded-full uppercase tracking-wide">KVG</span>
            <span className="text-[9px] text-muted-foreground">Grundversicherung</span>
          </div>
          <div className="divide-y divide-slate-100">
            {kvg.map(e => <ProductRow key={e.id} entry={e} dossierId={dossierId} onDelete={onDelete} />)}
          </div>
        </div>
      )}

      {/* VVG */}
      {vvg.length > 0 && (
        <div className={kvg.length > 0 ? 'mt-2 pt-2 border-t border-slate-100' : ''}>
          <div className="flex items-center gap-1.5 mb-1">
            <span className="text-[9px] font-bold text-violet-700 bg-violet-50 border border-violet-100 px-1.5 py-0.5 rounded-full uppercase tracking-wide">VVG</span>
            <span className="text-[9px] text-muted-foreground">Zusatzversicherungen</span>
          </div>
          <div className="divide-y divide-slate-100">
            {vvg.map(e => <ProductRow key={e.id} entry={e} dossierId={dossierId} onDelete={onDelete} />)}
          </div>
        </div>
      )}

      {/* Personen-Total */}
      {total > 0 && (
        <div className="mt-2.5 pt-2 border-t border-slate-200 flex items-center justify-between">
          <span className="text-[10px] text-muted-foreground">Total {person.split(' ')[0]}</span>
          <span className="text-xs font-bold text-foreground">{fmtCHF(total)}<span className="text-[10px] font-normal text-muted-foreground">/Mt.</span></span>
        </div>
      )}
    </div>
  );
}

// ── Einsparungsanzeige vs. Aktuelle Lösung ────────────────────────────────────
function SavingsBadge({ gruppeTotal, referenceTotal }) {
  if (!referenceTotal || referenceTotal === 0 || gruppeTotal === 0) return null;
  const diff = referenceTotal - gruppeTotal; // positiv = günstiger
  const pct = Math.abs(((referenceTotal - gruppeTotal) / referenceTotal) * 100).toFixed(1);

  if (Math.abs(diff) < 0.01) return (
    <div className="flex items-center gap-1 text-xs text-slate-500 bg-white/60 px-2.5 py-1 rounded-full border border-white/80">
      <Minus className="w-3 h-3" />gleich wie aktuell
    </div>
  );

  if (diff > 0) return (
    <div className="flex items-center gap-1 text-xs font-semibold text-emerald-700 bg-emerald-50/80 px-2.5 py-1 rounded-full border border-emerald-200">
      <TrendingDown className="w-3 h-3" />
      − {fmtCHF(diff)}/Mt. ({pct}% günstiger)
    </div>
  );

  return (
    <div className="flex items-center gap-1 text-xs font-semibold text-rose-700 bg-rose-50/80 px-2.5 py-1 rounded-full border border-rose-200">
      <TrendingUp className="w-3 h-3" />
      + {fmtCHF(Math.abs(diff))}/Mt. ({pct}% teurer)
    </div>
  );
}

// ── Lösungs-Container (eine Gruppe = eine Lösung) ─────────────────────────────
function LösungsContainer({ gruppe, label, entries, dossierId, referenceTotal, onDelete }) {
  const cfg = GRUPPE_CFG[gruppe] || GRUPPE_CFG.manuell;
  const [collapsed, setCollapsed] = useState(false);

  // Gesellschaften in dieser Lösung (für Logo/Anzeige)
  const gesellschaften = [...new Set(entries.map(e => e.gesellschaft).filter(Boolean))];
  const primaryGesellschaft = gesellschaften[0] || '';

  // Personen in dieser Lösung
  const persons = [...new Set(entries.map(e => e.person_name || 'Unbekannt'))];

  // Gesamttotal dieser Lösung
  const gruppeTotal = entries.reduce((s, e) => s + (e.praemie_monatlich ?? 0), 0);
  const hasRecommended = entries.some(e => e.is_recommended);
  const hasAiWarning = entries.some(e => e.ai_extracted && (e.ai_confidence ?? 1) < 0.6);

  return (
    <div className={`rounded-2xl border-2 overflow-hidden shadow-card ${cfg.border}`}>

      {/* ── Lösungs-Header ─────────────────────────────────────────────── */}
      <div className={`${cfg.headerBg} px-5 py-3.5`}>
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            {/* Logo */}
            <div className="w-9 h-9 rounded-lg bg-white/15 flex items-center justify-center overflow-hidden shrink-0">
              {primaryGesellschaft ? (
                <InsurerLogo name={primaryGesellschaft} size="sm" className="!border-0 !bg-transparent" />
              ) : (
                <div className="w-6 h-6 rounded bg-white/20" />
              )}
            </div>

            <div>
              {/* Lösungs-Label */}
              <div className={`text-[10px] font-bold uppercase tracking-widest ${cfg.headerText} opacity-80 mb-0.5`}>
                {label}
              </div>
              {/* Gesellschaft(en) */}
              <div className={`text-sm font-bold ${cfg.headerText}`}>
                {gesellschaften.length > 0 ? gesellschaften.join(' · ') : <span className="opacity-50 italic">Keine Gesellschaft</span>}
              </div>
            </div>

            {hasRecommended && (
              <div className="flex items-center gap-1 bg-amber-400/20 border border-amber-300/50 px-2 py-0.5 rounded-full">
                <Star className="w-2.5 h-2.5 text-amber-200 fill-amber-200" />
                <span className="text-[10px] font-bold text-amber-100">Empfohlen</span>
              </div>
            )}
            {hasAiWarning && (
              <div className="flex items-center gap-1 bg-red-400/20 border border-red-300/50 px-2 py-0.5 rounded-full">
                <AlertTriangle className="w-2.5 h-2.5 text-red-200" />
                <span className="text-[10px] text-red-100">Prüfen</span>
              </div>
            )}
          </div>

          <div className="flex items-center gap-3 shrink-0">
            {/* Gesamttotal */}
            {gruppeTotal > 0 && (
              <div className="text-right">
                <div className={`text-lg font-black ${cfg.headerText}`}>{fmtCHF(gruppeTotal)}</div>
                <div className={`text-[9px] ${cfg.headerText} opacity-70`}>Total / Monat</div>
              </div>
            )}
            <button
              onClick={() => setCollapsed(c => !c)}
              className={`p-1.5 rounded-lg bg-white/10 hover:bg-white/20 transition-colors ${cfg.headerText}`}
            >
              {collapsed ? <ChevronDown className="w-4 h-4" /> : <ChevronUp className="w-4 h-4" />}
            </button>
          </div>
        </div>

        {/* Einsparung vs. Aktuelle Lösung */}
        {!collapsed && cfg.savingsCmp && referenceTotal > 0 && (
          <div className="mt-2.5 flex items-center gap-2">
            <SavingsBadge gruppeTotal={gruppeTotal} referenceTotal={referenceTotal} />
          </div>
        )}
      </div>

      {/* ── Lösungs-Body ───────────────────────────────────────────────── */}
      {!collapsed && (
        <div className={`${cfg.bg} p-4 space-y-3`}>
          {persons.map(person => (
            <PersonBlock
              key={person}
              person={person}
              entries={entries.filter(e => (e.person_name || 'Unbekannt') === person)}
              dossierId={dossierId}
              onDelete={onDelete}
            />
          ))}

          {entries.length === 0 && (
            <p className="text-xs text-muted-foreground/60 italic text-center py-4">Keine Einträge in dieser Lösung</p>
          )}

          {/* Gesamttotal aller Personen (nur wenn mehrere Personen) */}
          {persons.length > 1 && gruppeTotal > 0 && (
            <div className="flex items-center justify-between pt-2 border-t border-border/60">
              <span className="text-xs font-semibold text-muted-foreground">Gesamttotal alle Personen</span>
              <div className="text-right">
                <span className="text-base font-black text-foreground">{fmtCHF(gruppeTotal)}</span>
                <span className="text-[10px] text-muted-foreground">/Mt. · {fmtCHF(gruppeTotal * 12)}/Jahr</span>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ── Hauptkomponente ───────────────────────────────────────────────────────────
export default function ComparisonGruppenView({ entries, dossierId }) {
  const qc = useQueryClient();

  const deleteMutation = useMutation({
    mutationFn: (id) => base44.entities.ComparisonEntry.delete(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['dossier_comparison', dossierId] }),
  });

  const normalizedEntries = useMemo(() =>
    entries.map(e => ({ ...e, gruppe: e.gruppe || 'manuell' })),
    [entries]
  );

  const presentGruppen = useMemo(() => {
    const seen = new Set(normalizedEntries.map(e => e.gruppe));
    return GRUPPE_ORDER.filter(g => seen.has(g));
  }, [normalizedEntries]);

  // Referenz-Total = Aktuelle Lösung (für Einsparungsvergleich)
  const referenceTotal = useMemo(() => {
    const current = normalizedEntries.filter(e => e.gruppe === 'aktuelle_loesung');
    return current.reduce((s, e) => s + (e.praemie_monatlich ?? 0), 0);
  }, [normalizedEntries]);

  if (normalizedEntries.length === 0) return null;

  return (
    <div className="space-y-4">
      {presentGruppen.map(gruppe => {
        const gruppeEntries = normalizedEntries.filter(e => e.gruppe === gruppe);
        const cfg = GRUPPE_CFG[gruppe] || GRUPPE_CFG.manuell;
        const label = gruppeEntries[0]?.gruppe_label || cfg.label;

        return (
          <LösungsContainer
            key={gruppe}
            gruppe={gruppe}
            label={label}
            entries={gruppeEntries}
            dossierId={dossierId}
            referenceTotal={referenceTotal}
            onDelete={(id) => deleteMutation.mutate(id)}
          />
        );
      })}
    </div>
  );
}