import React, { useState } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { base44 } from '@/api/base44Client'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card } from '@/components/ui/card'
import {
  CheckCircle2, AlertCircle, User, Users, UserPlus,
  ChevronRight, ChevronLeft, Loader2, FileText, Search,
  Sparkles, Bot
} from 'lucide-react'
import { cn } from '@/lib/utils'

const STEPS = ['Kundenzuweisung', 'Antragsdaten', 'Bestätigen']

function StepIndicator({ current }) {
  return (
    <div className="flex items-center gap-1 mb-4">
      {STEPS.map((label, i) => (
        <div key={i} className="flex items-center gap-1">
          <div className={cn(
            'flex items-center gap-1 text-xs font-medium px-2 py-1 rounded-full',
            i < current ? 'bg-green-100 text-green-700' :
            i === current ? 'bg-primary text-white' :
            'bg-muted text-muted-foreground'
          )}>
            {i < current ? <CheckCircle2 className="w-3 h-3" /> : <span>{i + 1}</span>}
            <span className="hidden sm:inline">{label}</span>
          </div>
          {i < STEPS.length - 1 && <ChevronRight className="w-3 h-3 text-muted-foreground flex-shrink-0" />}
        </div>
      ))}
    </div>
  )
}

export default function SmartDocumentReview({ document, documentType, analysisResult, onSuccess, onRestart }) {
  const queryClient = useQueryClient()
  const { extracted, customerMatches, matchedPrimaryCustomer, availablePrimaryCustomers } = analysisResult

  const [step, setStep] = useState(0) // 0=Kundenzuweisung, 1=Antragsdaten, 2=Bestätigen
  const [customerAction, setCustomerAction] = useState(
    customerMatches?.length > 0 ? 'use_existing' : null
  )
  const [selectedCustomerId, setSelectedCustomerId] = useState(customerMatches?.[0]?.customer?.id || null)
  const [selectedPrimaryId, setSelectedPrimaryId] = useState(matchedPrimaryCustomer?.id || null)
  const [searchQuery, setSearchQuery] = useState('')
  const [selectedPolicyIndex, setSelectedPolicyIndex] = useState(0)
  const [done, setDone] = useState(false)

  const policies = extracted?.policies || []

  const buildProductLabel = (pol) => {
    if (!pol) return ''
    const parts = [pol.product || '']
    if (pol.model) parts.push(`Variante: ${pol.model}`)
    if (pol.coverage_type) parts.push(pol.coverage_type)
    if (pol.coverage_summary) parts.push(pol.coverage_summary)
    return parts.filter(Boolean).join(' — ')
  }

  const [appData, setAppData] = useState({
    insurer: extracted?.insurer || '',
    policy_number: extracted?.policy_number || '',
    insurance_type: extracted?.insurance_type || 'health',
    sparte: extracted?.sparte || '',
    product: buildProductLabel(policies[0] || {}),
    franchise: extracted?.franchise ? String(extracted.franchise) : '',
    model: extracted?.model || '',
    coverage_type: extracted?.coverage_type || '',
    premium_monthly: extracted?.premium_monthly || '',
    premium_yearly: extracted?.premium_yearly || '',
    start_date: extracted?.start_date || '',
    end_date: extracted?.end_date || '',
    commission_estimate: extracted?.commission_estimate || '',
    broker_name: extracted?.broker_name || '',
  })

  const [newCustomerData, setNewCustomerData] = useState({
    first_name: extracted?.insured_is_different ? (extracted?.insured_first_name || '') : (extracted?.policy_holder_first_name || ''),
    last_name: extracted?.insured_is_different ? (extracted?.insured_last_name || '') : (extracted?.policy_holder_last_name || ''),
    birthdate: extracted?.insured_is_different ? (extracted?.insured_birthdate || '') : (extracted?.policy_holder_birthdate || ''),
    ahv_number: extracted?.insured_is_different ? (extracted?.insured_ahv_number || '') : '',
    email: extracted?.policy_holder_email || '',
    phone: extracted?.policy_holder_phone || '',
    street: extracted?.policy_holder_street || '',
    zip_code: extracted?.policy_holder_zip_code || '',
    city: extracted?.policy_holder_city || '',
    family_role: 'other',
  })

  const createMutation = useMutation({
    mutationFn: async (payload) => {
      const res = await base44.functions.invoke('createApplicationFromDocument', payload)
      return res.data
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['applications'] })
      queryClient.invalidateQueries({ queryKey: ['documents'] })
      queryClient.invalidateQueries({ queryKey: ['customers'] })
      setDone(true)
    },
  })

  const filteredCustomers = (availablePrimaryCustomers || []).filter(c => {
    if (!searchQuery) return true
    return `${c.first_name} ${c.last_name} ${c.customer_number || ''}`.toLowerCase().includes(searchQuery.toLowerCase())
  })

  const handleSubmit = () => {
    const selectedPolicy = policies[selectedPolicyIndex] || {}
    createMutation.mutate({
      documentId: document.id,
      documentSubtype: documentType,
      customerAction,
      customerId: customerAction === 'use_existing' ? selectedCustomerId : undefined,
      primaryCustomerId: customerAction === 'create_family_member' ? selectedPrimaryId : undefined,
      newCustomerData: ['create_primary', 'create_family_member'].includes(customerAction) ? newCustomerData : undefined,
      applicationData: {
        insurer: appData.insurer,
        policy_number: appData.policy_number || null,
        insurance_type: appData.insurance_type || 'other',
        sparte: appData.sparte || null,
        product: appData.product || null,
        franchise: appData.franchise ? Number(appData.franchise) : null,
        model: appData.model || null,
        coverage_type: appData.coverage_type || null,
        premium_monthly: appData.premium_monthly ? Number(appData.premium_monthly) : null,
        premium_yearly: appData.premium_yearly ? Number(appData.premium_yearly) : null,
        start_date: appData.start_date || null,
        end_date: appData.end_date || null,
        commission_estimate: appData.commission_estimate ? Number(appData.commission_estimate) : null,
        broker_name: appData.broker_name || null,
        health_declaration_required: selectedPolicy?.health_declaration_required || false,
      },
    })
  }

  // ── DONE ──────────────────────────────────────────────────────────────────
  if (done) {
    return (
      <div className="py-8 text-center space-y-4">
        <CheckCircle2 className="w-12 h-12 mx-auto text-green-500" />
        <p className="font-semibold text-green-700 text-lg">Antrag erstellt!</p>
        <div className="text-sm text-muted-foreground space-y-1">
          <p>Der Antrag wurde mit Status <strong>«In Prüfung»</strong> erstellt.</p>
          <p>Erst nach manueller Statusänderung wird automatisch ein Vertrag erzeugt.</p>
        </div>
        <Button onClick={onSuccess}>Fertig</Button>
      </div>
    )
  }

  // ── KI-Zusammenfassung (Inline-Banner) ────────────────────────────────────
  const AiBanner = () => {
    const name = extracted?.insured_is_different
      ? `${extracted.insured_first_name || ''} ${extracted.insured_last_name || ''}`.trim()
      : `${extracted?.policy_holder_first_name || ''} ${extracted?.policy_holder_last_name || ''}`.trim()
    const firstPol = policies[0]
    return (
      <div className="p-3 bg-slate-50 border border-slate-200 rounded-lg text-xs text-slate-600 flex items-start gap-2">
        <Sparkles className="w-3.5 h-3.5 mt-0.5 text-primary flex-shrink-0" />
        <div className="space-y-0.5">
          {name && <span className="font-medium text-slate-800">{name}</span>}
          {firstPol && (
            <span className="ml-2 text-slate-500">
              · {firstPol.insurer} {firstPol.sparte ? `(${firstPol.sparte})` : ''}
              {firstPol.premium_yearly ? ` · CHF ${Number(firstPol.premium_yearly).toLocaleString('de-CH')}/J.` : ''}
            </span>
          )}
          {extracted?.summary && <p className="text-slate-500 mt-0.5 line-clamp-1">{extracted.summary}</p>}
        </div>
      </div>
    )
  }

  // ── SCHRITT 0: Kundenzuweisung ────────────────────────────────────────────
  if (step === 0) {
    const canProceed = (
      (customerAction === 'use_existing' && selectedCustomerId) ||
      (customerAction === 'create_family_member' && selectedPrimaryId && newCustomerData.first_name && newCustomerData.last_name) ||
      (customerAction === 'create_primary' && newCustomerData.first_name && newCustomerData.last_name)
    )

    return (
      <div className="space-y-3">
        <StepIndicator current={0} />
        <AiBanner />

        <p className="text-sm font-semibold">Wem gehört dieses Dokument?</p>

        {/* Option A: Erkannte Kunden */}
        {customerMatches?.length > 0 && (
          <div className="space-y-1.5">
            <p className="text-[10px] text-muted-foreground uppercase font-semibold tracking-wide">KI-Vorschläge</p>
            {customerMatches.slice(0, 3).map(({ customer, confidence: conf, notes }) => (
              <button
                key={customer.id}
                type="button"
                onClick={() => { setCustomerAction('use_existing'); setSelectedCustomerId(customer.id) }}
                className={cn(
                  'w-full text-left p-3 rounded-lg border-2 transition-all',
                  selectedCustomerId === customer.id && customerAction === 'use_existing'
                    ? 'border-primary bg-primary/5 ring-1 ring-primary/20'
                    : conf >= 90 ? 'border-green-300 bg-green-50 hover:bg-green-100'
                    : 'border-amber-300 bg-amber-50 hover:bg-amber-100'
                )}
              >
                <div className="flex items-center gap-2">
                  {customer.is_family_member
                    ? <Users className="w-4 h-4 flex-shrink-0 text-amber-600" />
                    : <User className="w-4 h-4 flex-shrink-0 text-blue-600" />
                  }
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <span className="font-semibold text-sm">{customer.first_name} {customer.last_name}</span>
                      {customer.is_family_member
                        ? <span className="text-[10px] px-1.5 py-0.5 bg-amber-100 text-amber-700 rounded-full border border-amber-200">Familienmitglied</span>
                        : <span className="text-[10px] px-1.5 py-0.5 bg-blue-100 text-blue-700 rounded-full border border-blue-200">Hauptkontakt</span>
                      }
                      <span className={cn('text-[10px] px-1.5 py-0.5 rounded-full font-semibold',
                        conf >= 90 ? 'bg-green-100 text-green-700' : 'bg-amber-100 text-amber-700'
                      )}>{conf}%</span>
                    </div>
                    <p className="text-xs text-muted-foreground truncate mt-0.5">{notes}</p>
                  </div>
                  {selectedCustomerId === customer.id && customerAction === 'use_existing' && (
                    <CheckCircle2 className="w-5 h-5 text-primary flex-shrink-0" />
                  )}
                </div>
              </button>
            ))}
          </div>
        )}

        <div className="space-y-1.5">
          {customerMatches?.length > 0 && (
            <p className="text-[10px] text-muted-foreground uppercase font-semibold tracking-wide">Oder manuell zuweisen</p>
          )}

          {/* Option B: Familienmitglied */}
          <button
            type="button"
            onClick={() => { setCustomerAction('create_family_member'); setSearchQuery('') }}
            className={cn(
              'w-full text-left p-3 rounded-lg border-2 transition-all',
              customerAction === 'create_family_member'
                ? 'border-primary bg-primary/5 ring-1 ring-primary/20'
                : 'border-amber-200 bg-amber-50 hover:bg-amber-100'
            )}
          >
            <div className="flex items-center gap-2">
              <Users className="w-4 h-4 text-amber-600 flex-shrink-0" />
              <div>
                <p className="font-semibold text-sm text-amber-800">Neues Familienmitglied</p>
                <p className="text-xs text-amber-700">Kind, Partner – einer bestehenden Familie zuordnen</p>
              </div>
              {customerAction === 'create_family_member' && <CheckCircle2 className="w-5 h-5 text-primary ml-auto flex-shrink-0" />}
            </div>
          </button>

          {/* Option C: Neuer Hauptkontakt */}
          <button
            type="button"
            onClick={() => setCustomerAction('create_primary')}
            className={cn(
              'w-full text-left p-3 rounded-lg border-2 transition-all',
              customerAction === 'create_primary'
                ? 'border-primary bg-primary/5 ring-1 ring-primary/20'
                : 'border-border bg-muted/20 hover:bg-muted/50'
            )}
          >
            <div className="flex items-center gap-2">
              <UserPlus className="w-4 h-4 flex-shrink-0" />
              <div>
                <p className="font-semibold text-sm">Neuer Hauptkontakt</p>
                <p className="text-xs text-muted-foreground">Völlig neuer Kunde anlegen</p>
              </div>
              {customerAction === 'create_primary' && <CheckCircle2 className="w-5 h-5 text-primary ml-auto flex-shrink-0" />}
            </div>
          </button>
        </div>

        {/* Familienmitglied: Hauptkontakt suchen */}
        {customerAction === 'create_family_member' && (
          <div className="pl-3 border-l-2 border-amber-300 space-y-2">
            <p className="text-sm font-medium">Zu welchem Hauptkontakt gehört diese Person?</p>
            {matchedPrimaryCustomer && (
              <button
                type="button"
                onClick={() => setSelectedPrimaryId(matchedPrimaryCustomer.id)}
                className={cn('w-full text-left p-2.5 rounded-lg border text-sm transition-all font-medium',
                  selectedPrimaryId === matchedPrimaryCustomer.id
                    ? 'border-primary bg-primary/5 ring-1 ring-primary/20'
                    : 'border-green-300 bg-green-50 hover:bg-green-100'
                )}
              >
                <div className="flex items-center gap-2">
                  <Bot className="w-3.5 h-3.5 text-green-600" />
                  <span>{matchedPrimaryCustomer.first_name} {matchedPrimaryCustomer.last_name}</span>
                  <span className="text-xs text-green-600 font-normal">(KI-Vorschlag)</span>
                  {selectedPrimaryId === matchedPrimaryCustomer.id && <CheckCircle2 className="w-4 h-4 text-primary ml-auto" />}
                </div>
              </button>
            )}
            <div className="relative">
              <Search className="absolute left-2.5 top-2.5 w-4 h-4 text-muted-foreground" />
              <Input
                placeholder="Anderen Hauptkontakt suchen..."
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                className="pl-8"
              />
            </div>
            {searchQuery && (
              <div className="max-h-36 overflow-y-auto space-y-1 border rounded-lg p-1.5 bg-background">
                {filteredCustomers.filter(c => c.id !== matchedPrimaryCustomer?.id).map(c => (
                  <button
                    key={c.id}
                    type="button"
                    onClick={() => setSelectedPrimaryId(c.id)}
                    className={cn('w-full text-left p-2 rounded text-sm transition-all',
                      selectedPrimaryId === c.id ? 'bg-primary/10 font-semibold' : 'hover:bg-muted/60'
                    )}
                  >
                    {c.first_name} {c.last_name}
                    {c.customer_number && <span className="text-xs text-muted-foreground ml-1.5">({c.customer_number})</span>}
                  </button>
                ))}
                {filteredCustomers.filter(c => c.id !== matchedPrimaryCustomer?.id).length === 0 && (
                  <p className="text-xs text-center text-muted-foreground py-2">Keine Ergebnisse</p>
                )}
              </div>
            )}
            {/* Daten des neuen Familienmitglieds */}
            <Card className="p-3 border-l-4 border-l-amber-400 space-y-2">
              <p className="font-semibold text-xs text-muted-foreground uppercase tracking-wide">Daten Familienmitglied</p>
              <div className="grid grid-cols-2 gap-2">
                <Input placeholder="Vorname *" value={newCustomerData.first_name}
                  onChange={e => setNewCustomerData(d => ({ ...d, first_name: e.target.value }))} />
                <Input placeholder="Nachname *" value={newCustomerData.last_name}
                  onChange={e => setNewCustomerData(d => ({ ...d, last_name: e.target.value }))} />
              </div>
              <Input type="date" value={newCustomerData.birthdate}
                onChange={e => setNewCustomerData(d => ({ ...d, birthdate: e.target.value }))} />
              <Input placeholder="AHV-Nummer" value={newCustomerData.ahv_number}
                onChange={e => setNewCustomerData(d => ({ ...d, ahv_number: e.target.value }))} />
              <select value={newCustomerData.family_role}
                onChange={e => setNewCustomerData(d => ({ ...d, family_role: e.target.value }))}
                className="w-full p-2 border rounded text-sm bg-background">
                <option value="spouse">Partner / Ehepartner</option>
                <option value="child">Kind</option>
                <option value="parent">Elternteil</option>
                <option value="other">Sonstige</option>
              </select>
            </Card>
          </div>
        )}

        {/* Neuer Hauptkontakt: Daten */}
        {customerAction === 'create_primary' && (
          <Card className="p-3 border-l-4 border-l-primary space-y-2">
            <p className="font-semibold text-xs text-muted-foreground uppercase tracking-wide">Kundendaten</p>
            <div className="grid grid-cols-2 gap-2">
              <Input placeholder="Vorname *" value={newCustomerData.first_name}
                onChange={e => setNewCustomerData(d => ({ ...d, first_name: e.target.value }))} />
              <Input placeholder="Nachname *" value={newCustomerData.last_name}
                onChange={e => setNewCustomerData(d => ({ ...d, last_name: e.target.value }))} />
            </div>
            <Input type="date" value={newCustomerData.birthdate}
              onChange={e => setNewCustomerData(d => ({ ...d, birthdate: e.target.value }))} />
            <Input type="email" placeholder="E-Mail" value={newCustomerData.email}
              onChange={e => setNewCustomerData(d => ({ ...d, email: e.target.value }))} />
            <Input placeholder="Telefon" value={newCustomerData.phone}
              onChange={e => setNewCustomerData(d => ({ ...d, phone: e.target.value }))} />
            <div className="grid grid-cols-3 gap-2">
              <Input placeholder="Strasse" value={newCustomerData.street} className="col-span-2"
                onChange={e => setNewCustomerData(d => ({ ...d, street: e.target.value }))} />
              <Input placeholder="PLZ" value={newCustomerData.zip_code}
                onChange={e => setNewCustomerData(d => ({ ...d, zip_code: e.target.value }))} />
            </div>
            <Input placeholder="Ort" value={newCustomerData.city}
              onChange={e => setNewCustomerData(d => ({ ...d, city: e.target.value }))} />
          </Card>
        )}

        <div className="flex gap-2 pt-2 border-t">
          <Button variant="outline" type="button" onClick={onRestart}>Abbrechen</Button>
          <Button
            type="button"
            className="flex-1"
            disabled={!canProceed}
            onClick={() => setStep(1)}
          >
            Weiter: Antragsdaten <ChevronRight className="w-4 h-4 ml-1" />
          </Button>
        </div>
      </div>
    )
  }

  // ── SCHRITT 1: Antragsdaten prüfen ────────────────────────────────────────
  if (step === 1) {
    return (
      <div className="space-y-3">
        <StepIndicator current={1} />
        <AiBanner />

        {/* Police wählen wenn mehrere vorhanden */}
        {policies.length > 1 && (
          <div className="space-y-1.5">
            <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
              Police auswählen ({policies.length} erkannt)
            </p>
            <div className="grid gap-1">
              {policies.map((pol, i) => (
                <button
                  key={i}
                  type="button"
                  onClick={() => {
                    setSelectedPolicyIndex(i)
                    setAppData(d => ({
                      ...d,
                      insurer: pol.insurer || '',
                      policy_number: pol.policy_number || '',
                      insurance_type: pol.insurance_type || 'health',
                      sparte: pol.sparte || '',
                      product: buildProductLabel(pol),
                      franchise: pol.franchise ? String(pol.franchise) : '',
                      model: pol.model || '',
                      coverage_type: pol.coverage_type || '',
                      premium_monthly: pol.premium_monthly || '',
                      premium_yearly: pol.premium_yearly || '',
                      start_date: pol.start_date || '',
                      end_date: pol.end_date || '',
                    }))
                  }}
                  className={cn(
                    'w-full text-left p-2.5 rounded-lg border text-xs transition-all',
                    selectedPolicyIndex === i ? 'border-primary bg-primary/5 ring-1 ring-primary/20' : 'border-border hover:bg-muted/40'
                  )}
                >
                  <div className="flex justify-between items-center gap-2">
                    <div className="flex-1 min-w-0">
                      <p className="font-semibold text-slate-800 truncate">{pol.product || pol.insurer || '–'}</p>
                      <p className="text-muted-foreground">{pol.insurer}{pol.coverage_type ? ` · ${pol.coverage_type}` : ''}{pol.model ? ` · ${pol.model}` : ''}</p>
                    </div>
                    {pol.premium_monthly && <span className="text-emerald-700 font-bold whitespace-nowrap">CHF {Number(pol.premium_monthly).toLocaleString('de-CH')}/M.</span>}
                  </div>
                  {pol.policy_number && <p className="text-muted-foreground mt-0.5">Police: {pol.policy_number}</p>}
                </button>
              ))}
            </div>
          </div>
        )}

        <div className="space-y-2">
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="text-xs font-medium text-muted-foreground">Versicherer *</label>
              <Input value={appData.insurer} onChange={e => setAppData(d => ({ ...d, insurer: e.target.value }))} />
            </div>
            <div>
              <label className="text-xs font-medium text-muted-foreground">Policennummer</label>
              <Input value={appData.policy_number} onChange={e => setAppData(d => ({ ...d, policy_number: e.target.value }))} />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="text-xs font-medium text-muted-foreground">Versicherungsart</label>
              <select value={appData.insurance_type}
                onChange={e => setAppData(d => ({ ...d, insurance_type: e.target.value }))}
                className="w-full p-2 border rounded text-sm bg-background mt-0.5">
                <option value="health">Kranken (KVG/VVG)</option>
                <option value="life">Leben</option>
                <option value="property">Sach</option>
                <option value="liability">Haftpflicht</option>
                <option value="motor">Motorfahrzeug</option>
                <option value="other">Sonstiges</option>
              </select>
            </div>
            <div>
              <label className="text-xs font-medium text-muted-foreground">Sparte</label>
              <select value={appData.sparte}
                onChange={e => setAppData(d => ({ ...d, sparte: e.target.value }))}
                className="w-full p-2 border rounded text-sm bg-background mt-0.5">
                <option value="">– wählen –</option>
                <optgroup label="Privat – Kranken">
                  <option value="kvg">KVG – Grundversicherung</option>
                  <option value="vvg_zusatz">VVG – Zusatzversicherung</option>
                  <option value="kvg_vvg_kombi">KVG + VVG Kombi</option>
                </optgroup>
                <optgroup label="Privat – Leben">
                  <option value="leben_3a">Leben Säule 3a</option>
                  <option value="leben_3b">Leben Säule 3b</option>
                </optgroup>
                <optgroup label="Privat – Sach &amp; Haftpflicht">
                  <option value="motorfahrzeug">Motorfahrzeug</option>
                  <option value="hausrat">Hausrat</option>
                  <option value="gebaude_privat">Gebäude Privat</option>
                  <option value="haftpflicht_privat">Haftpflicht Privat</option>
                  <option value="unfall_privat">Unfall Privat</option>
                  <option value="rechtsschutz_privat">Rechtsschutz Privat</option>
                  <option value="reise">Reise</option>
                  <option value="cyber_privat">Cyber Privat</option>
                </optgroup>
                <optgroup label="Firma">
                  <option value="bvg">BVG – Pensionskasse</option>
                  <option value="uvg">UVG – Unfall</option>
                  <option value="ktg">KTG – Krankentaggeld</option>
                  <option value="betriebshaftpflicht">Betriebshaftpflicht</option>
                  <option value="berufshaftpflicht">Berufshaftpflicht</option>
                  <option value="inventar">Betriebs-/Inventar</option>
                  <option value="rechtsschutz_firma">Rechtsschutz Firma</option>
                  <option value="cyber_firma">Cyber Firma</option>
                  <option value="flotte">Flotte</option>
                </optgroup>
              </select>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="text-xs font-medium text-muted-foreground">Produkt / Tarif & Deckung</label>
              <textarea
                value={appData.product}
                onChange={e => setAppData(d => ({ ...d, product: e.target.value }))}
                rows={3}
                className="w-full mt-0.5 p-2 border rounded text-sm bg-background resize-none focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                placeholder="Produktname, Variante, Deckungsdetails..."
              />
            </div>
            <div>
              <label className="text-xs font-medium text-muted-foreground">Franchise (CHF)</label>
              <Input type="number" placeholder="z.B. 300" value={appData.franchise}
                onChange={e => setAppData(d => ({ ...d, franchise: e.target.value }))} />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="text-xs font-medium text-muted-foreground">Monatsprämie CHF</label>
              <Input type="number" value={appData.premium_monthly}
                onChange={e => setAppData(d => ({ ...d, premium_monthly: e.target.value }))} />
            </div>
            <div>
              <label className="text-xs font-medium text-muted-foreground">Jahresprämie CHF</label>
              <Input type="number" value={appData.premium_yearly}
                onChange={e => setAppData(d => ({ ...d, premium_yearly: e.target.value }))} />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="text-xs font-medium text-muted-foreground">Vertragsbeginn</label>
              <Input type="date" value={appData.start_date}
                onChange={e => setAppData(d => ({ ...d, start_date: e.target.value }))} />
            </div>
            <div>
              <label className="text-xs font-medium text-muted-foreground">Geschätzte Provision CHF</label>
              <Input type="number" value={appData.commission_estimate}
                onChange={e => setAppData(d => ({ ...d, commission_estimate: e.target.value }))} />
            </div>
          </div>
        </div>

        <div className="flex gap-2 pt-2 border-t">
          <Button variant="outline" type="button" onClick={() => setStep(0)}>
            <ChevronLeft className="w-4 h-4 mr-1" /> Zurück
          </Button>
          <Button type="button" className="flex-1" disabled={!appData.insurer} onClick={() => setStep(2)}>
            Weiter: Bestätigen <ChevronRight className="w-4 h-4 ml-1" />
          </Button>
        </div>
      </div>
    )
  }

  // ── SCHRITT 2: Bestätigen ─────────────────────────────────────────────────
  if (step === 2) {
    const typeLabels = { neuantrag: 'Neuantrag', aenderungsantrag: 'Änderungsantrag', erneuerungsantrag: 'Erneuerungsantrag', police: 'Police' }
    let customerLabel = ''
    if (customerAction === 'use_existing') {
      const match = customerMatches?.find(m => m.customer.id === selectedCustomerId)
      customerLabel = `${match?.customer.first_name} ${match?.customer.last_name} (bestehend)`
    } else if (customerAction === 'create_family_member') {
      const primary = availablePrimaryCustomers?.find(c => c.id === selectedPrimaryId) || matchedPrimaryCustomer
      customerLabel = `${newCustomerData.first_name} ${newCustomerData.last_name} (FM bei ${primary?.first_name} ${primary?.last_name})`
    } else {
      customerLabel = `${newCustomerData.first_name} ${newCustomerData.last_name} (neuer Kontakt)`
    }

    return (
      <div className="space-y-3">
        <StepIndicator current={2} />

        <div className="p-4 bg-muted/30 rounded-lg space-y-2 text-sm">
          <p className="font-semibold">Zusammenfassung</p>
          <div className="space-y-1.5">
            <div className="flex justify-between">
              <span className="text-muted-foreground">Dokumenttyp</span>
              <span className="font-medium">{typeLabels[documentType] || documentType}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Kunde</span>
              <span className="font-medium text-right max-w-[60%]">{customerLabel}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Versicherer</span>
              <span className="font-medium">{appData.insurer}</span>
            </div>
            {appData.policy_number && (
              <div className="flex justify-between">
                <span className="text-muted-foreground">Policennummer</span>
                <span className="font-medium">{appData.policy_number}</span>
              </div>
            )}
            {appData.premium_yearly && (
              <div className="flex justify-between">
                <span className="text-muted-foreground">Jahresprämie</span>
                <span className="font-medium">CHF {Number(appData.premium_yearly).toLocaleString('de-CH')}</span>
              </div>
            )}
            {appData.start_date && (
              <div className="flex justify-between">
                <span className="text-muted-foreground">Vertragsbeginn</span>
                <span className="font-medium">{appData.start_date}</span>
              </div>
            )}
          </div>
        </div>

        <div className="p-3 bg-blue-50 border border-blue-200 rounded text-sm text-blue-800">
          <AlertCircle className="w-4 h-4 inline mr-1" />
          Antrag wird mit Status <strong>«In Prüfung»</strong> erstellt. Vertrag folgt nach manueller Freigabe.
        </div>

        {createMutation.error && (
          <div className="p-3 bg-red-50 border border-red-200 rounded text-sm text-red-700">
            {createMutation.error?.response?.data?.error || createMutation.error?.message}
          </div>
        )}

        <div className="flex gap-2 pt-2 border-t">
          <Button variant="outline" type="button" onClick={() => setStep(1)} disabled={createMutation.isPending}>
            <ChevronLeft className="w-4 h-4 mr-1" /> Zurück
          </Button>
          <Button type="button" className="flex-1 gap-2" onClick={handleSubmit} disabled={createMutation.isPending}>
            {createMutation.isPending && <Loader2 className="w-4 h-4 animate-spin" />}
            {createMutation.isPending ? 'Wird erstellt...' : 'Antrag erstellen & speichern'}
          </Button>
        </div>
      </div>
    )
  }

  return null
}