/**
 * DossierStammdatenTab — Phase 1
 * Stammdaten-Formular: Kunde auswählen (read-only CRM), Typ, Titel, Notizen.
 * Schreibt NUR in AdvisoryDossier. Keine Änderungen an Customer/Contract.
 */
import React, { useState, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';

const DOSSIER_TYPES = [
  { value: 'kk_vergleich',    label: 'Krankenversicherungsvergleich' },
  { value: 'vorsorge',        label: 'Vorsorge' },
  { value: 'sachversicherung',label: 'Sachversicherung' },
  { value: 'gesamtdossier',   label: 'Gesamtdossier' },
];

const STATUS_OPTIONS = [
  { value: 'entwurf',        label: 'Entwurf' },
  { value: 'in_bearbeitung', label: 'In Bearbeitung' },
  { value: 'bereit',         label: 'Bereit' },
  { value: 'archiviert',     label: 'Archiviert' },
];

export default function DossierStammdatenTab({ dossier, onSave, isSaving }) {
  const [search, setSearch] = useState('');
  const [selectedCustomer, setSelectedCustomer] = useState(null);
  const [form, setForm] = useState({
    title: '',
    dossier_type: 'kk_vergleich',
    status: 'entwurf',
    valid_from: '',
    valid_until: '',
    recommendation_notes: '',
    notes: '',
  });

  // Sync existing dossier into form
  useEffect(() => {
    if (dossier) {
      setForm({
        title:                dossier.title || '',
        dossier_type:         dossier.dossier_type || 'kk_vergleich',
        status:               dossier.status || 'entwurf',
        valid_from:           dossier.valid_from || '',
        valid_until:          dossier.valid_until || '',
        recommendation_notes: dossier.recommendation_notes || '',
        notes:                dossier.notes || '',
      });
      if (dossier.customer_id) {
        setSelectedCustomer({ id: dossier.customer_id, label: dossier.customer_name });
      }
    }
  }, [dossier]);

  // READ-ONLY: Kunden suchen (kein Write auf Customer)
  const { data: customers = [] } = useQuery({
    queryKey: ['customers_search_dossier', search],
    queryFn: () => base44.entities.Customer.list('-created_date', 20),
    enabled: search.length >= 2,
    select: (data) => data.filter(c =>
      `${c.first_name} ${c.last_name}`.toLowerCase().includes(search.toLowerCase()) ||
      (c.email || '').toLowerCase().includes(search.toLowerCase())
    ).slice(0, 8),
  });

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!selectedCustomer) return;
    onSave({
      ...form,
      customer_id:   selectedCustomer.id,
      customer_name: selectedCustomer.label,
    });
  };

  const inputClass = "w-full border border-input bg-transparent rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-ring placeholder:text-muted-foreground";
  const labelClass = "block text-xs font-medium text-muted-foreground mb-1.5";

  return (
    <form onSubmit={handleSubmit} className="space-y-6 max-w-2xl">
      {/* Kundenauswahl (read-only CRM) */}
      <div>
        <label className={labelClass}>Kunde <span className="text-destructive">*</span></label>
        {selectedCustomer ? (
          <div className="flex items-center gap-3 border border-border rounded-lg px-4 py-3 bg-muted/40">
            <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center text-primary text-sm font-semibold">
              {selectedCustomer.label?.[0]?.toUpperCase()}
            </div>
            <span className="text-sm font-medium text-foreground flex-1">{selectedCustomer.label}</span>
            {!dossier && (
              <button
                type="button"
                onClick={() => { setSelectedCustomer(null); setSearch(''); }}
                className="text-xs text-muted-foreground hover:text-foreground"
              >
                Ändern
              </button>
            )}
          </div>
        ) : (
          <div className="relative">
            <input
              className={inputClass}
              placeholder="Kunde suchen (min. 2 Zeichen)…"
              value={search}
              onChange={e => setSearch(e.target.value)}
            />
            {customers.length > 0 && (
              <div className="absolute z-20 top-full left-0 right-0 mt-1 bg-popover border border-border rounded-lg shadow-modal overflow-hidden">
                {customers.map(c => (
                  <button
                    key={c.id}
                    type="button"
                    onClick={() => {
                      setSelectedCustomer({ id: c.id, label: `${c.first_name} ${c.last_name}` });
                      setSearch('');
                    }}
                    className="w-full text-left px-4 py-2.5 text-sm hover:bg-muted transition-colors"
                  >
                    <span className="font-medium">{c.first_name} {c.last_name}</span>
                    {c.email && <span className="text-muted-foreground ml-2">· {c.email}</span>}
                  </button>
                ))}
              </div>
            )}
          </div>
        )}
        <p className="text-xs text-muted-foreground mt-1">
          Kundendaten werden ausschliesslich lesend aus dem CRM übernommen.
        </p>
      </div>

      {/* Titel */}
      <div>
        <label className={labelClass}>Dossier-Titel <span className="text-destructive">*</span></label>
        <input
          className={inputClass}
          placeholder="z.B. Krankenversicherungsvergleich 2026 — Familie Frei"
          value={form.title}
          onChange={e => setForm(f => ({ ...f, title: e.target.value }))}
          required
        />
      </div>

      {/* Typ + Status */}
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className={labelClass}>Dossier-Typ</label>
          <select
            className={inputClass}
            value={form.dossier_type}
            onChange={e => setForm(f => ({ ...f, dossier_type: e.target.value }))}
          >
            {DOSSIER_TYPES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
          </select>
        </div>
        <div>
          <label className={labelClass}>Status</label>
          <select
            className={inputClass}
            value={form.status}
            onChange={e => setForm(f => ({ ...f, status: e.target.value }))}
          >
            {STATUS_OPTIONS.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
          </select>
        </div>
      </div>

      {/* Gültigkeitszeitraum */}
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className={labelClass}>Gültig ab</label>
          <input
            type="date"
            className={inputClass}
            value={form.valid_from}
            onChange={e => setForm(f => ({ ...f, valid_from: e.target.value }))}
          />
        </div>
        <div>
          <label className={labelClass}>Gültig bis</label>
          <input
            type="date"
            className={inputClass}
            value={form.valid_until}
            onChange={e => setForm(f => ({ ...f, valid_until: e.target.value }))}
          />
        </div>
      </div>

      {/* Beratungsnotiz */}
      <div>
        <label className={labelClass}>Beratungsnotiz / Empfehlung</label>
        <textarea
          className={`${inputClass} h-24 resize-none`}
          placeholder="Kurze Zusammenfassung der Beratungssituation und Empfehlung…"
          value={form.recommendation_notes}
          onChange={e => setForm(f => ({ ...f, recommendation_notes: e.target.value }))}
        />
      </div>

      {/* Interne Notizen */}
      <div>
        <label className={labelClass}>Interne Notizen</label>
        <textarea
          className={`${inputClass} h-20 resize-none`}
          placeholder="Interne Bemerkungen (nicht im PDF sichtbar)…"
          value={form.notes}
          onChange={e => setForm(f => ({ ...f, notes: e.target.value }))}
        />
      </div>

      <div className="flex items-center gap-3 pt-2">
        <button
          type="submit"
          disabled={!selectedCustomer || !form.title || isSaving}
          className="px-5 py-2 bg-primary text-primary-foreground text-sm font-medium rounded-lg hover:bg-primary/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {isSaving ? 'Speichern…' : dossier ? 'Aktualisieren' : 'Dossier erstellen'}
        </button>
        {dossier && (
          <span className="text-xs text-muted-foreground">
            Version {dossier.version} · Zuletzt geändert: {new Date(dossier.updated_date).toLocaleDateString('de-CH')}
          </span>
        )}
      </div>
    </form>
  );
}