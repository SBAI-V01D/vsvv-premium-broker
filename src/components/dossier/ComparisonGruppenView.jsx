/**
 * ComparisonGruppenView — Phase A (neue gruppenbasierte Architektur)
 *
 * Darstellung: Vollständige Gesamtlösung pro Person × Gruppe.
 * Zentrale Vergleichsachse: `gruppe` (Spalte).
 * Interne Strukturierung: `section` (KVG/VVG) — wird NICHT als Trennung dargestellt.
 *
 * Backward-compat: Einträge ohne `gruppe` werden als 'manuell' behandelt.
 *
 * Sicherheitsregel: Kein Write auf CRM-Entities. Nur ComparisonEntry.
 */
import React, { useMemo, useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Star, Trash2, Edit3, Check, X, AlertTriangle, ShieldCheck, Info } from 'lucide-react';
import { fmtCHF } from '@/lib/dossierCalc';

// ── Konfiguration Gruppen ─────────────────────────────────────────────────────

const GRUPPE_DEFAULTS = {
  aktuelle_loesung: { label: 'Aktuelle Lösung',    color: 'border-slate-300 bg-slate-50/50', badge: 'bg-slate-100 text-slate-700 border-slate-300' },
  optimiert:        { label: 'Optimiert',           color: 'border-blue-200 bg-blue-50/30',   badge: 'bg-blue-50 text-blue-700 border-blue-200' },
  angebot_1:        { label: 'Angebot 1',           color: 'border-emerald-200 bg-emerald-50/20', badge: 'bg-emerald-50 text-emerald-700 border-emerald-200' },
  angebot_2:        { label: 'Angebot 2',           color: 'border-violet-200 bg-violet-50/20',   badge: 'bg-violet-50 text-violet-700 border-violet-200' },
  angebot_3:        { label: 'Angebot 3',           color: 'border-orange-200 bg-orange-50/20',   badge: 'bg-orange-50 text-orange-700 border-orange-200' },
  angebot_4:        { label: 'Angebot 4',           color: 'border-rose-200 bg-rose-50/20',       badge: 'bg-rose-50 text-rose-700 border-rose-200' },
  angebot_5:        { label: 'Angebot 5',           color: 'border-teal-200 bg-teal-50/20',       badge: 'bg-teal-50 text-teal-700 border-teal-200' },
  manuell:          { label: 'Manuell erfasst',     color: 'border-border',                       badge: 'bg-muted text-muted-foreground border-border' },
};

function getGruppeLabel(entry) {
  if (entry.gruppe_label) return entry.gruppe_label;
  return GRUPPE_DEFAULTS[entry.gruppe || 'manuell']?.label || entry.gruppe || 'Unbekannt';
}

// ── Confidence-Indikator ──────────────────────────────────────────────────────
function ConfidenceBadge({ confidence }) {
  if (confidence == null) return null;
  const pct = Math.round(confidence * 100);
  if (confidence >= 0.8) return (
    <span className="flex items-center gap-1 text-[10px] text-emerald-700 bg-emerald-50 border border-emerald-200 px-1.5 py-0.5 rounded-full">
      <ShieldCheck className="w-2.5 h-2.5" />{pct}%
    </span>
  );
  if (confidence >= 0.6) return (
    <span className="flex items-center gap-1 text-[10px] text-amber-700 bg-amber-50 border border-amber-200 px-1.5 py-0.5 rounded-full">
      <Info className="w-2.5 h-2.5" />{pct}%
    </span>
  );
  return (
    <span className="flex items-center gap-1 text-[10px] text-red-700 bg-red-50 border border-red-200 px-1.5 py-0.5 rounded-full">
      <AlertTriangle className="w-2.5 h-2.5" />{pct}%
    </span>
  );
}

// ── Einzel-Eintrag (inline edit) ──────────────────────────────────────────────
function EntryRow({ entry, dossierId, onDelete }) {
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState({});
  const qc = useQueryClient();

  const updateMutation = useMutation({
    mutationFn: (data) => base44.entities.ComparisonEntry.update(entry.id, data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['dossier_comparison', dossierId] });
      setEditing(false);
    },
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

  const save = () => {
    updateMutation.mutate({
      ...form,
      praemie_monatlich: form.praemie_monatlich !== '' ? Number(form.praemie_monatlich) : null,
      franchise:         form.franchise !== '' ? Number(form.franchise) : null,
      manually_verified: true,
    });
  };

  const inputCls = "border border-input bg-background rounded px-2 py-1 text-xs w-full focus:outline-none focus:ring-1 focus:ring-ring";

  if (editing) {
    return (
      <div className="bg-primary/5 border border-primary/20 rounded-lg p-3 space-y-2">
        <div className="grid grid-cols-2 gap-2">
          <div><label className="text-[10px] text-muted-foreground">Gesellschaft</label>
            <input className={inputCls} value={form.gesellschaft} onChange={e => setForm(f => ({ ...f, gesellschaft: e.target.value }))} /></div>
          <div><label className="text-[10px] text-muted-foreground">Produkt</label>
            <input className={inputCls} value={form.product_name} onChange={e => setForm(f => ({ ...f, product_name: e.target.value }))} /></div>
          <div><label className="text-[10px] text-muted-foreground">Prämie/Mt.</label>
            <input className={inputCls} type="number" value={form.praemie_monatlich} onChange={e => setForm(f => ({ ...f, praemie_monatlich: e.target.value }))} /></div>
          <div><label className="text-[10px] text-muted-foreground">Franchise</label>
            <input className={inputCls} type="number" value={form.franchise} onChange={e => setForm(f => ({ ...f, franchise: e.target.value }))} /></div>
          <div><label className="text-[10px] text-muted-foreground">Modell</label>
            <input className={inputCls} value={form.modell} onChange={e => setForm(f => ({ ...f, modell: e.target.value }))} /></div>
          <div><label className="text-[10px] text-muted-foreground">Deckung</label>
            <input className={inputCls} value={form.deckung_details} onChange={e => setForm(f => ({ ...f, deckung_details: e.target.value }))} /></div>
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
    <div className="flex items-start justify-between gap-2 py-1.5 group">
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-1.5 flex-wrap">
          <span className="text-xs font-semibold text-foreground">{entry.gesellschaft}</span>
          {entry.product_name && <span className="text-[11px] text-muted-foreground">{entry.product_name}</span>}
          {entry.section === 'grundversicherung' && (
            <span className="text-[10px] bg-blue-50 text-blue-700 border border-blue-100 px-1.5 py-0.5 rounded-full">KVG</span>
          )}
          {entry.section === 'zusatzversicherung' && (
            <span className="text-[10px] bg-violet-50 text-violet-700 border border-violet-100 px-1.5 py-0.5 rounded-full">VVG</span>
          )}
          {entry.ai_extracted && <ConfidenceBadge confidence={entry.ai_confidence} />}
          {entry.is_recommended && (
            <span className="flex items-center gap-0.5 text-[10px] text-emerald-700">
              <Star className="w-2.5 h-2.5 fill-emerald-500" />Empfohlen
            </span>
          )}
        </div>
        <div className="flex items-center gap-3 mt-0.5 text-[11px] text-muted-foreground flex-wrap">
          {entry.praemie_monatlich != null && <span className="font-medium text-foreground">{fmtCHF(entry.praemie_monatlich)}/Mt.</span>}
          {entry.franchise != null && entry.section === 'grundversicherung' && <span>Fr. CHF {Number(entry.franchise).toLocaleString('de-CH')}</span>}
          {entry.modell && <span>{entry.modell}</span>}
          {entry.deckung_details && <span className="truncate max-w-48">{entry.deckung_details}</span>}
        </div>
      </div>
      <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
        <button onClick={startEdit} className="p-1 text-muted-foreground hover:text-foreground hover:bg-muted rounded">
          <Edit3 className="w-3 h-3" />
        </button>
        <button onClick={() => onDelete(entry.id)} className="p-1 text-muted-foreground hover:text-destructive hover:bg-destructive/10 rounded">
          <Trash2 className="w-3 h-3" />
        </button>
      </div>
    </div>
  );
}

// ── Personen-Lösungs-Spalte ───────────────────────────────────────────────────
function GruppePersonCard({ person, entries, gruppe, dossierId, onDelete }) {
  const cfg = GRUPPE_DEFAULTS[gruppe] || GRUPPE_DEFAULTS.manuell;
  const kvgEntries = entries.filter(e => e.section === 'grundversicherung');
  const vvgEntries = entries.filter(e => e.section === 'zusatzversicherung');

  const totalMonthly = entries.reduce((s, e) => s + (e.praemie_monatlich ?? 0), 0);
  const allLowConfidence = entries.some(e => e.ai_extracted && (e.ai_confidence ?? 1) < 0.6);

  return (
    <div className={`border rounded-xl p-4 ${cfg.color} ${allLowConfidence ? 'border-red-200' : ''}`}>
      {/* Person-Header */}
      <div className="flex items-center gap-2 mb-3">
        <div className="w-6 h-6 rounded-full bg-primary/10 flex items-center justify-center text-primary text-[10px] font-bold shrink-0">
          {person[0]?.toUpperCase()}
        </div>
        <span className="text-xs font-semibold text-foreground">{person}</span>
        {allLowConfidence && (
          <span className="flex items-center gap-0.5 text-[10px] text-red-700 ml-auto">
            <AlertTriangle className="w-3 h-3" />Bitte prüfen
          </span>
        )}
      </div>

      {/* KVG Block */}
      {kvgEntries.length > 0 && (
        <div className="mb-2">
          <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wide mb-1">Grundversicherung (KVG)</p>
          <div className="divide-y divide-border/40">
            {kvgEntries.map(e => <EntryRow key={e.id} entry={e} dossierId={dossierId} onDelete={onDelete} />)}
          </div>
        </div>
      )}

      {/* VVG Block */}
      {vvgEntries.length > 0 && (
        <div className={kvgEntries.length > 0 ? 'mt-2 pt-2 border-t border-border/40' : ''}>
          <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wide mb-1">Zusatzversicherung (VVG)</p>
          <div className="divide-y divide-border/40">
            {vvgEntries.map(e => <EntryRow key={e.id} entry={e} dossierId={dossierId} onDelete={onDelete} />)}
          </div>
        </div>
      )}

      {/* Total */}
      {totalMonthly > 0 && (
        <div className="mt-3 pt-2 border-t border-border/60 flex items-center justify-between">
          <span className="text-[10px] text-muted-foreground font-medium">Total/Monat</span>
          <span className="text-sm font-bold text-foreground">{fmtCHF(totalMonthly)}</span>
        </div>
      )}

      {entries.length === 0 && (
        <p className="text-[11px] text-muted-foreground/60 italic py-2">Keine Einträge</p>
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

  // Backward-compat: Einträge ohne gruppe → 'manuell'
  const normalizedEntries = useMemo(() =>
    entries.map(e => ({ ...e, gruppe: e.gruppe || 'manuell' })),
    [entries]
  );

  // Gruppen-Reihenfolge (stabil, nach Enum-Reihenfolge)
  const GRUPPE_ORDER = ['aktuelle_loesung', 'optimiert', 'angebot_1', 'angebot_2', 'angebot_3', 'angebot_4', 'angebot_5', 'manuell'];
  const presentGruppen = useMemo(() => {
    const seen = new Set(normalizedEntries.map(e => e.gruppe));
    return GRUPPE_ORDER.filter(g => seen.has(g));
  }, [normalizedEntries]);

  const persons = useMemo(() => {
    const seen = new Set(normalizedEntries.map(e => e.person_name));
    return [...seen];
  }, [normalizedEntries]);

  if (normalizedEntries.length === 0) return null;

  return (
    <div className="space-y-6">
      {persons.map(person => (
        <div key={person}>
          {/* Personen-Trennlinie */}
          {persons.length > 1 && (
            <div className="flex items-center gap-3 mb-3">
              <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center text-primary text-sm font-bold shrink-0">
                {person[0]?.toUpperCase()}
              </div>
              <h4 className="text-sm font-semibold text-foreground">{person}</h4>
              <div className="flex-1 h-px bg-border/60" />
            </div>
          )}

          {/* Gruppen-Spalten (horizontal scrollbar auf kleinen Screens) */}
          <div className="grid gap-3" style={{ gridTemplateColumns: `repeat(${Math.min(presentGruppen.length, 3)}, minmax(0, 1fr))` }}>
            {presentGruppen.map(gruppe => {
              const gruppeEntries = normalizedEntries.filter(
                e => e.person_name === person && e.gruppe === gruppe
              );
              const cfg = GRUPPE_DEFAULTS[gruppe] || GRUPPE_DEFAULTS.manuell;
              const label = gruppeEntries[0]?.gruppe_label || cfg.label;

              return (
                <div key={gruppe} className="space-y-2">
                  {/* Spalten-Header */}
                  <div className="flex items-center gap-2">
                    <span className={`text-[11px] font-semibold border px-2 py-0.5 rounded-full ${cfg.badge}`}>
                      {label}
                    </span>
                    {gruppe === 'aktuelle_loesung' && (
                      <span className="text-[10px] text-muted-foreground">Aktuell</span>
                    )}
                  </div>
                  <GruppePersonCard
                    person={person}
                    entries={gruppeEntries}
                    gruppe={gruppe}
                    dossierId={dossierId}
                    onDelete={(id) => deleteMutation.mutate(id)}
                  />
                </div>
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
}