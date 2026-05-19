/**
 * DossierVergleichTab — Phase 2
 * Zeigt Vergleichsofferten: ComparisonEntry-Records + Verkaufschance.gesellschaften (read-only).
 * Keine Berechnungslogik. Kein Write auf bestehende Entities.
 * Schreibt nur in ComparisonEntry (isolierte Dossier-Entity).
 */
import React, { useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Shield, Plus, Trash2, Star, ChevronDown, ChevronUp } from 'lucide-react';

const SECTION_LABELS = {
  grundversicherung: 'Grundversicherung (KVG)',
  zusatzversicherung: 'Zusatzversicherung (VVG)',
};

const inputClass = "w-full border border-input bg-transparent rounded-md px-3 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-ring placeholder:text-muted-foreground";

function GesellschaftFromVerkaufschance({ gesellschaften }) {
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

function ComparisonRow({ entry, onDelete }) {
  return (
    <div className={`border rounded-xl px-4 py-3 bg-card flex items-center gap-3 flex-wrap
      ${entry.is_recommended ? 'border-emerald-300 bg-emerald-50/40' : 'border-border'}`}>
      <div className="flex-1 min-w-0 grid grid-cols-2 md:grid-cols-4 gap-2 text-sm">
        <div>
          <p className="text-[10px] text-muted-foreground uppercase tracking-wide">Gesellschaft</p>
          <p className="font-semibold text-foreground truncate">{entry.gesellschaft}</p>
          {entry.product_name && <p className="text-xs text-muted-foreground">{entry.product_name}</p>}
        </div>
        <div>
          <p className="text-[10px] text-muted-foreground uppercase tracking-wide">Prämie/Mt.</p>
          <p className="font-bold text-foreground">
            {entry.praemie_monatlich != null
              ? `CHF ${Number(entry.praemie_monatlich).toLocaleString('de-CH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
              : '—'}
          </p>
        </div>
        <div>
          <p className="text-[10px] text-muted-foreground uppercase tracking-wide">Franchise / Modell</p>
          <p className="text-foreground">
            {entry.franchise ? `CHF ${entry.franchise}` : '—'}
            {entry.modell ? ` · ${entry.modell}` : ''}
          </p>
        </div>
        <div>
          <p className="text-[10px] text-muted-foreground uppercase tracking-wide">Deckung</p>
          <p className="text-xs text-foreground">{entry.deckung_details || '—'}</p>
        </div>
      </div>
      <div className="flex items-center gap-2 shrink-0">
        {entry.is_current && (
          <span className="text-[10px] bg-slate-100 text-slate-600 border border-slate-200 px-1.5 py-0.5 rounded-full">Aktuell</span>
        )}
        {entry.is_recommended && (
          <span className="text-[10px] bg-emerald-100 text-emerald-700 border border-emerald-200 px-1.5 py-0.5 rounded-full flex items-center gap-1">
            <Star className="w-2.5 h-2.5 fill-emerald-500" /> Empfohlen
          </span>
        )}
        <button
          onClick={() => onDelete(entry.id)}
          className="text-muted-foreground hover:text-destructive transition-colors p-1"
          title="Eintrag löschen"
        >
          <Trash2 className="w-3.5 h-3.5" />
        </button>
      </div>
    </div>
  );
}

function AddEntryForm({ dossierId, personName, section, onSuccess, onCancel }) {
  const [form, setForm] = useState({
    gesellschaft: '', product_name: '', praemie_monatlich: '',
    franchise: '', modell: '', deckung_details: '',
    is_current: false, is_recommended: false,
  });
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
      dossier_id: dossierId,
      person_name: personName,
      section,
      ...form,
      praemie_monatlich: form.praemie_monatlich ? Number(form.praemie_monatlich) : null,
      franchise: form.franchise ? Number(form.franchise) : null,
    });
  };

  return (
    <form onSubmit={handleSubmit} className="border border-primary/30 bg-primary/5 rounded-xl p-4 space-y-3">
      <p className="text-xs font-semibold text-primary">Neuer Vergleichseintrag — {personName}</p>
      <div className="grid grid-cols-2 gap-3">
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
          <label className="block text-xs text-muted-foreground mb-1">Deckungsdetails</label>
          <input className={inputClass} value={form.deckung_details}
            onChange={e => setForm(f => ({ ...f, deckung_details: e.target.value }))}
            placeholder="90%, stationär CH/Welt" />
        </div>
      </div>
      <div className="flex items-center gap-4 text-xs">
        <label className="flex items-center gap-1.5 cursor-pointer">
          <input type="checkbox" checked={form.is_current}
            onChange={e => setForm(f => ({ ...f, is_current: e.target.checked }))} />
          Aktuelle Police
        </label>
        <label className="flex items-center gap-1.5 cursor-pointer">
          <input type="checkbox" checked={form.is_recommended}
            onChange={e => setForm(f => ({ ...f, is_recommended: e.target.checked }))} />
          Empfohlen
        </label>
      </div>
      <div className="flex gap-2">
        <button type="submit" disabled={mutation.isPending}
          className="px-4 py-1.5 bg-primary text-primary-foreground text-xs font-medium rounded-lg hover:bg-primary/90 transition-colors disabled:opacity-50">
          {mutation.isPending ? 'Speichern…' : 'Hinzufügen'}
        </button>
        <button type="button" onClick={onCancel}
          className="px-4 py-1.5 border border-border text-xs font-medium rounded-lg hover:bg-muted transition-colors">
          Abbrechen
        </button>
      </div>
    </form>
  );
}

export default function DossierVergleichTab({ dossier }) {
  const [addingFor, setAddingFor] = useState(null); // { personName, section }
  const dossierId = dossier?.id;
  const customerId = dossier?.customer_id;
  const qc = useQueryClient();

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

  // Read Verkaufschance gesellschaften if linked
  const { data: verkaufschance } = useQuery({
    queryKey: ['dossier_vs_ro', dossier?.linked_verkaufschance_id],
    queryFn: () => base44.entities.Verkaufschance.filter({ id: dossier.linked_verkaufschance_id }).then(r => r[0]),
    enabled: !!dossier?.linked_verkaufschance_id,
  });

  const deleteMutation = useMutation({
    mutationFn: (id) => base44.entities.ComparisonEntry.delete(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['dossier_comparison', dossierId] }),
  });

  const persons = useMemo(() => {
    const list = [];
    if (mainCustomer) list.push(`${mainCustomer.first_name} ${mainCustomer.last_name}`.trim());
    familyMembers.forEach(m => list.push(`${m.first_name} ${m.last_name}`.trim()));
    return list;
  }, [mainCustomer, familyMembers]);

  if (!dossierId) {
    return (
      <div className="flex items-center justify-center py-16 text-center">
        <p className="text-sm text-muted-foreground">Bitte zuerst das Dossier speichern (Stammdaten-Tab).</p>
      </div>
    );
  }

  if (!customerId) {
    return (
      <div className="flex items-center justify-center py-16 text-center">
        <p className="text-sm text-muted-foreground">Bitte zuerst einen Kunden im Stammdaten-Tab auswählen.</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2 text-xs text-muted-foreground bg-muted/50 border border-border/60 rounded-lg px-3 py-2">
        <Shield className="w-3.5 h-3.5 shrink-0" />
        Vergleichsdaten werden in der isolierten Dossier-Entity gespeichert. CRM-Daten (Verträge, Offerten) read-only.
      </div>

      {/* Offerten aus Verkaufschance */}
      {verkaufschance?.gesellschaften?.length > 0 && (
        <GesellschaftFromVerkaufschance gesellschaften={verkaufschance.gesellschaften} />
      )}

      {isLoading ? (
        <div className="space-y-2">
          {[1, 2].map(i => <div key={i} className="h-16 bg-muted animate-pulse rounded-xl" />)}
        </div>
      ) : (
        ['grundversicherung', 'zusatzversicherung'].map(section => {
          const sectionEntries = entries.filter(e => e.section === section);
          return (
            <div key={section} className="space-y-2">
              <div className="flex items-center justify-between">
                <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                  {SECTION_LABELS[section]}
                </h4>
                <span className="text-xs text-muted-foreground">{sectionEntries.length} Einträge</span>
              </div>

              {sectionEntries.length === 0 ? (
                <div className="border border-dashed border-border rounded-xl p-4 text-center text-xs text-muted-foreground">
                  Noch keine Vergleichseinträge für {SECTION_LABELS[section]}.
                </div>
              ) : (
                <div className="space-y-2">
                  {sectionEntries.map(e => (
                    <ComparisonRow key={e.id} entry={e} onDelete={id => deleteMutation.mutate(id)} />
                  ))}
                </div>
              )}

              {/* Add entry */}
              {addingFor?.section === section ? (
                <AddEntryForm
                  dossierId={dossierId}
                  personName={addingFor.personName}
                  section={section}
                  onSuccess={() => setAddingFor(null)}
                  onCancel={() => setAddingFor(null)}
                />
              ) : (
                <div className="flex items-center gap-2 flex-wrap">
                  {persons.map(name => (
                    <button
                      key={name}
                      onClick={() => setAddingFor({ personName: name, section })}
                      className="flex items-center gap-1.5 text-xs text-primary border border-primary/30 px-3 py-1.5 rounded-lg hover:bg-primary/5 transition-colors"
                    >
                      <Plus className="w-3 h-3" />
                      Eintrag für {name}
                    </button>
                  ))}
                </div>
              )}
            </div>
          );
        })
      )}
    </div>
  );
}