/**
 * DossierVergleichTab — Phase 3
 * Orchestriert: Einsparungsübersicht + Side-by-Side Vergleich + Eintrags-Erfassung.
 * Berechnungslogik ausschliesslich via dossierCalc.js (keine verteilte Logik).
 * Schreibt nur in ComparisonEntry (isolierte Dossier-Entity).
 * Read-only gegenüber allen CRM-Kern-Entities.
 */
import React, { useState, useMemo, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Shield, Plus, ChevronDown, ChevronUp, Star, Sparkles } from 'lucide-react';
import DossierEinsparungPanel from '@/components/dossier/DossierEinsparungPanel';
import ComparisonSideBySide from '@/components/dossier/ComparisonSideBySide';
import ComparisonGruppenView from '@/components/dossier/ComparisonGruppenView';
import DossierAiUpload from '@/components/dossier/DossierAiUpload';
import { mapContractToEntry, getImportSummary } from '@/lib/contractToEntryMapper';

const GRUPPE_OPTIONS = [
  { value: 'aktuelle_loesung', label: 'Aktuelle Lösung' },
  { value: 'optimiert',        label: 'Optimiert (gleiche Gesellschaft)' },
  { value: 'angebot_1',        label: 'Angebot 1' },
  { value: 'angebot_2',        label: 'Angebot 2' },
  { value: 'angebot_3',        label: 'Angebot 3' },
  { value: 'angebot_4',        label: 'Angebot 4' },
  { value: 'angebot_5',        label: 'Angebot 5' },
  { value: 'manuell',          label: 'Manuell (ohne Gruppe)' },
];

const SECTION_LABELS = {
  grundversicherung: 'Grundversicherung (KVG)',
  zusatzversicherung: 'Zusatzversicherung (VVG)',
};

const inputClass = "w-full border border-input bg-transparent rounded-md px-3 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-ring placeholder:text-muted-foreground";

// ── Verkaufschance Offerten Read-Only Panel ──────────────────────────────────
function VerkaufschanceOfferten({ gesellschaften }) {
  const [open, setOpen] = useState(false);
  if (!gesellschaften || gesellschaften.length === 0) return null;

  return (
    <div className="border border-blue-200 bg-blue-50 rounded-xl overflow-hidden">
      <button
        onClick={() => setOpen(o => !o)}
        className="w-full flex items-center justify-between px-5 py-3 text-sm font-semibold text-blue-800"
      >
        <span>📋 Offerten aus Verkaufschance ({gesellschaften.length})</span>
        {open ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
      </button>
      {open && (
        <div className="px-5 pb-4 space-y-2">
          {gesellschaften.map((g, i) => (
            <div key={g.id || i} className="bg-white border border-blue-100 rounded-lg px-4 py-3 text-sm">
              <div className="flex items-center justify-between flex-wrap gap-2">
                <div className="flex items-center gap-2">
                  <span className="font-semibold text-foreground">{g.gesellschaft}</span>
                  {g.ist_favorit && <Star className="w-3.5 h-3.5 text-amber-500 fill-amber-400" />}
                  <span className={`text-[10px] border px-1.5 py-0.5 rounded-full
                    ${g.status === 'offerte_erhalten' ? 'bg-emerald-50 text-emerald-700 border-emerald-200' :
                      g.status === 'favorit' ? 'bg-amber-50 text-amber-700 border-amber-200' :
                      g.status === 'ausgewaehlt' ? 'bg-blue-100 text-blue-700 border-blue-200' :
                      'bg-slate-100 text-slate-600 border-slate-200'}`}>
                    {g.status || 'angefragt'}
                  </span>
                </div>
                {g.praemie_yearly != null && (
                  <span className="font-bold text-foreground">
                    CHF {(g.praemie_yearly / 12).toLocaleString('de-CH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}/Mt.
                  </span>
                )}
              </div>
              {g.deckung && <p className="text-xs text-muted-foreground mt-1">{g.deckung}</p>}
              {g.bemerkung && <p className="text-xs text-muted-foreground mt-0.5 italic">{g.bemerkung}</p>}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ── Neuer Eintrag Formular (mit optionaler Auto-Befüllung) ────────────────────
function AddEntryForm({ dossierId, personName, section, onSuccess, onCancel, prefill, defaultGruppe }) {
  const [form, setForm] = useState({
    gesellschaft: '', product_name: '', praemie_monatlich: '',
    franchise: '', modell: '', deckung_details: '',
    leistungs_score: '', is_current: false, is_recommended: false,
    gruppe: defaultGruppe || 'manuell', gruppe_label: '',
  });

  // Phase 5.3: Wenn prefill gesetzt → Auto-Befüllung aus Police
  useEffect(() => {
    if (prefill) {
      setForm(f => ({
        ...f,
        gesellschaft:      prefill.gesellschaft || '',
        product_name:      prefill.product_name || '',
        praemie_monatlich: prefill.praemie_monatlich !== '' ? prefill.praemie_monatlich : '',
        franchise:         prefill.franchise !== '' ? prefill.franchise : '',
        modell:            prefill.modell || '',
        deckung_details:   prefill.deckung_details || '',
        leistungs_score:   '',
        is_current:        prefill.is_current ?? false,
        is_recommended:    false,
        gruppe:            prefill.is_current ? 'aktuelle_loesung' : (defaultGruppe || 'manuell'),
      }));
    }
  }, [prefill]);
  const qc = useQueryClient();

  const mutation = useMutation({
    mutationFn: (data) => base44.entities.ComparisonEntry.create(data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['dossier_comparison', dossierId] });
      onSuccess();
    },
  });

  const handleSubmit = (e) => {
    e.preventDefault();
    mutation.mutate({
      dossier_id:        dossierId,
      person_name:       personName,
      section,
      gruppe:            form.gruppe,
      gruppe_label:      form.gruppe_label || null,
      gesellschaft:      form.gesellschaft,
      product_name:      form.product_name || null,
      praemie_monatlich: form.praemie_monatlich ? Number(form.praemie_monatlich) : null,
      franchise:         form.franchise ? Number(form.franchise) : null,
      modell:            form.modell || null,
      deckung_details:   form.deckung_details || null,
      leistungs_score:   form.leistungs_score ? Number(form.leistungs_score) : null,
      is_current:        form.is_current,
      is_recommended:    form.is_recommended,
      ai_extracted:      false,
      manually_verified: true,
    });
  };

  return (
    <form onSubmit={handleSubmit} className="border border-primary/30 bg-primary/5 rounded-xl p-4 space-y-3">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <p className="text-xs font-semibold text-primary">
          Neuer Eintrag — {personName} · {SECTION_LABELS[section]}
        </p>
        {prefill && (
          <span className="text-[10px] bg-primary/10 text-primary border border-primary/20 px-2 py-0.5 rounded-full">
            ✓ Aus Police vorbefüllt — bitte prüfen
          </span>
        )}
      </div>
      {/* Gruppe-Zuweisung */}
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="block text-xs text-muted-foreground mb-1">Gruppe (Vergleichsspalte)</label>
          <select className={inputClass} value={form.gruppe}
            onChange={e => setForm(f => ({ ...f, gruppe: e.target.value }))}>
            {GRUPPE_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
          </select>
        </div>
        <div>
          <label className="block text-xs text-muted-foreground mb-1">Spalten-Label (optional)</label>
          <input className={inputClass} value={form.gruppe_label}
            onChange={e => setForm(f => ({ ...f, gruppe_label: e.target.value }))}
            placeholder={`z.B. CSS — Angebot 1`} />
        </div>
      </div>
      <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
        <div>
          <label className="block text-xs text-muted-foreground mb-1">Gesellschaft *</label>
          <input className={inputClass} required value={form.gesellschaft}
            onChange={e => setForm(f => ({ ...f, gesellschaft: e.target.value }))}
            placeholder="z.B. SWICA" />
        </div>
        <div>
          <label className="block text-xs text-muted-foreground mb-1">Produkt</label>
          <input className={inputClass} value={form.product_name}
            onChange={e => setForm(f => ({ ...f, product_name: e.target.value }))}
            placeholder="z.B. Optima Flex" />
        </div>
        <div>
          <label className="block text-xs text-muted-foreground mb-1">Prämie/Mt. (CHF)</label>
          <input className={inputClass} type="number" step="0.05" value={form.praemie_monatlich}
            onChange={e => setForm(f => ({ ...f, praemie_monatlich: e.target.value }))}
            placeholder="350.00" />
        </div>
        <div>
          <label className="block text-xs text-muted-foreground mb-1">Franchise (CHF)</label>
          <input className={inputClass} type="number" value={form.franchise}
            onChange={e => setForm(f => ({ ...f, franchise: e.target.value }))}
            placeholder="2500" />
        </div>
        <div>
          <label className="block text-xs text-muted-foreground mb-1">Modell</label>
          <input className={inputClass} value={form.modell}
            onChange={e => setForm(f => ({ ...f, modell: e.target.value }))}
            placeholder="HMO / HAM / Standard" />
        </div>
        <div>
          <label className="block text-xs text-muted-foreground mb-1">Leistungsbewertung (1–6)</label>
          <input className={inputClass} type="number" min="1" max="6" step="0.5" value={form.leistungs_score}
            onChange={e => setForm(f => ({ ...f, leistungs_score: e.target.value }))}
            placeholder="z.B. 5" />
        </div>
        <div className="col-span-2 md:col-span-3">
          <label className="block text-xs text-muted-foreground mb-1">Deckungsdetails</label>
          <input className={inputClass} value={form.deckung_details}
            onChange={e => setForm(f => ({ ...f, deckung_details: e.target.value }))}
            placeholder="z.B. 90%, stationär CH/Welt, unbegrenzt" />
        </div>
      </div>
      <div className="flex items-center gap-5 text-xs">
        <label className="flex items-center gap-1.5 cursor-pointer">
          <input type="checkbox" checked={form.is_current}
            onChange={e => setForm(f => ({ ...f, is_current: e.target.checked }))} />
          <span>Aktuelle Police</span>
        </label>
        <label className="flex items-center gap-1.5 cursor-pointer">
          <input type="checkbox" checked={form.is_recommended}
            onChange={e => setForm(f => ({ ...f, is_recommended: e.target.checked }))} />
          <span>Als Empfehlung markieren</span>
        </label>
      </div>
      <div className="flex gap-2">
        <button type="submit" disabled={mutation.isPending || !form.gesellschaft}
          className="px-4 py-1.5 bg-primary text-primary-foreground text-xs font-medium rounded-lg hover:bg-primary/90 transition-colors disabled:opacity-50">
          {mutation.isPending ? 'Hinzufügen…' : 'Hinzufügen'}
        </button>
        <button type="button" onClick={onCancel}
          className="px-4 py-1.5 border border-border text-xs font-medium rounded-lg hover:bg-muted transition-colors">
          Abbrechen
        </button>
      </div>
    </form>
  );
}

// ── Hauptkomponente ───────────────────────────────────────────────────────────
export default function DossierVergleichTab({ dossier, pendingImportContract, onPendingImportConsumed }) {
  const [addingFor, setAddingFor] = useState(null); // { personName, section, prefill? }
  const [showAiUpload, setShowAiUpload] = useState(false);
  const [viewMode, setViewMode] = useState('gruppen');
  const dossierId = dossier?.id;
  const customerId = dossier?.customer_id;

  const { data: mainCustomer } = useQuery({
    queryKey: ['dossier_customer_ro', customerId],
    queryFn: () => base44.entities.Customer.filter({ id: customerId }).then(r => r[0]),
    enabled: !!customerId,
  });

  const { data: familyMembers = [] } = useQuery({
    queryKey: ['dossier_family_ro', customerId],
    queryFn: () => base44.entities.Customer.filter({ primary_customer_id: customerId }),
    enabled: !!customerId,
  });

  const { data: entries = [], isLoading } = useQuery({
    queryKey: ['dossier_comparison', dossierId],
    queryFn: () => base44.entities.ComparisonEntry.filter({ dossier_id: dossierId }),
    enabled: !!dossierId,
  });

  const { data: verkaufschance } = useQuery({
    queryKey: ['dossier_vs_ro', dossier?.linked_verkaufschance_id],
    queryFn: () => base44.entities.Verkaufschance.filter({ id: dossier.linked_verkaufschance_id }).then(r => r[0]),
    enabled: !!dossier?.linked_verkaufschance_id,
  });

  const persons = useMemo(() => {
    const list = [];
    if (mainCustomer) list.push(`${mainCustomer.first_name} ${mainCustomer.last_name}`.trim());
    familyMembers.forEach(m => list.push(`${m.first_name} ${m.last_name}`.trim()));
    return list;
  }, [mainCustomer, familyMembers]);

  // Phase 5.3: Pending Import aus Policen-Tab verarbeiten
  useEffect(() => {
    if (pendingImportContract && persons.length > 0) {
      const mapped = mapContractToEntry(pendingImportContract, persons[0]);
      setAddingFor({ personName: persons[0], section: mapped.section, prefill: mapped });
      if (onPendingImportConsumed) onPendingImportConsumed();
    }
  }, [pendingImportContract, persons]);

  if (!dossierId) {
    return (
      <div className="flex items-center justify-center py-16">
        <p className="text-sm text-muted-foreground">Bitte zuerst das Dossier speichern (Stammdaten-Tab).</p>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      {/* Isolation notice */}
      <div className="flex items-center gap-2 text-xs text-muted-foreground bg-muted/50 border border-border/60 rounded-lg px-3 py-2">
        <Shield className="w-3.5 h-3.5 shrink-0" />
        Vergleichsdaten in isolierter Dossier-Entity. CRM-Daten (Verträge, Offerten) ausschliesslich lesend.
      </div>

      {/* Offerten aus Verkaufschance (read-only) */}
      {verkaufschance?.gesellschaften?.length > 0 && (
        <VerkaufschanceOfferten gesellschaften={verkaufschance.gesellschaften} />
      )}

      {/* Einsparungsübersicht — zentrale Berechnung via dossierCalc */}
      <DossierEinsparungPanel entries={entries} />

      {/* Toolbar */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <h3 className="text-sm font-semibold text-foreground">
          Vergleichseinträge
          <span className="ml-2 text-xs font-normal text-muted-foreground">({entries.length} Anbieter)</span>
        </h3>
        <div className="flex items-center gap-2">
          <div className="flex border border-border rounded-lg overflow-hidden text-xs font-medium">
            <button
              onClick={() => setViewMode('gruppen')}
              className={`px-3 py-1.5 transition-colors ${viewMode === 'gruppen' ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:bg-muted'}`}>
              Gesamtlösungen
            </button>
            <button
              onClick={() => setViewMode('sidebyside')}
              className={`px-3 py-1.5 transition-colors border-l border-border ${viewMode === 'sidebyside' ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:bg-muted'}`}>
              Side-by-Side
            </button>
            <button
              onClick={() => setViewMode('list')}
              className={`px-3 py-1.5 transition-colors border-l border-border ${viewMode === 'list' ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:bg-muted'}`}>
              Liste
            </button>
          </div>
        </div>
      </div>

      {/* Entries */}
      {isLoading ? (
        <div className="space-y-2">
          {[1, 2, 3].map(i => <div key={i} className="h-32 bg-muted animate-pulse rounded-xl" />)}
        </div>
      ) : viewMode === 'gruppen' ? (
        <ComparisonGruppenView entries={entries} dossierId={dossierId} />
      ) : viewMode === 'sidebyside' ? (
        <ComparisonSideBySide entries={entries} dossierId={dossierId} />
      ) : (
        ['grundversicherung', 'zusatzversicherung'].map(section => {
          const sectionEntries = entries.filter(e => e.section === section);
          if (sectionEntries.length === 0) return null;
          return (
            <div key={section}>
              <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">
                {SECTION_LABELS[section]} ({sectionEntries.length})
              </h4>
              <ComparisonSideBySide entries={sectionEntries} dossierId={dossierId} />
            </div>
          );
        })
      )}

      {/* Add entry + KI-Upload */}
      <div className="border-t border-border/60 pt-4 space-y-3">
        <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Eintrag hinzufügen</p>

        {/* KI-Upload Panel — nur wenn Gruppe ausgewählt */}
        {typeof showAiUpload === 'object' && showAiUpload.gruppe && (
          <DossierAiUpload
            dossierId={dossierId}
            personName={persons[0] || ''}
            knownPersons={persons}
            onEntryAdded={() => { setShowAiUpload(false); }}
            onClose={() => { setShowAiUpload(false); }}
            defaultGruppe={showAiUpload.gruppe}
          />
        )}

        {/* Manuelle Eingabe / Auto-Befüllung */}
        {addingFor && !showAiUpload ? (
          <AddEntryForm
            dossierId={dossierId}
            personName={addingFor.personName}
            section={addingFor.section}
            prefill={addingFor.prefill}
            onSuccess={() => setAddingFor(null)}
            onCancel={() => setAddingFor(null)}
          />
        ) : !showAiUpload && (
          <div className="space-y-3">
            {/* Gruppe-Auswahl VOR dem Upload */}
            <div>
              <label className="block text-xs font-semibold text-foreground mb-2">
                1. Zu welcher Vergleichsgruppe gehört das Dokument?
              </label>
              <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
                {GRUPPE_OPTIONS.filter(o => o.value !== 'manuell').map((o, idx) => (
                  <button
                    key={o.value}
                    onClick={() => setShowAiUpload({ gruppe: o.value })}
                    className={`text-xs font-medium py-2.5 px-3 rounded-lg border transition-colors text-left
                      ${typeof showAiUpload === 'object' && showAiUpload.gruppe === o.value
                        ? 'bg-primary text-primary-foreground border-primary'
                        : idx === 0
                          ? 'border-primary/40 bg-primary/5 text-primary hover:bg-muted'
                          : 'border-border text-muted-foreground hover:bg-muted'}`}
                  >
                    {o.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Primär: KI-Analyse (nur wenn Gruppe ausgewählt) */}
            {typeof showAiUpload === 'object' && showAiUpload.gruppe && (
              <>
                <button
                  onClick={() => { /* showAiUpload ist bereits gesetzt, DossierAiUpload wird gleich gerendert */ }}
                  className="w-full flex items-center justify-center gap-2 text-sm font-medium text-violet-700 border-2 border-violet-200 bg-violet-50 px-4 py-3 rounded-xl hover:bg-violet-100 transition-colors"
                >
                  <Sparkles className="w-4 h-4" />
                  2. Dokument jetzt per KI analysieren (Gruppe: {GRUPPE_OPTIONS.find(o => o.value === showAiUpload.gruppe)?.label})
                </button>
                <p className="text-[10px] text-muted-foreground text-center">
                  Extrahiert automatisch KVG + VVG für alle Personen — Review vor Speicherung
                </p>
              </>
            )}

            {/* Sekundär: Manuelle Ergänzung (nur für Sonderfälle) */}
            <div className="border-t border-border/60 pt-3">
              <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wide mb-2">
                Manuell ergänzen (nur bei Sonderfällen)
              </p>
              <div className="flex items-center gap-2 flex-wrap">
                {['grundversicherung', 'zusatzversicherung'].map(section =>
                  persons.map(name => (
                    <button
                      key={`${section}-${name}`}
                      onClick={() => setAddingFor({ personName: name, section })}
                      className="flex items-center gap-1.5 text-[10px] text-muted-foreground border border-border px-2.5 py-1.5 rounded-lg hover:bg-muted transition-colors"
                    >
                      <Plus className="w-2.5 h-2.5" />
                      {SECTION_LABELS[section].split(' ')[0]} · {name}
                    </button>
                  ))
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}