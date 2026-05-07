import React, { useState } from 'react'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import {
  Upload, Loader2, CheckCircle2, AlertTriangle, User, UserPlus,
  FileText, Search, X, ChevronRight, Edit2
} from 'lucide-react'
import { base44 } from '@/api/base44Client'
import { matchCustomers } from '@/lib/customerMatcher'
import { ALL_SPARTEN, getFieldsForSparte, FRANCHISE_OPTIONS } from '@/lib/insuranceSparten'

const grouped = ALL_SPARTEN.reduce((acc, s) => {
  if (!acc[s.group]) acc[s.group] = []
  acc[s.group].push(s)
  return acc
}, {})

// ── Step indicator ────────────────────────────────────────────────────────────
function StepBadge({ n, label, active, done }) {
  return (
    <div className={`flex items-center gap-2 text-xs font-medium ${active ? 'text-primary' : done ? 'text-green-600' : 'text-muted-foreground'}`}>
      <div className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold border-2 ${active ? 'border-primary bg-primary text-white' : done ? 'border-green-600 bg-green-600 text-white' : 'border-muted-foreground'}`}>
        {done ? '✓' : n}
      </div>
      {label}
    </div>
  )
}

// ── Customer search typeahead ─────────────────────────────────────────────────
function CustomerSearch({ customers, onSelect }) {
  const [q, setQ] = useState('')
  const results = q.trim().length < 2 ? [] : customers.filter(c => {
    const hay = [c.first_name, c.last_name, c.company_name, c.email].filter(Boolean).join(' ').toLowerCase()
    return hay.includes(q.toLowerCase())
  }).slice(0, 8)

  return (
    <div className="space-y-2">
      <div className="relative">
        <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
        <Input
          value={q} onChange={e => setQ(e.target.value)}
          placeholder="Name, Firma oder E-Mail (min. 2 Zeichen)"
          className="pl-8 h-9 text-sm" autoFocus
        />
      </div>
      {q.length >= 2 && results.length === 0 && (
        <p className="text-xs text-muted-foreground px-1">Kein Treffer</p>
      )}
      {results.map(c => (
        <button key={c.id} type="button" onClick={() => { onSelect(c); setQ('') }}
          className="w-full flex items-center gap-3 p-2 rounded-lg border hover:bg-primary/5 text-left text-sm transition-colors">
          <div className="w-7 h-7 rounded-full bg-primary/10 flex items-center justify-center text-primary text-xs font-bold flex-shrink-0">
            {(c.first_name?.[0] || '') + (c.last_name?.[0] || '')}
          </div>
          <div className="min-w-0">
            <p className="font-medium truncate">{c.first_name} {c.last_name}{c.company_name ? ` – ${c.company_name}` : ''}</p>
            <p className="text-xs text-muted-foreground">{c.email || ''}{c.birthdate ? ` · Geb. ${c.birthdate}` : ''}</p>
          </div>
        </button>
      ))}
    </div>
  )
}

// ── New customer mini-form ────────────────────────────────────────────────────
function NewCustomerForm({ data, onChange }) {
  const set = (k, v) => onChange({ ...data, [k]: v })
  return (
    <div className="space-y-3 p-3 border rounded-lg bg-muted/20">
      <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Neuer Kunde erfassen</p>
      <div className="grid grid-cols-2 gap-2">
        <div>
          <Label className="text-xs">Vorname *</Label>
          <Input value={data.first_name || ''} onChange={e => set('first_name', e.target.value)} className="mt-1 h-8 text-sm" />
        </div>
        <div>
          <Label className="text-xs">Nachname *</Label>
          <Input value={data.last_name || ''} onChange={e => set('last_name', e.target.value)} className="mt-1 h-8 text-sm" />
        </div>
        <div>
          <Label className="text-xs">E-Mail</Label>
          <Input type="email" value={data.email || ''} onChange={e => set('email', e.target.value)} className="mt-1 h-8 text-sm" />
        </div>
        <div>
          <Label className="text-xs">Telefon</Label>
          <Input value={data.phone || ''} onChange={e => set('phone', e.target.value)} className="mt-1 h-8 text-sm" />
        </div>
        <div>
          <Label className="text-xs">Geburtsdatum</Label>
          <Input type="date" value={data.birthdate || ''} onChange={e => set('birthdate', e.target.value)} className="mt-1 h-8 text-sm" />
        </div>
        <div>
          <Label className="text-xs">Ort</Label>
          <Input value={data.city || ''} onChange={e => set('city', e.target.value)} className="mt-1 h-8 text-sm" />
        </div>
      </div>
    </div>
  )
}

// ── Main Wizard ───────────────────────────────────────────────────────────────
export default function PolicyUploadWizard({ open, onClose, customers = [], organizations = [], onContractCreated }) {
  const [step, setStep] = useState(1) // 1=upload, 2=customer, 3=contract, 4=done
  const [uploading, setUploading] = useState(false)
  const [extracting, setExtracting] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState(null)

  // Uploaded file
  const [fileUrl, setFileUrl] = useState(null)
  const [fileName, setFileName] = useState('')

  // Extracted contract data — supports multiple contracts (z.B. Grundversicherung + Zusatzversicherungen)
  const [contracts, setContracts] = useState([{
    insurer: '', policy_number: '', sparte: '', product: '',
    premium_monthly: '', premium_yearly: '', start_date: '', end_date: '',
    cancellation_deadline: '', status: 'active', notes: '', sparte_data: {}
  }])
  const [activeContractIdx, setActiveContractIdx] = useState(0)
  const contract = contracts[activeContractIdx] || contracts[0]

  // Customer state
  const [customerMode, setCustomerMode] = useState('search') // 'search' | 'new' | 'matched'
  const [selectedCustomer, setSelectedCustomer] = useState(null)
  const [matchCandidates, setMatchCandidates] = useState([])
  const [newCustomerData, setNewCustomerData] = useState({})

  const setC = (k, v) => setContracts(prev => prev.map((c, i) => i === activeContractIdx ? { ...c, [k]: v } : c))
  const setSparteData = (k, v) => setContracts(prev => prev.map((c, i) => i === activeContractIdx ? { ...c, sparte_data: { ...c.sparte_data, [k]: v } } : c))
  const addContract = () => {
    setContracts(prev => [...prev, { insurer: contract.insurer, policy_number: '', sparte: '', product: '', premium_monthly: '', premium_yearly: '', start_date: contract.start_date, end_date: contract.end_date, cancellation_deadline: contract.cancellation_deadline, status: 'active', notes: '', sparte_data: {} }])
    setActiveContractIdx(contracts.length)
  }
  const removeContract = (idx) => {
    setContracts(prev => prev.filter((_, i) => i !== idx))
    setActiveContractIdx(Math.max(0, activeContractIdx - 1))
  }
  const sparteFields = getFieldsForSparte(contract.sparte)
  const franchiseOptions = FRANCHISE_OPTIONS[contract.sparte_data?.age_group] || FRANCHISE_OPTIONS.default

  // ── Step 1: Upload + Extract ────────────────────────────────────────────────
  const handleFileUpload = async (e) => {
    const file = e.target.files?.[0]
    if (!file) return
    e.target.value = ''
    setError(null)
    setUploading(true)
    setFileName(file.name)

    const { file_url } = await base44.integrations.Core.UploadFile({ file })
    setFileUrl(file_url)
    setUploading(false)
    setExtracting(true)

    // Extract data
    const res = await base44.functions.invoke('extractContractDataFromPDF', { file_url })
    setExtracting(false)

    if (res.data?.success && res.data?.extractedData) {
      const d = res.data.extractedData
      const baseContract = {
        insurer: d.provider || d.insurer || '',
        policy_number: d.policy_number || '',
        sparte: d.insurance_type || mapInsuranceType(d.insurance_type) || '',
        product: d.product || '',
        premium_monthly: d.premium_monthly || '',
        premium_yearly: d.premium_yearly || '',
        start_date: d.start_date || '',
        end_date: d.end_date || '',
        cancellation_deadline: d.cancellation_deadline || '',
        notes: d.notes || '',
        sparte_data: d.sparte_data || {},
        status: 'active',
      }
      // Wenn Zusatzversicherungen erkannt wurden, zusätzliche Einträge vorbereiten
      const additionalContracts = (d.additional_products || []).map(ap => ({
        ...baseContract,
        sparte: 'vvg_zusatz',
        product: ap.product || ap.name || '',
        premium_monthly: ap.premium_monthly || '',
        premium_yearly: ap.premium_yearly || '',
        policy_number: ap.policy_number || baseContract.policy_number,
        notes: ap.notes || '',
        sparte_data: {},
      }))
      setContracts([baseContract, ...additionalContracts])
      setActiveContractIdx(0)

      // Try to extract customer name from file for matching
      const extracted = res.data.extractedData
      const nameParts = (extracted.policy_holder_name || '').trim().split(/\s+/)
      const matchData = {
        first_name: extracted.first_name || nameParts[0] || '',
        last_name: extracted.last_name || nameParts.slice(1).join(' ') || '',
        birthdate: extracted.birthdate || '',
        email: extracted.email || '',
        phone: extracted.phone || '',
        street: extracted.street || '',
        city: extracted.city || extracted.location || '',
        zip_code: extracted.zip_code || '',
      }
      if (matchData.first_name || matchData.last_name) {
        const { candidates } = matchCustomers(matchData, customers)
        setMatchCandidates(candidates)
        if (candidates.length > 0 && candidates[0].score >= 80) {
          setSelectedCustomer(candidates[0].customer)
          setCustomerMode('matched')
        } else {
          // Pre-fill new customer form with KI-extracted data so user just confirms
          setNewCustomerData(matchData)
          if (!candidates.length) setCustomerMode('new')
        }
      }
    }
    setStep(2)
  }

  // ── Step 3: Save ─────────────────────────────────────────────────────────────
  const handleSave = async () => {
    setSaving(true)
    setError(null)

    let customerId = selectedCustomer?.id || null
    let customerName = selectedCustomer ? `${selectedCustomer.first_name} ${selectedCustomer.last_name}` : ''
    let orgId = selectedCustomer?.organization_id || organizations[0]?.id || ''

    // Create new customer if needed — email is optional, generate placeholder if missing
    if (!customerId && customerMode === 'new') {
      const nc = newCustomerData
      if (!nc.first_name || !nc.last_name) {
        setError('Vorname und Nachname sind erforderlich')
        setSaving(false)
        return
      }
      // Email is required by entity — generate unique placeholder if not available
      const emailValue = nc.email && nc.email.trim()
        ? nc.email.trim()
        : `${nc.first_name.toLowerCase()}.${nc.last_name.toLowerCase()}.${Date.now()}@import.local`
      const created = await base44.entities.Customer.create({
        first_name: nc.first_name,
        last_name: nc.last_name,
        email: emailValue,
        phone: nc.phone || undefined,
        birthdate: nc.birthdate || undefined,
        street: nc.street || undefined,
        city: nc.city || undefined,
        zip_code: nc.zip_code || undefined,
        organization_id: orgId,
        status: 'active',
        customer_type: 'private',
      })
      customerId = created.id
      customerName = `${nc.first_name} ${nc.last_name}`
      orgId = created.organization_id || orgId
    }

    if (!customerId) {
      setError('Bitte einen Kunden auswählen oder neu erfassen')
      setSaving(false)
      return
    }
    if (!contract.insurer) {
      setError('Versicherungsgesellschaft ist erforderlich')
      setSaving(false)
      return
    }

    // Create all contracts (Grundversicherung + alle Zusatzversicherungen)
    let firstContract = null
    for (let i = 0; i < contracts.length; i++) {
      const c = contracts[i]
      if (!c.insurer) continue
      const created = await base44.entities.Contract.create({
        customer_id: customerId,
        customer_name: customerName,
        primary_customer_id: selectedCustomer?.is_family_member ? selectedCustomer.primary_customer_id : customerId,
        organization_id: orgId,
        advisor_id: selectedCustomer?.advisor_id || undefined,
        insurer: c.insurer,
        policy_number: c.policy_number || undefined,
        insurance_type: c.sparte || undefined,
        sparte: c.sparte || undefined,
        sparte_data: c.sparte_data && Object.keys(c.sparte_data).length > 0 ? c.sparte_data : undefined,
        product: c.product || undefined,
        premium_monthly: c.premium_monthly ? Number(c.premium_monthly) : undefined,
        premium_yearly: c.premium_yearly ? Number(c.premium_yearly) : undefined,
        start_date: c.start_date || undefined,
        end_date: c.end_date || undefined,
        cancellation_deadline: c.cancellation_deadline || undefined,
        status: 'active',
        policy_document_url: i === 0 && fileUrl ? fileUrl : undefined,
        notes: c.notes || undefined,
      })
      if (i === 0) firstContract = created
    }

    // Save document reference linked to first contract
    if (fileUrl && firstContract) {
      await base44.entities.Document.create({
        name: fileName,
        file_url: fileUrl,
        customer_id: customerId,
        customer_name: customerName,
        category: 'contract',
        doc_type: 'anlage',
        classification_status: 'klassifiziert',
        linked_contract_id: firstContract.id,
      })
    }

    setSaving(false)
    setStep(4)
    onContractCreated?.(firstContract)
  }

  const handleClose = () => {
    setStep(1); setFileUrl(null); setFileName(''); setError(null)
    setContracts([{ insurer: '', policy_number: '', sparte: '', product: '', premium_monthly: '', premium_yearly: '', start_date: '', end_date: '', cancellation_deadline: '', status: 'active', notes: '', sparte_data: {} }])
    setActiveContractIdx(0)
    setSelectedCustomer(null); setCustomerMode('search'); setMatchCandidates([]); setNewCustomerData({})
    onClose()
  }

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-lg font-bold">
            <FileText className="w-5 h-5 text-primary" />
            Police hochladen & Vertrag erfassen
          </DialogTitle>
        </DialogHeader>

        {/* Step indicator */}
        <div className="flex items-center gap-2 py-2 border-b flex-wrap">
          <StepBadge n={1} label="Upload" active={step === 1} done={step > 1} />
          <ChevronRight className="w-3 h-3 text-muted-foreground flex-shrink-0" />
          <StepBadge n={2} label="Kunde" active={step === 2} done={step > 2} />
          <ChevronRight className="w-3 h-3 text-muted-foreground flex-shrink-0" />
          <StepBadge n={3} label="Vertragsdaten" active={step === 3} done={step > 3} />
          <ChevronRight className="w-3 h-3 text-muted-foreground flex-shrink-0" />
          <StepBadge n={4} label="Fertig" active={step === 4} done={false} />
        </div>

        {error && (
          <div className="flex items-center gap-2 p-2.5 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">
            <AlertTriangle className="w-4 h-4 flex-shrink-0" /> {error}
          </div>
        )}

        {/* ── STEP 1: Upload ── */}
        {step === 1 && (
          <div className="py-8 flex flex-col items-center gap-4">
            {uploading || extracting ? (
              <div className="text-center space-y-3">
                <Loader2 className="w-12 h-12 animate-spin text-primary mx-auto" />
                <p className="font-semibold">{uploading ? 'Datei wird hochgeladen...' : 'KI analysiert Police...'}</p>
                <p className="text-sm text-muted-foreground">{uploading ? '' : 'Versicherungsdaten werden automatisch extrahiert'}</p>
              </div>
            ) : (
              <>
                <div className="w-20 h-20 rounded-2xl bg-primary/10 flex items-center justify-center">
                  <Upload className="w-10 h-10 text-primary" />
                </div>
                <div className="text-center">
                  <p className="font-semibold text-lg">Police hochladen</p>
                  <p className="text-sm text-muted-foreground mt-1">PDF oder Bild der Police – KI extrahiert die Daten automatisch</p>
                </div>
                <Label htmlFor="policy-upload" className="cursor-pointer">
                  <div className="px-6 py-3 rounded-lg bg-primary text-primary-foreground font-medium text-sm hover:bg-primary/90 transition-colors flex items-center gap-2">
                    <Upload className="w-4 h-4" /> Datei auswählen
                  </div>
                </Label>
                <input id="policy-upload" type="file" accept=".pdf,.png,.jpg,.jpeg" className="hidden" onChange={handleFileUpload} />
                <p className="text-xs text-muted-foreground">PDF, PNG, JPG unterstützt</p>
              </>
            )}
          </div>
        )}

        {/* ── STEP 2: Customer ── */}
        {step === 2 && (
          <div className="space-y-4 py-2">
            <p className="text-sm text-muted-foreground">Wem gehört diese Police?</p>

            {/* Auto-matched candidates */}
            {matchCandidates.length > 0 && customerMode !== 'new' && (
              <div className="space-y-2">
                <p className="text-xs font-semibold text-muted-foreground uppercase">KI-Vorschläge ({matchCandidates.length})</p>
                {matchCandidates.map(({ customer: c, score }) => (
                  <button
                    key={c.id} type="button"
                    onClick={() => { setSelectedCustomer(c); setCustomerMode('matched') }}
                    className={`w-full flex items-center gap-3 p-3 rounded-lg border-2 text-left transition-colors ${selectedCustomer?.id === c.id ? 'border-primary bg-primary/5' : 'border-border hover:border-primary/40'}`}
                  >
                    <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold flex-shrink-0 ${score >= 80 ? 'bg-green-100 text-green-700' : 'bg-amber-100 text-amber-700'}`}>
                      {(c.first_name?.[0] || '') + (c.last_name?.[0] || '')}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-sm">{c.first_name} {c.last_name}</p>
                      <p className="text-xs text-muted-foreground">{c.email || ''}{c.birthdate ? ` · Geb. ${c.birthdate}` : ''}{c.city ? ` · ${c.city}` : ''}</p>
                    </div>
                    <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${score >= 80 ? 'bg-green-100 text-green-700' : 'bg-amber-100 text-amber-700'}`}>{score}%</span>
                    {selectedCustomer?.id === c.id && <CheckCircle2 className="w-5 h-5 text-primary flex-shrink-0" />}
                  </button>
                ))}
              </div>
            )}

            {/* Selected customer display */}
            {selectedCustomer && customerMode === 'matched' && (
              <div className="flex items-center justify-between p-3 bg-green-50 border border-green-200 rounded-lg">
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="w-5 h-5 text-green-600" />
                  <div>
                    <p className="text-sm font-semibold text-green-800">{selectedCustomer.first_name} {selectedCustomer.last_name}</p>
                    <p className="text-xs text-green-700">{selectedCustomer.email || 'Kein E-Mail'}</p>
                  </div>
                </div>
                <button type="button" onClick={() => { setSelectedCustomer(null); setCustomerMode('search') }}
                  className="text-xs text-primary underline">Ändern</button>
              </div>
            )}

            {/* Search mode */}
            {(customerMode === 'search' || (!selectedCustomer && customerMode !== 'new')) && (
              <div className="space-y-2">
                {matchCandidates.length === 0 && <p className="text-xs text-muted-foreground">Kein automatischer Treffer — bitte manuell suchen:</p>}
                <CustomerSearch customers={customers} onSelect={c => { setSelectedCustomer(c); setCustomerMode('matched') }} />
              </div>
            )}

            {/* New customer toggle */}
            {customerMode !== 'new' && (
              <button type="button" onClick={() => { setCustomerMode('new'); setSelectedCustomer(null) }}
                className="flex items-center gap-2 text-sm text-primary hover:underline">
                <UserPlus className="w-4 h-4" /> Neuen Kunden erfassen
              </button>
            )}

            {/* New customer form — pre-filled from KI extraction */}
            {customerMode === 'new' && (
              <>
                {(newCustomerData.first_name || newCustomerData.last_name) && (
                  <div className="flex items-center gap-2 p-2.5 bg-blue-50 border border-blue-200 rounded-lg text-xs text-blue-700">
                    <User className="w-4 h-4 flex-shrink-0" />
                    KI hat Kundendaten aus der Police extrahiert – bitte prüfen und bei Bedarf ergänzen
                  </div>
                )}
                <NewCustomerForm data={newCustomerData} onChange={setNewCustomerData} />
                <button type="button" onClick={() => setCustomerMode('search')}
                  className="flex items-center gap-2 text-sm text-muted-foreground hover:underline">
                  <Search className="w-3.5 h-3.5" /> Doch bestehenden Kunden suchen
                </button>
              </>
            )}

            <div className="flex justify-between pt-2">
              <Button variant="outline" onClick={() => setStep(1)}>Zurück</Button>
              <Button onClick={() => setStep(3)}
                disabled={!selectedCustomer && customerMode !== 'new'}>
                Weiter <ChevronRight className="w-4 h-4 ml-1" />
              </Button>
            </div>
          </div>
        )}

        {/* ── STEP 3: Contract review ── */}
        {step === 3 && (
          <div className="space-y-4 py-2">
            {fileUrl && (
              <div className="flex items-center gap-2 p-2 bg-green-50 border border-green-200 rounded-lg text-xs text-green-700">
                <CheckCircle2 className="w-4 h-4 flex-shrink-0" />
                KI hat Daten aus <strong>{fileName}</strong> extrahiert – bitte prüfen und ergänzen
              </div>
            )}

            {/* Multi-contract tabs */}
            <div className="flex items-center gap-2 flex-wrap">
              {contracts.map((c, i) => (
                <button key={i} type="button"
                  onClick={() => setActiveContractIdx(i)}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors ${activeContractIdx === i ? 'bg-primary text-primary-foreground border-primary' : 'bg-background border-border hover:border-primary/40'}`}
                >
                  {i === 0 ? '📋 Grundversicherung' : `➕ Zusatz ${i}`}
                  {c.product && <span className="opacity-70 truncate max-w-[80px]">– {c.product}</span>}
                  {contracts.length > 1 && i > 0 && (
                    <span onClick={e => { e.stopPropagation(); removeContract(i) }} className="ml-1 text-red-400 hover:text-red-600">✕</span>
                  )}
                </button>
              ))}
              <button type="button" onClick={addContract}
                className="flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-medium border border-dashed border-primary/40 text-primary hover:bg-primary/5 transition-colors">
                + Zusatzversicherung
              </button>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="col-span-2">
                <Label className="text-xs">Versicherungsgesellschaft *</Label>
                <Input value={contract.insurer} onChange={e => setC('insurer', e.target.value)} className="mt-1 h-8 text-sm" />
              </div>
              <div>
                <Label className="text-xs">Versicherungssparte</Label>
                <Select value={contract.sparte} onValueChange={v => setContracts(prev => prev.map((c, i) => i === activeContractIdx ? { ...c, sparte: v, insurance_type: v, sparte_data: {} } : c))}>
                  <SelectTrigger className="mt-1 h-8 text-sm"><SelectValue placeholder="Wählen..." /></SelectTrigger>
                  <SelectContent>
                    {Object.entries(grouped).map(([group, items]) => (
                      <div key={group}>
                        <div className="px-2 py-1 text-xs font-semibold text-muted-foreground bg-muted/50">{group}</div>
                        {items.map(s => <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>)}
                      </div>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label className="text-xs">Policen-Nummer</Label>
                <Input value={contract.policy_number} onChange={e => setC('policy_number', e.target.value)} className="mt-1 h-8 text-sm" />
              </div>
              <div className="col-span-2">
                <Label className="text-xs font-semibold text-primary">Produkt / Tarif</Label>
                <Input
                  value={contract.product}
                  onChange={e => setC('product', e.target.value)}
                  placeholder="z.B. COMPACT, HMO 1500, Vollkasko SB500, NATURA, TELEMED..."
                  className="mt-1 h-8 text-sm border-primary/30 focus:border-primary"
                />
              </div>
              <div>
                <Label className="text-xs">Monatsprämie (CHF)</Label>
                <Input type="number" step="0.01" value={contract.premium_monthly} onChange={e => setC('premium_monthly', e.target.value)} className="mt-1 h-8 text-sm" />
              </div>
              <div>
                <Label className="text-xs">Jahresprämie (CHF)</Label>
                <Input type="number" step="0.01" value={contract.premium_yearly} onChange={e => setC('premium_yearly', e.target.value)} className="mt-1 h-8 text-sm" />
              </div>
              <div>
                <Label className="text-xs">Vertragsbeginn</Label>
                <Input type="date" value={contract.start_date} onChange={e => setC('start_date', e.target.value)} className="mt-1 h-8 text-sm" />
              </div>
              <div>
                <Label className="text-xs">Vertragsende</Label>
                <Input type="date" value={contract.end_date} onChange={e => setC('end_date', e.target.value)} className="mt-1 h-8 text-sm" />
              </div>
              <div className="col-span-2">
                <Label className="text-xs">Kündigungsfrist</Label>
                <Input type="date" value={contract.cancellation_deadline} onChange={e => setC('cancellation_deadline', e.target.value)} className="mt-1 h-8 text-sm" />
              </div>
            </div>

            {/* Sparte-specific fields */}
            {sparteFields.length > 0 && (
              <div className="p-3 bg-muted/30 rounded-lg border space-y-3">
                <p className="text-xs font-semibold text-muted-foreground uppercase">Spartenspezifische Angaben</p>
                <div className="grid grid-cols-2 gap-2">
                  {sparteFields.map(field => (
                    <div key={field.key}>
                      <Label className="text-xs">{field.label}</Label>
                      {field.type === 'franchise' ? (
                        <Select value={contract.sparte_data?.[field.key] || ''} onValueChange={v => setSparteData(field.key, v)}>
                          <SelectTrigger className="mt-1 h-8 text-sm"><SelectValue placeholder="Wählen" /></SelectTrigger>
                          <SelectContent>{franchiseOptions.map(o => <SelectItem key={o} value={o}>CHF {o}</SelectItem>)}</SelectContent>
                        </Select>
                      ) : field.type === 'select' ? (
                        <Select value={contract.sparte_data?.[field.key] || ''} onValueChange={v => setSparteData(field.key, v)}>
                          <SelectTrigger className="mt-1 h-8 text-sm"><SelectValue /></SelectTrigger>
                          <SelectContent>{field.options.map(o => <SelectItem key={o} value={o}>{o}</SelectItem>)}</SelectContent>
                        </Select>
                      ) : (
                        <Input type={field.type} value={contract.sparte_data?.[field.key] || ''} onChange={e => setSparteData(field.key, e.target.value)} placeholder={field.placeholder || ''} className="mt-1 h-8 text-sm" />
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div>
              <Label className="text-xs">Notizen / KI-Hinweise</Label>
              <Textarea value={contract.notes} onChange={e => setC('notes', e.target.value)} className="mt-1 text-sm" rows={2} />
            </div>

            <div className="flex justify-between pt-2">
              <Button variant="outline" onClick={() => setStep(2)}>Zurück</Button>
              <Button onClick={handleSave} disabled={saving}>
                {saving ? <><Loader2 className="w-4 h-4 animate-spin mr-2" />Speichern...</> : `✓ ${contracts.length > 1 ? `${contracts.length} Verträge` : 'Vertrag'} erstellen`}
              </Button>
            </div>
          </div>
        )}

        {/* ── STEP 4: Done ── */}
        {step === 4 && (
          <div className="flex flex-col items-center gap-4 py-10 text-center">
            <CheckCircle2 className="w-16 h-16 text-green-500" />
            <div>
              <p className="text-xl font-bold text-green-700">Vertrag erfasst!</p>
              <p className="text-sm text-muted-foreground mt-1">
                Police wurde hochgeladen und der Vertrag wurde beim Kunden erfasst.
              </p>
            </div>
            <Button onClick={handleClose}>Schliessen</Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}

// ── Helper: map KI insurance_type to sparte value ─────────────────────────────
function mapInsuranceType(type) {
  if (!type) return ''
  const t = type.toLowerCase()
  if (t.includes('kvg') || t.includes('kranken')) return 'kvg'
  if (t.includes('vvg') || t.includes('zusatz')) return 'vvg_zusatz'
  if (t.includes('3a') || t.includes('säule 3a')) return 'leben_3a'
  if (t.includes('leben') || t.includes('3b')) return 'leben_3b'
  if (t.includes('motorfahrzeug') || t.includes('auto')) return 'motorfahrzeug'
  if (t.includes('hausrat')) return 'hausrat'
  if (t.includes('haftpflicht') && t.includes('betrieb')) return 'betriebshaftpflicht'
  if (t.includes('haftpflicht')) return 'haftpflicht_privat'
  if (t.includes('unfall')) return 'unfall_privat'
  if (t.includes('rechtsschutz')) return 'rechtsschutz_privat'
  if (t.includes('bvg') || t.includes('pensionskasse')) return 'bvg'
  if (t.includes('uvg')) return 'uvg'
  if (t.includes('ktg') || t.includes('krankentaggeld')) return 'ktg'
  if (t.includes('gebäude')) return 'gebaude_privat'
  return ''
}