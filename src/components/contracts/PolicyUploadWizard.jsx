import React, { useState, useEffect } from 'react'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import {
  Upload, Loader2, CheckCircle2, AlertTriangle, User, UserPlus,
  FileText, Search, X, ChevronRight, MapPin
} from 'lucide-react'
import { base44 } from '@/api/base44Client'
import { lookupPostalCode, fixOcrPostalCode } from '@/lib/swissPostalCodes'
import { useMemo } from 'react'
import { ALL_SPARTEN, getFieldsForSparte, FRANCHISE_OPTIONS } from '@/lib/insuranceSparten'

// ── Helpers ───────────────────────────────────────────────────────────────────
const grouped = ALL_SPARTEN.reduce((acc, s) => {
  if (!acc[s.group]) acc[s.group] = []
  acc[s.group].push(s)
  return acc
}, {})

const matchCustomers = (matchData, customers) => {
  const candidates = customers
    .map(c => {
      let score = 0
      if (matchData.first_name && c.first_name?.toLowerCase() === matchData.first_name.toLowerCase()) score += 35
      if (matchData.last_name && c.last_name?.toLowerCase() === matchData.last_name.toLowerCase()) score += 35
      if (matchData.email && c.email && c.email.toLowerCase() === matchData.email.toLowerCase()) score += 40
      if (matchData.birthdate && c.birthdate === matchData.birthdate) score += 20
      if (matchData.zip_code && c.zip_code === matchData.zip_code) score += 10
      return { customer: c, score }
    })
    .filter(x => x.score >= 35)
    .sort((a, b) => b.score - a.score)
  return candidates
}

function mapInsuranceType(type) {
  if (!type) return ''
  const t = type.toLowerCase()
  if (t.includes('kvg') || t.includes('kranken')) return 'kvg'
  if (t.includes('vvg') || t.includes('zusatz')) return 'vvg_zusatz'
  if (t.includes('3a')) return 'leben_3a'
  if (t.includes('3b') || t.includes('leben')) return 'leben_3b'
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
        <Input value={q} onChange={e => setQ(e.target.value)}
          placeholder="Name, Firma oder E-Mail (min. 2 Zeichen)"
          className="pl-8 h-9 text-sm" autoFocus />
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

// ── New customer mini-form WITH PLZ auto-lookup ───────────────────────────────
function NewCustomerForm({ data, onChange }) {
  const [plzSuggestions, setPlzSuggestions] = useState(null)
  const set = (k, v) => onChange({ ...data, [k]: v })

  const handlePlzChange = (raw) => {
    set('zip_code', raw)
    let plz = raw.replace(/\D/g, '')
    // Pad with leading zeros if necessary
    while (plz.length < 4) {
      plz = '0' + plz
    }
    plz = plz.slice(0, 4)
    
    if (plz.length !== 4) return
    const result = lookupPostalCode(plz)
    if (!result) return
    
    if (!Array.isArray(result)) {
      // Single match — auto-fill
      onChange({ ...data, zip_code: plz, city: result.ort, canton: result.kanton })
      setPlzSuggestions(null)
    } else if (result.length > 0) {
      // Multiple matches — show suggestions
      set('zip_code', plz)
      setPlzSuggestions(result)
    }
  }

  const selectSuggestion = (s) => {
    onChange({ ...data, city: s.ort, canton: s.kanton })
    setPlzSuggestions(null)
  }

  return (
    <div className="space-y-3 p-3 border rounded-lg bg-muted/20">
      <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Neuen Kunden erfassen</p>
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
          <Label className="text-xs">Geburtsdatum</Label>
          <Input type="date" value={data.birthdate || ''} onChange={e => set('birthdate', e.target.value)} className="mt-1 h-8 text-sm" />
        </div>
        <div>
          <Label className="text-xs">E-Mail</Label>
          <Input type="email" value={data.email || ''} onChange={e => set('email', e.target.value)} className="mt-1 h-8 text-sm" />
        </div>
        <div>
          <Label className="text-xs">Telefon</Label>
          <Input value={data.phone || ''} onChange={e => set('phone', e.target.value)} className="mt-1 h-8 text-sm" />
        </div>
        <div className="col-span-2">
          <Label className="text-xs">Strasse + Hausnummer</Label>
          <Input value={data.street || ''} onChange={e => set('street', e.target.value)} className="mt-1 h-8 text-sm" />
        </div>
        <div>
          <Label className="text-xs flex items-center gap-1">
            PLZ <MapPin className="w-3 h-3 text-primary" />
          </Label>
          <Input
            value={data.zip_code || ''}
            onChange={e => handlePlzChange(e.target.value)}
            className="mt-1 h-8 text-sm"
            maxLength={4}
            placeholder="4-stellig"
          />
          {plzSuggestions && (
            <div className="mt-1 border rounded-md bg-background shadow-sm z-10">
              {plzSuggestions.map((s, i) => (
                <button key={i} type="button" onClick={() => selectSuggestion(s)}
                  className="w-full text-left px-3 py-1.5 text-xs hover:bg-primary/5 border-b last:border-0">
                  {s.ort} ({s.kanton})
                </button>
              ))}
            </div>
          )}
        </div>
        <div>
          <Label className="text-xs">Ort</Label>
          <Input value={data.city || ''} onChange={e => set('city', e.target.value)} className="mt-1 h-8 text-sm"
            placeholder={data.zip_code?.length === 4 ? 'Wird automatisch gefüllt' : ''} />
        </div>
        {data.canton && (
          <div className="col-span-2 flex items-center gap-1.5 text-xs text-primary">
            <MapPin className="w-3 h-3" /> Kanton: <strong>{data.canton}</strong>
          </div>
        )}
      </div>
    </div>
  )
}

// ── KI Extraction Summary ─────────────────────────────────────────────────────
function ExtractionSummary({ data }) {
  const fields = [
    { label: 'Versicherungsnehmer', value: [data.first_name, data.last_name].filter(Boolean).join(' ') || data.policy_holder_name },
    { label: 'Geburtsdatum', value: data.birthdate },
    { label: 'Adresse', value: [data.street, [data.zip_code, data.city].filter(Boolean).join(' ')].filter(Boolean).join(', ') },
    { label: 'Versicherung', value: data.insurer || data.provider },
    { label: 'Policen-Nr.', value: data.policy_number },
    { label: 'Produkt', value: data.product },
    { label: 'Jahresprämie', value: data.premium_yearly ? `CHF ${data.premium_yearly.toLocaleString('de-CH')}` : null },
  ].filter(f => f.value)

  if (!fields.length) return null

  return (
    <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg space-y-1.5">
      <p className="text-xs font-semibold text-blue-700 flex items-center gap-1.5">
        <CheckCircle2 className="w-3.5 h-3.5" /> KI-Extraktion erfolgreich
      </p>
      <div className="grid grid-cols-2 gap-x-4 gap-y-1">
        {fields.map(f => (
          <div key={f.label} className="flex gap-1 text-xs">
            <span className="text-blue-500 font-medium shrink-0">{f.label}:</span>
            <span className="text-blue-800 truncate">{f.value}</span>
          </div>
        ))}
      </div>
    </div>
  )
}

// ── Main Wizard ───────────────────────────────────────────────────────────────
export default function PolicyUploadWizard({ open, onClose, customers = [], organizations = [], onContractCreated }) {
  const [step, setStep] = useState(1)
  const [uploading, setUploading] = useState(false)
  const [extracting, setExtracting] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState(null)
  const [extractedRaw, setExtractedRaw] = useState(null)

  const [fileUrl, setFileUrl] = useState(null)
  const [fileName, setFileName] = useState('')

  const [contractList, setContractList] = useState([{
    insurer: '', policy_number: '', sparte: '', product: '',
    premium_monthly: '', premium_yearly: '', start_date: '', end_date: '',
    cancellation_deadline: '', status: 'active', notes: '', sparte_data: {}
  }])
  const [activeContractIdx, setActiveContractIdx] = useState(0)
  const contract = contractList[activeContractIdx] || contractList[0]

  const [customerMode, setCustomerMode] = useState('search')
  const [selectedCustomer, setSelectedCustomer] = useState(null)
  const [matchCandidates, setMatchCandidates] = useState([])
  const [newCustomerData, setNewCustomerData] = useState({})

  const setC = (k, v) => setContractList(prev => prev.map((c, i) => i === activeContractIdx ? { ...c, [k]: v } : c))
  const setSparteData = (k, v) => setContractList(prev => prev.map((c, i) => i === activeContractIdx ? { ...c, sparte_data: { ...c.sparte_data, [k]: v } } : c))

  const addContract = () => {
    setContractList(prev => [...prev, {
      insurer: contract.insurer, policy_number: '', sparte: '', product: '',
      premium_monthly: '', premium_yearly: '',
      start_date: contract.start_date, end_date: contract.end_date,
      cancellation_deadline: contract.cancellation_deadline,
      status: 'active', notes: '', sparte_data: {}
    }])
    setActiveContractIdx(contractList.length)
  }

  const removeContract = (idx) => {
    setContractList(prev => prev.filter((_, i) => i !== idx))
    setActiveContractIdx(Math.max(0, activeContractIdx - 1))
  }

  const sparteFields = getFieldsForSparte(contract.sparte)
  const franchiseOptions = FRANCHISE_OPTIONS[contract.sparte_data?.age_group] || FRANCHISE_OPTIONS.default

  // ── Auto-create customer and skip to step 3 ────────────────────────────────
  const createAndProceed = async (customerData) => {
    const orgId = organizations[0]?.id || ''
    const emailValue = customerData.email?.trim()
      ? customerData.email.trim()
      : `${customerData.first_name.toLowerCase()}.${customerData.last_name.toLowerCase()}.${Date.now()}@import.local`
    
    const created = await base44.entities.Customer.create({
      first_name: customerData.first_name,
      last_name: customerData.last_name,
      email: emailValue,
      phone: customerData.phone || undefined,
      birthdate: customerData.birthdate || undefined,
      street: customerData.street || undefined,
      city: customerData.city || undefined,
      zip_code: customerData.zip_code || undefined,
      canton: customerData.canton || undefined,
      organization_id: orgId,
      status: 'active',
      customer_type: 'private',
    })
    setSelectedCustomer(created)
    setCustomerMode('matched')
    setNewCustomerData(customerData)
    setStep(3)
  }

  // ── Auto-lookup PLZ → Ort + Kanton ────────────────────────────────────────────
  const autoLookupPlz = (rawPlz) => {
    if (!rawPlz || rawPlz.length !== 4) return null
    const result = lookupPostalCode(rawPlz)
    if (!result) return null
    if (Array.isArray(result)) {
      // Multiple matches — return first
      return result[0] ? { ort: result[0].ort, kanton: result[0].kanton } : null
    }
    // Single match
    return { ort: result.ort, kanton: result.kanton }
  }

  // ── Step 1: Upload + Extract ────────────────────────────────────────────────
  const handleFileUpload = async (e) => {
    try {
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
    setError(null)

    let res;
    try {
      res = await base44.functions.invoke('extractPolicyData', { file_url, file_name: file.name })
    } catch (err) {
      setExtracting(false)
      setError(`Datei konnte nicht verarbeitet werden. Bitte versuche es später erneut oder erfasse manuell.`)
      return
    }

    setExtracting(false)

    // Tolerant: Always proceed with extraction result
    const d = res?.data?.extractedData || {}

    // Auto-lookup PLZ → Ort + Kanton
    if (d.zip_code && !d.city) {
      const lookup = autoLookupPlz(d.zip_code)
      if (lookup) {
        d.city = lookup.ort
        if (!d.canton) d.canton = lookup.kanton
      }
    }
    
    setExtractedRaw(d)

      // CRITICAL: Check if extracted person is the POLICY HOLDER (Versicherungsnehmer)
      // If policy_holder_name matches a customer → that customer is the Hauptkontakt
      let policyHolderCustomer = null;
      let isChildOfPolicyHolder = false;
      
      if (d.policy_holder_name) {
        const phName = d.policy_holder_name.trim().toLowerCase();
        policyHolderCustomer = customers.find(c => {
          const fullName = `${c.first_name} ${c.last_name}`.trim().toLowerCase();
          return fullName === phName;
        });
        
        // Check if versicherte Person is DIFFERENT from Versicherungsnehmer
        const insuredName = `${d.first_name} ${d.last_name}`.trim().toLowerCase();
        if (policyHolderCustomer && insuredName !== phName) {
          isChildOfPolicyHolder = true;
        }
      }

      // Call automatic customer matching for VERSICHERTE PERSON (extracted first_name/last_name)
      let matchingResult = { decision: { action: 'new_customer' }, all_matches: [] };
      try {
        const matchRes = await base44.functions.invoke('matchCustomerAndFamily', {
          extractedData: d,
          organization_id: organizations[0]?.id || '',
          policyHolderCustomerId: policyHolderCustomer?.id || null
        });
        if (matchRes?.data?.success) {
          matchingResult = matchRes.data;
        }
      } catch (matchErr) {
        console.warn('[PolicyUploadWizard] Matching error (non-fatal):', matchErr.message);
      }

      // AUTO-SKIP TO STEP 3 if policy holder found and child detected
      if (isChildOfPolicyHolder && policyHolderCustomer) {
        setSelectedCustomer(policyHolderCustomer);
        setCustomerMode('policy_holder_main');
        setNewCustomerData({
          first_name: (d.first_name || '').trim(),
          last_name: (d.last_name || '').trim(),
          birthdate: d.birthdate || '',
          email: policyHolderCustomer.email || '', // Inherit from policy holder
          phone: (d.phone || '').trim(),
          mobile: (d.mobile || '').trim(),
          street: (d.street || '').trim(),
          city: (d.city || '').trim(),
          zip_code: (d.zip_code || '').trim(),
          canton: (d.canton || '').trim(),
          family_role: d.role === 'Kind' ? 'child' : d.role === 'Ehepartner' ? 'spouse' : 'other'
        });
        setContractList([baseContract, ...additionalContracts]);
        setActiveContractIdx(0);
        setStep(3);
        return;
      }

      // Build contracts from extracted data
      const sparteKey = mapInsuranceType(d.insurance_type) || d.insurance_type || ''
      const sparteData = d.sparte_data || {}

      const baseContract = {
        insurer: d.insurer || d.provider || '',
        policy_number: d.policy_number || '',
        sparte: sparteKey,
        product: d.product || '',
        premium_monthly: d.premium_monthly || '',
        premium_yearly: d.premium_yearly || '',
        start_date: d.start_date || '',
        end_date: d.end_date || '',
        cancellation_deadline: d.cancellation_deadline || '',
        renewal_date: d.renewal_date || '',
        notes: d.notes || '',
        sparte_data: sparteData,
        status: 'active',
      }

      const additionalContracts = (d.additional_products || []).map(ap => ({
        ...baseContract,
        sparte: 'vvg_zusatz',
        product: ap.product || '',
        premium_monthly: ap.premium_monthly || '',
        premium_yearly: ap.premium_yearly || '',
        policy_number: ap.policy_number || baseContract.policy_number,
        notes: '',
        sparte_data: {},
      }))

      setContractList([baseContract, ...additionalContracts])
      setActiveContractIdx(0)

      // Setze versicherte Person Daten
      setNewCustomerData({
        first_name: (d.first_name || '').trim(),
        last_name: (d.last_name || '').trim(),
        birthdate: d.birthdate || '',
        email: (d.email || '').trim(),
        phone: (d.phone || '').trim(),
        mobile: (d.mobile || '').trim(),
        street: (d.street || '').trim(),
        city: (d.city || '').trim(),
        zip_code: (d.zip_code || '').trim(),
        canton: (d.canton || '').trim(),
      })

      // Go to Step 2: Broker entscheidet Zuordnung
      setCustomerMode('existing_structure')
      setSelectedCustomer(null)
      setStep(2)
      } catch (err) {
        setExtracting(false)
        setError(`Fehler: ${err.message || 'Unbekannter Fehler beim Upload'}`)
      }
      }

       // ── Step 3: Save ─────────────────────────────────────────────────────────────
  const handleSave = async () => {
    setSaving(true)
    setError(null)

    try {
      const insuredFirstName = newCustomerData.first_name?.trim()
      const insuredLastName = newCustomerData.last_name?.trim()
      const insuredBirthdate = newCustomerData.birthdate

      let customerId, customerName, orgId, insuredPersonId

      // ── OPTION 1: Bestehende Familienstruktur verwenden ──
      if (customerMode === 'existing_structure') {
        if (!selectedCustomer || !selectedCustomer.id) {
          setError('Bitte einen gültigen Kunden auswählen')
          setSaving(false)
          return
        }
        customerId = selectedCustomer.id
        customerName = `${selectedCustomer.first_name || ''} ${selectedCustomer.last_name || ''}`.trim()
        orgId = selectedCustomer.organization_id
        insuredPersonId = customerId
        
        if (!orgId) {
          setError('Kunde hat keine Organisation zugewiesen')
          setSaving(false)
          return
        }
      }

      // ── OPTION 2: Versicherungsnehmer als Hauptkontakt ──
      else if (customerMode === 'policy_holder_main') {
        if (!selectedCustomer || !selectedCustomer.id) {
          setError('Bitte den Versicherungsnehmer auswählen oder erstellen')
          setSaving(false)
          return
        }
        customerId = selectedCustomer.id
        customerName = `${selectedCustomer.first_name || ''} ${selectedCustomer.last_name || ''}`.trim()
        orgId = selectedCustomer.organization_id

        if (!orgId) {
          setError('Kunde hat keine Organisation zugewiesen')
          setSaving(false)
          return
        }

        // Versicherte Person als Familienmitglied erstellen?
        if (insuredFirstName && insuredLastName && `${insuredFirstName} ${insuredLastName}` !== customerName) {
          const emailValue = newCustomerData.email?.trim()
            ? newCustomerData.email.trim()
            : `${insuredFirstName.toLowerCase().replace(/\s+/g, '.')}.${insuredLastName.toLowerCase().replace(/\s+/g, '.')}.${Date.now()}@import.local`

          try {
            const familyMember = await base44.entities.Customer.create({
              first_name: insuredFirstName,
              last_name: insuredLastName,
              email: emailValue,
              phone: newCustomerData.phone?.trim() || undefined,
              birthdate: insuredBirthdate || undefined,
              street: selectedCustomer.street || undefined,
              city: selectedCustomer.city || undefined,
              zip_code: selectedCustomer.zip_code || undefined,
              canton: selectedCustomer.canton || undefined,
              organization_id: orgId,
              status: 'active',
              customer_type: 'private',
              is_family_member: true,
              primary_customer_id: customerId,
              family_role: 'child'
            })
            insuredPersonId = familyMember.id
          } catch (familyErr) {
            console.error('[FamilyMember] Erstellung fehlgeschlagen:', familyErr)
            // Fallback: Vertrag wird dem Hauptkontakt zugeordnet
            insuredPersonId = customerId
          }
        } else {
          insuredPersonId = customerId
        }
      }

      // ── OPTION 3: Unabhängiger Kunde ──
      else if (customerMode === 'independent' || customerMode === 'new') {
        if (!insuredFirstName || !insuredLastName) {
          setError('Vorname und Nachname sind erforderlich')
          setSaving(false)
          return
        }

        const emailValue = newCustomerData.email?.trim()
          ? newCustomerData.email.trim()
          : `${insuredFirstName.toLowerCase().replace(/\s+/g, '.')}.${insuredLastName.toLowerCase().replace(/\s+/g, '.')}.${Date.now()}@import.local`

        try {
          const created = await base44.entities.Customer.create({
            first_name: insuredFirstName,
            last_name: insuredLastName,
            email: emailValue,
            phone: newCustomerData.phone?.trim() || undefined,
            birthdate: insuredBirthdate || undefined,
            street: newCustomerData.street?.trim() || undefined,
            city: newCustomerData.city?.trim() || undefined,
            zip_code: newCustomerData.zip_code?.trim() || undefined,
            canton: newCustomerData.canton?.trim() || undefined,
            organization_id: organizations[0]?.id || '',
            status: 'active',
            customer_type: 'private',
          })
          customerId = created.id
          customerName = `${insuredFirstName} ${insuredLastName}`
          orgId = created.organization_id || organizations[0]?.id || ''
          insuredPersonId = created.id

          if (!orgId) {
            setError('Konnte Organisation nicht zuweisen')
            setSaving(false)
            return
          }
        } catch (createErr) {
          console.error('[Customer] Erstellung fehlgeschlagen:', createErr)
          setError(`Kundenerstellung fehlgeschlagen: ${createErr.message || 'Unbekannter Fehler'}`)
          setSaving(false)
          return
        }
      }

      // Validierung
      if (!customerId || !insuredPersonId) {
        setError('Kritischer Fehler: Kunde/Versicherte Person konnte nicht bestimmt werden')
        setSaving(false)
        return
      }

      if (!contract?.insurer) {
        setError('Versicherungsgesellschaft ist erforderlich')
        setSaving(false)
        return
      }

      if (!orgId) {
        setError('Organisation konnte nicht bestimmt werden')
        setSaving(false)
        return
      }

      // Verträge erstellen
      let firstContract = null
      for (let i = 0; i < contractList.length; i++) {
        const c = contractList[i]
        if (!c.insurer) continue

        try {
          const created = await base44.entities.Contract.create({
            customer_id: insuredPersonId,
            customer_name: insuredFirstName && insuredLastName ? `${insuredFirstName} ${insuredLastName}` : customerName,
            primary_customer_id: customerId,
            is_family_member: insuredPersonId !== customerId,
            organization_id: orgId,
            advisor_id: selectedCustomer?.advisor_id || undefined,
            insurer: c.insurer,
            policy_number: c.policy_number?.trim() || undefined,
            insurance_type: c.sparte || undefined,
            sparte: c.sparte || undefined,
            sparte_data: c.sparte_data && Object.keys(c.sparte_data).length > 0 ? c.sparte_data : undefined,
            product: c.product?.trim() || undefined,
            premium_monthly: c.premium_monthly ? Number(c.premium_monthly) : undefined,
            premium_yearly: c.premium_yearly ? Number(c.premium_yearly) : undefined,
            start_date: c.start_date || undefined,
            end_date: c.end_date || undefined,
            cancellation_deadline: c.cancellation_deadline || undefined,
            status: 'active',
            policy_document_url: i === 0 && fileUrl ? fileUrl : undefined,
            notes: c.notes?.trim() || undefined,
          })
          if (i === 0) firstContract = created
        } catch (contractErr) {
          console.error(`[Contract ${i}] Erstellung fehlgeschlagen:`, contractErr)
          if (i === 0) {
            setError(`Vertragserstellung fehlgeschlagen: ${contractErr.message || 'Unbekannter Fehler'}`)
            setSaving(false)
            return
          }
          // Fehler bei Zusatzversicherungen nicht kritisch → weitermachen
        }
      }

      if (!firstContract) {
        setError('Mindestens ein Vertrag muss erstellt werden')
        setSaving(false)
        return
      }

      // Dokument verknüpfen
      if (fileUrl && firstContract?.id) {
        try {
          await base44.entities.Document.create({
            name: fileName,
            file_url: fileUrl,
            customer_id: insuredPersonId,
            customer_name: insuredFirstName && insuredLastName ? `${insuredFirstName} ${insuredLastName}` : customerName,
            category: 'contract',
            doc_type: 'anlage',
            classification_status: 'klassifiziert',
            linked_contract_id: firstContract.id,
          })
        } catch (docErr) {
          console.warn('[Document] Verknüpfung fehlgeschlagen:', docErr)
          // Nicht kritisch
        }
      }

      setSaving(false)
      setStep(4)
      onContractCreated?.(firstContract)

    } catch (err) {
      console.error('[handleSave] Unerwarteter Fehler:', err)
      setError(`Fehler: ${err.message || 'Unbekannter Fehler beim Speichern'}`)
      setSaving(false)
    }
  }

  const handleClose = () => {
    setStep(1); setFileUrl(null); setFileName(''); setError(null); setExtractedRaw(null)
    setContractList([{ insurer: '', policy_number: '', sparte: '', product: '', premium_monthly: '', premium_yearly: '', start_date: '', end_date: '', cancellation_deadline: '', status: 'active', notes: '', sparte_data: {} }])
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
                <p className="text-sm text-muted-foreground">
                  {uploading ? '' : 'Name, Adresse, Vertragsdaten werden automatisch erkannt'}
                </p>
              </div>
            ) : (
              <>
                <div className="w-20 h-20 rounded-2xl bg-primary/10 flex items-center justify-center">
                  <Upload className="w-10 h-10 text-primary" />
                </div>
                <div className="text-center">
                  <p className="font-semibold text-lg">Police hochladen</p>
                  <p className="text-sm text-muted-foreground mt-1">
                    KI erkennt automatisch: Name, Vorname, Geburtsdatum, Adresse, PLZ/Ort, Vertragsdaten
                  </p>
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
             {extractedRaw && <ExtractionSummary data={extractedRaw} />}

             {/* BROKER DECISION: Wie wird die Police zugeordnet? */}
             <div className="p-4 bg-blue-50 border-2 border-blue-300 rounded-lg space-y-3">
               <p className="text-sm font-bold text-blue-900">📋 KI-Analyse:</p>
               <div className="space-y-2 text-xs">
                 {extractedRaw?.policy_holder_name && (
                   <div className="flex items-start gap-2">
                     <span className="text-blue-600 font-bold">Versicherungsnehmer:</span>
                     <span className="text-blue-800">{extractedRaw.policy_holder_name}</span>
                   </div>
                 )}
                 {(extractedRaw?.first_name || extractedRaw?.last_name) && (
                   <div className="flex items-start gap-2">
                     <span className="text-blue-600 font-bold">Versicherte Person:</span>
                     <span className="text-blue-800">{extractedRaw.first_name} {extractedRaw.last_name}</span>
                   </div>
                 )}
               </div>
             </div>

             {/* OPTION 1: Bestehende CRM Struktur verwenden */}
             <div className="p-4 bg-green-50 border-2 border-green-200 rounded-lg space-y-3">
               <button
                 type="button"
                 onClick={() => { setCustomerMode('existing_structure'); setSelectedCustomer(null) }}
                 className="w-full flex items-center gap-3 text-left hover:opacity-80"
               >
                 <input type="radio" checked={customerMode === 'existing_structure'} readOnly className="w-4 h-4" />
                 <div>
                   <p className="font-semibold text-sm text-green-900">✓ Bestehende Familienstruktur verwenden</p>
                   <p className="text-xs text-green-700 mt-1">Keine Änderungen. CRM Rollen bleiben bestehen.</p>
                 </div>
               </button>
               {customerMode === 'existing_structure' && (
                 <div className="ml-7 space-y-2 text-xs border-t border-green-200 pt-2">
                   <p className="text-green-800 font-semibold">Suche existierende Struktur...</p>
                   <CustomerSearch customers={customers} onSelect={c => { setSelectedCustomer(c); }} />
                 </div>
               )}
             </div>

             {/* OPTION 2: Versicherungsnehmer als Hauptkontakt */}
             <div className="p-4 bg-amber-50 border-2 border-amber-200 rounded-lg space-y-3">
               <button
                 type="button"
                 onClick={() => { setCustomerMode('policy_holder_main'); setSelectedCustomer(null) }}
                 className="w-full flex items-center gap-3 text-left hover:opacity-80"
               >
                 <input type="radio" checked={customerMode === 'policy_holder_main'} readOnly className="w-4 h-4" />
                 <div>
                   <p className="font-semibold text-sm text-amber-900">👤 Versicherungsnehmer als Hauptkontakt</p>
                   <p className="text-xs text-amber-700 mt-1">{extractedRaw?.policy_holder_name || 'KI erkannt'} = Hauptkontakt, Versicherte Person = Familienmitglied</p>
                 </div>
               </button>
               {customerMode === 'policy_holder_main' && (
                 <div className="ml-7 space-y-2 text-xs border-t border-amber-200 pt-2">
                   <p className="text-amber-800">Suche Versicherungsnehmer: <span className="font-bold">{extractedRaw?.policy_holder_name}</span></p>
                   <CustomerSearch customers={customers} onSelect={c => { setSelectedCustomer(c); setNewCustomerData(prev => ({...prev, is_family_member: true})) }} />
                   {!selectedCustomer && (
                     <button
                       type="button"
                       onClick={() => { setCustomerMode('new'); setNewCustomerData({first_name: extractedRaw?.policy_holder_name?.split(' ')[0] || '', last_name: extractedRaw?.policy_holder_name?.split(' ').slice(1).join(' ') || ''}) }}
                       className="flex items-center gap-2 text-xs text-primary hover:underline font-medium"
                     >
                       <UserPlus className="w-3 h-3" /> Neuen Kunden erstellen
                     </button>
                   )}
                 </div>
               )}
             </div>

             {/* OPTION 3: Unabhängiger Kunde */}
             <div className="p-4 bg-slate-50 border-2 border-slate-200 rounded-lg space-y-3">
               <button
                 type="button"
                 onClick={() => { setCustomerMode('independent'); setSelectedCustomer(null) }}
                 className="w-full flex items-center gap-3 text-left hover:opacity-80"
               >
                 <input type="radio" checked={customerMode === 'independent'} readOnly className="w-4 h-4" />
                 <div>
                   <p className="font-semibold text-sm text-slate-900">🆕 Eigenständiger Kunde</p>
                   <p className="text-xs text-slate-600 mt-1">Neue Familie oder unabhängige Person. Keine Verknüpfung zu bestehender Struktur.</p>
                 </div>
               </button>
               {customerMode === 'independent' && (
                 <div className="ml-7 space-y-2 text-xs border-t border-slate-200 pt-2">
                   <NewCustomerForm data={newCustomerData} onChange={setNewCustomerData} />
                 </div>
               )}
             </div>

             {/* FAMILY MEMBER — MANUAL PRIMARY SELECTION (legacy) */}
             {customerMode === 'family_member_manual' && (
               <div className="p-4 bg-emerald-50 border-2 border-emerald-300 rounded-lg space-y-3">
                 <p className="text-sm font-bold text-emerald-900">✓ Bestehendes Familienmitglied erkannt</p>
                 <div className="grid grid-cols-2 gap-3 text-xs">
                   <div className="bg-white p-2 rounded border border-emerald-100">
                     <p className="text-muted-foreground font-semibold">Hauptkontakt</p>
                     <p className="font-bold text-sm mt-1">{selectedCustomer.first_name} {selectedCustomer.last_name}</p>
                     <p className="text-[10px] text-muted-foreground mt-0.5">{selectedCustomer.birthdate || '–'}</p>
                   </div>
                   <div className="bg-emerald-100/50 p-2 rounded border border-emerald-200">
                     <p className="text-muted-foreground font-semibold">Erkannte Person</p>
                     <p className="font-bold text-sm mt-1">{newCustomerData.first_name} {newCustomerData.last_name}</p>
                     <p className="text-[10px] text-emerald-700 font-semibold mt-0.5">bereits im System</p>
                   </div>
                   <div className="col-span-2 bg-emerald-100/50 p-2 rounded text-xs">
                     <p>✓ Familienverknüpfung bleibt bestehen</p>
                     <p className="text-muted-foreground text-[10px] mt-0.5">Die Police wird dem Familienmitglied zugeordnet</p>
                   </div>
                 </div>
               </div>
             )}

             {/* NEW FAMILY MEMBER DETECTION UI */}
             {customerMode === 'family_member' && selectedCustomer && (
               <div className="p-4 bg-blue-50 border-2 border-blue-300 rounded-lg space-y-3">
                 <p className="text-sm font-bold text-blue-900">👨‍👩‍👧 Familienmitglied erkannt</p>
                 <div className="grid grid-cols-2 gap-3 text-xs">
                   <div className="bg-white p-2 rounded border border-blue-100">
                     <p className="text-muted-foreground font-semibold">Hauptkontakt</p>
                     <p className="font-bold text-sm mt-1">{selectedCustomer.first_name} {selectedCustomer.last_name}</p>
                     <p className="text-[10px] text-muted-foreground mt-0.5">{selectedCustomer.birthdate || '–'}</p>
                   </div>
                   <div className="bg-white p-2 rounded border border-blue-100">
                     <p className="text-muted-foreground font-semibold">Neue Person</p>
                     <p className="font-bold text-sm mt-1">{newCustomerData.first_name || '?'} {newCustomerData.last_name || '?'}</p>
                     <p className="text-[10px] text-muted-foreground mt-0.5">{newCustomerData.birthdate || 'kein Geburtsdatum'}</p>
                   </div>
                   <div className="col-span-2 bg-blue-100/50 p-2 rounded text-xs">
                     <p>📍 Gemeinsame Adresse: {selectedCustomer.street || '–'}, {selectedCustomer.zip_code || '–'} {selectedCustomer.city || '–'}</p>
                   </div>
                 </div>
                 <div className="space-y-2">
                   <p className="text-xs font-semibold text-blue-800">Familienmitglied als:</p>
                   <div className="flex gap-2 flex-wrap">
                     {[
                       { value: 'spouse', label: '👰 Ehepartner/in' },
                       { value: 'child', label: '👧 Kind' },
                       { value: 'parent', label: '👴 Elternteil' },
                       { value: 'other', label: '👥 Sonstiges' }
                     ].map(opt => (
                       <button
                         key={opt.value}
                         type="button"
                         onClick={() => setNewCustomerData(p => ({ ...p, family_role: opt.value }))}
                         className={`px-3 py-1.5 text-xs font-medium rounded-lg border transition-colors ${
                           newCustomerData.family_role === opt.value
                             ? 'bg-blue-600 text-white border-blue-600'
                             : 'bg-white border-blue-200 text-blue-800 hover:border-blue-400'
                         }`}
                       >
                         {opt.label}
                       </button>
                     ))}
                   </div>
                 </div>
               </div>
             )}

            <p className="text-sm text-muted-foreground">Wem gehört diese Police?</p>

            {/* Auto-matched candidates */}
            {matchCandidates.length > 0 && customerMode !== 'new' && (
              <div className="space-y-2">
                <p className="text-xs font-semibold text-muted-foreground uppercase">KI-Vorschläge ({matchCandidates.length})</p>
                {matchCandidates.slice(0, 3).map(({ customer: c, score }) => (
                  <button key={c.id} type="button"
                    onClick={() => { setSelectedCustomer(c); setCustomerMode('matched') }}
                    className={`w-full flex items-center gap-3 p-3 rounded-lg border-2 text-left transition-colors ${selectedCustomer?.id === c.id ? 'border-primary bg-primary/5' : 'border-border hover:border-primary/40'}`}
                  >
                    <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold flex-shrink-0 ${score >= 80 ? 'bg-green-100 text-green-700' : 'bg-amber-100 text-amber-700'}`}>
                      {(c.first_name?.[0] || '') + (c.last_name?.[0] || '')}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-sm">{c.first_name} {c.last_name}</p>
                      <p className="text-xs text-muted-foreground">
                        {c.email || ''}{c.birthdate ? ` · Geb. ${c.birthdate}` : ''}{c.city ? ` · ${c.city}` : ''}
                      </p>
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

            {(customerMode === 'search' || (!selectedCustomer && customerMode !== 'new')) && (
              <div className="space-y-2">
                {matchCandidates.length === 0 && <p className="text-xs text-muted-foreground">Kein automatischer Treffer — bitte manuell suchen:</p>}
                <CustomerSearch customers={customers} onSelect={c => { setSelectedCustomer(c); setCustomerMode('matched') }} />
              </div>
            )}

            {(customerMode === 'search' || customerMode === 'matched' || !selectedCustomer) && (
              <div className="space-y-2 p-3 bg-blue-50 border border-blue-200 rounded-lg">
                <p className="text-xs font-semibold text-blue-900">💡 Tipp:</p>
                <p className="text-xs text-blue-800">Der Hauptkontakt muss existieren. Falls die versicherte Person ein Kind ist, wähle den Elternteil oder Vormund als Hauptkontakt.</p>
              </div>
            )}

            {customerMode !== 'new' && (
              <button type="button" onClick={() => { setCustomerMode('new'); setSelectedCustomer(null) }}
                className="flex items-center gap-2 text-sm text-primary hover:underline">
                <UserPlus className="w-4 h-4" /> Neuen Kunden erfassen
              </button>
            )}

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
              <Button onClick={() => setStep(3)} disabled={!selectedCustomer && customerMode !== 'new'}>
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

            {/* Show Hauptkontakt + Versicherte Person */}
            {selectedCustomer && (newCustomerData.first_name || newCustomerData.last_name) && (
              <div className="grid grid-cols-2 gap-3 p-3 bg-blue-50 border border-blue-200 rounded-lg text-xs">
                <div className="bg-white p-2 rounded border border-blue-100">
                  <p className="text-muted-foreground font-semibold">👤 Hauptkontakt</p>
                  <p className="font-bold text-sm mt-1">{selectedCustomer.first_name} {selectedCustomer.last_name}</p>
                </div>
                <div className="bg-white p-2 rounded border border-blue-100">
                  <p className="text-muted-foreground font-semibold">🔍 Versicherte Person</p>
                  <p className="font-bold text-sm mt-1">{newCustomerData.first_name} {newCustomerData.last_name}</p>
                  {newCustomerData.birthdate && <p className="text-[10px] text-muted-foreground mt-0.5">Geb: {newCustomerData.birthdate}</p>}
                </div>
              </div>
            )}

            {/* Multi-contract tabs */}
            <div className="flex items-center gap-2 flex-wrap">
              {contractList.map((c, i) => (
                <button key={i} type="button" onClick={() => setActiveContractIdx(i)}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors ${activeContractIdx === i ? 'bg-primary text-primary-foreground border-primary' : 'bg-background border-border hover:border-primary/40'}`}
                >
                  {i === 0 ? '📋 Grundversicherung' : `➕ Zusatz ${i}`}
                  {c.product && <span className="opacity-70 truncate max-w-[80px]">– {c.product}</span>}
                  {contractList.length > 1 && i > 0 && (
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
                <Select value={contract.sparte} onValueChange={v => setContractList(prev => prev.map((c, i) => i === activeContractIdx ? { ...c, sparte: v, insurance_type: v, sparte_data: {} } : c))}>
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
                <Input value={contract.product} onChange={e => setC('product', e.target.value)}
                  placeholder="z.B. COMPACT, HMO 1500, Vollkasko SB500..."
                  className="mt-1 h-8 text-sm border-primary/30" />
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
                {saving ? <><Loader2 className="w-4 h-4 animate-spin mr-2" />Speichern...</> : `✓ ${contractList.length > 1 ? `${contractList.length} Verträge` : 'Vertrag'} erstellen`}
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
                Police hochgeladen und {contractList.length > 1 ? `${contractList.length} Verträge` : 'Vertrag'} beim Kunden erfasst.
              </p>
            </div>
            <Button onClick={handleClose}>Schliessen</Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}