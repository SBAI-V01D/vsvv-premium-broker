import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import {
  Upload, FileText, CheckCircle2, AlertTriangle, User, Shield,
  ChevronDown, ChevronUp, Loader2, X, Save, Search
} from 'lucide-react';
import { cn } from '@/lib/utils';

const MONTH_LAST = [31,28,31,30,31,30,31,31,30,31,30,31];
const fmtDate = (d) => d ? new Date(d + 'T00:00:00').toLocaleDateString('de-CH') : '–';
const fmtCHF = (n) => n != null ? `CHF ${Number(n).toLocaleString('de-CH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` : '–';

function KonfidenzBadge({ value }) {
  if (value == null) return null;
  const pct = Math.round(value * 100);
  const cls = value >= 0.8 ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
    : value >= 0.6 ? 'bg-amber-50 text-amber-700 border-amber-200'
    : 'bg-red-50 text-red-600 border-red-200';
  return <span className={cn('text-[10px] font-semibold px-1.5 py-0.5 rounded border', cls)}>{pct}%</span>;
}

function PolicyCard({ policy, index, unsichere, editData, onChange }) {
  const [open, setOpen] = useState(true);
  const isKvg = policy.typ === 'kvg';
  const fields = editData[index] || policy;

  const set = (key, val) => onChange(index, { ...fields, [key]: val });
  const isUnsicher = (key) => unsichere.some(f => f.includes(`policy[${index}]`) || f.includes(key));

  return (
    <div className={cn('rounded-xl border overflow-hidden', isKvg ? 'border-blue-200' : 'border-violet-200')}>
      <button
        onClick={() => setOpen(o => !o)}
        className={cn('w-full flex items-center gap-3 px-4 py-3 text-left', isKvg ? 'bg-blue-50' : 'bg-violet-50')}
      >
        <span className={cn('text-[10px] font-bold px-2 py-0.5 rounded-full uppercase', isKvg ? 'bg-blue-600 text-white' : 'bg-violet-600 text-white')}>
          {isKvg ? 'KVG' : 'VVG'}
        </span>
        <span className="font-semibold text-sm flex-1">{fields.produkt_name || '–'}</span>
        {fields.praemie_netto != null && <span className="text-sm font-bold text-emerald-700">{fmtCHF(fields.praemie_netto)}/Mt</span>}
        <KonfidenzBadge value={fields.konfidenz} />
        {open ? <ChevronUp className="w-4 h-4 text-muted-foreground" /> : <ChevronDown className="w-4 h-4 text-muted-foreground" />}
      </button>

      {open && (
        <div className="p-4 grid grid-cols-2 gap-3 bg-white">
          {[
            { key: 'produkt_name', label: 'Produkt' },
            { key: 'produkt_code', label: 'Code' },
            { key: 'modell', label: 'Modell' },
            { key: 'polnummer', label: 'Police-Nr.' },
            ...(isKvg ? [{ key: 'franchise', label: 'Franchise CHF', type: 'number' }] : []),
            { key: 'praemie_brutto', label: 'Prämie Brutto', type: 'number' },
            { key: 'praemie_netto', label: 'Prämie Netto', type: 'number' },
            { key: 'gueltig_ab', label: 'Gültig ab' },
              { key: 'gueltig_bis', label: 'Gültig bis' },
              ...(!isKvg ? [
                { key: 'tod_kapital_chf', label: 'Tod-Kapital CHF', type: 'number' },
                { key: 'invaliditaet_kapital_chf', label: 'Invalidität-Kapital CHF', type: 'number' },
                { key: 'spital_franchise_chf', label: 'Spital-Franchise CHF', type: 'number' },
              ] : []),
            ].map(({ key, label, type }) => (
            <div key={key}>
              <label className={cn('text-[10px] font-semibold uppercase tracking-wide block mb-1', isUnsicher(key) ? 'text-amber-600' : 'text-muted-foreground')}>
                {label}{isUnsicher(key) && ' ⚠'}
              </label>
              <Input
                type={type || 'text'}
                value={fields[key] ?? ''}
                onChange={e => set(key, type === 'number' ? parseFloat(e.target.value) || null : e.target.value)}
                className={cn('h-8 text-sm', isUnsicher(key) && 'border-amber-300 bg-amber-50/30')}
              />
            </div>
          ))}
          <div className="col-span-2 flex gap-4 text-sm">
            <label className="flex items-center gap-2">
              <input type="checkbox" checked={fields.unfall_gedeckt ?? true}
                onChange={e => set('unfall_gedeckt', e.target.checked)} className="rounded" />
              Unfall gedeckt
            </label>
            {fields.bonus_stufe != null && (
              <span className="text-muted-foreground">Bonusstufe: <strong>{fields.bonus_stufe}</strong></span>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

export default function DocumentExtractor() {
  const queryClient = useQueryClient();
  const [file, setFile] = useState(null);
  const [extractResult, setExtractResult] = useState(null);
  const [editPolicies, setEditPolicies] = useState({});
  const [editPersons, setEditPersons] = useState({});
  const [customerMatches, setCustomerMatches] = useState([]);
  const [selectedCustomerId, setSelectedCustomerId] = useState(null);
  const [saved, setSaved] = useState(false);

  const { data: allCustomers = [] } = useQuery({
    queryKey: ['customers', 'all'],
    queryFn: () => base44.entities.Customer.list(null, 500),
    staleTime: 5 * 60 * 1000,
  });

  const uploadMutation = useMutation({
    mutationFn: async (f) => {
      const { file_url } = await base44.integrations.Core.UploadFile({ file: f });
      return file_url;
    }
  });

  const extractMutation = useMutation({
    mutationFn: async (file_url) => {
      const res = await base44.functions.invoke('extractInsuranceDocument', { file_url, file_name: file?.name });
      return res.data;
    },
    onSuccess: (data) => {
      if (!data.success) return;
      setExtractResult(data.data);
      setEditPolicies({});
      setEditPersons({});
      setSaved(false);

      // Auto-Matching gegen Kundenstamm
      const persons = data.data.persons || [];
      const matches = [];
      persons.forEach((p, pi) => {
        if (!p.nachname) return;
        const found = allCustomers.filter(c =>
          c.last_name?.toLowerCase() === p.nachname?.toLowerCase() &&
          (!p.plz || c.zip_code === p.plz)
        );
        found.forEach(c => matches.push({ person_index: pi, customer: c }));
      });
      setCustomerMatches(matches);
      if (matches.length === 1) setSelectedCustomerId(matches[0].customer.id);
    }
  });

  const saveMutation = useMutation({
    mutationFn: async () => {
      const data = extractResult;
      const policies = (data.policies || []).map((p, i) => ({ ...p, ...(editPolicies[i] || {}) }));

      // Für jede Police einen Vertrag erstellen
      for (const pol of policies) {
        const personIdx = pol.person_index ?? 0;
        const person = (data.persons || [])[personIdx] || {};
        const merged = { ...person, ...(editPersons[personIdx] || {}) };

        await base44.entities.Contract.create({
          customer_id: selectedCustomerId || null,
          customer_name: selectedCustomerId
            ? allCustomers.find(c => c.id === selectedCustomerId)?.first_name + ' ' + allCustomers.find(c => c.id === selectedCustomerId)?.last_name
            : merged.vorname + ' ' + merged.nachname,
          insurer: data.versicherer || pol.versicherer || '',
          policy_number: pol.polnummer || null,
          insurance_type: pol.typ === 'kvg' ? 'health' : 'other',
          sparte: pol.typ || 'other',
          product: pol.produkt_name || null,
          premium_monthly: pol.praemie_netto || pol.praemie_brutto || null,
          premium_yearly: pol.praemie_netto ? Math.round(pol.praemie_netto * 12 * 100) / 100 : null,
          start_date: pol.gueltig_ab || null,
          end_date: pol.gueltig_bis || null,
          status: 'active',
          sparte_data: {
            franchise: pol.franchise || null,
            modell: pol.modell || null,
            unfall_gedeckt: pol.unfall_gedeckt,
            bonus_stufe: pol.bonus_stufe || null,
          },
          notes: `Importiert via Dokument-Extraktor. Konfidenz: ${Math.round((pol.konfidenz || 0) * 100)}%`,
          organization_id: allCustomers.find(c => c.id === selectedCustomerId)?.organization_id || '',
        });
      }
    },
    onSuccess: () => {
      setSaved(true);
      queryClient.invalidateQueries({ queryKey: ['contracts'] });
    }
  });

  const handleFile = (f) => {
    if (!f) return;
    setFile(f);
    setExtractResult(null);
    setCustomerMatches([]);
    setSelectedCustomerId(null);
    setSaved(false);
  };

  const handleExtract = async () => {
    if (!file) return;
    const url = await uploadMutation.mutateAsync(file);
    extractMutation.mutate(url);
  };

  const handlePolicyChange = (index, updated) => {
    setEditPolicies(prev => ({ ...prev, [index]: updated }));
  };

  const isLoading = uploadMutation.isPending || extractMutation.isPending;
  const data = extractResult;
  const unsichere = data?.unsichere_felder || [];

  return (
    <div className="page-enter flex flex-col h-full">
      <div className="px-6 py-5 border-b border-border bg-card shrink-0">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-primary/10 flex items-center justify-center">
            <FileText className="w-5 h-5 text-primary" />
          </div>
          <div>
            <h1 className="text-lg font-bold tracking-tight">Dokument-Extraktor</h1>
            <p className="text-xs text-muted-foreground">PDF hochladen → KI extrahiert → Admin prüft → Verträge speichern</p>
          </div>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-6 space-y-6 max-w-4xl mx-auto w-full">
        {/* Upload */}
        <div className="surface p-5 space-y-4">
          <h2 className="text-sm font-semibold">1. Dokument hochladen</h2>
          <div
            className="border-2 border-dashed border-border rounded-xl p-8 text-center cursor-pointer hover:border-primary/50 hover:bg-primary/5 transition-colors"
            onDragOver={e => e.preventDefault()}
            onDrop={e => { e.preventDefault(); handleFile(e.dataTransfer.files[0]); }}
            onClick={() => document.getElementById('doc-upload').click()}
          >
            <input id="doc-upload" type="file" accept=".pdf,.png,.jpg,.jpeg" className="hidden"
              onChange={e => handleFile(e.target.files[0])} />
            <Upload className="w-8 h-8 mx-auto mb-2 text-muted-foreground" />
            {file ? (
              <div className="flex items-center justify-center gap-2">
                <FileText className="w-4 h-4 text-primary" />
                <span className="text-sm font-medium text-primary">{file.name}</span>
                <button onClick={e => { e.stopPropagation(); setFile(null); setExtractResult(null); }}
                  className="text-muted-foreground hover:text-destructive"><X className="w-4 h-4" /></button>
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">PDF, PNG oder JPG hier ablegen oder klicken</p>
            )}
          </div>
          <Button onClick={handleExtract} disabled={!file || isLoading} className="w-full gap-2">
            {isLoading ? <><Loader2 className="w-4 h-4 animate-spin" /> Analysiere...</> : <><Search className="w-4 h-4" /> KI-Analyse starten</>}
          </Button>
          {(extractMutation.isError || (extractMutation.data && !extractMutation.data.success)) && (
            <div className="rounded-lg border border-red-200 bg-red-50 p-4 space-y-2">
              <p className="text-sm font-semibold text-red-700">Fehler bei der Extraktion</p>
              <p className="text-sm text-red-600">
                {extractMutation.data?.error || extractMutation.error?.message || 'Unbekannter Fehler'}
              </p>
              <details className="text-xs text-muted-foreground">
                <summary className="cursor-pointer">Debug-Info</summary>
                <p className="mt-1 font-mono">{file?.name} · {file?.type} · {file ? (file.size / 1024).toFixed(0) + ' KB' : '–'}</p>
              </details>
            </div>
          )}
        </div>

        {/* Ergebnis */}
        {data && (
          <>
            {/* Antrag/Vorgeburt Banner */}
            {(data.dokument_typ === 'antrag' || data.dokument_typ === 'antrag_vorgeburt' || data.dokument_typ?.includes('antrag')) && (
              <div className="rounded-lg border border-blue-200 bg-blue-50 p-3 text-sm text-blue-800">
                <strong>Antrag erkannt</strong>
                {data.persons?.some(p => p.vorname === 'Baby' || (p.geburtsdatum && p.geburtsdatum > new Date().toISOString().slice(0,10))) && (
                  <span> — Vorgeburtliche Anmeldung</span>
                )}
                {data.notizen && <div className="mt-1 text-xs text-blue-700">{data.notizen}</div>}
              </div>
            )}

            {/* Header */}
            <div className="surface p-4 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <Shield className="w-5 h-5 text-primary" />
                <div>
                  <p className="font-semibold">{data.versicherer || 'Unbekannter Versicherer'}</p>
                  <p className="text-xs text-muted-foreground">{data.dokument_typ} · {fmtDate(data.dokument_datum)}</p>
                </div>
              </div>
              <div className="flex items-center gap-3">
                {unsichere.length > 0 && (
                  <Badge variant="outline" className="border-amber-300 text-amber-700 bg-amber-50 gap-1">
                    <AlertTriangle className="w-3 h-3" /> {unsichere.length} unsichere Felder
                  </Badge>
                )}
                <KonfidenzBadge value={data.gesamt_konfidenz} />
                {data.total_praemie_monatlich && (
                  <span className="text-sm font-bold text-emerald-700">{fmtCHF(data.total_praemie_monatlich)}/Mt gesamt</span>
                )}
              </div>
            </div>

            {/* Personen-Matching */}
            <div className="surface p-5 space-y-3">
              <h2 className="text-sm font-semibold flex items-center gap-2">
                <User className="w-4 h-4 text-primary" /> 2. Kundenzuweisung
              </h2>
              {(data.persons || []).map((person, pi) => {
                const matches = customerMatches.filter(m => m.person_index === pi);
                return (
                  <div key={pi} className="p-3 rounded-lg border border-border bg-slate-50/50">
                    <div className="flex items-center gap-2 mb-2">
                      <span className="text-[10px] font-bold uppercase px-2 py-0.5 rounded-full bg-slate-200 text-slate-600">{person.rolle || 'Person ' + (pi + 1)}</span>
                      <span className="font-semibold text-sm">{person.vorname} {person.nachname}</span>
                      {person.geburtsdatum && <span className="text-xs text-muted-foreground">{fmtDate(person.geburtsdatum)}</span>}
                      {person.plz && <span className="text-xs text-muted-foreground">{person.plz} {person.ort}</span>}
                    </div>
                    {matches.length > 0 ? (
                      <div className="space-y-1">
                        <p className="text-xs text-muted-foreground mb-1">{matches.length} Treffer im Kundenstamm:</p>
                        {matches.map(m => (
                          <button key={m.customer.id}
                            onClick={() => setSelectedCustomerId(m.customer.id)}
                            className={cn('w-full text-left text-xs px-3 py-2 rounded border transition-colors flex items-center justify-between',
                              selectedCustomerId === m.customer.id
                                ? 'border-primary bg-primary/5 text-primary font-semibold'
                                : 'border-border hover:bg-muted'
                            )}>
                            <span>{m.customer.first_name} {m.customer.last_name} · {m.customer.zip_code} {m.customer.city}</span>
                            {selectedCustomerId === m.customer.id && <CheckCircle2 className="w-3.5 h-3.5" />}
                          </button>
                        ))}
                        <button onClick={() => setSelectedCustomerId(null)}
                          className={cn('w-full text-left text-xs px-3 py-2 rounded border transition-colors',
                            !selectedCustomerId ? 'border-amber-400 bg-amber-50 text-amber-700 font-semibold' : 'border-dashed border-border text-muted-foreground hover:bg-muted'
                          )}>
                          Neuen Kunden erstellen
                        </button>
                      </div>
                    ) : (
                      <p className="text-xs text-amber-700 bg-amber-50 px-3 py-2 rounded border border-amber-200">
                        Kein Treffer — Verträge werden ohne Kundenzuweisung gespeichert (kann nachträglich gesetzt werden)
                      </p>
                    )}
                  </div>
                );
              })}
            </div>

            {/* Polices */}
            <div className="space-y-3">
              <h2 className="text-sm font-semibold flex items-center gap-2">
                <FileText className="w-4 h-4 text-primary" /> 3. Extrahierte Polices ({(data.policies || []).length})
              </h2>
              {(data.policies || []).map((pol, i) => (
                <PolicyCard
                  key={i}
                  policy={pol}
                  index={i}
                  unsichere={unsichere}
                  editData={editPolicies}
                  onChange={handlePolicyChange}
                />
              ))}
            </div>

            {/* Speichern */}
            <div className="surface p-4 flex items-center justify-between">
              {saved ? (
                <div className="flex items-center gap-2 text-emerald-700 font-semibold">
                  <CheckCircle2 className="w-5 h-5" />
                  {(data.policies || []).length} Verträge erfolgreich gespeichert!
                </div>
              ) : (
                <>
                  <p className="text-sm text-muted-foreground">
                    {(data.policies || []).length} Verträge werden{selectedCustomerId ? ' dem gewählten Kunden' : ' ohne Kundenzuweisung'} gespeichert
                  </p>
                  <Button onClick={() => saveMutation.mutate()} disabled={saveMutation.isPending} className="gap-2">
                    {saveMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                    Verträge speichern
                  </Button>
                </>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
}