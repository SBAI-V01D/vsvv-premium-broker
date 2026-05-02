import React, { useState, useEffect } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { base44 } from '@/api/base44Client'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { AlertTriangle, CheckCircle2, Loader2, UserPlus, FileCheck, X, ChevronRight, Zap, Bug, Package, Users } from 'lucide-react'
import { ALL_SPARTEN } from '@/lib/insuranceSparten'
import { matchCustomers } from '@/lib/customerMatcher'

// ─── Simple editable field ────────────────────────────────────────────────────
function Field({ label, value, onChange, warn }) {
  return (
    <div className={`p-2.5 rounded-lg border ${warn ? 'border-amber-300 bg-amber-50' : value ? 'border-green-200 bg-green-50/40' : 'border-border bg-muted/20'}`}>
      <div className="flex items-center justify-between mb-1">
        <span className="text-xs font-medium text-muted-foreground">{label}</span>
        {warn && <AlertTriangle className="w-3 h-3 text-amber-500" />}
      </div>
      <Input value={value ?? ''} onChange={e => onChange(e.target.value)} className="h-7 text-sm" placeholder="–" />
    </div>
  )
}

// ─── Product list display / edit ──────────────────────────────────────────────
function ProdukteListe({ produkte, onChange }) {
  const handleChange = (idx, key, val) => {
    const updated = produkte.map((p, i) => i === idx ? { ...p, [key]: val } : p)
    onChange(updated)
  }
  const handleAdd = () => onChange([...produkte, { typ: 'Zusatz', name: '' }])
  const handleRemove = (idx) => onChange(produkte.filter((_, i) => i !== idx))

  return (
    <div className="space-y-1.5">
      {produkte.map((p, i) => (
        <div key={i} className="flex gap-1.5 items-center">
          <select
            value={p.typ}
            onChange={e => handleChange(i, 'typ', e.target.value)}
            className="h-7 text-xs rounded-md border border-input bg-transparent px-2 w-36 flex-shrink-0"
          >
            <option>Grundversicherung</option>
            <option>Zusatz</option>
            <option>Sonstige</option>
          </select>
          <Input
            value={p.name}
            onChange={e => handleChange(i, 'name', e.target.value)}
            className="h-7 text-xs flex-1"
            placeholder="Produktname"
          />
          <button onClick={() => handleRemove(i)} className="text-muted-foreground hover:text-destructive text-xs px-1">✕</button>
        </div>
      ))}
      <button onClick={handleAdd} className="text-xs text-primary underline flex items-center gap-1 mt-1">
        + Produkt hinzufügen
      </button>
    </div>
  )
}

// ─── Debug panel ─────────────────────────────────────────────────────────────
function DebugPanel({ raw, mapping, missingFields }) {
  return (
    <div className="mx-3 my-2 rounded-lg border border-slate-700 bg-slate-900 text-slate-100 text-xs overflow-auto max-h-56">
      <div className="px-3 py-1.5 border-b border-slate-700 font-semibold flex items-center gap-2">
        <Bug className="w-3 h-3" /> Debug Output
      </div>
      <div className="p-3 space-y-2">
        {missingFields?.length > 0 && (
          <div className="text-red-400">⚠ Fehlende Pflichtfelder: {missingFields.join(', ')}</div>
        )}
        <div className="text-slate-400 font-semibold">Extrahiertes JSON:</div>
        <pre className="whitespace-pre-wrap text-green-300">{JSON.stringify(raw, null, 2)}</pre>
        <div className="text-slate-400 font-semibold mt-2">Mapping:</div>
        <pre className="whitespace-pre-wrap text-yellow-300">{JSON.stringify(mapping, null, 2)}</pre>
      </div>
    </div>
  )
}

// ─── Main component ───────────────────────────────────────────────────────────
export default function DocumentReviewPanel({ document, onClose, onSaved }) {
  const queryClient = useQueryClient()
  const [extraction, setExtraction] = useState(null)
  const [form, setForm] = useState(null)
  const [produkte, setProdukte] = useState([])
  const [extracting, setExtracting] = useState(false)
  const [saving, setSaving] = useState(false)
  const [autoSaved, setAutoSaved] = useState(false)
  const [matchCustomer, setMatchCustomer] = useState(null)
  const [matchScore, setMatchScore] = useState(0)
  const [matchCandidates, setMatchCandidates] = useState([])   // [{customer, score}]
  const [matchMode, setMatchMode] = useState('pending')        // 'pending'|'auto'|'candidates'|'none'|'confirmed'|'new'
  const [createNew, setCreateNew] = useState(false)
  const [showDebug, setShowDebug] = useState(false)

  const { data: customers = [] } = useQuery({
    queryKey: ['customers'],
    queryFn: () => base44.entities.Customer.list(),
  })

  // Pre-set customer from document if already linked
  React.useEffect(() => {
    if (document?.customer_id && customers.length > 0) {
      const found = customers.find(c => c.id === document.customer_id)
      if (found) setMatchCustomer(found)
    }
  }, [document?.customer_id, customers])

  const buildForm = (s) => ({
    first_name: s.person?.vorname ?? null,
    last_name:  s.person?.nachname ?? null,
    birthdate:  s.person?.geburtsdatum ?? null,
    phone:      s.kontaktperson?.telefon ?? null,
    email:      s.kontaktperson?.email ?? null,
    street:     s.adresse?.strasse ?? null,
    zip_code:   s.adresse?.plz ?? null,
    city:       s.adresse?.ort ?? null,
    insurer:    s.versicherung?.gesellschaft ?? null,
    contract_start_date: s.versicherung?.beginn ?? null,
    estimated_premium_monthly: s.versicherung?.praemie_monat ?? null,
    franchise:      s.versicherung?.franchise ?? null,
    kassenmodell:   s.versicherung?.kassenmodell ?? null,
  })

  const buildMapping = (f) => ({
    'person.vorname → first_name': f?.first_name,
    'person.nachname → last_name': f?.last_name,
    'person.geburtsdatum → birthdate': f?.birthdate,
    'adresse.strasse → street': f?.street,
    'adresse.plz → zip_code': f?.zip_code,
    'adresse.ort → city': f?.city,
    'kontaktperson.telefon → phone': f?.phone,
    'kontaktperson.email → email': f?.email,
    'versicherung.gesellschaft → insurer': f?.insurer,
    'versicherung.beginn → contract_start_date': f?.contract_start_date,
    'versicherung.franchise → sparte_data.franchise': f?.franchise,
    'versicherung.kassenmodell → sparte_data.model': f?.kassenmodell,
    'versicherung.produkte → sparte_data.produkte': produkte,
    'ageGroup → sparte_data.age_group': extraction?.age_group,
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
    const flat = buildForm(data.structured)
    setExtraction(data)
    setForm(flat)
    setProdukte(data.structured?.versicherung?.produkte || [])

    // Run multi-stage scoring match
    const { autoMatch, candidates, topScore } = matchCustomers(flat, customers)
    setMatchCandidates(candidates)
    setMatchScore(topScore)

    if (autoMatch) {
      setMatchCustomer(autoMatch)
      setMatchMode('auto')
    } else if (candidates.length > 0 && topScore >= 70) {
      setMatchMode('candidates')
    } else {
      setMatchMode('none')
    }

    // Auto-save if confidence ≥ 85 and auto-matched customer
    if (data.auto_save && autoMatch) {
      await doSave(flat, data.structured?.versicherung?.produkte || [], data.age_group, autoMatch.id, autoMatch)
      setAutoSaved(true)
    }
  }

  // ── Save ─────────────────────────────────────────────────────────────────
  const doSave = async (f, prods, ageGroup, customerId, existingCustomer) => {
    setSaving(true)
    let cid = customerId

    if (!cid && createNew) {
      const newC = await base44.entities.Customer.create({
        first_name: f.first_name || '',
        last_name:  f.last_name || '',
        birthdate:  f.birthdate || undefined,
        street:     f.street || undefined,
        zip_code:   f.zip_code || undefined,
        city:       f.city || undefined,
        phone:      f.phone || undefined,
        email:      f.email || undefined,
        status: 'active',
      })
      cid = newC.id
    }

    if (!cid) { setSaving(false); return }

    const customer = existingCustomer || customers.find(c => c.id === cid)
    const customerName = customer
      ? `${customer.first_name} ${customer.last_name}`
      : `${f.first_name || ''} ${f.last_name || ''}`.trim()

    // Determine sparte
    const sparteMatch = ALL_SPARTEN.find(s =>
      s.label?.toLowerCase().includes((f.insurance_type || '').toLowerCase()) ||
      s.value?.toLowerCase() === (f.insurance_type || '').toLowerCase()
    )
    const sparte = sparteMatch?.value || 'kvg'

    // Validation status
    const missingRequired = !f.first_name || !f.last_name || !f.birthdate || !f.contract_start_date
    const appStatus = missingRequired ? 'draft' : 'draft'
    const appNotes = [
      `Automatisch aus Dokument extrahiert: ${document.name}`,
      missingRequired ? '⚠ Unvollständig – Pflichtfelder fehlen' : null,
    ].filter(Boolean).join('\n')

    const newApp = await base44.entities.Application.create({
      customer_id: cid,
      customer_name: customerName,
      insurer: f.insurer || 'Andere',
      sparte,
      insurance_type: sparte,
      contract_start_date: f.contract_start_date || undefined,
      estimated_premium_monthly: f.estimated_premium_monthly ? Number(f.estimated_premium_monthly) : undefined,
      sparte_data: {
        franchise:    f.franchise || undefined,
        model:        f.kassenmodell || undefined,
        age_group:    ageGroup || undefined,
        produkte:     prods.length > 0 ? prods : undefined,
      },
      status: appStatus,
      custom_status: missingRequired ? 'unvollstaendig' : undefined,
      notes: appNotes,
    })

    // Link document to application and customer
    await base44.entities.Document.update(document.id, {
      customer_id:  cid,
      customer_name: customerName,
      linked_application_id: newApp.id,
      doc_type: 'antrag',
      classification_status: 'klassifiziert',
    })

    queryClient.invalidateQueries({ queryKey: ['applications'] })
    queryClient.invalidateQueries({ queryKey: ['documents'] })
    setSaving(false)
    onSaved?.()
    onClose()
  }

  const handleManualSave = () =>
    doSave(form, produkte, extraction?.age_group, matchCustomer?.id, matchCustomer)

  const handleConfirmCandidate = (cust) => {
    setMatchCustomer(cust)
    setMatchMode('confirmed')
  }

  const handleChangeCustomer = () => {
    setMatchCustomer(null)
    setCreateNew(false)
    setMatchMode('candidates')
  }

  const setField = (key, val) => setForm(prev => ({ ...prev, [key]: val }))

  const confidence = extraction?.confidence ?? 0
  const status = extraction?.status ?? null
  const missingFields = extraction?.missing_fields ?? []
  const ageGroup = extraction?.age_group

  // ─── Render ───────────────────────────────────────────────────────────────
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
        {/* Left: Document preview */}
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
          {/* Confidence + status bar */}
          <div className="px-3 py-2 border-b bg-muted/40 flex items-center justify-between gap-2 flex-wrap">
            <span className="text-xs font-semibold text-muted-foreground">Extrahierte Daten</span>
            {extraction && (
              <div className="flex items-center gap-2 flex-wrap">
                <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${confidence >= 85 ? 'bg-green-100 text-green-700' : confidence >= 60 ? 'bg-amber-100 text-amber-700' : 'bg-red-100 text-red-700'}`}>
                  {confidence >= 85 ? <CheckCircle2 className="w-3 h-3 inline mr-1" /> : <AlertTriangle className="w-3 h-3 inline mr-1" />}
                  {confidence}%
                </span>
                {status === 'unvollstaendig' && <span className="text-xs bg-red-100 text-red-700 px-2 py-0.5 rounded-full border border-red-200">Unvollständig</span>}
                {status === 'pruefung_erforderlich' && <span className="text-xs bg-amber-100 text-amber-700 px-2 py-0.5 rounded-full border border-amber-200">Prüfung erforderlich</span>}
                {ageGroup && <span className="text-xs bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full">{ageGroup}</span>}
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
                    <p className="text-sm text-muted-foreground mt-1">Strukturierte Datenextraktion inkl. Produkte & Franchise</p>
                  </div>
                </>
              ) : (
                <>
                  <div className="w-16 h-16 rounded-2xl bg-primary/10 flex items-center justify-center">
                    <FileCheck className="w-8 h-8 text-primary" />
                  </div>
                  <div className="text-center">
                    <p className="font-semibold">Vollständige Datenextraktion</p>
                    <p className="text-sm text-muted-foreground mt-1">Person, Adresse, Versicherung, Franchise, Modell & Produkte</p>
                    <p className="text-xs text-muted-foreground mt-1">≥ 85% Konfidenz → automatisches Speichern</p>
                  </div>
                  <Button onClick={handleExtract} className="gap-2">
                    <Zap className="w-4 h-4" /> Extraktion starten
                  </Button>
                </>
              )}
            </div>
          ) : (
            <div className="flex-1 overflow-auto">
              {showDebug && (
                <DebugPanel raw={extraction.structured} mapping={buildMapping(form)} missingFields={missingFields} />
              )}

              {/* Banners */}
              {autoSaved && (
                <div className="mx-3 mt-3 p-2.5 bg-green-50 border border-green-200 rounded-lg flex items-center gap-2 text-xs text-green-700">
                  <CheckCircle2 className="w-4 h-4" /> Antrag automatisch erstellt & Dokument verknüpft (Konfidenz ≥ 85%)
                </div>
              )}
              {status === 'unvollstaendig' && (
                <div className="mx-3 mt-3 p-2.5 bg-red-50 border border-red-200 rounded-lg flex items-center gap-2 text-xs text-red-700">
                  <AlertTriangle className="w-4 h-4" /> Pflichtfelder fehlen: {missingFields.join(', ')} – bitte ergänzen.
                </div>
              )}
              {status === 'pruefung_erforderlich' && (
                <div className="mx-3 mt-3 p-2.5 bg-amber-50 border border-amber-200 rounded-lg flex items-center gap-2 text-xs text-amber-700">
                  <AlertTriangle className="w-4 h-4" /> Konfidenz unter 85% – bitte Felder prüfen und manuell speichern.
                </div>
              )}

              {/* Person */}
              <div className="px-3 pt-3">
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">Personendaten</p>
                <div className="grid grid-cols-2 gap-2">
                  <Field label="Vorname *" value={form.first_name} onChange={v => setField('first_name', v)} warn={!form.first_name} />
                  <Field label="Nachname *" value={form.last_name} onChange={v => setField('last_name', v)} warn={!form.last_name} />
                  <Field label="Geburtsdatum *" value={form.birthdate} onChange={v => setField('birthdate', v)} warn={!form.birthdate} />
                  <Field label="Telefon" value={form.phone} onChange={v => setField('phone', v)} />
                  <Field label="E-Mail" value={form.email} onChange={v => setField('email', v)} />
                  <Field label="Strasse" value={form.street} onChange={v => setField('street', v)} />
                  <Field label="PLZ" value={form.zip_code} onChange={v => setField('zip_code', v)} />
                  <Field label="Ort" value={form.city} onChange={v => setField('city', v)} />
                </div>
              </div>

              {/* Insurance */}
              <div className="px-3 pt-3">
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">Versicherung</p>
                <div className="grid grid-cols-2 gap-2">
                  <Field label="Gesellschaft" value={form.insurer} onChange={v => setField('insurer', v)} warn={!form.insurer} />
                  <Field label="Vertragsbeginn *" value={form.contract_start_date} onChange={v => setField('contract_start_date', v)} warn={!form.contract_start_date} />
                  <Field label="Monatsprämie (CHF)" value={form.estimated_premium_monthly} onChange={v => setField('estimated_premium_monthly', v)} />
                  <Field label="Franchise" value={form.franchise} onChange={v => setField('franchise', v)} />
                  <Field label="Kassenmodell" value={form.kassenmodell} onChange={v => setField('kassenmodell', v)} />
                  {ageGroup && (
                    <div className="p-2.5 rounded-lg border border-blue-200 bg-blue-50">
                      <p className="text-xs font-medium text-muted-foreground mb-1">Altersgruppe</p>
                      <p className="text-sm font-semibold text-blue-700">{ageGroup}</p>
                    </div>
                  )}
                </div>
              </div>

              {/* Products */}
              <div className="px-3 pt-3">
                <div className="flex items-center gap-2 mb-2">
                  <Package className="w-3.5 h-3.5 text-muted-foreground" />
                  <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Produkte / Tarife</p>
                </div>
                {produkte.length === 0 ? (
                  <p className="text-xs text-muted-foreground italic mb-2">Keine Produkte erkannt</p>
                ) : null}
                <ProdukteListe produkte={produkte} onChange={setProdukte} />
              </div>

              {/* Customer assignment */}
              <div className="mx-3 mt-3 p-3 border rounded-lg bg-card">
                <div className="flex items-center justify-between mb-2">
                  <p className="text-xs font-semibold flex items-center gap-1.5"><Users className="w-3.5 h-3.5" /> Kundenzuordnung</p>
                  {matchScore > 0 && (
                    <span className={`text-xs px-1.5 py-0.5 rounded-full font-medium ${matchScore >= 90 ? 'bg-green-100 text-green-700' : matchScore >= 70 ? 'bg-amber-100 text-amber-700' : 'bg-red-100 text-red-700'}`}>
                      Score {matchScore}/100
                    </span>
                  )}
                </div>

                {/* AUTO match (score ≥ 90) – confirmed or pending */}
                {(matchMode === 'auto' || matchMode === 'confirmed') && matchCustomer && (
                  <div className="space-y-2">
                    <div className="flex items-center gap-2 p-2 bg-green-50 border border-green-200 rounded-lg">
                      <CheckCircle2 className="w-4 h-4 text-green-600 flex-shrink-0" />
                      <div className="flex-1 text-xs">
                        <p className="font-medium text-green-800">
                          {matchMode === 'auto' ? 'Automatisch erkannt: ' : 'Ausgewählt: '}
                          {matchCustomer.first_name} {matchCustomer.last_name}
                        </p>
                        {matchCustomer.birthdate && <p className="text-green-600">Geb.: {matchCustomer.birthdate}</p>}
                        {matchCustomer.email && <p className="text-green-600">{matchCustomer.email}</p>}
                      </div>
                      <button className="text-xs text-muted-foreground underline flex-shrink-0" onClick={handleChangeCustomer}>Ändern</button>
                    </div>
                  </div>
                )}

                {/* CANDIDATES (score 70–89) – show top 3 */}
                {matchMode === 'candidates' && (
                  <div className="space-y-2">
                    <p className="text-xs text-amber-700 flex items-center gap-1">
                      <AlertTriangle className="w-3 h-3" /> Mögliche Übereinstimmungen – bitte bestätigen:
                    </p>
                    {matchCandidates.map(({ customer: c, score }) => (
                      <div key={c.id} className="flex items-center gap-2 p-2 border rounded-lg hover:bg-muted/40 cursor-pointer" onClick={() => handleConfirmCandidate(c)}>
                        <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0 ${score >= 90 ? 'bg-green-100 text-green-700' : score >= 70 ? 'bg-amber-100 text-amber-700' : 'bg-slate-100 text-slate-600'}`}>
                          {score}
                        </div>
                        <div className="flex-1 text-xs min-w-0">
                          <p className="font-medium truncate">{c.first_name} {c.last_name}</p>
                          <p className="text-muted-foreground truncate">{c.birthdate || ''} {c.zip_code ? `· PLZ ${c.zip_code}` : ''}</p>
                        </div>
                        <ChevronRight className="w-3.5 h-3.5 text-muted-foreground flex-shrink-0" />
                      </div>
                    ))}
                    <div className="border-t pt-2 flex items-center justify-between">
                      <button className="text-xs text-primary underline" onClick={() => setMatchMode('manual')}>Andere Kunden durchsuchen</button>
                      <button className="text-xs text-muted-foreground underline" onClick={() => { setCreateNew(true); setMatchMode('new') }}>Neuen Kunden erstellen</button>
                    </div>
                  </div>
                )}

                {/* NO match (score < 70) */}
                {matchMode === 'none' && !createNew && (
                  <div className="space-y-2">
                    <div className="p-2 bg-red-50 border border-red-200 rounded-lg text-xs text-red-700 flex items-center gap-2">
                      <AlertTriangle className="w-3.5 h-3.5 flex-shrink-0" />
                      Kein passender Kunde gefunden (Score &lt; 70)
                    </div>
                    <div className="flex gap-2">
                      <button className="text-xs text-primary underline" onClick={() => setMatchMode('manual')}>Manuell zuordnen</button>
                      <span className="text-muted-foreground text-xs">·</span>
                      <button className="text-xs text-primary underline flex items-center gap-1" onClick={() => { setCreateNew(true); setMatchMode('new') }}>
                        <UserPlus className="w-3 h-3" /> Neuen Kunden anlegen
                      </button>
                    </div>
                  </div>
                )}

                {/* NEW customer */}
                {matchMode === 'new' && createNew && (
                  <div className="flex items-center gap-2 p-2 bg-blue-50 border border-blue-200 rounded-lg">
                    <UserPlus className="w-4 h-4 text-blue-600 flex-shrink-0" />
                    <div className="flex-1 text-xs">
                      <p className="font-medium text-blue-800">Neuer Kunde wird aus Formulardaten erstellt</p>
                      <p className="text-blue-600">{form.first_name} {form.last_name}</p>
                    </div>
                    <button className="text-xs text-muted-foreground underline" onClick={() => { setCreateNew(false); setMatchMode('none') }}>Abbrechen</button>
                  </div>
                )}

                {/* MANUAL search */}
                {matchMode === 'manual' && (
                  <div className="space-y-2">
                    <Select onValueChange={v => { handleConfirmCandidate(customers.find(c => c.id === v)) }}>
                      <SelectTrigger className="h-8 text-xs"><SelectValue placeholder="Kunden suchen..." /></SelectTrigger>
                      <SelectContent>
                        {customers.filter(c => !c.is_family_member).map(c => (
                          <SelectItem key={c.id} value={c.id}>{c.first_name} {c.last_name}{c.birthdate ? ` (${c.birthdate.slice(0,4)})` : ''}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <div className="flex gap-2">
                      <button className="text-xs text-muted-foreground underline" onClick={() => setMatchMode(matchCandidates.length ? 'candidates' : 'none')}>Zurück</button>
                      <span className="text-muted-foreground text-xs">·</span>
                      <button className="text-xs text-primary underline flex items-center gap-1" onClick={() => { setCreateNew(true); setMatchMode('new') }}>
                        <UserPlus className="w-3 h-3" /> Neuen Kunden anlegen
                      </button>
                    </div>
                  </div>
                )}
              </div>

              {/* Save button */}
              {!autoSaved && (
                <div className="mx-3 my-3">
                  <Button
                    className="w-full gap-2"
                    onClick={handleManualSave}
                    disabled={saving || (!matchCustomer && matchMode !== 'new')}
                  >
                    {saving
                      ? <><Loader2 className="w-4 h-4 animate-spin" /> Speichern...</>
                      : <><ChevronRight className="w-4 h-4" /> Antrag erstellen & Dokument verknüpfen</>
                    }
                  </Button>
                  {!matchCustomer && matchMode !== 'new' && (
                    <p className="text-xs text-muted-foreground text-center mt-1">Bitte Kunden zuordnen oder neu anlegen</p>
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