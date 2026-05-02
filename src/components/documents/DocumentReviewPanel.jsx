import React, { useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { base44 } from '@/api/base44Client'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { AlertTriangle, CheckCircle2, Loader2, UserPlus, FileCheck, X, ChevronRight, Zap, Bug } from 'lucide-react'
import { ALL_SPARTEN } from '@/lib/insuranceSparten'

// ─── Field editor ────────────────────────────────────────────────────────────
function Field({ label, value, onChange, warn }) {
  return (
    <div className={`p-2.5 rounded-lg border ${warn ? 'border-amber-300 bg-amber-50' : value ? 'border-green-200 bg-green-50/40' : 'border-border bg-muted/20'}`}>
      <div className="flex items-center justify-between mb-1">
        <span className="text-xs font-medium text-muted-foreground">{label}</span>
        {warn && <AlertTriangle className="w-3 h-3 text-amber-500" />}
      </div>
      <Input
        value={value ?? ''}
        onChange={e => onChange(e.target.value)}
        className="h-7 text-sm"
        placeholder="–"
      />
    </div>
  )
}

// ─── Debug panel ─────────────────────────────────────────────────────────────
function DebugPanel({ raw, mapping, missingFields }) {
  return (
    <div className="mx-3 my-2 rounded-lg border border-slate-300 bg-slate-900 text-slate-100 text-xs overflow-auto max-h-64">
      <div className="px-3 py-1.5 border-b border-slate-700 font-semibold flex items-center gap-2">
        <Bug className="w-3 h-3" /> Debug Output
      </div>
      <div className="p-3 space-y-2">
        {missingFields?.length > 0 && (
          <div className="text-red-400">⚠ Fehlende Felder: {missingFields.join(', ')}</div>
        )}
        <div className="text-slate-400 font-semibold">Extrahiertes JSON:</div>
        <pre className="whitespace-pre-wrap text-green-300">{JSON.stringify(raw, null, 2)}</pre>
        <div className="text-slate-400 font-semibold mt-2">Mapping-Ergebnis:</div>
        <pre className="whitespace-pre-wrap text-yellow-300">{JSON.stringify(mapping, null, 2)}</pre>
      </div>
    </div>
  )
}

// ─── Main component ───────────────────────────────────────────────────────────
export default function DocumentReviewPanel({ document, onClose, onSaved }) {
  const queryClient = useQueryClient()
  const [extraction, setExtraction] = useState(null)    // raw API response
  const [form, setForm] = useState(null)                // editable flat form state
  const [extracting, setExtracting] = useState(false)
  const [saving, setSaving] = useState(false)
  const [autoSaved, setAutoSaved] = useState(false)
  const [matchCustomer, setMatchCustomer] = useState(null)
  const [createNew, setCreateNew] = useState(false)
  const [showDebug, setShowDebug] = useState(false)

  const { data: customers = [] } = useQuery({
    queryKey: ['customers'],
    queryFn: () => base44.entities.Customer.list(),
  })

  // ── Map structured response → flat form fields ───────────────────────────
  const buildForm = (s) => ({
    first_name: s.person?.vorname ?? null,
    last_name: s.person?.nachname ?? null,
    birthdate: s.person?.geburtsdatum ?? null,
    phone: s.kontaktperson?.telefon ?? null,
    email: s.kontaktperson?.email ?? null,
    street: s.adresse?.strasse ?? null,
    zip_code: s.adresse?.plz ?? null,
    city: s.adresse?.ort ?? null,
    insurer: s.versicherung?.gesellschaft ?? null,
    insurance_type: s.versicherung?.sparte ?? null,
    contract_start_date: s.versicherung?.beginn ?? null,
    estimated_premium_monthly: s.versicherung?.praemie_monat ?? null,
    payment_interval: s.versicherung?.zahlungsintervall ?? null,
  })

  const buildMapping = (f) => ({
    'person.vorname → Customer.first_name': f?.first_name,
    'person.nachname → Customer.last_name': f?.last_name,
    'person.geburtsdatum → Customer.birthdate': f?.birthdate,
    'kontaktperson.telefon → Customer.phone': f?.phone,
    'kontaktperson.email → Customer.email': f?.email,
    'adresse.strasse → Customer.street': f?.street,
    'adresse.plz → Customer.zip_code': f?.zip_code,
    'adresse.ort → Customer.city': f?.city,
    'versicherung.gesellschaft → Application.insurer': f?.insurer,
    'versicherung.sparte → Application.sparte': f?.insurance_type,
    'versicherung.beginn → Application.contract_start_date': f?.contract_start_date,
    'versicherung.praemie_monat → Application.estimated_premium_monthly': f?.estimated_premium_monthly,
  })

  // ── Extraction ────────────────────────────────────────────────────────────
  const handleExtract = async () => {
    setExtracting(true)
    const res = await base44.functions.invoke('extractApplicationData', {
      file_url: document.file_url,
      file_name: document.name,
    })
    setExtracting(false)

    if (!res.data?.success) return

    const data = res.data
    const flatForm = buildForm(data.structured)
    setExtraction(data)
    setForm(flatForm)

    // Auto-match customer by name
    const fn = flatForm.first_name
    const ln = flatForm.last_name
    if (fn && ln) {
      const found = customers.find(c =>
        c.first_name?.toLowerCase() === fn.toLowerCase() &&
        c.last_name?.toLowerCase() === ln.toLowerCase()
      )
      if (found) setMatchCustomer(found)
    }

    // Auto-save if confidence ≥ 85 AND customer match found
    if (data.auto_save && flatForm.first_name && flatForm.last_name) {
      const found = customers.find(c =>
        c.first_name?.toLowerCase() === (fn || '').toLowerCase() &&
        c.last_name?.toLowerCase() === (ln || '').toLowerCase()
      )
      if (found) {
        await doSave(flatForm, found.id, found)
        setAutoSaved(true)
      }
    }
  }

  // ── Save logic ────────────────────────────────────────────────────────────
  const doSave = async (f, customerId, existingCustomer) => {
    setSaving(true)
    let cid = customerId

    if (!cid && createNew) {
      const newC = await base44.entities.Customer.create({
        first_name: f.first_name || '',
        last_name: f.last_name || '',
        birthdate: f.birthdate || undefined,
        street: f.street || undefined,
        zip_code: f.zip_code || undefined,
        city: f.city || undefined,
        phone: f.phone || undefined,
        email: f.email || undefined,
        status: 'active',
      })
      cid = newC.id
    }

    if (!cid) { setSaving(false); return }

    const customer = existingCustomer || customers.find(c => c.id === cid)
    const customerName = customer
      ? `${customer.first_name} ${customer.last_name}`
      : `${f.first_name || ''} ${f.last_name || ''}`.trim()

    const sparteMatch = ALL_SPARTEN.find(s =>
      s.label?.toLowerCase().includes((f.insurance_type || '').toLowerCase()) ||
      s.value?.toLowerCase() === (f.insurance_type || '').toLowerCase()
    )
    const sparte = sparteMatch?.value || f.insurance_type || ''

    await base44.entities.Application.create({
      customer_id: cid,
      customer_name: customerName,
      insurer: f.insurer || 'Andere',
      sparte,
      insurance_type: sparte,
      contract_start_date: f.contract_start_date || undefined,
      estimated_premium_monthly: f.estimated_premium_monthly ? Number(f.estimated_premium_monthly) : undefined,
      sparte_data: {
        payment_interval: f.payment_interval || undefined,
      },
      status: 'draft',
      notes: `Automatisch aus Dokument extrahiert: ${document.name}`,
    })

    await base44.entities.Document.update(document.id, {
      customer_id: cid,
      customer_name: customerName,
    })

    queryClient.invalidateQueries({ queryKey: ['applications'] })
    queryClient.invalidateQueries({ queryKey: ['documents'] })
    setSaving(false)
    onSaved?.()
    onClose()
  }

  const handleManualSave = () => doSave(form, matchCustomer?.id, matchCustomer)

  const setField = (key, val) => setForm(prev => ({ ...prev, [key]: val }))

  const confidence = extraction?.confidence ?? 0
  const requiresReview = extraction?.requires_review ?? false
  const missingFields = extraction?.missing_fields ?? []

  // ─── Render ─────────────────────────────────────────────────────────────
  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b bg-card">
        <div>
          <h2 className="font-semibold text-sm">{document.name}</h2>
          <p className="text-xs text-muted-foreground">KI-Datenextraktion & Antragserstellung</p>
        </div>
        <div className="flex items-center gap-2">
          {extraction && (
            <button
              onClick={() => setShowDebug(p => !p)}
              className={`text-xs flex items-center gap-1 px-2 py-1 rounded border transition-colors ${showDebug ? 'bg-slate-800 text-white border-slate-700' : 'text-muted-foreground border-border hover:bg-muted'}`}
            >
              <Bug className="w-3 h-3" /> Debug
            </button>
          )}
          <Button variant="ghost" size="icon" onClick={onClose}><X className="w-4 h-4" /></Button>
        </div>
      </div>

      {/* Split layout */}
      <div className="flex flex-1 overflow-hidden">
        {/* Left: Document */}
        <div className="w-1/2 border-r flex flex-col bg-muted/20">
          <div className="px-3 py-2 border-b text-xs font-semibold text-muted-foreground bg-muted/40">Originaldokument</div>
          <div className="flex-1 overflow-auto p-2">
            {document.file_url?.match(/\.(jpg|jpeg|png)$/i) ? (
              <img src={document.file_url} alt="Dokument" className="w-full rounded shadow" />
            ) : (
              <iframe src={document.file_url} className="w-full h-full rounded border" title="Dokument" style={{ minHeight: '500px' }} />
            )}
          </div>
        </div>

        {/* Right: Extraction panel */}
        <div className="w-1/2 flex flex-col overflow-hidden">
          {/* Confidence bar */}
          <div className="px-3 py-2 border-b bg-muted/40 flex items-center justify-between">
            <span className="text-xs font-semibold text-muted-foreground">Extrahierte Daten</span>
            {extraction && (
              <div className="flex items-center gap-2">
                <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${confidence >= 85 ? 'bg-green-100 text-green-700' : confidence >= 60 ? 'bg-amber-100 text-amber-700' : 'bg-red-100 text-red-700'}`}>
                  {confidence >= 85 ? <CheckCircle2 className="w-3 h-3 inline mr-1" /> : <AlertTriangle className="w-3 h-3 inline mr-1" />}
                  Konfidenz {confidence}%
                </span>
                {requiresReview && (
                  <span className="text-xs bg-amber-100 text-amber-700 px-2 py-0.5 rounded-full border border-amber-200">Prüfung erforderlich</span>
                )}
              </div>
            )}
          </div>

          {!extraction ? (
            <div className="flex-1 flex flex-col items-center justify-center gap-4 p-6">
              {extracting ? (
                <>
                  <Loader2 className="w-10 h-10 animate-spin text-primary" />
                  <div className="text-center">
                    <p className="font-semibold">KI analysiert Dokument...</p>
                    <p className="text-sm text-muted-foreground mt-1">Strukturierte Datenextraktion läuft</p>
                  </div>
                </>
              ) : (
                <>
                  <div className="w-16 h-16 rounded-2xl bg-primary/10 flex items-center justify-center">
                    <FileCheck className="w-8 h-8 text-primary" />
                  </div>
                  <div className="text-center">
                    <p className="font-semibold">Strukturierte Datenextraktion</p>
                    <p className="text-sm text-muted-foreground mt-1">Alle Felder werden automatisch erkannt und ins Antragssystem übertragen</p>
                    <p className="text-xs text-muted-foreground mt-1">Ab 85% Konfidenz: automatisches Speichern</p>
                  </div>
                  <Button onClick={handleExtract} className="gap-2">
                    <Zap className="w-4 h-4" /> Extraktion starten
                  </Button>
                </>
              )}
            </div>
          ) : (
            <div className="flex-1 overflow-auto">
              {/* Debug panel */}
              {showDebug && (
                <DebugPanel
                  raw={extraction.structured}
                  mapping={buildMapping(form)}
                  missingFields={missingFields}
                />
              )}

              {/* Auto-saved banner */}
              {autoSaved && (
                <div className="mx-3 mt-3 p-2.5 bg-green-50 border border-green-200 rounded-lg flex items-center gap-2 text-xs text-green-700">
                  <CheckCircle2 className="w-4 h-4" />
                  <span>Antrag wurde automatisch gespeichert (Konfidenz ≥ 85%)</span>
                </div>
              )}

              {/* Review warning */}
              {requiresReview && (
                <div className="mx-3 mt-3 p-2.5 bg-amber-50 border border-amber-200 rounded-lg flex items-center gap-2 text-xs text-amber-700">
                  <AlertTriangle className="w-4 h-4" />
                  <span>Konfidenz unter 85% – bitte Felder prüfen und manuell speichern.</span>
                </div>
              )}

              {/* Section: Person */}
              <div className="px-3 pt-3">
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">Personendaten</p>
                <div className="grid grid-cols-2 gap-2">
                  <Field label="Vorname" value={form.first_name} onChange={v => setField('first_name', v)} />
                  <Field label="Nachname" value={form.last_name} onChange={v => setField('last_name', v)} />
                  <Field label="Geburtsdatum" value={form.birthdate} onChange={v => setField('birthdate', v)} />
                  <Field label="Telefon" value={form.phone} onChange={v => setField('phone', v)} />
                  <Field label="E-Mail" value={form.email} onChange={v => setField('email', v)} />
                  <Field label="Strasse" value={form.street} onChange={v => setField('street', v)} />
                  <Field label="PLZ" value={form.zip_code} onChange={v => setField('zip_code', v)} />
                  <Field label="Ort" value={form.city} onChange={v => setField('city', v)} />
                </div>
              </div>

              {/* Section: Insurance */}
              <div className="px-3 pt-3">
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">Versicherung</p>
                <div className="grid grid-cols-2 gap-2">
                  <Field label="Gesellschaft" value={form.insurer} onChange={v => setField('insurer', v)} warn={!form.insurer} />
                  <Field label="Sparte" value={form.insurance_type} onChange={v => setField('insurance_type', v)} />
                  <Field label="Vertragsbeginn" value={form.contract_start_date} onChange={v => setField('contract_start_date', v)} />
                  <Field label="Monatsprämie (CHF)" value={form.estimated_premium_monthly} onChange={v => setField('estimated_premium_monthly', v)} />
                  <Field label="Zahlungsintervall" value={form.payment_interval} onChange={v => setField('payment_interval', v)} />
                </div>
              </div>

              {/* Customer matching */}
              <div className="mx-3 mt-3 p-3 border rounded-lg bg-card">
                <p className="text-xs font-semibold mb-2">Kundenzuordnung</p>
                {matchCustomer ? (
                  <div className="flex items-center gap-2 p-2 bg-green-50 border border-green-200 rounded-lg">
                    <CheckCircle2 className="w-4 h-4 text-green-600 flex-shrink-0" />
                    <div className="flex-1 text-xs">
                      <p className="font-medium text-green-800">Kunde gefunden: {matchCustomer.first_name} {matchCustomer.last_name}</p>
                      <button className="text-green-600 underline mt-0.5" onClick={() => { setMatchCustomer(null); setCreateNew(false) }}>Ändern</button>
                    </div>
                  </div>
                ) : createNew ? (
                  <div className="flex items-center gap-2 p-2 bg-blue-50 border border-blue-200 rounded-lg">
                    <UserPlus className="w-4 h-4 text-blue-600 flex-shrink-0" />
                    <div className="flex-1 text-xs">
                      <p className="font-medium text-blue-800">Neuer Kunde wird erstellt</p>
                      <button className="text-blue-600 underline" onClick={() => setCreateNew(false)}>Abbrechen</button>
                    </div>
                  </div>
                ) : (
                  <div className="space-y-2">
                    <Select onValueChange={v => setMatchCustomer(customers.find(c => c.id === v))}>
                      <SelectTrigger className="h-8 text-xs"><SelectValue placeholder="Bestehendem Kunden zuordnen..." /></SelectTrigger>
                      <SelectContent>
                        {customers.filter(c => !c.is_family_member).map(c => (
                          <SelectItem key={c.id} value={c.id}>{c.first_name} {c.last_name}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <button className="text-xs text-primary underline flex items-center gap-1" onClick={() => setCreateNew(true)}>
                      <UserPlus className="w-3 h-3" /> Neuen Kunden anlegen
                    </button>
                  </div>
                )}
              </div>

              {/* Save button (only shown if not auto-saved) */}
              {!autoSaved && (
                <div className="mx-3 my-3">
                  <Button
                    className="w-full gap-2"
                    onClick={handleManualSave}
                    disabled={saving || (!matchCustomer && !createNew)}
                  >
                    {saving
                      ? <><Loader2 className="w-4 h-4 animate-spin" /> Speichern...</>
                      : <><ChevronRight className="w-4 h-4" /> Antrag erstellen & speichern</>
                    }
                  </Button>
                  {!matchCustomer && !createNew && (
                    <p className="text-xs text-muted-foreground text-center mt-1">Bitte Kunden auswählen oder neu anlegen</p>
                  )}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}