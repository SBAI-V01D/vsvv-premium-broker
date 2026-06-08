import React, { useState, useRef, useEffect, useMemo } from 'react'
import { base44 } from '@/api/base44Client'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Button } from '@/components/ui/button'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Search, X, AlertTriangle } from 'lucide-react'
import { Textarea } from '@/components/ui/textarea'
import { DialogFooter } from '@/components/ui/dialog'
import { ALL_SPARTEN, SPARTEN_PRIVAT, SPARTEN_FIRMA, getFieldsForSparte, FRANCHISE_OPTIONS, getSparteLabel } from '@/lib/insuranceSparten'
import { useQuery } from '@tanstack/react-query'
import { useAuth } from '@/lib/AuthContext'

// Commission estimates by sparte
const COMMISSION_ESTIMATES = {
  'kvg': 500.00,                    // Krankenversicherung
  'kvg_vvg_kombi': 500.00,          // KVG + VVG
  'vvg_zusatz': 500.00,             // VVG Zusatz
  'hausrat': 200.00,                // Haushaltsversicherung
  'motorfahrzeug': 400.00,          // Motorfahrzeugversicherung
  'rechtsschutz': 350.00,           // Rechtschutzversicherung
  'gebaueude': 200.00,              // Gebäude
  'leben': 300.00,                  // Leben
  'haftpflicht': 200.00,            // Haftpflicht
  'unfall': 300.00,                 // Unfall
  'default': 300.00,                // Standard
}

const SWISS_INSURERS = [
  'Allianz','Axa','Baloise','CSS','Concordia','Die Mobiliar','Elvia','Generali',
  'Helvetia','Helsana','Mutuel','ÖKK','SWICA','Sanitas','Smile','Suva',
  'Swiss Life','Swiss Re','TCS','Visana','Zurich','Andere',
]

// Group sparten by group label
const grouped = ALL_SPARTEN.reduce((acc, s) => {
  if (!acc[s.group]) acc[s.group] = []
  acc[s.group].push(s)
  return acc
}, {})

function AdvisorSelect({ value, onChange }) {
  const { data: advisors = [] } = useQuery({
    queryKey: ['advisors-all'],
    queryFn: () => base44.entities.Advisor.list(),
    staleTime: 60_000,
  })
  const active = advisors.filter(a => a.status === 'active')

  // Resolve initial value: match by id, email, or name string
  const resolvedId = useMemo(() => {
    if (!value) return '__none__'
    const byId = active.find(a => a.id === value)
    if (byId) return byId.id
    const byEmail = active.find(a => a.email === value)
    if (byEmail) return byEmail.id
    const byName = active.find(a => `${a.firstname} ${a.lastname}`.trim() === value)
    if (byName) return byName.id
    return '__none__'
  }, [value, active])

  const handleChange = (id) => {
    if (id === '__none__') { onChange(''); return }
    const advisor = active.find(a => a.id === id)
    if (advisor) onChange(advisor.id)
  }

  return (
    <div>
      <Label>Zuständiger Berater</Label>
      <Select value={resolvedId} onValueChange={handleChange}>
        <SelectTrigger className="mt-1"><SelectValue placeholder="Berater auswählen" /></SelectTrigger>
        <SelectContent>
          <SelectItem value="__none__">– kein Berater –</SelectItem>
          {active.map(a => (
            <SelectItem key={a.id} value={a.id}>
              {`${a.firstname} ${a.lastname}`.trim()}
              {a.organization_name ? ` · ${a.organization_name}` : ''}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  )
}

export default function ApplicationForm({ application, customers = [], brokers = [], onSave, onCancel, saving, classificationDebug }) {
  const { user } = useAuth()

  // Advisors für Standardberater-Lookup
  const { data: advisors = [] } = useQuery({
    queryKey: ['advisors-all'],
    queryFn: () => base44.entities.Advisor.list(),
    staleTime: 60_000,
  })

  // Standardberater: eingeloggter User → passenden Advisor suchen
  const defaultAdvisorId = useMemo(() => {
    if (!user || !advisors.length) return ''
    const match = advisors.find(a => a.email === user.email)
    return match?.id || ''
  }, [user, advisors])

  const [form, setForm] = useState(() => {
    if (application) {
      return {
        ...application,
        sparte: application.sparte || application.insurance_type || '',
        sparte_data: application.sparte_data || {},
        kundentyp: application.kundentyp || 'privat',
        estimated_premium_monthly: application.estimated_premium_monthly || '',
        estimated_premium_yearly: application.estimated_premium_yearly || '',
        requested_start_date: application.requested_start_date || '',
        policy_number: application.policy_number || '',
        contract_start_date: application.contract_start_date || '',
        contract_end_date: application.contract_end_date || '',
        acceptance_date: application.acceptance_date || '',
        commission_estimate: application.commission_estimate || '',
        assigned_broker: application.assigned_broker || '',
        notes: application.notes || '',
      }
    }
    return {
      customer_id: '',
      insurance_type: '',
      sparte: '',
      product: '',
      insurer: '',
      status: 'draft',
      kundentyp: 'privat',
      estimated_premium_monthly: '',
      estimated_premium_yearly: '',
      requested_start_date: '',
      policy_number: '',
      contract_start_date: '',
      contract_end_date: '',
      acceptance_date: '',
      commission_estimate: '',
      assigned_broker: '',
      notes: '',
      sparte_data: {},
    }
  })

  // Standardberater setzen sobald verfügbar (nur für neue Anträge)
  useEffect(() => {
    if (!application && defaultAdvisorId && !form.assigned_broker) {
      setForm(prev => ({ ...prev, assigned_broker: defaultAdvisorId }))
    }
  }, [defaultAdvisorId])

  // Ablöse-Workflow State
  const [abloeseActive, setAbloeseActive] = useState(false)
  const [abloeseContractId, setAbloeseContractId] = useState('')

  // Verträge des gewählten Kunden für Ablöse-Auswahl
  const { data: customerContracts = [] } = useQuery({
    queryKey: ['contracts-for-customer', form.customer_id],
    queryFn: () => base44.entities.Contract.filter({ customer_id: form.customer_id, archived: false }),
    enabled: !!form.customer_id && abloeseActive,
    staleTime: 30_000,
  })

  // Sparte ist gesperrt wenn sie bereits klassifiziert wurde
  const isSparteLockedByClassification = application?.sparte && classificationDebug

  const selectedCustomer = customers.find(c => c.id === form.customer_id)
  const set = (k, v) => setForm(prev => ({ ...prev, [k]: v }))
  const setSparte = (v) => {
    // Auto-set commission estimate based on sparte
    const commission = COMMISSION_ESTIMATES[v] || COMMISSION_ESTIMATES.default
    setForm(prev => ({ 
      ...prev, 
      sparte: v, 
      insurance_type: v, 
      sparte_data: {},
      commission_estimate: commission
    }))
  }
  const setSparteData = (k, v) => setForm(prev => ({ ...prev, sparte_data: { ...prev.sparte_data, [k]: v } }))

  // Customer search state
   const [customerQuery, setCustomerQuery] = useState(() => {
     if (application?.customer_id && customers.length > 0) {
       const c = customers.find(c => c.id === application.customer_id)
       if (c) return c.company_name || `${c.first_name} ${c.last_name}`
     }
     return ''
   })
  const [showDropdown, setShowDropdown] = useState(false)
  const dropdownRef = useRef(null)

  useEffect(() => {
     // Wenn Antrag und Customers geladen sind, aber CustomerQuery leer ist, initialisiere es
     if (application?.customer_id && customers.length > 0 && !customerQuery) {
       const c = customers.find(c => c.id === application.customer_id)
       if (c) {
         setCustomerQuery(c.company_name || `${c.first_name} ${c.last_name}`)
         set('customer_id', c.id)
       }
     }
   }, [application?.customer_id, customers.length])

   useEffect(() => {
     const handler = (e) => {
       if (dropdownRef.current && !dropdownRef.current.contains(e.target)) {
         setShowDropdown(false)
       }
     }
     document.addEventListener('mousedown', handler)
     return () => document.removeEventListener('mousedown', handler)
   }, [])

  const customerResults = customerQuery.trim().length < 1 ? [] : customers
    .filter(c => {
      const haystack = [c.first_name, c.last_name, c.company_name, c.email, c.zip_code, c.city]
        .filter(Boolean).join(' ').toLowerCase()
      return haystack.includes(customerQuery.toLowerCase())
    })
    .slice(0, 12)

  const handleSelectCustomer = (c) => {
    set('customer_id', c.id)
    setCustomerQuery(c.company_name || `${c.first_name} ${c.last_name}`)
    setShowDropdown(false)
  }

  const sparteFields = getFieldsForSparte(form.sparte)
  const franchiseOptions = FRANCHISE_OPTIONS[form.sparte_data?.age_group] || FRANCHISE_OPTIONS.default

  // Determine which field groups to show based on sparte
  const isHealthInsurance = ['kvg', 'kvg_vvg_kombi', 'vvg_zusatz'].includes(form.sparte)
  const isHouseholdInsurance = ['hausrat', 'gebaude_privat'].includes(form.sparte)
  const isMotorVehicle = form.sparte === 'motorfahrzeug'
  const isLife = form.sparte && form.sparte.startsWith('leben')

  const handleSubmit = (e) => {
    e.preventDefault()
    const sparteKey = form.sparte || ''
    // Derive organization_id and advisor_id from selected customer or existing form data
    const orgId = selectedCustomer?.organization_id || form.organization_id || ''
    const advisorId = selectedCustomer?.advisor_id || form.advisor_id || ''
    onSave({
      customer_id: form.customer_id,
      customer_name: selectedCustomer
        ? (selectedCustomer.company_name || `${selectedCustomer.first_name} ${selectedCustomer.last_name}`.trim())
        : form.customer_name,
      primary_customer_id: selectedCustomer?.is_family_member ? selectedCustomer.primary_customer_id : (selectedCustomer?.id || form.primary_customer_id),
      is_family_member: selectedCustomer?.is_family_member || false,
      organization_id: orgId,
      advisor_id: advisorId,
      kundentyp: form.kundentyp || 'privat',
      sparte: sparteKey,
      insurance_type: sparteKey,
      sparte_data: form.sparte_data || {},
      product: form.product || '',
      insurer: form.insurer || '',
      status: form.status || 'draft',
      custom_status: form.custom_status,
      linked_contract_id: form.linked_contract_id,
      estimated_premium_monthly: form.estimated_premium_monthly ? Number(form.estimated_premium_monthly) : undefined,
      estimated_premium_yearly: form.estimated_premium_yearly ? Number(form.estimated_premium_yearly) : undefined,
      commission_estimate: form.commission_estimate ? Number(form.commission_estimate) : undefined,
      requested_start_date: form.requested_start_date || '',
      policy_number: form.policy_number || '',
      contract_start_date: form.contract_start_date || '',
      contract_end_date: form.contract_end_date || '',
      acceptance_date: form.acceptance_date || '',
      assigned_broker: form.assigned_broker || '',
      notes: form.notes || '',
      abloese_contract_id: (abloeseActive && abloeseContractId) ? abloeseContractId : null,
    })
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      {/* Kunde – Suchfeld */}
      <div>
        <Label>Kunde *</Label>
        <div className="relative mt-1" ref={dropdownRef}>
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground pointer-events-none" />
          <Input
            value={customerQuery}
            onChange={e => {
              setCustomerQuery(e.target.value)
              setShowDropdown(true)
              if (!e.target.value) set('customer_id', '')
            }}
            onFocus={() => setShowDropdown(true)}
            placeholder="Name, Firma, E-Mail, PLZ suchen..."
            className="pl-9 pr-8"
          />
          {customerQuery && (
            <button
              type="button"
              onClick={() => { setCustomerQuery(''); set('customer_id', ''); setShowDropdown(false) }}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
          {showDropdown && customerResults.length > 0 && (
            <div className="absolute z-50 left-0 right-0 mt-1 border rounded-lg bg-card shadow-lg overflow-hidden max-h-60 overflow-y-auto">
              {customerResults.map(c => (
                <button
                  key={c.id}
                  type="button"
                  onClick={() => handleSelectCustomer(c)}
                  className="w-full flex items-center gap-2 px-3 py-2 hover:bg-muted/60 text-left text-sm border-b last:border-0"
                >
                  <div className="w-7 h-7 rounded-full bg-primary/10 flex items-center justify-center text-primary font-bold flex-shrink-0 text-xs">
                    {c.first_name?.[0]}{c.last_name?.[0]}
                  </div>
                  <div className="min-w-0">
                    <p className="font-medium truncate">
                      {c.company_name ? c.company_name : `${c.first_name} ${c.last_name}`}
                      {c.is_family_member && <span className="ml-1 text-xs text-muted-foreground">({c.family_role})</span>}
                    </p>
                    <p className="text-xs text-muted-foreground truncate">
                      {c.first_name} {c.last_name}{c.birthdate ? ` · ${c.birthdate}` : ''}{c.zip_code ? ` · ${c.zip_code} ${c.city || ''}` : ''}{c.email ? ` · ${c.email}` : ''}
                    </p>
                  </div>
                </button>
              ))}
            </div>
          )}
          {showDropdown && customerQuery.trim().length >= 1 && customerResults.length === 0 && (
            <div className="absolute z-50 left-0 right-0 mt-1 border rounded-lg bg-card shadow-lg px-3 py-2 text-xs text-muted-foreground">
              Kein Treffer für „{customerQuery}"
            </div>
          )}
        </div>
        {form.customer_id && (
          <p className="text-xs text-green-600 mt-1">✓ Kunde gesetzt (ID: {form.customer_id.slice(0, 8)}...)</p>
        )}
      </div>

      {/* Kundentyp */}
      <div>
        <Label>Kundentyp *</Label>
        <Select value={form.kundentyp || 'privat'} onValueChange={v => set('kundentyp', v)}>
          <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="privat">Privatkunde</SelectItem>
            <SelectItem value="firma">Firmenkunde / KMU</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* AHV-Nummer des gewählten Kunden anzeigen */}
      {selectedCustomer?.ahv_number && (
        <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg text-sm">
          <span className="text-blue-600 font-medium">AHV-Nummer: </span>
          <span className="font-mono">{selectedCustomer.ahv_number}</span>
        </div>
      )}

      {/* Klassifizierungs-Info + Sparten-Locking anzeigen */}
      {classificationDebug && (
        <div className={`p-4 rounded-lg border ${application?.sparte ? 'bg-green-50 border-green-200' : 'bg-amber-50 border-amber-200'}`}>
          <div className="flex items-center gap-2 mb-2">
            <p className={`text-sm font-medium flex-1 ${application?.sparte ? 'text-green-700' : 'text-amber-700'}`}>
              ✓ {classificationDebug.debug}
            </p>
            {application?.sparte && (
              <span className="text-xs bg-green-100 text-green-700 px-2 py-1 rounded font-semibold">🔒 LOCKED</span>
            )}
          </div>
          {classificationDebug.matchedKeywords?.length > 0 && (
            <p className={`text-xs mt-2 ${application?.sparte ? 'text-green-600' : 'text-amber-600'}`}>
              Erkannte Keywords: {classificationDebug.matchedKeywords.join(', ')}
            </p>
          )}
        </div>
      )}

      {/* Sparte – GESPERRT wenn klassifiziert */}
      <div>
        <Label>Versicherungssparte *</Label>
        {isSparteLockedByClassification ? (
          <div className="mt-1 px-4 py-2 rounded-md bg-muted/40 border border-border flex items-center justify-between">
            <span className="font-medium text-sm">{getSparteLabel(form.sparte)}</span>
            <span className="text-xs bg-green-100 text-green-700 px-2 py-1 rounded">🔒 Automatisch erkannt</span>
          </div>
        ) : (
          <Select value={form.sparte} onValueChange={setSparte}>
            <SelectTrigger className="mt-1"><SelectValue placeholder="Sparte wählen" /></SelectTrigger>
            <SelectContent>
              {Object.entries(grouped).map(([group, items]) => (
                <div key={group}>
                  <div className="px-2 py-1 text-xs font-semibold text-muted-foreground bg-muted/50 sticky top-0">{group}</div>
                  {items.map(s => (
                    <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>
                  ))}
                </div>
              ))}
            </SelectContent>
          </Select>
        )}
      </div>

      {/* Versicherer */}
      <div className="grid grid-cols-2 gap-3">
        <div>
          <Label>Versicherungsgesellschaft *</Label>
          <Select value={form.insurer} onValueChange={v => set('insurer', v)}>
            <SelectTrigger className="mt-1"><SelectValue placeholder="Gesellschaft wählen" /></SelectTrigger>
            <SelectContent>
              {SWISS_INSURERS.map(ins => <SelectItem key={ins} value={ins}>{ins}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <div>
          <Label>Produkt / Tarif</Label>
          <Input value={form.product} onChange={e => set('product', e.target.value)} className="mt-1" placeholder="z.B. myFlex, 3a-Protect..." />
        </div>
      </div>

      {/* Dynamische Sparten-Felder */}
      {sparteFields.length > 0 && (
        <div className="p-4 bg-muted/30 rounded-lg border border-border space-y-4">
          <p className="text-sm font-semibold text-foreground">
            {isHealthInsurance && '🏥 Krankenversicherung – Spezifische Angaben'}
            {isHouseholdInsurance && '🏠 Haushaltsversicherung – Spezifische Angaben'}
            {isMotorVehicle && '🚗 Motorfahrzeug – Spezifische Angaben'}
            {isLife && '📋 Lebensversicherung – Spezifische Angaben'}
            {!isHealthInsurance && !isHouseholdInsurance && !isMotorVehicle && !isLife && 'Spartenspezifische Angaben'}
          </p>
          <div className="grid grid-cols-2 gap-3">
            {sparteFields.map(field => (
              <div key={field.key}>
                <Label>{field.label}</Label>
                {field.type === 'franchise' ? (
                  <Select
                    value={form.sparte_data?.[field.key] || ''}
                    onValueChange={v => setSparteData(field.key, v)}
                  >
                    <SelectTrigger className="mt-1"><SelectValue placeholder="Franchise wählen" /></SelectTrigger>
                    <SelectContent>
                      {franchiseOptions.map(o => <SelectItem key={o} value={o}>CHF {o}</SelectItem>)}
                    </SelectContent>
                  </Select>
                ) : field.type === 'select' ? (
                  <Select
                    value={form.sparte_data?.[field.key] || ''}
                    onValueChange={v => setSparteData(field.key, v)}
                  >
                    <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {field.options.map(o => <SelectItem key={o} value={o}>{o}</SelectItem>)}
                    </SelectContent>
                  </Select>
                ) : (
                  <Input
                    type={field.type}
                    value={form.sparte_data?.[field.key] || ''}
                    onChange={e => setSparteData(field.key, e.target.value)}
                    placeholder={field.placeholder || ''}
                    className="mt-1"
                  />
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Info: Was ist versteckt basierend auf Sparte */}
      {form.sparte && !sparteFields.length && (
        <div className="p-4 bg-amber-50 border border-amber-200 rounded-lg text-sm text-amber-800">
          <p className="font-medium">✓ Sparte erkannt: {getSparteLabel(form.sparte)}</p>
          <p className="text-xs mt-1">
            {isHealthInsurance && 'Felder für Franchise, Modell und Altersgruppe sind verfügbar.'}
            {isHouseholdInsurance && 'Keine zusätzlichen Felder erforderlich – Basis-Daten ausreichend.'}
            {isMotorVehicle && 'Fahrzeug- und Haftpflicht-Daten können hinzugefügt werden.'}
            {isLife && 'Altersgruppe und Auszahlungsoptionen verfügbar.'}
          </p>
        </div>
      )}

      {/* Prämien */}
      <div className="grid grid-cols-2 gap-3">
        <div>
          <Label>Geschätzte Monatsprämie (CHF)</Label>
          <Input type="number" step="0.01" value={form.estimated_premium_monthly} onChange={e => set('estimated_premium_monthly', e.target.value)} className="mt-1" />
        </div>
        <div>
          <Label>Geschätzte Jahresprämie (CHF)</Label>
          <Input type="number" step="0.01" value={form.estimated_premium_yearly} onChange={e => set('estimated_premium_yearly', e.target.value)} className="mt-1" />
        </div>
      </div>

      {/* Dates & Commission */}
      <div className="grid grid-cols-2 gap-3">
        <div>
          <Label>Gewünschtes Startdatum</Label>
          <Input type="date" value={form.requested_start_date} onChange={e => set('requested_start_date', e.target.value)} className="mt-1" />
        </div>
        <div>
          <Label>Geschätzte Provision (CHF)</Label>
          <Input type="number" step="0.01" value={form.commission_estimate} onChange={e => set('commission_estimate', e.target.value)} className="mt-1" />
        </div>
      </div>

      {/* Police & Vertragsdaten */}
      <div className="p-4 bg-muted/30 rounded-lg border border-border space-y-3">
        <p className="text-sm font-semibold text-foreground">Police &amp; Vertragsdaten</p>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <Label>Policennummer</Label>
            <Input value={form.policy_number} onChange={e => set('policy_number', e.target.value)} className="mt-1" placeholder="z.B. POL-2024-001" />
          </div>
          <div>
            <Label>Annahmedatum</Label>
            <Input type="date" value={form.acceptance_date} onChange={e => set('acceptance_date', e.target.value)} className="mt-1" />
          </div>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <Label>Vertragsbeginn</Label>
            <Input type="date" value={form.contract_start_date} onChange={e => set('contract_start_date', e.target.value)} className="mt-1" />
          </div>
          <div>
            <Label>Vertragsende</Label>
            <Input type="date" value={form.contract_end_date} onChange={e => set('contract_end_date', e.target.value)} className="mt-1" />
          </div>
        </div>
      </div>

      {/* ── Ablöse-Workflow ─────────────────────────────────────────── */}
      <div className="p-4 rounded-xl border border-amber-200 bg-amber-50 space-y-3">
        <div className="flex items-center gap-2">
          <input
            type="checkbox"
            id="abloese-check"
            checked={abloeseActive}
            onChange={e => { setAbloeseActive(e.target.checked); if (!e.target.checked) setAbloeseContractId('') }}
            className="w-4 h-4 cursor-pointer accent-amber-600"
          />
          <label htmlFor="abloese-check" className="text-sm font-semibold text-amber-800 cursor-pointer flex items-center gap-1.5">
            <AlertTriangle className="w-4 h-4" />
            Dieser Antrag löst einen bestehenden Vertrag ab
          </label>
        </div>
        {abloeseActive && (
          <div className="ml-6 space-y-2">
            <p className="text-xs text-amber-700">
              Bei Annahme wird automatisch eine Aufgabe «Kündigung einreichen» erstellt. Der Berater entscheidet und handelt manuell.
            </p>
            {!form.customer_id ? (
              <p className="text-xs text-amber-600 italic">Bitte zuerst einen Kunden auswählen.</p>
            ) : customerContracts.length === 0 ? (
              <p className="text-xs text-amber-600 italic">Keine aktiven Verträge für diesen Kunden gefunden.</p>
            ) : (
              <div>
                <Label className="text-xs text-amber-700">Abzulösender Vertrag *</Label>
                <Select value={abloeseContractId} onValueChange={setAbloeseContractId}>
                  <SelectTrigger className="mt-1 bg-white border-amber-300"><SelectValue placeholder="Vertrag auswählen..." /></SelectTrigger>
                  <SelectContent>
                    {customerContracts.map(c => (
                      <SelectItem key={c.id} value={c.id}>
                        {c.insurer} · {getSparteLabel(c.sparte || c.insurance_type)}
                        {c.policy_number ? ` · ${c.policy_number}` : ''}
                        {c.end_date && !c.end_date.startsWith('9999') ? ` (bis ${c.end_date})` : ''}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Berater — aus Advisor-Entity */}
      <AdvisorSelect value={form.assigned_broker} onChange={v => set('assigned_broker', v)} />

      {/* Notizen */}
      <div>
        <Label>Notizen</Label>
        <Textarea value={form.notes} onChange={e => set('notes', e.target.value)} className="mt-1" rows={3} placeholder="Interne Notizen, Besonderheiten, Vorbehalte..." />
      </div>

      <DialogFooter>
        <Button type="button" variant="outline" onClick={onCancel} disabled={saving}>Abbrechen</Button>
        <Button type="submit" disabled={saving}>
          {saving ? 'Speichern...' : (application ? 'Aktualisieren' : 'Erstellen')}
        </Button>
      </DialogFooter>
    </form>
  )
}