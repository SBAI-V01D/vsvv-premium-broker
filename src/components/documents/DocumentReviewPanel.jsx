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
// Mindestzeichen: 2, sucht first_name, last_name, company_name, email
function CustomerTypeahead({ customers, onSelect }) {
  const [query, setQuery] = useState('')

  const results = query.trim().length < 2 ? [] : customers
    .filter(c => {
      const haystack = [
        c.first_name,
        c.last_name,
        c.company_name,
        c.email,
      ].filter(Boolean).join(' ').toLowerCase()
      return haystack.includes(query.trim().toLowerCase())
    })
    .slice(0, 10)

  return (
    <div>
      <div className="relative">
        <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
        <Input
          value={query}
          onChange={e => setQuery(e.target.value)}
          placeholder="Min. 2 Zeichen: Name, Firma, E-Mail..."
          className="h-8 text-xs pl-8"
          autoFocus
        />
      </div>

      {query.trim().length >= 2 && results.length === 0 && (
        <p className="mt-2 text-xs text-muted-foreground px-1">Kein Treffer für „{query}"</p>
      )}

      {results.length > 0 && (
        <div className="mt-1 border rounded-lg bg-card shadow-md overflow-hidden">
          {results.map(c => (
            <button
              key={c.id}
              type="button"
              onClick={() => { onSelect(c); setQuery('') }}
              className="w-full flex items-center gap-2 px-3 py-2 hover:bg-muted/60 text-left text-xs border-b last:border-0"
            >
              <div className="w-6 h-6 rounded-full bg-primary/10 flex items-center justify-center text-primary font-bold flex-shrink-0 text-xs">
                {c.first_name?.[0]}{c.last_name?.[0]}
              </div>
              <div className="min-w-0">
                <p className="font-medium truncate">
                  {c.company_name ? c.company_name : `${c.first_name} ${c.last_name}`}
                </p>
                <p className="text-muted-foreground truncate">
                  {c.first_name} {c.last_name}
                  {c.birthdate ? ` · Geb. ${c.birthdate}` : ''}
                  {c.email ? ` · ${c.email}` : ''}
                </p>
              </div>
            </button>
          ))}
        </div>
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
        <div><span className="text-slate-400">Kunden geladen: </span><span>{totalCustomers}</span></div>
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
  if (confidence < 80) return 'low'
  return 'high'
}

// ─── Main component ────────────────────────────────────────────────────────────
export default function DocumentReviewPanel({ document, onClose, onSaved }) {
  const queryClient = useQueryClient()

  const INITIAL_STEPS = [
    { id: 'extract', label: 'Schritt 1: Datenextraktion (OCR + KI)', status: 'pending' },
    { id: 'match',   label: 'Schritt 2: Kunden-Matching',             status: 'pending' },
    { id: 'review',  label: 'Schritt 3: Prüfung durch Benutzer',      status: 'pending' },
    { id: 'create',  label: 'Schritt 4: Antrag erstellen',            status: 'pending' },
    { id: 'link',    label: 'Schritt 5: Dokument verknüpfen',         status: 'pending' },
  ]

  const [steps, setSteps] = useState(INITIAL_STEPS)
  const [pipelineError, setPipelineError] = useState(null)
  const [processing, setProcessing] = useState(false)
  const [saving, setSaving] = useState(false)
  const [showDebug, setShowDebug] = useState(false)

  const [extraction, setExtraction] = useState(null)
  const [form, setForm] = useState(null)
  const [produkte, setProdukte] = useState([])
  const originalRef = useRef(null)
  const [sparteLocked, setSparteLocked] = useState(false)
  const [sparteDetectionMethod, setSparteDetectionMethod] = useState(null)
  const [sparteOverwriteWarning, setSparteOverwriteWarning] = useState(null)

  // ── SINGLE SOURCE OF TRUTH: customerLocked + overrideCustomer ──────────────
  // Wenn customerLocked = true → KI darf NIEMALS überschreiben
  const [matchedCustomer, setMatchedCustomer] = useState(null)
  const [matchScore, setMatchScore] = useState(0)
  const [matchCandidates, setMatchCandidates] = useState([])
  const [matchMode, setMatchMode] = useState('pending')
  const [overrideCustomer, setOverrideCustomer] = useState(null)
  const overrideCustomerRef = useRef(null) // Ref für sync-sicheren Zugriff in handleConfirm
  const [customerLocked, setCustomerLocked] = useState(document?.customer_locked || false)
  const [lockConfirmed, setLockConfirmed] = useState(false) // Verhindert Race Conditions
  const [showCustomerSearch, setShowCustomerSearch] = useState(false)

  // Phase: 'extracting' | 'auto_processing' | 'review' | 'saving' | 'done'
  const [phase, setPhase] = useState('extracting')
  // Auto-Result: Feedback nach Auto-Mode
  const [autoResult, setAutoResult] = useState(null) // { customerName, appId }

  // Refs for scroll
  const rightPanelRef = useRef(null)

  // ── Customers Query: gleicher Key wie Hauptseite → nutzt Cache ───────────────
  const { data: customers = [], isSuccess: customersLoaded } = useQuery({
    queryKey: ['customers'],
    queryFn: () => base44.entities.Customer.list(null, 1000),
    staleTime: 60_000,
  })

  const setStep = (id, status, detail) =>
    setSteps(prev => prev.map(s => s.id === id ? { ...s, status, detail: detail ?? s.detail } : s))

  // Auto-start nach Kunden-Load
  useEffect(() => {
    if (customersLoaded && !extraction && !processing) runExtract()
  }, [customersLoaded])

  // Nach Review-Phase: nach oben scrollen damit User Felder sieht
  useEffect(() => {
    if (phase === 'review' && rightPanelRef.current) {
      setTimeout(() => {
        rightPanelRef.current.scrollTop = 0
      }, 100)
    }
  }, [phase])

  // ── STEP 1+2: Extract + Match ─────────────────────────────────────────────────
  const runExtract = async () => {
    setProcessing(true)
    setPipelineError(null)
    setPhase('extracting')

    setStep('extract', 'running')
    let res
    try {
      res = await base44.functions.invoke('extractApplicationData', {
        file_url: document.file_url,
        file_name: document.name,
      })
      if (!res.data?.success || !res.data?.structured) {
        setStep('extract', 'error', 'Extraktion fehlgeschlagen')
        setPipelineError('Datenextraktion fehlgeschlagen. Bitte erneut versuchen.')
        setProcessing(false)
        return
      }
    } catch (err) {
      setStep('extract', 'error', err.message)
      setPipelineError(`Datenextraktion-Fehler: ${err.message}`)
      setProcessing(false)
      return
    }

    const data = res.data
    const normalized = applyLearned(data.normalized || {})
    setExtraction({ ...data, normalized })

    if (normalized.sparte) {
      setSparteLocked(true)
      setSparteDetectionMethod(normalized.sparte_detection_method || 'extraction')
    }

    const flat = {
      company_name:              normalized.company_name,
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
      sparte:                    normalized.sparte,
    }
    setForm(flat)
    originalRef.current = { ...flat }
    setProdukte(normalized.produkte || [])
    setStep('extract', 'ok', `Konfidenz: ${data.confidence}% · ${data.status}`)

    // STEP 2: Match — NUR wenn customer NICHT manuell gesperrt (via document.customer_locked)
    setStep('match', 'running')
    const { candidates, topScore } = matchCustomers(flat, customers)
    setMatchCandidates(candidates)
    setMatchScore(topScore)

    // Prüfe ob Kunde schon im Dokument gespeichert + gesperrt ist
    if (document?.customer_id && document?.customer_locked) {
      // Dokument hat bereits einen gesperrten Kunden
      const lockedCust = customers.find(c => c.id === document.customer_id)
      if (lockedCust) {
        overrideCustomerRef.current = lockedCust
        setOverrideCustomer(lockedCust)
        setMatchedCustomer(null)
        setCustomerLocked(true)
        setMatchMode('manual')
        setStep('match', 'ok', `🔒 Dokumentkunde gesperrt: ${lockedCust.first_name} ${lockedCust.last_name} – wird nicht geändert`)
      }
    } else if (!customerLocked) {
      // KI setzt Kunde nur wenn noch kein Lock gesetzt
      if (topScore >= 80) {
        setMatchedCustomer(candidates[0].customer)
        setMatchMode('auto')
        setStep('match', 'ok', `✅ Match: ${candidates[0].customer.first_name} ${candidates[0].customer.last_name} (${topScore}%)`)
      } else if (topScore >= 60) {
        setMatchedCustomer(candidates[0].customer)
        setMatchMode('auto_low')
        setStep('match', 'ok', `⚠ Unsicher: ${candidates[0].customer.first_name} ${candidates[0].customer.last_name} (${topScore}%)`)
      } else {
        setMatchMode('new_auto')
        setStep('match', 'ok', `${customers.length} geprüft · kein Match → neuer Kunde`)
      }
    } else {
      // Manuell gesperrter Kunde — KI überschreibt NICHT
      const locked = overrideCustomer
      setStep('match', 'ok', `🔒 Manuell gesetzt: ${locked?.first_name} ${locked?.last_name} – wird beibehalten`)
    }

    // ── AUTO MODE: Konfidenz >= 90 → direkt speichern, kein Review ────────────
    if (data.confidence >= 90) {
      setStep('review', 'ok', `Auto-Mode: Konfidenz ${data.confidence}% ≥ 90% → direkt verarbeiten`)
      setPhase('auto_processing')
      setProcessing(false)
      // Speichern mit den soeben gesetzten lokalen Werten (kein State-Read)
      await doSaveAutoMode(data.normalized || {}, flat, normalized.produkte || [], candidates, topScore)
      return
    }

    // ── REVIEW MODE: Konfidenz < 90 → User muss prüfen ────────────────────────
    setStep('review', 'waiting', `Konfidenz ${data.confidence}% < 90% → Bitte Daten prüfen`)
    setPhase('review')
    setProcessing(false)
  }

  // ── Auto-Mode Speichern (ohne State-Deps, alles als Parameter) ───────────────
  const doSaveAutoMode = async (normalized, flat, produkteData, candidates, topScore) => {
    const premiumMonthly = normalized.premium_monthly ?? (flat.estimated_premium_monthly ? Number(flat.estimated_premium_monthly) : null)
    const premiumYearly  = normalized.premium_yearly ?? (premiumMonthly ? Math.round(premiumMonthly * 12 * 100) / 100 : null)
    const sparte         = normalized.sparte || null

    // Customer: Auto-Match oder neuer Kunde
    let cid = null
    let customerName = `${flat.first_name || ''} ${flat.last_name || ''}`.trim()

    if (topScore >= 80 && candidates.length > 0) {
      cid = candidates[0].customer.id
      customerName = `${candidates[0].customer.first_name} ${candidates[0].customer.last_name}`
      setStep('match', 'ok', `✅ Auto-Match: ${customerName} (${topScore}%)`)
    } else {
      // Neuen Kunden anlegen
      try {
        const syncResult = await base44.functions.invoke('syncCustomerFromApplication', {
          first_name: flat.first_name || 'Unbekannt',
          last_name:  flat.last_name || 'Unbekannt',
          email:      flat.email || '',
          phone:      flat.phone || '',
          street:     flat.street || '',
          zip_code:   flat.zip_code || '',
          city:       flat.city || '',
          birthdate:  flat.birthdate || '',
          nationality: 'CH',
        })
        if (syncResult.data?.customer_id) {
          cid = syncResult.data.customer_id
        }
      } catch (_) {
        const newC = await base44.entities.Customer.create({
          first_name: flat.first_name || 'Unbekannt',
          last_name:  flat.last_name || 'Unbekannt',
          email:      flat.email || undefined,
          phone:      flat.phone || undefined,
          birthdate:  flat.birthdate || undefined,
          status: 'prospect',
          customer_type: 'private',
        })
        cid = newC.id
      }
    }

    setStep('create', 'running')
    let newApp
    try {
      newApp = await base44.entities.Application.create({
        customer_id: cid,
        customer_name: customerName,
        insurer: flat.insurer || 'Andere',
        sparte,
        insurance_type: sparte,
        product: flat.product_label || normalized.product_label || normalized.product_type || undefined,
        contract_start_date: flat.contract_start_date || undefined,
        contract_end_date:   flat.contract_end_date || undefined,
        estimated_premium_monthly: premiumMonthly || undefined,
        estimated_premium_yearly:  premiumYearly || undefined,
        sparte_data: {
          franchise:         flat.franchise || undefined,
          model:             flat.kassenmodell || normalized.kassenmodell || undefined,
          age_group:         normalized.age_group || undefined,
          produkte:          produkteData.length > 0 ? produkteData : undefined,
          product_type:      normalized.product_type || undefined,
          zahlungsintervall: normalized.zahlungsintervall || undefined,
          health_declaration: normalized.gesundheitsdeklaration ? 'Ja' : 'Nein',
          zusatz_type:       normalized.zusatz_type || undefined,
        },
        status: 'submitted',
        custom_status: 'in_pruefung',
        status_changed_at: new Date().toISOString(),
        notes: `Auto-verarbeitet aus Dokument: ${document.name}`,
      })
      setStep('create', 'ok', `Antrag-ID: ${newApp.id}`)
    } catch (err) {
      setStep('create', 'error', err.message)
      setPipelineError(`Antrag konnte nicht erstellt werden: ${err.message}`)
      setPhase('review') // Fallback zu Review
      return
    }

    setStep('link', 'running')
    try {
      await base44.entities.Document.update(document.id, {
        customer_id: cid,
        customer_name: customerName,
        linked_application_id: newApp.id,
        doc_type: 'antrag',
        classification_status: 'klassifiziert',
      })
      setStep('link', 'ok', 'Dokument → Antrag verknüpft')
    } catch (err) {
      setStep('link', 'error', err.message)
    }

    queryClient.invalidateQueries({ queryKey: ['applications'] })
    queryClient.invalidateQueries({ queryKey: ['documents'] })
    queryClient.invalidateQueries({ queryKey: ['customers'] })
    setAutoResult({ customerName, appId: newApp.id })
    setPhase('done')
    onSaved?.()
    setTimeout(() => onClose(), 3000)
  }

  // ── Speichern ─────────────────────────────────────────────────────────────────
  // lockedCustomer wird direkt von handleConfirm übergeben — kein State-Read
  const doSaveWithData = async (normalized, flat, produkteData, lockedCustomer) => {
    setSaving(true)
    setStep('create', 'running')

    const premiumMonthly = normalized.premium_monthly ?? (flat.estimated_premium_monthly ? Number(flat.estimated_premium_monthly) : null)
    const premiumYearly  = normalized.premium_yearly ?? (premiumMonthly ? Math.round(premiumMonthly * 12 * 100) / 100 : null)
    const sparte         = normalized.sparte || null

    if (!sparte && sparteLocked && sparteDetectionMethod) {
      setSparteOverwriteWarning('Sparte-Locking-Fehler: Ursprüngliche Sparte verloren!')
    }

    // ── SINGLE SOURCE OF TRUTH: lockedCustomer (direkt übergeben) hat absolute Priorität ────────
    let cid = lockedCustomer?.id || null
    let resolvedCustomer = lockedCustomer

    if (!cid) {
      try {
        const syncResult = await base44.functions.invoke('syncCustomerFromApplication', {
          first_name: flat.first_name || 'Unbekannt',
          last_name:  flat.last_name || 'Unbekannt',
          email:      flat.email || '',
          phone:      flat.phone || '',
          mobile:     flat.mobile || '',
          street:     flat.street || '',
          zip_code:   flat.zip_code || '',
          city:       flat.city || '',
          canton:     flat.canton || '',
          birthdate:  flat.birthdate || '',
          ahv_number: flat.ahv_number || '',
          nationality: flat.nationality || 'CH',
        })
        if (syncResult.data?.customer_id) {
          cid = syncResult.data.customer_id
          resolvedCustomer = customers.find(c => c.id === cid)
          queryClient.invalidateQueries({ queryKey: ['customers'] })
        }
      } catch (err) {
        const newC = await base44.entities.Customer.create({
          first_name: flat.first_name || 'Unbekannt',
          last_name:  flat.last_name || 'Unbekannt',
          birthdate:  flat.birthdate || undefined,
          street:     flat.street || undefined,
          zip_code:   flat.zip_code || undefined,
          city:       flat.city || undefined,
          phone:      flat.phone || undefined,
          email:      flat.email || undefined,
          status: 'prospect',
          customer_type: 'private',
          is_family_member: false,
        })
        cid = newC.id
        resolvedCustomer = newC
      }
    }

    const customer = resolvedCustomer || customers.find(c => c.id === cid)
    const customerName = customer
      ? `${customer.first_name} ${customer.last_name}`
      : `${flat.first_name || ''} ${flat.last_name || ''}`.trim()

    let newApp
    try {
      newApp = await base44.entities.Application.create({
        customer_id: cid,  // ← IMMER von overrideCustomer oder matchedCustomer, nie von KI-Rohwert
        customer_name: customerName,
        insurer: flat.insurer || 'Andere',
        sparte,
        insurance_type: sparte,
        product: flat.product_label || normalized.product_label || normalized.product_type || undefined,
        contract_start_date: flat.contract_start_date || undefined,
        contract_end_date:   flat.contract_end_date || undefined,
        estimated_premium_monthly: premiumMonthly || undefined,
        estimated_premium_yearly:  premiumYearly || undefined,
        sparte_data: {
          franchise:         flat.franchise || undefined,
          model:             flat.kassenmodell || normalized.kassenmodell || undefined,
          age_group:         normalized.age_group || undefined,
          produkte:          produkteData.length > 0 ? produkteData : undefined,
          product_type:      normalized.product_type || undefined,
          zahlungsintervall: normalized.zahlungsintervall || undefined,
          health_declaration: normalized.gesundheitsdeklaration ? 'Ja' : 'Nein',
          zusatz_type:       flat.zusatz_type || normalized.zusatz_type || undefined,
        },
        status: 'submitted',
        custom_status: 'in_pruefung',
        status_changed_at: new Date().toISOString(),
        notes: `Automatisch aus Dokument extrahiert: ${document.name}`,
      })
    } catch (err) {
      setStep('create', 'error', err.message)
      setPipelineError(`Antrag konnte nicht erstellt werden: ${err.message}`)
      setSaving(false)
      setPhase('review')
      return
    }

    setStep('create', 'ok', `Antrag-ID: ${newApp.id}`)
    setStep('link', 'running')
    try {
      // Dokument: customer_id + application-Link persistent speichern
      await base44.entities.Document.update(document.id, {
        customer_id: cid,       // ← einzige Wahrheit, kommt von lockedCustomer
        customer_name: customerName,
        linked_application_id: newApp.id,
        doc_type: 'antrag',
        classification_status: 'klassifiziert',
      })
      setStep('link', 'ok', 'Dokument → Antrag verknüpft')
    } catch (err) {
      setStep('link', 'error', err.message)
    }

    queryClient.invalidateQueries({ queryKey: ['applications'] })
    queryClient.invalidateQueries({ queryKey: ['documents'] })
    queryClient.invalidateQueries({ queryKey: ['customers'] })
    setSaving(false)
    setPhase('done')
    onSaved?.()
    setTimeout(() => onClose(), 1500)
  }

  // ── Bestätigen ────────────────────────────────────────────────────────────────
  const handleConfirm = async () => {
    if (!form) return
    const orig = originalRef.current || {}
    ;['kassenmodell', 'insurer', 'franchise'].forEach(field => {
      if (orig[field] !== form[field]) recordCorrection(field, orig[field], form[field])
    })
    setStep('review', 'ok', 'Manuell bestätigt')
    setPhase('saving')
    // Ref hat immer den aktuellen Wert — kein React State-Race
    const lockedCustomer = overrideCustomerRef.current || matchedCustomer
    await doSaveWithData(extraction?.normalized || {}, form, produkte, lockedCustomer)
  }

  const setField = (key, val) => setForm(prev => ({ ...prev, [key]: val }))

  const rawConfidence = extraction?.confidence ?? 0
  const confidence    = rawConfidence > 1 ? rawConfidence : rawConfidence * 100
  const missingFields = extraction?.missing_fields ?? []
  const fc = (key, value) => getFieldConfidence(value, key, missingFields, confidence)

  const norm              = extraction?.normalized || {}
  const ageGroup          = norm.age_group
  const productType       = norm.product_type
  const gesundheitsdeklaration = norm.gesundheitsdeklaration
  const premiumYearly     = norm.premium_yearly
  const isKvgLike         = form?.sparte === 'kvg' || form?.sparte === 'kvg_vvg_kombi' || form?.sparte === 'vvg_zusatz'
  const activeCustomer    = overrideCustomer || matchedCustomer

  return (
    // Äusserer Container: volle Höhe, kein overflow-hidden
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>

      {/* Header – fixiert */}
      <div className="flex items-center justify-between px-4 py-3 border-b bg-card" style={{ flexShrink: 0 }}>
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="sm" onClick={onClose} className="gap-1.5 text-muted-foreground">
            <X className="w-4 h-4" /> Zurück
          </Button>
          <div className="h-4 w-px bg-border" />
          <div>
            <h2 className="font-semibold text-sm">{document.name}</h2>
            <p className="text-xs text-muted-foreground">
              KI-Review · {phase === 'review' ? '⚠ Konfidenz < 90% – manuelle Prüfung erforderlich' : phase === 'done' ? '✅ Verarbeitet' : 'Analysiert...'}
            </p>
          </div>
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
          {phase === 'review' && (
            <span className="text-xs bg-amber-100 text-amber-700 px-2 py-1 rounded-full font-medium">
              Review-Modus
            </span>
          )}
          {(phase === 'extracting' || phase === 'auto_processing') && (
            <span className="text-xs bg-green-100 text-green-700 px-2 py-1 rounded-full font-medium flex items-center gap-1">
              <Loader2 className="w-3 h-3 animate-spin" /> Verarbeitung...
            </span>
          )}
        </div>
      </div>

      {/* Body: 2-Spalten-Layout */}
      <div style={{ display: 'flex', flex: 1, overflow: 'hidden' }}>

        {/* Links: Dokument-Vorschau — eigener Scroll */}
        <div style={{ width: '50%', display: 'flex', flexDirection: 'column', borderRight: '1px solid hsl(var(--border))' }}>
          <div className="px-3 py-2 border-b text-xs font-semibold text-muted-foreground bg-muted/40" style={{ flexShrink: 0 }}>
            Originaldokument
          </div>
          <div style={{ flex: 1, overflow: 'auto', padding: '8px' }}>
            {document.file_url?.match(/\.(jpg|jpeg|png)$/i) ? (
              <img src={document.file_url} alt="Dokument" className="w-full rounded shadow" />
            ) : (
              <iframe src={document.file_url} className="w-full rounded border" title="Dokument" style={{ height: '100%', minHeight: '500px' }} />
            )}
          </div>
        </div>

        {/* Rechts: Pipeline + Review — eigener Scroll */}
        <div
          ref={rightPanelRef}
          style={{ width: '50%', display: 'flex', flexDirection: 'column', overflowY: 'auto', overflowX: 'hidden' }}
        >
          {/* Pipeline-Schritte */}
          <div className="px-4 py-3 border-b bg-muted/30 space-y-1.5" style={{ flexShrink: 0 }}>
            {steps.map(s => <StepItem key={s.id} step={s} />)}
          </div>

          {/* Fehler */}
          {pipelineError && (
            <div className="mx-3 mt-3 p-2.5 bg-red-50 border border-red-200 rounded-lg flex items-start gap-2 text-xs text-red-700">
              <AlertTriangle className="w-4 h-4 flex-shrink-0 mt-0.5" />
              <div>
                <p className="font-semibold">Fehler</p>
                <p>{pipelineError}</p>
                <button onClick={runExtract} className="underline mt-1">Erneut versuchen</button>
              </div>
            </div>
          )}

          {/* Sparte-Warnung */}
          {sparteOverwriteWarning && (
            <div className="mx-3 mt-3 p-2.5 bg-red-50 border border-red-200 rounded-lg flex items-start gap-2 text-xs text-red-700">
              <AlertTriangle className="w-4 h-4 flex-shrink-0 mt-0.5" />
              <p className="font-semibold">{sparteOverwriteWarning}</p>
            </div>
          )}

          {/* Laden */}
          {phase === 'extracting' && !pipelineError && (
            <div className="flex flex-col items-center justify-center gap-3 p-12 text-center">
              <Loader2 className="w-10 h-10 animate-spin text-primary" />
              <div>
                <p className="font-semibold">Dokument wird analysiert...</p>
                <p className="text-sm text-muted-foreground mt-1">OCR → KI-Extraktion → Normalisierung</p>
              </div>
            </div>
          )}

          {/* Auto-Processing */}
          {phase === 'auto_processing' && !pipelineError && (
            <div className="flex flex-col items-center justify-center gap-3 p-12 text-center">
              <Loader2 className="w-10 h-10 animate-spin text-green-600" />
              <div>
                <p className="font-semibold text-green-700">⚡ Auto-Mode – hohe Konfidenz</p>
                <p className="text-sm text-muted-foreground mt-1">Antrag wird automatisch erstellt...</p>
              </div>
            </div>
          )}

          {/* Fertig */}
          {phase === 'done' && (
            <div className="flex flex-col items-center justify-center gap-4 p-12 text-center">
              <CheckCircle2 className="w-16 h-16 text-green-500" />
              <div className="space-y-2">
                <p className="font-bold text-lg text-green-700">✅ Automatisch verarbeitet</p>
                {autoResult?.customerName && (
                  <p className="text-sm text-muted-foreground">Kunde: <span className="font-semibold text-foreground">{autoResult.customerName}</span></p>
                )}
                <p className="text-sm text-green-600 font-medium">Antrag erstellt</p>
                <p className="text-xs text-muted-foreground mt-2">Fenster schließt automatisch...</p>
              </div>
              <Button variant="outline" onClick={onClose}>Jetzt schliessen</Button>
            </div>
          )}

          {/* ── REVIEW FORMULAR ── */}
          {(phase === 'review' || phase === 'saving') && form && (
            <div style={{ padding: '0 0 24px 0' }}>

              {/* Feedback-Banner nach KI-Analyse */}
              <div className="mx-3 mt-3 p-3 bg-green-50 border border-green-200 rounded-lg space-y-1">
                <div className="flex items-center gap-2 text-xs font-semibold text-green-800">
                  <CheckCircle2 className="w-4 h-4" /> Daten extrahiert
                </div>
                {activeCustomer && (
                  <div className="flex items-center gap-2 text-xs text-green-700">
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    Kunde gesetzt: <span className="font-semibold">{activeCustomer.first_name} {activeCustomer.last_name}</span>
                    {customerLocked && <span className="ml-1">🔒</span>}
                  </div>
                )}
                <div className="flex items-center gap-2 text-xs text-green-700">
                  <CheckCircle2 className="w-3.5 h-3.5" /> Antrag vorbereitet – bitte Daten prüfen
                </div>
              </div>

              {/* Debug */}
              {showDebug && (
                <DebugPanel
                  raw={extraction.structured}
                  candidates={matchCandidates}
                  totalCustomers={customers.length}
                  missingFields={missingFields}
                />
              )}

              {/* Konfidenz + Status Badges */}
              <div className="px-3 pt-3 flex items-center gap-2 flex-wrap">
                <span className={`text-xs font-bold px-2 py-0.5 rounded-full flex items-center gap-1 ${confidence >= 80 ? 'bg-green-100 text-green-700' : confidence >= 60 ? 'bg-amber-100 text-amber-700' : 'bg-red-100 text-red-700'}`}>
                  {confidence >= 80 ? <CheckCircle2 className="w-3 h-3" /> : <AlertTriangle className="w-3 h-3" />}
                  Konfidenz {Math.round(confidence)}%
                </span>
                {ageGroup && <span className="text-xs bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full">{ageGroup}</span>}
                {productType && <span className="text-xs bg-green-100 text-green-700 px-2 py-0.5 rounded-full font-semibold">{productType}</span>}
                {gesundheitsdeklaration && <span className="text-xs bg-orange-100 text-orange-700 px-2 py-0.5 rounded-full">GD erforderlich</span>}
                {missingFields.filter(f => !['KVG/VVG','Altersgruppe','Produkte'].includes(f)).length > 0 && (
                  <span className="text-xs bg-red-100 text-red-700 px-2 py-0.5 rounded-full">
                    {missingFields.filter(f => !['KVG/VVG','Altersgruppe','Produkte'].includes(f)).length} Feld(er) fehlt
                  </span>
                )}
              </div>

              {/* Legende */}
              <div className="px-3 pt-2 flex items-center gap-3 text-xs text-muted-foreground">
                <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-green-400 inline-block" /> Sicher</span>
                <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-amber-400 inline-block" /> Unsicher</span>
                <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-red-400 inline-block" /> Fehlt</span>
              </div>

              {/* Personendaten */}
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

              {/* Versicherungsdaten */}
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
                  {ageGroup && <ReviewField label="Altersgruppe (berechnet)" value={ageGroup} confidence="high" readOnly />}
                  {productType && <ReviewField label="KVG / VVG (abgeleitet)" value={productType} confidence="high" readOnly />}
                  {norm.zahlungsintervall && <ReviewField label="Zahlungsintervall" value={norm.zahlungsintervall} confidence="high" readOnly />}
                  {isKvgLike && (
                    <ReviewField label="Gesundheitserklärung nötig" value={gesundheitsdeklaration ? 'Ja' : 'Nein'} confidence="high" readOnly />
                  )}
                </div>
              </div>

              {/* Zusatzversicherungstypen */}
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

              {/* Produkte */}
              <div className="px-3 pt-3">
                <div className="flex items-center gap-2 mb-2">
                  <Package className="w-3.5 h-3.5 text-muted-foreground" />
                  <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Produkte / Tarife</p>
                </div>
                <ReviewProdukte produkte={produkte} onChange={setProdukte} />
              </div>

              {/* Kundenzuordnung */}
              <div className="px-3 pt-3 space-y-2">
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Kundenzuordnung</p>

                {activeCustomer && (
                   <div className={`flex items-center gap-2 p-2.5 rounded-lg border ${customerLocked ? 'bg-blue-50 border-blue-300' : matchMode === 'auto' ? 'bg-green-50 border-green-200' : 'bg-amber-50 border-amber-200'}`}>
                     {customerLocked
                       ? <CheckCircle2 className="w-4 h-4 text-blue-600 flex-shrink-0" />
                       : matchMode === 'auto'
                         ? <CheckCircle2 className="w-4 h-4 text-green-600 flex-shrink-0" />
                         : <AlertTriangle className="w-4 h-4 text-amber-600 flex-shrink-0" />
                     }
                     <div className="flex-1 text-xs">
                       <p className={`font-medium ${customerLocked ? 'text-blue-800' : matchMode === 'auto' ? 'text-green-800' : 'text-amber-800'}`}>
                         {activeCustomer.first_name} {activeCustomer.last_name}
                         {!customerLocked && matchScore > 0 && <span className="font-normal ml-1">({matchScore}%)</span>}
                         {customerLocked && <span className="ml-1 font-semibold">🔒 DOKUMENTKUNDE GESPERRT</span>}
                       </p>
                       {activeCustomer.birthdate && <p className="text-muted-foreground">Geb. {activeCustomer.birthdate}</p>}
                       {activeCustomer.organization_id && <p className="text-muted-foreground">Org: {activeCustomer.organization_id}</p>}
                     </div>
                     {!customerLocked && !lockConfirmed && (
                       <button
                         type="button"
                         onClick={() => {
                           overrideCustomerRef.current = null
                           setCustomerLocked(false)
                           setOverrideCustomer(null)
                           setShowCustomerSearch(true)
                         }}
                         className="text-xs text-primary underline"
                       >
                         Ändern
                       </button>
                     )}
                   </div>
                 )}

                {matchMode === 'new_auto' && !overrideCustomer && !customerLocked && (
                  <div className="flex items-center gap-2 p-2.5 bg-blue-50 border border-blue-200 rounded-lg">
                    <UserPlus className="w-4 h-4 text-blue-600 flex-shrink-0" />
                    <div className="flex-1 text-xs">
                      <p className="font-medium text-blue-800">Neuer Kunde wird angelegt</p>
                    </div>
                    <button type="button" onClick={() => setShowCustomerSearch(p => !p)} className="text-xs text-primary underline">
                      Bestehenden wählen
                    </button>
                  </div>
                )}

                {showCustomerSearch && (
                  <div className="border rounded-lg p-3 bg-muted/20">
                    <p className="text-xs font-medium text-muted-foreground mb-2">
                      Kunden suchen ({customers.length} Kunden geladen):
                    </p>
                    <CustomerTypeahead
                      customers={customers}
                      onSelect={async (c) => {
                        // 1. Sofort ins Backend schreiben + LOCK setzen
                        await base44.entities.Document.update(document.id, {
                          customer_id: c.id,
                          customer_name: `${c.first_name} ${c.last_name}`,
                          customer_locked: true,
                        })
                        queryClient.invalidateQueries({ queryKey: ['documents'] })
                        // 2. State + Ref setzen — Lock aktiv für diese Session
                        overrideCustomerRef.current = c
                        setOverrideCustomer(c)
                        setMatchedCustomer(null)
                        setCustomerLocked(true)
                        setLockConfirmed(true) // Lock ist jetzt bestätigt
                        setMatchMode('manual')
                        setMatchScore(0)
                        setShowCustomerSearch(false)
                      }}
                    />
                  </div>
                )}
              </div>

              {/* Bestätigen-Button */}
              <div className="px-3 pt-4 pb-6">
                {phase === 'saving' ? (
                  <div className="flex items-center justify-center gap-2 py-3">
                    <Loader2 className="w-5 h-5 animate-spin text-primary" />
                    <span className="text-sm text-muted-foreground">Antrag wird gespeichert...</span>
                  </div>
                ) : (
                  <Button className="w-full" size="lg" onClick={handleConfirm} disabled={saving}>
                    <Save className="w-4 h-4 mr-2" />
                    Daten prüfen & bestätigen
                  </Button>
                )}
                {missingFields.filter(f => !['KVG/VVG','Altersgruppe','Produkte'].includes(f)).length > 0 && (
                  <p className="text-xs text-amber-600 mt-2 text-center">
                    ⚠ Fehlende Felder: {missingFields.filter(f => !['KVG/VVG','Altersgruppe','Produkte'].includes(f)).join(', ')} – trotzdem speichern möglich.
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