import React, { useState, useEffect } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { base44 } from '@/api/base44Client'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  AlertTriangle, CheckCircle2, Loader2, UserPlus, X,
  Zap, Bug, Package, Circle, Search
} from 'lucide-react'
import { ALL_SPARTEN } from '@/lib/insuranceSparten'
import { matchCustomers } from '@/lib/customerMatcher'

// ─── Step log item ────────────────────────────────────────────────────────────
function StepItem({ step }) {
  const icons = {
    pending:  <Circle className="w-3.5 h-3.5 text-muted-foreground" />,
    running:  <Loader2 className="w-3.5 h-3.5 text-primary animate-spin" />,
    ok:       <CheckCircle2 className="w-3.5 h-3.5 text-green-600" />,
    error:    <AlertTriangle className="w-3.5 h-3.5 text-red-500" />,
    skipped:  <Circle className="w-3.5 h-3.5 text-muted-foreground/40" />,
  }
  const colors = {
    pending: 'text-muted-foreground',
    running: 'text-primary font-medium',
    ok:      'text-green-700',
    error:   'text-red-600 font-medium',
    skipped: 'text-muted-foreground/40',
  }
  return (
    <div className="flex items-start gap-2">
      <span className="mt-0.5 flex-shrink-0">{icons[step.status] || icons.pending}</span>
      <div className="min-w-0">
        <p className={`text-xs ${colors[step.status] || colors.pending}`}>{step.label}</p>
        {step.detail && <p className="text-xs text-muted-foreground truncate">{step.detail}</p>}
      </div>
    </div>
  )
}

// ─── Editable field ───────────────────────────────────────────────────────────
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

// ─── Product list ─────────────────────────────────────────────────────────────
function ProdukteListe({ produkte, onChange }) {
  const handleChange = (idx, key, val) =>
    onChange(produkte.map((p, i) => i === idx ? { ...p, [key]: val } : p))
  return (
    <div className="space-y-1.5">
      {produkte.map((p, i) => (
        <div key={i} className="flex gap-1.5 items-center">
          <select value={p.typ} onChange={e => handleChange(i, 'typ', e.target.value)}
            className="h-7 text-xs rounded-md border border-input bg-transparent px-2 w-36 flex-shrink-0">
            <option>Grundversicherung</option>
            <option>Zusatz</option>
            <option>Sonstige</option>
          </select>
          <Input value={p.name} onChange={e => handleChange(i, 'name', e.target.value)}
            className="h-7 text-xs flex-1" placeholder="Produktname" />
          <button onClick={() => onChange(produkte.filter((_, j) => j !== i))}
            className="text-muted-foreground hover:text-destructive text-xs px-1">✕</button>
        </div>
      ))}
      <button onClick={() => onChange([...produkte, { typ: 'Zusatz', name: '' }])}
        className="text-xs text-primary underline mt-1">+ Produkt hinzufügen</button>
    </div>
  )
}

// ─── Typeahead customer search ────────────────────────────────────────────────
function CustomerTypeahead({ customers, onSelect }) {
  const [query, setQuery] = useState('')
  const results = query.trim().length < 1 ? [] : customers
    .filter(c => `${c.first_name} ${c.last_name} ${c.email || ''} ${c.phone || ''} ${c.mobile || ''}`
      .toLowerCase().includes(query.toLowerCase()))
    .slice(0, 8)

  return (
    <div className="relative">
      <div className="relative">
        <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
        <Input value={query} onChange={e => setQuery(e.target.value)}
          placeholder="Vorname, Nachname, E-Mail oder Telefon..."
          className="h-8 text-xs pl-8" autoFocus />
      </div>
      {results.length > 0 && (
        <div className="mt-1 border rounded-lg bg-card shadow-md overflow-hidden z-10">
          {results.map(c => (
            <button key={c.id} onClick={() => { onSelect(c); setQuery('') }}
              className="w-full flex items-center gap-2 px-3 py-2 hover:bg-muted/60 text-left text-xs border-b last:border-0">
              <div className="w-6 h-6 rounded-full bg-primary/10 flex items-center justify-center text-primary font-bold flex-shrink-0">
                {c.first_name?.[0]}{c.last_name?.[0]}
              </div>
              <div className="min-w-0">
                <p className="font-medium truncate">{c.first_name} {c.last_name}</p>
                <p className="text-muted-foreground truncate">
                  {c.birthdate || ''}
                  {c.zip_code ? ` · PLZ ${c.zip_code}` : ''}
                  {c.email ? ` · ${c.email}` : ''}
                </p>
              </div>
            </button>
          ))}
        </div>
      )}
      {query.trim().length >= 1 && results.length === 0 && (
        <p className="mt-1 text-xs text-muted-foreground px-1">Kein Treffer für „{query}"</p>
      )}
    </div>
  )
}

// ─── Debug panel ──────────────────────────────────────────────────────────────
function DebugPanel({ raw, candidates, totalCustomers, applicationCreated, missingFields }) {
  return (
    <div className="mx-3 my-2 rounded-lg border border-slate-700 bg-slate-900 text-slate-100 text-xs overflow-auto max-h-80">
      <div className="px-3 py-1.5 border-b border-slate-700 font-semibold flex items-center gap-2">
        <Bug className="w-3 h-3" /> Debug Output
      </div>
      <div className="p-3 space-y-3">
        <div>
          <span className="text-slate-400 font-semibold">Matching: </span>
          <span className="text-white">{totalCustomers} Kunden durchsucht</span>
        </div>
        {missingFields?.length > 0 && (
          <div className="text-red-400">⚠ Fehlende Pflichtfelder: {missingFields.join(', ')}</div>
        )}
        <div>
          <span className="text-slate-400 font-semibold">Antrag erstellt: </span>
          <span className={applicationCreated ? 'text-green-400' : 'text-slate-500'}>
            {applicationCreated === true ? 'true' : applicationCreated === false ? 'false' : 'ausstehend'}
          </span>
        </div>
        {candidates?.length > 0 && (
          <div>
            <div className="text-slate-400 font-semibold mb-1">Match-Scores:</div>
            {candidates.map(({ customer: c, score }) => (
              <div key={c.id} className={`px-2 py-1 rounded mb-1 ${score >= 90 ? 'bg-green-900 text-green-300' : score >= 70 ? 'bg-amber-900 text-amber-300' : 'bg-slate-800 text-slate-400'}`}>
                Score {score}/100 – {c.first_name} {c.last_name}
                {c.birthdate ? ` | Geb: ${c.birthdate}` : ''}
                {c.zip_code ? ` | PLZ: ${c.zip_code}` : ''}
                {c.email ? ` | ${c.email}` : ''}
              </div>
            ))}
          </div>
        )}
        <div>
          <div className="text-slate-400 font-semibold mb-1">parsedData (JSON):</div>
          <pre className="whitespace-pre-wrap text-green-300">{JSON.stringify(raw, null, 2)}</pre>
        </div>
      </div>
    </div>
  )
}

// ─── Main component ───────────────────────────────────────────────────────────
export default function DocumentReviewPanel({ document, onClose, onSaved }) {
  const queryClient = useQueryClient()

  // Pipeline state
  const [steps, setSteps] = useState([
    { id: 'extract',  label: 'Schritt 1: Datenextraktion (OCR + KI)', status: 'pending' },
    { id: 'match',    label: 'Schritt 2: Kunden-Matching',            status: 'pending' },
    { id: 'assign',   label: 'Schritt 3: Kundenzuordnung',            status: 'pending' },
    { id: 'create',   label: 'Schritt 4: Antrag erstellen',           status: 'pending' },
    { id: 'link',     label: 'Schritt 5: Dokument verknüpfen',        status: 'pending' },
  ])
  const [pipelineError, setPipelineError] = useState(null)
  const [pipelineDone, setPipelineDone] = useState(false)
  const [processing, setProcessing] = useState(false)

  // Data state
  const [extraction, setExtraction] = useState(null)
  const [form, setForm] = useState(null)
  const [produkte, setProdukte] = useState([])
  const [saving, setSaving] = useState(false)

  // Matching state
  const [matchedCustomer, setMatchedCustomer] = useState(null)
  const [matchScore, setMatchScore] = useState(0)
  const [matchCandidates, setMatchCandidates] = useState([])
  const [matchMode, setMatchMode] = useState('pending') // pending|auto|auto_low|new_auto|manual
  const [applicationCreated, setApplicationCreated] = useState(null)
  const [documentLinked, setDocumentLinked] = useState(null)

  const [showDebug, setShowDebug] = useState(false)

  // Load ALL customers (no pagination limit)
  const { data: customers = [], isSuccess: customersLoaded } = useQuery({
    queryKey: ['customers-all'],
    queryFn: () => base44.entities.Customer.list(null, 1000),
  })

  const setStep = (id, status, detail) =>
    setSteps(prev => prev.map(s => s.id === id ? { ...s, status, detail: detail ?? s.detail } : s))

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
    franchise:  s.versicherung?.franchise ?? null,
    kassenmodell: s.versicherung?.kassenmodell ?? null,
  })

  // ── Auto-start extraction when panel opens and customers are ready ─────────
  useEffect(() => {
    if (customersLoaded && !extraction && !processing) {
      runPipeline()
    }
  }, [customersLoaded])

  // ── Step 1+2: Extract and match ────────────────────────────────────────────
  const runPipeline = async () => {
    setProcessing(true)
    setPipelineError(null)
    setApplicationCreated(null)

    // STEP 1: Extract
    setStep('extract', 'running')
    const res = await base44.functions.invoke('extractApplicationData', {
      file_url: document.file_url,
      file_name: document.name,
    })

    if (!res.data?.success || !res.data?.structured) {
      setStep('extract', 'error', 'Extraktion fehlgeschlagen – keine strukturierten Daten')
      setPipelineError('Datenextraktion ist fehlgeschlagen. Bitte versuchen Sie es erneut.')
      setProcessing(false)
      return
    }

    const data = res.data
    const flat = buildForm(data.structured)
    setExtraction(data)
    setForm(flat)
    setProdukte(data.structured?.versicherung?.produkte || [])
    setStep('extract', 'ok', `Konfidenz: ${data.confidence}% · Status: ${data.status}`)

    // STEP 2: Match customers
    setStep('match', 'running')
    const { autoMatch, candidates, topScore } = matchCustomers(flat, customers)
    setMatchCandidates(candidates)
    setMatchScore(topScore)

    const matchDetail = candidates.length > 0
      ? `${customers.length} durchsucht · bester Match: ${topScore}%`
      : `${customers.length} durchsucht · kein Treffer`
    setStep('match', 'ok', matchDetail)

    // STEP 3: Assign + auto-continue pipeline
    const prods = data.structured?.versicherung?.produkte || []
    const ag = data.age_group

    if (topScore >= 80) {
      // Score ≥ 80: auto-assign, no UI needed
      setMatchedCustomer(candidates[0].customer)
      setMatchMode('auto')
      setStep('assign', 'ok', `Automatisch: ${candidates[0].customer.first_name} ${candidates[0].customer.last_name} (Score ${topScore})`)
      setProcessing(false)
      await doSave(flat, prods, ag, candidates[0].customer.id, candidates[0].customer)
    } else if (topScore >= 60) {
      // Score 60–79: auto-assign with review flag
      setMatchedCustomer(candidates[0].customer)
      setMatchMode('auto_low')
      setStep('assign', 'ok', `Auto-Zuweisung (Prüfen empfohlen): ${candidates[0].customer.first_name} ${candidates[0].customer.last_name} (Score ${topScore})`)
      setProcessing(false)
      await doSave(flat, prods, ag, candidates[0].customer.id, candidates[0].customer, true)
    } else {
      // Score < 60: auto-create new customer
      setMatchMode('new_auto')
      setStep('assign', 'ok', 'Kein Match – neuer Kunde wird automatisch erstellt')
      setProcessing(false)
      await doSave(flat, prods, ag, null, null)
    }
  }

  // ── Save (Steps 4+5) ───────────────────────────────────────────────────────
  const doSave = async (f, prods, ageGroup, customerId, existingCustomer, needsReview = false) => {
    setSaving(true)
    setStep('create', 'running')
    let cid = customerId
    let resolvedCustomer = existingCustomer

    // Auto-create new customer if no match
    if (!cid) {
      const newC = await base44.entities.Customer.create({
        first_name: f.first_name || 'Unbekannt',
        last_name:  f.last_name || 'Unbekannt',
        birthdate:  f.birthdate || undefined,
        street:     f.street || undefined,
        zip_code:   f.zip_code || undefined,
        city:       f.city || undefined,
        phone:      f.phone || undefined,
        email:      f.email || undefined,
        status: 'active',
      })
      cid = newC.id
      resolvedCustomer = newC
      setStep('assign', 'ok', `Neuer Kunde automatisch erstellt: ${newC.first_name} ${newC.last_name}`)
    }

    const customer = resolvedCustomer || customers.find(c => c.id === cid)
    const customerName = customer
      ? `${customer.first_name} ${customer.last_name}`
      : `${f.first_name || ''} ${f.last_name || ''}`.trim()

    const sparteMatch = ALL_SPARTEN.find(s =>
      s.label?.toLowerCase().includes((f.insurance_type || '').toLowerCase()) ||
      s.value?.toLowerCase() === (f.insurance_type || '').toLowerCase()
    )
    const sparte = sparteMatch?.value || 'kvg'
    const missingRequired = !f.first_name || !f.last_name || !f.birthdate || !f.contract_start_date
    const appNotes = [
      `Automatisch aus Dokument extrahiert: ${document.name}`,
      missingRequired ? '⚠ Unvollständig – Pflichtfelder fehlen' : null,
    ].filter(Boolean).join('\n')

    let newApp
    try {
      newApp = await base44.entities.Application.create({
        customer_id: cid,
        customer_name: customerName,
        insurer: f.insurer || 'Andere',
        sparte,
        insurance_type: sparte,
        contract_start_date: f.contract_start_date || undefined,
        estimated_premium_monthly: f.estimated_premium_monthly ? Number(f.estimated_premium_monthly) : undefined,
        sparte_data: {
          franchise:  f.franchise || undefined,
          model:      f.kassenmodell || undefined,
          age_group:  ageGroup || undefined,
          produkte:   prods.length > 0 ? prods : undefined,
        },
        status: 'draft',
        custom_status: needsReview ? 'pruefung_erforderlich' : (missingRequired ? 'unvollstaendig' : undefined),
        notes: appNotes,
      })
    } catch (err) {
      setStep('create', 'error', err.message)
      setPipelineError(`Antrag konnte nicht erstellt werden: ${err.message}`)
      setSaving(false)
      setApplicationCreated(false)
      return
    }

    setStep('create', 'ok', `Antrag-ID: ${newApp.id}`)
    setApplicationCreated(true)

    // STEP 5: Link document
    setStep('link', 'running')
    try {
      await base44.entities.Document.update(document.id, {
        customer_id: cid,
        customer_name: customerName,
        linked_application_id: newApp.id,
        doc_type: 'antrag',
        classification_status: 'klassifiziert',
      })
      setStep('link', 'ok', `Dokument → Antrag ${newApp.id}`)
      setDocumentLinked(true)
    } catch (err) {
      setStep('link', 'error', err.message)
      setPipelineError(`Dokument konnte nicht verknüpft werden: ${err.message}`)
      setSaving(false)
      setDocumentLinked(false)
      return
    }

    queryClient.invalidateQueries({ queryKey: ['applications'] })
    queryClient.invalidateQueries({ queryKey: ['documents'] })
    setSaving(false)
    setPipelineDone(true)
    onSaved?.()
    // Auto-close after 1.5s so user can see the success state
    setTimeout(() => onClose(), 1500)
  }

  const setField = (key, val) => setForm(prev => ({ ...prev, [key]: val }))

  const confidence = extraction?.confidence ?? 0
  const status = extraction?.status ?? null
  const missingFields = extraction?.missing_fields ?? []
  const ageGroup = extraction?.age_group
  const isExtracting = steps.find(s => s.id === 'extract')?.status === 'running'
  const extractionDone = steps.find(s => s.id === 'extract')?.status === 'ok'

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b bg-card">
        <div>
          <h2 className="font-semibold text-sm">{document.name}</h2>
          <p className="text-xs text-muted-foreground">Automatische Verarbeitung: OCR → Matching → Antrag</p>
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

        {/* Right: Processing panel */}
        <div className="w-1/2 flex flex-col overflow-hidden">

          {/* Pipeline step log */}
          <div className="px-4 py-3 border-b bg-muted/30 space-y-1.5">
            {steps.map(s => <StepItem key={s.id} step={s} />)}
          </div>

          {/* Error banner */}
          {pipelineError && (
            <div className="mx-3 mt-3 p-2.5 bg-red-50 border border-red-200 rounded-lg flex items-start gap-2 text-xs text-red-700">
              <AlertTriangle className="w-4 h-4 flex-shrink-0 mt-0.5" />
              <div>
                <p className="font-semibold">Fehler – Prozess gestoppt</p>
                <p>{pipelineError}</p>
                <button onClick={runPipeline} className="underline mt-1 text-red-600">Erneut versuchen</button>
              </div>
            </div>
          )}

          {/* Loading state before extraction completes */}
          {!extractionDone && !pipelineError && (
            <div className="flex-1 flex flex-col items-center justify-center gap-3 p-6 text-center">
              <Loader2 className="w-10 h-10 animate-spin text-primary" />
              <div>
                <p className="font-semibold">Dokument wird automatisch verarbeitet...</p>
                <p className="text-sm text-muted-foreground mt-1">OCR → Datenextraktion → Kunden-Matching</p>
              </div>
            </div>
          )}

          {/* Extracted data + matching UI */}
          {extractionDone && form && (
            <div className="flex-1 overflow-auto">

              {/* Debug panel */}
              {showDebug && (
                <DebugPanel
                  raw={extraction.structured}
                  candidates={matchCandidates}
                  totalCustomers={customers.length}
                  applicationCreated={applicationCreated}
                  missingFields={missingFields}
                />
              )}

              {/* Confidence bar */}
              <div className="px-3 pt-3 flex items-center gap-2 flex-wrap">
                <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${confidence >= 85 ? 'bg-green-100 text-green-700' : confidence >= 60 ? 'bg-amber-100 text-amber-700' : 'bg-red-100 text-red-700'}`}>
                  {confidence >= 85 ? <CheckCircle2 className="w-3 h-3 inline mr-1" /> : <AlertTriangle className="w-3 h-3 inline mr-1" />}
                  Konfidenz {confidence}%
                </span>
                {status === 'unvollstaendig' && <span className="text-xs bg-red-100 text-red-700 px-2 py-0.5 rounded-full border border-red-200">Unvollständig</span>}
                {status === 'pruefung_erforderlich' && <span className="text-xs bg-amber-100 text-amber-700 px-2 py-0.5 rounded-full border border-amber-200">Prüfung erforderlich</span>}
                {ageGroup && <span className="text-xs bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full">{ageGroup}</span>}
              </div>

              {/* Warning banners */}
              {status === 'unvollstaendig' && (
                <div className="mx-3 mt-2 p-2.5 bg-red-50 border border-red-200 rounded-lg flex items-center gap-2 text-xs text-red-700">
                  <AlertTriangle className="w-4 h-4" /> Pflichtfelder fehlen: {missingFields.join(', ')} – bitte ergänzen.
                </div>
              )}

              {/* Person */}
              <div className="px-3 pt-3">
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">Personendaten</p>
                <div className="grid grid-cols-2 gap-2">
                  <Field label="Vorname *"      value={form.first_name} onChange={v => setField('first_name', v)} warn={!form.first_name} />
                  <Field label="Nachname *"     value={form.last_name}  onChange={v => setField('last_name', v)}  warn={!form.last_name} />
                  <Field label="Geburtsdatum *" value={form.birthdate}  onChange={v => setField('birthdate', v)}  warn={!form.birthdate} />
                  <Field label="Telefon"        value={form.phone}      onChange={v => setField('phone', v)} />
                  <Field label="E-Mail"         value={form.email}      onChange={v => setField('email', v)} />
                  <Field label="Strasse"        value={form.street}     onChange={v => setField('street', v)} />
                  <Field label="PLZ"            value={form.zip_code}   onChange={v => setField('zip_code', v)} />
                  <Field label="Ort"            value={form.city}       onChange={v => setField('city', v)} />
                </div>
              </div>

              {/* Insurance */}
              <div className="px-3 pt-3">
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">Versicherung</p>
                <div className="grid grid-cols-2 gap-2">
                  <Field label="Gesellschaft"       value={form.insurer}                    onChange={v => setField('insurer', v)}                    warn={!form.insurer} />
                  <Field label="Vertragsbeginn *"   value={form.contract_start_date}        onChange={v => setField('contract_start_date', v)}        warn={!form.contract_start_date} />
                  <Field label="Monatsprämie (CHF)" value={form.estimated_premium_monthly}  onChange={v => setField('estimated_premium_monthly', v)} />
                  <Field label="Franchise"          value={form.franchise}                  onChange={v => setField('franchise', v)} />
                  <Field label="Kassenmodell"       value={form.kassenmodell}               onChange={v => setField('kassenmodell', v)} />
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
                {produkte.length === 0 && <p className="text-xs text-muted-foreground italic mb-2">Keine Produkte erkannt</p>}
                <ProdukteListe produkte={produkte} onChange={setProdukte} />
              </div>

              {/* Customer assignment status – read-only, no interaction needed */}
              <div className="mx-3 mt-3 space-y-2">

                {(matchMode === 'auto') && matchedCustomer && (
                  <div className="flex items-center gap-2 p-2.5 bg-green-50 border border-green-200 rounded-lg">
                    <CheckCircle2 className="w-4 h-4 text-green-600 flex-shrink-0" />
                    <div className="flex-1 text-xs">
                      <p className="font-medium text-green-800">
                        Kunde automatisch zugeordnet: {matchedCustomer.first_name} {matchedCustomer.last_name}
                        <span className="ml-1 text-green-600 font-normal">({matchScore}%)</span>
                      </p>
                      {matchedCustomer.birthdate && <span className="text-green-600">Geb. {matchedCustomer.birthdate}</span>}
                    </div>
                  </div>
                )}

                {matchMode === 'auto_low' && matchedCustomer && (
                  <div className="flex items-center gap-2 p-2.5 bg-amber-50 border border-amber-200 rounded-lg">
                    <AlertTriangle className="w-4 h-4 text-amber-600 flex-shrink-0" />
                    <div className="flex-1 text-xs">
                      <p className="font-medium text-amber-800">
                        Kunde zugeordnet (Prüfung empfohlen): {matchedCustomer.first_name} {matchedCustomer.last_name}
                        <span className="ml-1 text-amber-600 font-normal">({matchScore}%)</span>
                      </p>
                    </div>
                  </div>
                )}

                {matchMode === 'new_auto' && (
                  <div className="flex items-center gap-2 p-2.5 bg-blue-50 border border-blue-200 rounded-lg">
                    <UserPlus className="w-4 h-4 text-blue-600 flex-shrink-0" />
                    <p className="text-xs font-medium text-blue-800">Kein Match – neuer Kunde wird automatisch erstellt</p>
                  </div>
                )}

                {applicationCreated === true && (
                  <div className="flex items-center gap-2 p-2.5 bg-green-50 border border-green-200 rounded-lg">
                    <CheckCircle2 className="w-4 h-4 text-green-600 flex-shrink-0" />
                    <p className="text-xs font-medium text-green-800">Antrag erstellt</p>
                  </div>
                )}

                {documentLinked === true && (
                  <div className="flex items-center gap-2 p-2.5 bg-green-50 border border-green-200 rounded-lg">
                    <CheckCircle2 className="w-4 h-4 text-green-600 flex-shrink-0" />
                    <p className="text-xs font-medium text-green-800">Dokument verknüpft</p>
                  </div>
                )}

                {saving && (
                  <div className="flex items-center gap-2 p-2.5 bg-muted/40 border rounded-lg">
                    <Loader2 className="w-4 h-4 animate-spin text-primary flex-shrink-0" />
                    <p className="text-xs text-muted-foreground">Antrag wird erstellt und Dokument verknüpft...</p>
                  </div>
                )}
              </div>

            </div>
          )}
        </div>
      </div>
    </div>
  )
}