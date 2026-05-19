/**
 * ComparisonSideBySide — Phase 3
 * Side-by-Side Vergleichstabelle mit Leistungsbewertung 1–6.
 * Farbliche Hervorhebung, Empfehlungsmarkierung.
 * Keine eigene Berechnungslogik — alles über dossierCalc.js.
 */
import React, { useState } from 'react';
import { Star, Trash2, Edit3, Check, X } from 'lucide-react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { fmtCHF, sortByPraemie, scoreClass, SCORE_COLORS } from '@/lib/dossierCalc';

const SECTION_LABELS = {
  grundversicherung: 'Grundversicherung (KVG)',
  zusatzversicherung: 'Zusatzversicherung (VVG)',
};

// Leistungsbewertung 1–6 Sterne-Picker
function ScorePicker({ value, onChange, disabled }) {
  const scores = [1, 2, 3, 4, 5, 6];
  return (
    <div className="flex items-center gap-0.5">
      {scores.map(s => (
        <button
          key={s}
          type="button"
          disabled={disabled}
          onClick={() => onChange(s === value ? null : s)}
          className={`w-5 h-5 rounded text-[10px] font-bold transition-colors border
            ${value != null && s <= value
              ? 'bg-amber-400 border-amber-400 text-white'
              : 'bg-muted border-border text-muted-foreground hover:bg-amber-100'}`}
        >
          {s}
        </button>
      ))}
    </div>
  );
}

function EntryCard({ entry, lowestPraemie, onDelete, onUpdate, dossierId }) {
  const [editing, setEditing] = useState(false);
  const [editForm, setEditForm] = useState({});
  const qc = useQueryClient();

  const updateMutation = useMutation({
    mutationFn: ({ id, data }) => base44.entities.ComparisonEntry.update(id, data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['dossier_comparison', dossierId] });
      setEditing(false);
    },
  });

  const scoreVal = entry.leistungs_score;
  const sc = scoreClass(scoreVal);
  const praemie = entry.praemie_monatlich;
  const isCheapest = praemie != null && lowestPraemie != null && praemie === lowestPraemie;

  const borderClass = entry.is_recommended
    ? 'border-emerald-300 shadow-sm shadow-emerald-100'
    : entry.is_current
      ? 'border-slate-300 bg-slate-50/50'
      : 'border-border';

  const startEdit = () => {
    setEditForm({
      gesellschaft:    entry.gesellschaft,
      product_name:    entry.product_name || '',
      praemie_monatlich: entry.praemie_monatlich ?? '',
      franchise:       entry.franchise ?? '',
      modell:          entry.modell || '',
      deckung_details: entry.deckung_details || '',
      leistungs_score: entry.leistungs_score ?? null,
      is_current:      entry.is_current || false,
      is_recommended:  entry.is_recommended || false,
    });
    setEditing(true);
  };

  const saveEdit = () => {
    updateMutation.mutate({
      id: entry.id,
      data: {
        ...editForm,
        praemie_monatlich: editForm.praemie_monatlich !== '' ? Number(editForm.praemie_monatlich) : null,
        franchise:         editForm.franchise !== '' ? Number(editForm.franchise) : null,
      },
    });
  };

  const inputCls = "w-full border border-input bg-background rounded px-2 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-ring";

  if (editing) {
    return (
      <div className="border border-primary/30 bg-primary/5 rounded-xl p-4 space-y-3">
        <div className="grid grid-cols-2 gap-2">
          <div>
            <label className="block text-[10px] text-muted-foreground mb-0.5">Gesellschaft *</label>
            <input className={inputCls} value={editForm.gesellschaft}
              onChange={e => setEditForm(f => ({ ...f, gesellschaft: e.target.value }))} />
          </div>
          <div>
            <label className="block text-[10px] text-muted-foreground mb-0.5">Produkt</label>
            <input className={inputCls} value={editForm.product_name}
              onChange={e => setEditForm(f => ({ ...f, product_name: e.target.value }))} />
          </div>
          <div>
            <label className="block text-[10px] text-muted-foreground mb-0.5">Prämie/Mt. (CHF)</label>
            <input className={inputCls} type="number" step="0.05" value={editForm.praemie_monatlich}
              onChange={e => setEditForm(f => ({ ...f, praemie_monatlich: e.target.value }))} />
          </div>
          <div>
            <label className="block text-[10px] text-muted-foreground mb-0.5">Franchise (CHF)</label>
            <input className={inputCls} type="number" value={editForm.franchise}
              onChange={e => setEditForm(f => ({ ...f, franchise: e.target.value }))} />
          </div>
          <div>
            <label className="block text-[10px] text-muted-foreground mb-0.5">Modell</label>
            <input className={inputCls} value={editForm.modell}
              onChange={e => setEditForm(f => ({ ...f, modell: e.target.value }))} />
          </div>
          <div>
            <label className="block text-[10px] text-muted-foreground mb-0.5">Deckungsdetails</label>
            <input className={inputCls} value={editForm.deckung_details}
              onChange={e => setEditForm(f => ({ ...f, deckung_details: e.target.value }))} />
          </div>
        </div>
        <div>
          <label className="block text-[10px] text-muted-foreground mb-1">Leistungsbewertung (1–6)</label>
          <ScorePicker
            value={editForm.leistungs_score}
            onChange={v => setEditForm(f => ({ ...f, leistungs_score: v }))}
          />
        </div>
        <div className="flex items-center gap-4 text-xs">
          <label className="flex items-center gap-1.5 cursor-pointer">
            <input type="checkbox" checked={editForm.is_current}
              onChange={e => setEditForm(f => ({ ...f, is_current: e.target.checked }))} />
            Aktuelle Police
          </label>
          <label className="flex items-center gap-1.5 cursor-pointer">
            <input type="checkbox" checked={editForm.is_recommended}
              onChange={e => setEditForm(f => ({ ...f, is_recommended: e.target.checked }))} />
            Empfohlen
          </label>
        </div>
        <div className="flex gap-2">
          <button onClick={saveEdit} disabled={updateMutation.isPending}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-primary text-primary-foreground text-xs font-medium rounded-lg hover:bg-primary/90 transition-colors disabled:opacity-50">
            <Check className="w-3 h-3" />
            {updateMutation.isPending ? 'Speichern…' : 'Speichern'}
          </button>
          <button onClick={() => setEditing(false)}
            className="flex items-center gap-1.5 px-3 py-1.5 border border-border text-xs font-medium rounded-lg hover:bg-muted transition-colors">
            <X className="w-3 h-3" />
            Abbrechen
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className={`border rounded-xl p-4 bg-card transition-shadow hover:shadow-card-md ${borderClass}`}>
      {/* Header row */}
      <div className="flex items-start justify-between gap-2 mb-3">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-sm font-bold text-foreground truncate">{entry.gesellschaft}</span>
            {entry.is_recommended && (
              <span className="inline-flex items-center gap-1 text-[10px] font-semibold bg-emerald-100 text-emerald-700 border border-emerald-200 px-1.5 py-0.5 rounded-full">
                <Star className="w-2.5 h-2.5 fill-emerald-500" /> Empfohlen
              </span>
            )}
            {entry.is_current && (
              <span className="text-[10px] font-medium bg-slate-100 text-slate-600 border border-slate-200 px-1.5 py-0.5 rounded-full">
                Aktuell
              </span>
            )}
            {isCheapest && !entry.is_current && (
              <span className="text-[10px] font-medium bg-blue-50 text-blue-700 border border-blue-200 px-1.5 py-0.5 rounded-full">
                Günstigste
              </span>
            )}
          </div>
          {entry.product_name && (
            <p className="text-xs text-muted-foreground mt-0.5">{entry.product_name}</p>
          )}
        </div>
        <div className="flex items-center gap-1 shrink-0">
          <button onClick={startEdit}
            className="p-1.5 text-muted-foreground hover:text-foreground hover:bg-muted rounded-lg transition-colors"
            title="Bearbeiten">
            <Edit3 className="w-3.5 h-3.5" />
          </button>
          <button onClick={() => onDelete(entry.id)}
            className="p-1.5 text-muted-foreground hover:text-destructive hover:bg-destructive/10 rounded-lg transition-colors"
            title="Löschen">
            <Trash2 className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* Data grid */}
      <div className="grid grid-cols-2 gap-x-4 gap-y-2 text-xs">
        <div>
          <p className="text-muted-foreground">Prämie/Monat</p>
          <p className={`font-bold text-base ${isCheapest && !entry.is_current ? 'text-blue-700' : entry.is_recommended ? 'text-emerald-700' : 'text-foreground'}`}>
            {fmtCHF(entry.praemie_monatlich)}
          </p>
          {entry.praemie_monatlich != null && (
            <p className="text-muted-foreground">{fmtCHF(entry.praemie_monatlich * 12)} / Jahr</p>
          )}
        </div>
        <div>
          <p className="text-muted-foreground">Franchise / Modell</p>
          <p className="font-medium text-foreground">
            {entry.franchise ? `CHF ${Number(entry.franchise).toLocaleString('de-CH')}` : '—'}
          </p>
          {entry.modell && <p className="text-muted-foreground">{entry.modell}</p>}
        </div>
        {entry.deckung_details && (
          <div className="col-span-2">
            <p className="text-muted-foreground">Deckung</p>
            <p className="font-medium text-foreground">{entry.deckung_details}</p>
          </div>
        )}
        <div>
          <p className="text-muted-foreground">Leistungsbewertung</p>
          {scoreVal != null ? (
            <div className="flex items-center gap-1.5 mt-0.5">
              <span className={`text-xs font-bold border px-2 py-0.5 rounded-full ${SCORE_COLORS[sc]}`}>
                {scoreVal} / 6
              </span>
              <div className="flex gap-0.5">
                {[1,2,3,4,5,6].map(i => (
                  <div key={i}
                    className={`w-3 h-3 rounded-sm ${i <= scoreVal ? 'bg-amber-400' : 'bg-muted'}`} />
                ))}
              </div>
            </div>
          ) : (
            <button onClick={startEdit}
              className="text-[10px] text-primary underline-offset-2 hover:underline mt-0.5">
              Bewertung erfassen
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

export default function ComparisonSideBySide({ entries, dossierId }) {
  const qc = useQueryClient();

  const deleteMutation = useMutation({
    mutationFn: (id) => base44.entities.ComparisonEntry.delete(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['dossier_comparison', dossierId] }),
  });

  const sections = ['grundversicherung', 'zusatzversicherung'];

  return (
    <div className="space-y-6">
      {sections.map(section => {
        const sectionEntries = entries.filter(e => e.section === section);
        if (sectionEntries.length === 0) return null;

        // Group by person, then sort each person's entries by praemie
        const persons = [...new Set(sectionEntries.map(e => e.person_name || 'Unbekannt'))];

        return (
          <div key={section}>
            <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-3">
              {SECTION_LABELS[section]}
            </h4>

            {persons.map(person => {
              const personEntries = sortByPraemie(sectionEntries.filter(e => (e.person_name || 'Unbekannt') === person));
              const prices = personEntries.map(e => e.praemie_monatlich).filter(p => p != null);
              const lowestPraemie = prices.length > 0 ? Math.min(...prices) : null;

              return (
                <div key={person} className="mb-4">
                  <p className="text-xs font-medium text-foreground mb-2 flex items-center gap-2">
                    <span className="w-5 h-5 rounded-full bg-primary/10 text-primary flex items-center justify-center text-[10px] font-bold">
                      {person[0]?.toUpperCase()}
                    </span>
                    {person}
                    <span className="text-muted-foreground font-normal">({personEntries.length} Anbieter)</span>
                  </p>
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                    {personEntries.map(e => (
                      <EntryCard
                        key={e.id}
                        entry={e}
                        lowestPraemie={lowestPraemie}
                        dossierId={dossierId}
                        onDelete={id => deleteMutation.mutate(id)}
                      />
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        );
      })}
    </div>
  );
}