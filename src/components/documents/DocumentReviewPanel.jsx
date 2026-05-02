import React, { useState, useEffect, useRef } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { base44 } from '@/api/base44Client'
import { Button } from '@/components/ui/button'
import {
  AlertTriangle, CheckCircle2, Loader2, UserPlus, X,
  Bug, Package, Circle, Search, Save, Eye
} from 'lucide-react'
import { Input } from '@/components/ui/input'
import { matchCustomers } from '@/lib/customerMatcher'
import { recordCorrection, applyLearned } from '@/lib/fieldLearning'
import ReviewField from './ReviewField.jsx'
import ReviewProdukte from './ReviewProdukte.jsx'

// ─── Step log ─────────────────────────────────────────────────────────────────
function StepItem({ step }) {
  const icons = {
    pending: <Circle className="w-3.5 h-3.5 text-muted-foreground" />,
    running: <Loader2 className="w-3.5 h-3.5 text-primary animate-spin" />,
    ok:      <CheckCircle2 className="w-3.5 h-3.5 text-green-600" />,
    error:   <AlertTriangle className="w-3.5 h-3.5 text-red-500" />,
    waiting: <Eye className="w-3.5 h-3.5 text-amber-500" />,
  }
  const colors = {
    pending: 'text-muted-foreground',
    running: 'text-primary font-medium',
    ok:      'text-green-700',
    error:   'text-red-600 font-medium',
    waiting: 'text-amber-600 font-medium',
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

// ─── Customer typeahead ────────────────────────────────────────────────────────
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
          placeholder="Vorname, Nachname, E-Mail..."
          className="h-8 text-xs pl-8" autoFocus />
      </div>
      {results.length > 0 && (
        <div className="mt-1 border rounded-lg bg-card shadow-md overflow-hidden absolute z-20 w-full">
          {results.map(c => (
            <button key={c.id} onClick={() => { onSelect(c); setQuery('') }}
              className="w-full flex items-center gap-2 px-3 py-2 hover:bg-muted/60 text-left text-xs border-b last:border-0">
              <div className="w-6 h-6 rounded-full bg-primary/10 flex items-center justify-center text-primary font-bold flex-shrink-0">
                {c.first_name?.[0]}{c.last_name?.[0]}
              </div>
              <div className="min-w-0">
                <p className="font-medium truncate">{c.first_name} {c.last_name}</p>
                <p className="text-muted-foreground truncate">
                  {c.birthdate || ''}{c.zip_code ? ` · PLZ ${c.zip_code}` : ''}{c.email ? ` · ${c.email}` : ''}
                </p>
              </div>
            </button>
          ))}
        </div>
      )}
      {query.trim().length >= 1 && results.length === 0 && (
        <p className="mt-1 text-xs text-muted-foreground px-1">Kein Treffer</p>
      )}
    </div>
  )
}

// ─── Debug panel ───────────────────────────────────────────────────────────────
function DebugPanel({ raw, candidates, totalCustomers, missingFields }) {
  return (
    <div className="mx-3 my-2 rounded-lg border border-slate-700 bg-slate-900 text-slate-100 text-xs overflow-auto max-h-72">
      <div className="px-3 py-1.5 border-b border-slate-700 font-semibold flex items-center gap-2">
        <Bug className="w-3 h-3" /> Debug
      </div>
      <div className="p-3 space-y-2">
        <div><span className="text-slate-400">Kunden geprüft: </span><span>{totalCustomers}</span></div>
        {missingFields?.length > 0 && <div className="text-red-400">⚠ Fehlend: {missingFields.join(', ')}</div>}
        {candidates?.length > 0 && candidates.map(({ customer: c, score }) => (
          <div key={c.id} className={`px-2 py-1 rounded ${score >= 90 ? 'bg-green-900 text-green-300' : score >= 70 ? 'bg-amber-900 text-amber-300' : 'bg-slate-800 text-slate-400'}`}>
            {score}/100 – {c.first_name} {c.last_name}{c.birthdate ? ` | ${c.birthdate}` : ''}
          </div>
        ))}
        <pre className="whitespace-pre-wrap text-green-300 text-xs">{JSON.stringify(raw, null, 2)}</pre>
      </div>
    </div>
  )
}

// ─── Confidence helper ─────────────────────────────────────────────────────────
function getFieldConfidence(value, fieldKey, missingFields, confidence) {
  if (!value) return 'missing'
  if (missingFields?.includes(fieldKey)) return 'missing'
  if (confidence < 85) return 'low'
  return 'high'
}

// ─── Main component ────────────────────────────────────────────────────────────
export default function DocumentReviewPanel({ document, onClose, onSaved }) {
  const queryClient = useQueryClient()

  const INITIAL_STEPS = [
    { id: 'extract', label: 'Schritt 1: Datenextraktion (OCR + KI)', status: 'pending' },
    { id: 'match',   label: 'Schritt 2: Kunden-Matching',             status: 'pending' },
    { id: 'review',  label: 'Schritt 3: Formular-Abgleich & Bestätigung', status: 'pending' },
    { id: 'create',  label: 'Schritt 4: Antrag erstellen',            status: 'pending' },
    { id: 'link',    label: 'Schritt 5: Dokument verknüpfen',         status: 'pending' },
  ]

  const [steps, setSteps] = useState(INITIAL_STEPS)
  const [pipelineError, setPipelineError] = useState(null)
  const [processing, setProcessing] = useState(false)
  const [saving, setSaving] = useState(false)
  const [showDebug, setShowDebug] = useState(false)

  // Extraction data
  const [extraction, setExtraction] = useState(null)
  // Editable form (pre-filled from normalized extraction)
  const [form, setForm] = useState(null)
  const [produkte, setProdukte] = useState([])
  // Original extracted values for change detection (learning)
  const originalRef = useRef(null)

  // Matching
  const [matchedCustomer, setMatchedCustomer] = useState(null)
  const [matchScore, setMatchScore] = useState(0)
  const [matchCandidates, setMatchCandidates] = useState([])
  const [matchMode, setMatchMode] = useState('pending')
  const [overrideCustomer, setOverrideCustomer] = useState(null)
  const [showCustomerSearch, setShowCustomerSearch] = useState(false)

  // Phase: 'extracting' | 'review' | 'saving' | 'done'
  const [phase, setPhase] = useState('extracting')

  const { data: customers = [], isSuccess: customersLoaded } = useQuery({
    queryKey: ['customers-all'],
    queryFn: () => base44.entities.Customer.list(null, 1000),
  })

  const setStep = (id, status, detail) =>
    setSteps(prev => prev.map(s => s.id === id ? { ...s, status, detail: detail ?? s.detail } : s))

  // Auto-start
  useEffect(() => {
    if (customersLoaded && !extraction && !processing) runExtract()
  }, [customersLoaded])

  // ── STEP 1+2: Extract + Match ────────────────────────────────────────────────
  const runExtract = async () => {
    setProcessing(true)
    setPipelineError(null)
    setPhase('extracting')

    setStep('extract', 'running')
    const res = await base44.functions.invoke('extractApplicationData', {
      file_url: document.file_url,
      file_name: document.name,
    })

    if (!res.data?.success || !res.data?.structured) {
      setStep('extract', 'error', 'Extraktion fehlgeschlagen')
      setPipelineError('Datenextraktion fehlgeschlagen. Bitte erneut versuchen.')
      setProcessing(false)
      return
    }

    const data = res.data
    // Apply learned corrections on top of normalized data
    const normalized = applyLearned(data.normalized || {})
    setExtraction({ ...data, normalized })
    const flat = {
      first_name:                normalized.first_name,
      last_name:                 normalized.last_name,
      birthdate:                 normalized.birthdate,
      phone:                     normalized.phone,
      email:                     normalized.email,
      street:                    normalized.street,
      zip_code:                  normalized.zip_code,
      city:                      normalized.city,
      insurer:                   normalized.insurer,
      contract_start_date:       normalized.contract_start_date,
      contract_end_date:         normalized.contract_end_date,
      estimated_premium_monthly: normalized.premium_monthly,
      franchise:                 normalized.franchise,
      kassenmodell:              normalized.kassenmodell,
      zusatz_type:               normalized.zusatz_type,
      product_label:             normalized.product_label,
    }
    setForm(flat)
    originalRef.current = { ...flat }
    setProdukte(normalized.produkte || [])
    setStep('extract', 'ok', `Konfidenz: ${data.confidence}% · Status: ${data.status}`)

    // STEP 2: Match
    setStep('match', 'running')
    const { candidates, topScore } = matchCustomers(flat, customers)
    setMatchCandidates(candidates)
    setMatchScore(topScore)

    if (topScore >= 80) {
      setMatchedCustomer(candidates[0].customer)
      setMatchMode('auto')
      setStep('match', 'ok', `Match: ${candidates[0].customer.first_name} ${candidates[0].customer.last_name} (${topScore}%)`)
    } else if (topScore >= 60) {
      setMatchedCustomer(candidates[0].customer)
      setMatchMode('auto_low')
      setStep('match', 'ok', `Unsicherer Match: ${candidates[0].customer.first_name} ${candidates[0].customer.last_name} (${topScore}%)`)
    } else {
      setMatchMode('new_auto')
      setStep('match', 'ok', `${customers.length} geprüft · kein Match → neuer Kunde`)
    }

    // STEP 3: Wait for user review
    setStep('review', 'waiting', 'Bitte Felder prüfen und bestätigen')
    setPhase('review')
    setProcessing(false)
  }

  // ── STEP 3 → confirm: record corrections, then save ──────────────────────────
  const handleConfirm = async () => {
    if (!form) return

    // Record any field corrections for learning
    const orig = originalRef.current || {}
    const fieldsToLearn = ['kassenmodell', 'insurer', 'franchise']
    fieldsToLearn.forEach(field => {
      if (orig[field] !== form[field]) {
        recordCorrection(field, orig[field], form[field])
      }
    })

    setStep('review', 'ok', 'Daten bestätigt')
    setPhase('saving')
    await doSave()
  }

  // ── STEP 4+5: Save ────────────────────────────────────────────────────────────
  const doSave = async () => {
    setSaving(true)
    setStep('create', 'running')

    const norm = extraction?.normalized || {}
    const f = form

    const computedAgeGroup    = norm.age_group
    const premiumMonthly      = norm.premium_monthly ?? (f.estimated_premium_monthly ? Number(f.estimated_premium_monthly) : null)
    const premiumYearly       = norm.premium_yearly ?? (premiumMonthly ? Math.round(premiumMonthly * 12 * 100) / 100 : null)
    const productType         = norm.product_type
    const kassenmodell        = f.kassenmodell || norm.kassenmodell
    const gesundheitsdeklaration = norm.gesundheitsdeklaration ?? false
    const zahlungsintervall   = norm.zahlungsintervall || null
    const sparteFromNorm      = norm.sparte || null
    const sparte              = sparteFromNorm || (
      productType === 'VVG' ? 'vvg_zusatz' :
      productType === 'KVG + VVG' ? 'kvg_vvg_kombi' : 'kvg'
    )

    const activeCustomer = overrideCustomer || matchedCustomer
    let cid = activeCustomer?.id || null
    let resolvedCustomer = activeCustomer

    // Create or update customer
    if (!cid) {
      const newC = await base44.entities.Customer.create({
        first_name: f.first_name || 'Unbekannt',
        last_name:  f.last_name  || 'Unbekannt',
        birthdate:  f.birthdate  || undefined,
        street:     f.street     || undefined,
        zip_code:   f.zip_code   || undefined,
        city:       f.city       || undefined,
        phone:      f.phone      || undefined,
        email:      f.email      || undefined,
        status: 'active',
        notes: computedAgeGroup ? `Kategorie: ${computedAgeGroup}` : undefined,
      })
      cid = newC.id
      resolvedCustomer = newC
      setStep('review', 'ok', `Neuer Kunde erstellt: ${newC.first_name} ${newC.last_name}`)
    } else {
      const existing = resolvedCustomer || customers.find(c => c.id === cid)
      if (existing) {
        const patch = {}
        if (!existing.birthdate && f.birthdate) patch.birthdate = f.birthdate
        if (!existing.street   && f.street)     patch.street   = f.street
        if (!existing.zip_code && f.zip_code)   patch.zip_code = f.zip_code
        if (!existing.city     && f.city)       patch.city     = f.city
        if (!existing.phone    && f.phone)      patch.phone    = f.phone
        if (!existing.email    && f.email)      patch.email    = f.email
        if (computedAgeGroup) {
          patch.notes = existing.notes
            ? (existing.notes.includes('Kategorie:') ? existing.notes.replace(/Kategorie:\s*\S+/, `Kategorie: ${computedAgeGroup}`) : `${existing.notes}\nKategorie: ${computedAgeGroup}`)
            : `Kategorie: ${computedAgeGroup}`
        }
        if (Object.keys(patch).length > 0) {
          await base44.entities.Customer.update(cid, patch)
          queryClient.invalidateQueries({ queryKey: ['customers'] })
        }
      }
    }

    const customer = resolvedCustomer || customers.find(c => c.id === cid)
    const customerName = customer
      ? `${customer.first_name} ${customer.last_name}`
      : `${f.first_name || ''} ${f.last_name || ''}`.trim()

    const missingRequired = !f.first_name || !f.last_name || !f.birthdate || !f.contract_start_date
    const validationMissing = []
    if (!productType) validationMissing.push('KVG/VVG')
    if (!computedAgeGroup) validationMissing.push('Altersgruppe')
    if (!premiumMonthly) validationMissing.push('Monatsprämie')
    if (produkte.length === 0) validationMissing.push('Produkte')
    const isIncomplete = missingRequired || validationMissing.length > 0

    const appNotes = [
      `Automatisch aus Dokument extrahiert: ${document.name}`,
      isIncomplete ? `⚠ Unvollständig: ${validationMissing.join(', ')}` : null,
    ].filter(Boolean).join('\n')

    let newApp
    try {
      newApp = await base44.entities.Application.create({
        customer_id: cid,
        customer_name: customerName,
        insurer: f.insurer || 'Andere',
        sparte,
        insurance_type: sparte,
        product: f.product_label || norm.product_label || productType || undefined,
        contract_start_date: f.contract_start_date || undefined,
        contract_end_date:   f.contract_end_date || undefined,
        estimated_premium_monthly: premiumMonthly || undefined,
        estimated_premium_yearly: premiumYearly || undefined,
        sparte_data: {
          franchise:          f.franchise || undefined,
          model:              kassenmodell || undefined,
          age_group:          computedAgeGroup || undefined,
          produkte:           norm.produkte?.length > 0 ? norm.produkte : produkte.length > 0 ? produkte : undefined,
          product_type:       productType || undefined,
          zahlungsintervall:  zahlungsintervall || undefined,
          health_declaration: gesundheitsdeklaration ? 'Ja' : 'Nein',
          zusatz_type:        f.zusatz_type || norm.zusatz_type || undefined,
        },
        status: 'submitted',
        custom_status: isIncomplete ? 'unvollstaendig' : (matchMode === 'auto_low' ? 'pruefung_erforderlich' : 'eingereicht'),
        notes: appNotes,
      })
    } catch (err) {
      setStep('create', 'error', err.message)
      setPipelineError(`Antrag konnte nicht erstellt werden: ${err.message}`)
      setSaving(false)
      setPhase('review')
      return
    }

    setStep('create', 'ok', `Antrag-ID: ${newApp.id}`)

    // Link document
    setStep('link', 'running')
    try {
      await base44.entities.Document.update(document.id, {
        customer_id: cid,
        customer_name: customerName,
        linked_application_id: newApp.id,
        doc_type: 'antrag',
        classification_status: 'klassifiziert',
      })
      setStep('link', 'ok', `Dokument → Antrag verknüpft`)
    } catch (err) {
      setStep('link', 'error', err.message)
    }

    queryClient.invalidateQueries({ queryKey: ['applications'] })
    queryClient.invalidateQueries({ queryKey: ['documents'] })
    queryClient.invalidateQueries({ queryKey: ['customers'] })
    queryClient.invalidateQueries({ queryKey: ['customers-all'] })
    setSaving(false)
    setPhase('done')
    onSaved?.()
    setTimeout(() => onClose(), 1500)
  }

  const setField = (key, val) => setForm(prev => ({ ...prev, [key]: val }))

  // Confidence helpers
  const confidence = extraction?.confidence ?? 0
  const missingFields = extraction?.missing_fields ?? []

  const fc = (key, value) => getFieldConfidence(value, key, missingFields, confidence)

  // Derived display values from normalized
  const norm = extraction?.normalized || {}
  const ageGroup = norm.age_group
  const productType = norm.product_type
  const gesundheitsdeklaration = norm.gesundheitsdeklaration
  const premiumYearly = norm.premium_yearly

  const isReviewPhase = phase === 'review'
  const isDone = phase === 'done'

  // Active customer (override > matched)
  const activeCustomer = overrideCustomer || matchedCustomer

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b bg-card flex-shrink-0">
        <div>
          <h2 className="font-semibold text-sm">{document.name}</h2>
          <p className="text-xs text-muted-foreground">OCR → Extraktion → Abgleich → Bestätigung → Speichern</p>
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
        <div className="w-1/2 border-r flex flex-col bg-muted/20 flex-shrink-0">
          <div className="px-3 py-2 border-b text-xs font-semibold text-muted-foreground bg-muted/40">Originaldokument</div>
          <div className="flex-1 overflow-auto p-2">
            {document.file_url?.match(/\.(jpg|jpeg|png)$/i) ? (
              <img src={document.file_url} alt="Dokument" className="w-full rounded shadow" />
            ) : (
              <iframe src={document.file_url} className="w-full h-full rounded border" title="Dokument" style={{ minHeight: '500px' }} />
            )}
          </div>
        </div>

        {/* Right: Processing + Review panel */}
        <div className="w-1/2 flex flex-col overflow-hidden">

          {/* Pipeline steps */}
          <div className="px-4 py-3 border-b bg-muted/30 space-y-1.5 flex-shrink-0">
            {steps.map(s => <StepItem key={s.id} step={s} />)}
          </div>

          {/* Error */}
          {pipelineError && (
            <div className="mx-3 mt-3 p-2.5 bg-red-50 border border-red-200 rounded-lg flex items-start gap-2 text-xs text-red-700 flex-shrink-0">
              <AlertTriangle className="w-4 h-4 flex-shrink-0 mt-0.5" />
              <div>
                <p className="font-semibold">Fehler</p>
                <p>{pipelineError}</p>
                <button onClick={runExtract} className="underline mt-1">Erneut versuchen</button>
              </div>
            </div>
          )}

          {/* Loading */}
          {phase === 'extracting' && !pipelineError && (
            <div className="flex-1 flex flex-col items-center justify-center gap-3 p-6 text-center">
              <Loader2 className="w-10 h-10 animate-spin text-primary" />
              <div>
                <p className="font-semibold">Dokument wird analysiert...</p>
                <p className="text-sm text-muted-foreground mt-1">OCR → KI-Extraktion → Normalisierung</p>
              </div>
            </div>
          )}

          {/* Done */}
          {isDone && (
            <div className="flex-1 flex flex-col items-center justify-center gap-3 p-6 text-center">
              <CheckCircle2 className="w-12 h-12 text-green-500" />
              <div>
                <p className="font-semibold text-green-700">Antrag erfolgreich erstellt</p>
                <p className="text-sm text-muted-foreground mt-1">Dokument verknüpft – Fenster schließt automatisch</p>
              </div>
            </div>
          )}

          {/* ── REVIEW FORM ── */}
          {(isReviewPhase || phase === 'saving') && form && (
            <div className="flex-1 overflow-auto">

              {/* Debug */}
              {showDebug && (
                <DebugPanel
                  raw={extraction.structured}
                  candidates={matchCandidates}
                  totalCustomers={customers.length}
                  missingFields={missingFields}
                />
              )}

              {/* Confidence + status badges */}
              <div className="px-3 pt-3 flex items-center gap-2 flex-wrap">
                <span className={`text-xs font-bold px-2 py-0.5 rounded-full flex items-center gap-1 ${confidence >= 85 ? 'bg-green-100 text-green-700' : confidence >= 60 ? 'bg-amber-100 text-amber-700' : 'bg-red-100 text-red-700'}`}>
                  {confidence >= 85 ? <CheckCircle2 className="w-3 h-3" /> : <AlertTriangle className="w-3 h-3" />}
                  Konfidenz {confidence}%
                </span>
                {ageGroup && <span className="text-xs bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full">{ageGroup}</span>}
                {productType && <span className="text-xs bg-green-100 text-green-700 px-2 py-0.5 rounded-full font-semibold">{productType}</span>}
                {gesundheitsdeklaration && <span className="text-xs bg-orange-100 text-orange-700 px-2 py-0.5 rounded-full">GD erforderlich</span>}
                {missingFields.length > 0 && (
                  <span className="text-xs bg-red-100 text-red-700 px-2 py-0.5 rounded-full">
                    {missingFields.length} Feld{missingFields.length > 1 ? 'er' : ''} fehlt
                  </span>
                )}
              </div>

              {/* Legend */}
              <div className="px-3 pt-2 flex items-center gap-3 text-xs text-muted-foreground">
                <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-green-400 inline-block" /> Sicher</span>
                <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-amber-400 inline-block" /> Unsicher</span>
                <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-red-400 inline-block" /> Fehlt</span>
              </div>

              {/* Person */}
              <div className="px-3 pt-3">
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">Personendaten</p>
                <div className="grid grid-cols-2 gap-2">
                  <ReviewField label="Vorname"      value={form.first_name}  onChange={v => setField('first_name', v)}  confidence={fc('Vorname', form.first_name)}  required />
                  <ReviewField label="Nachname"     value={form.last_name}   onChange={v => setField('last_name', v)}   confidence={fc('Nachname', form.last_name)}   required />
                  <ReviewField label="Geburtsdatum" value={form.birthdate}   onChange={v => setField('birthdate', v)}   confidence={fc('Geburtsdatum', form.birthdate)} required />
                  <ReviewField label="Telefon"      value={form.phone}       onChange={v => setField('phone', v)}       confidence={form.phone ? (confidence >= 85 ? 'high' : 'low') : 'missing'} />
                  <ReviewField label="E-Mail"       value={form.email}       onChange={v => setField('email', v)}       confidence={form.email ? (confidence >= 85 ? 'high' : 'low') : 'missing'} />
                  <ReviewField label="Strasse"      value={form.street}      onChange={v => setField('street', v)}      confidence={form.street ? 'high' : 'missing'} />
                  <ReviewField label="PLZ"          value={form.zip_code}    onChange={v => setField('zip_code', v)}    confidence={form.zip_code ? 'high' : 'missing'} />
                  <ReviewField label="Ort"          value={form.city}        onChange={v => setField('city', v)}        confidence={form.city ? 'high' : 'missing'} />
                </div>
              </div>

              {/* Insurance */}
              <div className="px-3 pt-3">
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">Versicherung</p>
                <div className="grid grid-cols-2 gap-2">
                  <ReviewField label="Gesellschaft"       value={form.insurer}               onChange={v => setField('insurer', v)}               confidence={fc('Versicherungsgesellschaft', form.insurer)} required />
                  <ReviewField label="Vertragsbeginn"     value={form.contract_start_date}   onChange={v => setField('contract_start_date', v)}   confidence={fc('Vertragsbeginn', form.contract_start_date)} required />
                  <ReviewField label="Monatsprämie (CHF)" value={String(form.estimated_premium_monthly ?? '')} onChange={v => setField('estimated_premium_monthly', v)} confidence={fc('Monatsprämie', form.estimated_premium_monthly)} required />
                  <ReviewField label="Jahresprämie (CHF)" value={premiumYearly ? premiumYearly.toLocaleString('de-CH', { minimumFractionDigits: 2 }) : ''} confidence={premiumYearly ? 'high' : 'missing'} readOnly />
                  <ReviewField label="Vertragsende"       value={form.contract_end_date}     onChange={v => setField('contract_end_date', v)}     confidence={form.contract_end_date ? 'high' : 'missing'} />
                  <ReviewField label="Franchise"          value={form.franchise}             onChange={v => setField('franchise', v)}             confidence={form.franchise ? 'high' : 'missing'} />
                  <ReviewField label="Kassenmodell"       value={form.kassenmodell}          onChange={v => setField('kassenmodell', v)}          confidence={form.kassenmodell ? (confidence >= 85 ? 'high' : 'low') : 'missing'} />
                  <ReviewField label="Zusatzversicherungstyp" value={form.zusatz_type}       onChange={v => setField('zusatz_type', v)}           confidence={form.zusatz_type ? 'high' : 'missing'} />
                  <ReviewField label="Produkt / Tarif"    value={form.product_label}         onChange={v => setField('product_label', v)}         confidence={form.product_label ? 'high' : 'missing'} />
                  {/* Computed / read-only fields */}
                  {ageGroup && <ReviewField label="Altersgruppe (berechnet)" value={ageGroup} confidence="high" readOnly />}
                  {productType && <ReviewField label="KVG / VVG (abgeleitet)" value={productType} confidence="high" readOnly />}
                  {norm.zahlungsintervall && <ReviewField label="Zahlungsintervall" value={norm.zahlungsintervall} confidence="high" readOnly />}
                  <ReviewField
                    label="Gesundheitserklärung nötig"
                    value={gesundheitsdeklaration ? 'Ja' : 'Nein'}
                    confidence="high"
                    readOnly
                  />
                </div>
              </div>

              {/* Zusatzversicherungstypen aus Produkten */}
              {produkte.filter(p => p.zusatz_typ).length > 0 && (
                <div className="px-3 pt-3">
                  <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">Zusatzversicherungstypen</p>
                  <div className="grid grid-cols-2 gap-2">
                    {produkte.filter(p => p.zusatz_typ).map((p, i) => (
                      <div key={i} className="p-2.5 rounded-lg border border-green-200 bg-green-50/40">
                        <p className="text-xs font-medium text-muted-foreground mb-1">{p.name}</p>
                        <p className="text-sm font-semibold text-green-700">{p.zusatz_typ}</p>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Products */}
              <div className="px-3 pt-3">
                <div className="flex items-center gap-2 mb-2">
                  <Package className="w-3.5 h-3.5 text-muted-foreground" />
                  <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Produkte / Tarife</p>
                </div>
                <ReviewProdukte produkte={produkte} onChange={setProdukte} />
              </div>

              {/* Customer assignment */}
              <div className="px-3 pt-3 space-y-2">
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Kundenzuordnung</p>

                {activeCustomer && (
                  <div className={`flex items-center gap-2 p-2.5 rounded-lg border ${matchMode === 'auto' ? 'bg-green-50 border-green-200' : 'bg-amber-50 border-amber-200'}`}>
                    {matchMode === 'auto'
                      ? <CheckCircle2 className="w-4 h-4 text-green-600 flex-shrink-0" />
                      : <AlertTriangle className="w-4 h-4 text-amber-600 flex-shrink-0" />
                    }
                    <div className="flex-1 text-xs">
                      <p className={`font-medium ${matchMode === 'auto' ? 'text-green-800' : 'text-amber-800'}`}>
                        {activeCustomer.first_name} {activeCustomer.last_name}
                        {matchScore > 0 && <span className="font-normal ml-1">({matchScore}%)</span>}
                        {overrideCustomer && <span className="ml-1 text-blue-600">(manuell)</span>}
                      </p>
                      {activeCustomer.birthdate && <p className="text-muted-foreground">Geb. {activeCustomer.birthdate}</p>}
                    </div>
                    <button onClick={() => setShowCustomerSearch(p => !p)} className="text-xs text-primary underline">Ändern</button>
                  </div>
                )}

                {matchMode === 'new_auto' && !overrideCustomer && (
                  <div className="flex items-center gap-2 p-2.5 bg-blue-50 border border-blue-200 rounded-lg">
                    <UserPlus className="w-4 h-4 text-blue-600 flex-shrink-0" />
                    <div className="flex-1 text-xs">
                      <p className="font-medium text-blue-800">Neuer Kunde wird angelegt</p>
                    </div>
                    <button onClick={() => setShowCustomerSearch(p => !p)} className="text-xs text-primary underline">Bestehenden wählen</button>
                  </div>
                )}

                {showCustomerSearch && (
                  <div className="border rounded-lg p-2 bg-muted/20">
                    <p className="text-xs text-muted-foreground mb-1.5">Kunden suchen:</p>
                    <CustomerTypeahead customers={customers} onSelect={c => {
                      setOverrideCustomer(c)
                      setMatchMode('auto')
                      setMatchScore(0)
                      setShowCustomerSearch(false)
                    }} />
                  </div>
                )}
              </div>

              {/* ── CONFIRM BUTTON ── */}
              <div className="px-3 py-4">
                {phase === 'saving' ? (
                  <div className="flex items-center justify-center gap-2 py-3">
                    <Loader2 className="w-5 h-5 animate-spin text-primary" />
                    <span className="text-sm text-muted-foreground">Antrag wird gespeichert...</span>
                  </div>
                ) : (
                  <Button
                    className="w-full"
                    size="lg"
                    onClick={handleConfirm}
                    disabled={saving}
                  >
                    <Save className="w-4 h-4 mr-2" />
                    Daten bestätigen & Antrag erstellen
                  </Button>
                )}
                {missingFields.length > 0 && (
                  <p className="text-xs text-amber-600 mt-2 text-center">
                    ⚠ {missingFields.length} Pflichtfeld{missingFields.length > 1 ? 'er' : ''} fehlt – trotzdem speichern möglich, Antrag wird als unvollständig markiert.
                  </p>
                )}
              </div>

            </div>
          )}
        </div>
      </div>
    </div>
  )
}