import React, { useState } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { base44 } from '@/api/base44Client'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card } from '@/components/ui/card'
import {
  CheckCircle2, AlertCircle, User, Users, UserPlus,
  ChevronRight, ChevronLeft, Loader2, FileText, Search,
  Sparkles, TrendingUp, Shield, Calendar, Banknote
} from 'lucide-react'
import { cn } from '@/lib/utils'

const STEPS = ['Analyse', 'Kundenzuweisung', 'Antragsdaten prüfen', 'Bestätigen']

function StepIndicator({ current }) {
  // current=-1 → step "Analyse" active; current=0..2 → wizard steps
  const displayIndex = current === -1 ? 0 : current + 1
  return (
    <div className="flex items-center gap-1 mb-4">
      {STEPS.map((label, i) => (
        <React.Fragment key={i}>
          <div className={cn(
            'flex items-center gap-1 text-xs font-medium px-2 py-1 rounded-full',
            i < displayIndex ? 'bg-green-100 text-green-700' :
            i === displayIndex ? 'bg-primary text-white' :
            'bg-muted text-muted-foreground'
          )}>
            {i < displayIndex ? <CheckCircle2 className="w-3 h-3" /> : <span>{i + 1}</span>}
            <span className="hidden sm:inline">{label}</span>
          </div>
          {i < STEPS.length - 1 && <ChevronRight className="w-3 h-3 text-muted-foreground flex-shrink-0" />}
        </React.Fragment>
      ))}
    </div>
  )
}

export default function SmartDocumentReview({ document, documentType, analysisResult, onSuccess, onRestart }) {
  const queryClient = useQueryClient()
  const { extracted, customerMatches, detectionPhase, matchedPrimaryCustomer, availableFamilyMembers, availablePrimaryCustomers } = analysisResult

  const [step, setStep] = useState(-1) // -1 = Analyse-Übersicht, 0..2 = Wizard
  const [customerAction, setCustomerAction] = useState(null) // 'use_existing' | 'create_primary' | 'create_family_member'
  const [selectedCustomerId, setSelectedCustomerId] = useState(
    customerMatches?.[0]?.customer?.id || null
  )
  const [selectedPrimaryId, setSelectedPrimaryId] = useState(matchedPrimaryCustomer?.id || null)
  const [searchQuery, setSearchQuery] = useState('')
  const [done, setDone] = useState(false)
  const [resultData, setResultData] = useState(null)

  // Antragsdaten (vorausgefüllt aus KI, editierbar)
  const [appData, setAppData] = useState({
    insurer: extracted?.insurer || '',
    policy_number: extracted?.policy_number || '',
    insurance_type: extracted?.insurance_type || 'health',
    sparte: extracted?.sparte || '',
    product: extracted?.product || '',
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

  // Neuer Kunde Daten
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
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['applications'] })
      queryClient.invalidateQueries({ queryKey: ['documents'] })
      queryClient.invalidateQueries({ queryKey: ['customers'] })
      setResultData(data)
      setDone(true)
    },
  })

  const filteredCustomers = (availablePrimaryCustomers || []).filter(c => {
    if (!searchQuery) return true
    return `${c.first_name} ${c.last_name} ${c.customer_number || ''}`.toLowerCase().includes(searchQuery.toLowerCase())
  })

  const filteredFamilyMembers = (availableFamilyMembers || []).filter(c => {
    if (!searchQuery) return true
    return `${c.first_name} ${c.last_name}`.toLowerCase().includes(searchQuery.toLowerCase())
  })

  const handleSubmit = async () => {
    const payload = {
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
        health_declaration_required: extracted?.health_declaration_required || false,
      },
    }
    createMutation.mutate(payload)
  }

  // ── DONE ──────────────────────────────────────────────────────────────────
  if (done) {
    return (
      <div className="py-8 text-center space-y-4">
        <CheckCircle2 className="w-12 h-12 mx-auto text-green-500" />
        <p className="font-semibold text-green-700 text-lg">Antrag erstellt!</p>
        <div className="text-sm text-muted-foreground space-y-1">
          <p>Der Antrag wurde mit Status <strong>«In Prüfung»</strong> erstellt.</p>
          <p>Erst nach manueller Statusänderung (Angenommen/Policiert) wird automatisch ein Vertrag erzeugt.</p>
        </div>
        {createMutation.error && (
          <div className="p-3 bg-red-50 border border-red-200 rounded text-sm text-red-700">
            {createMutation.error?.response?.data?.error || createMutation.error?.message}
          </div>
        )}
        <div className="flex gap-2 justify-center">
          <Button onClick={onSuccess}>Fertig</Button>
        </div>
      </div>
    )
  }

  // ── SCHRITT -1: Analyse-Übersicht ────────────────────────────────────────
  if (step === -1) {
    const confidence = extracted?.document_confidence
    const confLabel = confidence >= 0.9 ? 'Sehr hoch' : confidence >= 0.7 ? 'Hoch' : confidence >= 0.5 ? 'Mittel' : 'Niedrig'
    const confColor = confidence >= 0.9 ? 'bg-emerald-50 text-emerald-700 border-emerald-200' :
                      confidence >= 0.7 ? 'bg-blue-50 text-blue-700 border-blue-200' :
                      'bg-amber-50 text-amber-700 border-amber-200'

    return (
      <div className="space-y-4">
        <StepIndicator current={-1} />

        {/* Dokumenttyp & Konfidenz */}
        <div className="flex items-center justify-between p-3 rounded-lg border bg-muted/30">
          <div className="flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-primary" />
            <div>
              <p className="text-sm font-semibold capitalize">{extracted?.document_subtype || 'Dokument'} erkannt</p>
              <p className="text-xs text-muted-foreground">{document?.name}</p>
            </div>
          </div>
          {confidence != null && (
            <span className={cn('text-xs px-2 py-1 rounded-full border font-medium', confColor)}>
              {confLabel} ({Math.round(confidence * 100)}%)
            </span>
          )}
        </div>

        {/* Person */}
        {(extracted?.policy_holder_first_name || extracted?.insured_first_name) && (
          <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg space-y-1">
            <p className="text-[10px] font-semibold uppercase tracking-wide text-blue-700">Person erkannt</p>
            <p className="text-sm font-medium text-blue-900">
              {extracted.insured_is_different
                ? `${extracted.insured_first_name || ''} ${extracted.insured_last_name || ''}`
                : `${extracted.policy_holder_first_name || ''} ${extracted.policy_holder_last_name || ''}`
              }
              {extracted.policy_holder_birthdate && <span className="text-blue-700 font-normal ml-2">· Geb. {extracted.policy_holder_birthdate}</span>}
            </p>
            {extracted.policy_holder_street && (
              <p className="text-xs text-blue-700">{extracted.policy_holder_street}, {extracted.policy_holder_zip_code} {extracted.policy_holder_city}</p>
            )}
            {extracted.policy_holder_phone && <p className="text-xs text-blue-700">📞 {extracted.policy_holder_phone}</p>}
            {extracted.policy_holder_email && <p className="text-xs text-blue-700">✉️ {extracted.policy_holder_email}</p>}
          </div>
        )}

        {/* Versicherungsdetails */}
        <div className="space-y-2">
          <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">Versicherungsdetails</p>
          <div className="grid grid-cols-2 gap-2">
            {extracted?.insurer && (
              <div className="p-2.5 bg-card border rounded-lg text-xs">
                <p className="text-muted-foreground">Gesellschaft</p>
                <p className="font-semibold">{extracted.insurer}</p>
              </div>
            )}
            {extracted?.policy_number && (
              <div className="p-2.5 bg-card border rounded-lg text-xs">
                <p className="text-muted-foreground">Policennummer</p>
                <p className="font-semibold">{extracted.policy_number}</p>
              </div>
            )}
            {extracted?.product && (
              <div className="p-2.5 bg-card border rounded-lg text-xs col-span-2">
                <p className="text-muted-foreground">Produkt / Tarif</p>
                <p className="font-semibold">{extracted.product}</p>
              </div>
            )}
            {extracted?.model && (
              <div className="p-2.5 bg-card border rounded-lg text-xs">
                <p className="text-muted-foreground">Modell</p>
                <p className="font-semibold">{extracted.model}</p>
              </div>
            )}
            {extracted?.franchise != null && (
              <div className="p-2.5 bg-card border rounded-lg text-xs">
                <p className="text-muted-foreground">Franchise</p>
                <p className="font-semibold">CHF {extracted.franchise}</p>
              </div>
            )}
          </div>
        </div>

        {/* Prämien */}
        {(extracted?.premium_monthly || extracted?.premium_yearly) && (
          <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-lg">
            <p className="text-[10px] font-semibold uppercase tracking-wide text-emerald-700 mb-2 flex items-center gap-1">
              <Banknote className="w-3 h-3" /> Prämien
            </p>
            <div className="flex gap-4">
              {extracted.premium_monthly && (
                <div>
                  <p className="text-xs text-emerald-700">Monatlich</p>
                  <p className="text-base font-bold text-emerald-800">CHF {Number(extracted.premium_monthly).toLocaleString('de-CH')}</p>
                </div>
              )}
              {extracted.premium_yearly && (
                <div>
                  <p className="text-xs text-emerald-700">Jährlich</p>
                  <p className="text-base font-bold text-emerald-800">CHF {Number(extracted.premium_yearly).toLocaleString('de-CH')}</p>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Vertragslaufzeit */}
        {(extracted?.start_date || extracted?.end_date) && (
          <div className="p-2.5 bg-card border rounded-lg text-xs flex items-center gap-3">
            <Calendar className="w-4 h-4 text-muted-foreground flex-shrink-0" />
            <div className="flex gap-4">
              {extracted.start_date && <span><span className="text-muted-foreground">Beginn: </span><strong>{extracted.start_date}</strong></span>}
              {extracted.end_date && <span><span className="text-muted-foreground">Ende: </span><strong>{extracted.end_date}</strong></span>}
            </div>
          </div>
        )}

        {/* Kunden-Matches */}
        {customerMatches?.length > 0 && (
          <div className={cn('p-3 rounded-lg border text-sm font-medium flex items-center gap-2',
            customerMatches[0].confidence >= 90 ? 'bg-green-50 border-green-300 text-green-800' : 'bg-amber-50 border-amber-300 text-amber-800'
          )}>
            <User className="w-4 h-4 flex-shrink-0" />
            {customerMatches[0].confidence >= 90 ? '✅' : '⚠️'} Möglicher Kunde: {customerMatches[0].customer.first_name} {customerMatches[0].customer.last_name}
            <span className="ml-auto text-xs font-normal opacity-75">{customerMatches[0].confidence}% – {customerMatches[0].matchType}</span>
          </div>
        )}

        <div className="flex gap-2 pt-2 border-t">
          <Button variant="outline" onClick={onRestart}>Abbrechen</Button>
          <Button className="flex-1 gap-2" onClick={() => setStep(0)}>
            Weiter: Antrag erstellen <ChevronRight className="w-4 h-4" />
          </Button>
        </div>
      </div>
    )
  }

  // ── SCHRITT 0: Kundenzuweisung ────────────────────────────────────────────
  if (step === 0) {
    return (
      <div className="space-y-4">
        <StepIndicator current={0} />

        {/* KI-Erkennungsstatus */}
        <div className="p-3 rounded-lg border bg-muted/30 text-sm space-y-1">
          <p className="font-semibold">KI-Erkennungsergebnis</p>
          <p className="text-muted-foreground">
            Person im Dokument: <strong>{extracted?.insured_is_different
              ? `${extracted.insured_first_name || '–'} ${extracted.insured_last_name || ''}` 
              : `${extracted?.policy_holder_first_name || '–'} ${extracted?.policy_holder_last_name || ''}`
            }</strong>
          </p>
          {extracted?.policy_holder_birthdate && (
            <p className="text-muted-foreground">Geburtsdatum: <strong>{extracted.policy_holder_birthdate}</strong></p>
          )}
          {customerMatches?.length > 0 && (
            <div className={cn('mt-2 p-2 rounded text-xs font-medium',
              customerMatches[0].confidence >= 90 ? 'bg-green-100 text-green-800' : 'bg-amber-100 text-amber-800'
            )}>
              {customerMatches[0].confidence >= 90 ? '✅' : '⚠️'} Möglicher Match: {customerMatches[0].customer.first_name} {customerMatches[0].customer.last_name}
              {' '}({customerMatches[0].confidence}% – {customerMatches[0].matchType})
            </div>
          )}
        </div>

        <p className="text-sm font-semibold">Wie soll das Dokument zugewiesen werden?</p>

        {/* Option A: Bestehende Person (hohe Konfidenz Match) */}
        {customerMatches?.length > 0 && (
          <div className="space-y-2">
            <p className="text-xs text-muted-foreground uppercase font-medium tracking-wide">Erkannte Personen</p>
            {customerMatches.slice(0, 3).map(({ customer, confidence, matchType, notes }) => (
              <button
                key={customer.id}
                onClick={() => { setCustomerAction('use_existing'); setSelectedCustomerId(customer.id) }}
                className={cn(
                  'w-full text-left p-3 rounded-lg border-2 transition',
                  selectedCustomerId === customer.id && customerAction === 'use_existing'
                    ? 'border-primary bg-primary/5'
                    : confidence >= 90
                      ? 'border-green-300 bg-green-50 hover:bg-green-100'
                      : 'border-amber-300 bg-amber-50 hover:bg-amber-100'
                )}
              >
                <div className="flex items-center gap-2">
                  <User className="w-4 h-4 flex-shrink-0" />
                  <div className="flex-1">
                    <p className="font-semibold text-sm">{customer.first_name} {customer.last_name}</p>
                    <p className="text-xs text-muted-foreground">{notes} · {confidence}% Konfidenz</p>
                  </div>
                  {selectedCustomerId === customer.id && customerAction === 'use_existing' && (
                    <CheckCircle2 className="w-4 h-4 text-primary" />
                  )}
                </div>
              </button>
            ))}
          </div>
        )}

        {/* Option B: Familienmitglied einer bestehenden Familie */}
        <button
          onClick={() => { setCustomerAction('create_family_member'); setSearchQuery('') }}
          className={cn(
            'w-full text-left p-3 rounded-lg border-2 transition',
            customerAction === 'create_family_member'
              ? 'border-primary bg-primary/5'
              : 'border-amber-200 bg-amber-50 hover:bg-amber-100'
          )}
        >
          <div className="flex items-center gap-2">
            <Users className="w-4 h-4 text-amber-600" />
            <div>
              <p className="font-semibold text-sm text-amber-800">Neues Familienmitglied</p>
              <p className="text-xs text-amber-700">Kind, Partner oder Mitglied einer bestehenden Familie</p>
            </div>
          </div>
        </button>

        {customerAction === 'create_family_member' && (
          <div className="pl-2 border-l-2 border-amber-300 space-y-3">
            <p className="text-sm font-medium">Zu welchem Hauptkontakt gehört diese Person?</p>
            <div className="relative">
              <Search className="absolute left-2 top-2.5 w-4 h-4 text-muted-foreground" />
              <Input
                placeholder="Hauptkontakt suchen..."
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                className="pl-8"
              />
            </div>
            {matchedPrimaryCustomer && (
              <button
                onClick={() => setSelectedPrimaryId(matchedPrimaryCustomer.id)}
                className={cn('w-full text-left p-2 rounded border text-sm transition',
                  selectedPrimaryId === matchedPrimaryCustomer.id ? 'border-primary bg-primary/5 font-semibold' : 'border-green-300 bg-green-50 hover:bg-green-100'
                )}
              >
                ✅ {matchedPrimaryCustomer.first_name} {matchedPrimaryCustomer.last_name} (KI-Vorschlag)
              </button>
            )}
            <div className="max-h-40 overflow-y-auto space-y-1 border rounded p-2">
              {filteredCustomers.map(c => (
                <button key={c.id}
                  onClick={() => setSelectedPrimaryId(c.id)}
                  className={cn('w-full text-left p-2 rounded text-sm transition',
                    selectedPrimaryId === c.id ? 'bg-primary/10 font-semibold' : 'hover:bg-muted/60'
                  )}
                >
                  {c.first_name} {c.last_name}
                  {c.customer_number && <span className="text-xs text-muted-foreground ml-1">({c.customer_number})</span>}
                </button>
              ))}
              {filteredCustomers.length === 0 && (
                <p className="text-xs text-center text-muted-foreground py-3">Keine Ergebnisse</p>
              )}
            </div>
          </div>
        )}

        {/* Option C: Neuer Hauptkontakt */}
        <button
          onClick={() => setCustomerAction('create_primary')}
          className={cn(
            'w-full text-left p-3 rounded-lg border-2 transition',
            customerAction === 'create_primary'
              ? 'border-primary bg-primary/5'
              : 'border-border bg-muted/20 hover:bg-muted/50'
          )}
        >
          <div className="flex items-center gap-2">
            <UserPlus className="w-4 h-4" />
            <div>
              <p className="font-semibold text-sm">Neuer Hauptkontakt</p>
              <p className="text-xs text-muted-foreground">Völlig neuer Kunde ohne bestehende Familie</p>
            </div>
          </div>
        </button>

        {/* Kundendaten-Formular bei Neu-Erstellung */}
        {(customerAction === 'create_primary' || customerAction === 'create_family_member') && (
          <Card className="p-4 border-l-4 border-l-primary space-y-2">
            <p className="font-semibold text-sm mb-2">
              {customerAction === 'create_primary' ? 'Kundendaten Hauptkontakt' : 'Daten Familienmitglied'}
            </p>
            <div className="grid grid-cols-2 gap-2">
              <Input placeholder="Vorname *" value={newCustomerData.first_name}
                onChange={e => setNewCustomerData(d => ({ ...d, first_name: e.target.value }))} />
              <Input placeholder="Nachname *" value={newCustomerData.last_name}
                onChange={e => setNewCustomerData(d => ({ ...d, last_name: e.target.value }))} />
            </div>
            <Input type="date" placeholder="Geburtsdatum" value={newCustomerData.birthdate}
              onChange={e => setNewCustomerData(d => ({ ...d, birthdate: e.target.value }))} />
            {customerAction === 'create_family_member' && (
              <>
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
              </>
            )}
            {customerAction === 'create_primary' && (
              <>
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
              </>
            )}
          </Card>
        )}

        <div className="flex gap-2 pt-2 border-t">
          <Button variant="outline" onClick={onRestart}>Neu starten</Button>
          <Button
            className="flex-1"
            disabled={
              !customerAction ||
              (customerAction === 'use_existing' && !selectedCustomerId) ||
              (customerAction === 'create_family_member' && !selectedPrimaryId) ||
              (customerAction === 'create_family_member' && (!newCustomerData.first_name || !newCustomerData.last_name)) ||
              (customerAction === 'create_primary' && (!newCustomerData.first_name || !newCustomerData.last_name))
            }
            onClick={() => setStep(1)}
          >
            Weiter: Antragsdaten prüfen
            <ChevronRight className="w-4 h-4 ml-1" />
          </Button>
        </div>
      </div>
    )
  }

  // ── SCHRITT 1: Antragsdaten prüfen ────────────────────────────────────────
  if (step === 1) {
    return (
      <div className="space-y-4">
        <StepIndicator current={1} />

        <div className="p-3 bg-blue-50 border border-blue-200 rounded text-sm text-blue-800">
          <FileText className="w-4 h-4 inline mr-1" />
          Bitte prüfen und korrigieren Sie die von der KI erkannten Antragsdaten.
        </div>

        <div className="space-y-3">
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
                className="w-full p-2 border rounded text-sm bg-background">
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
              <Input placeholder="z.B. kvg, vvg, mf" value={appData.sparte}
                onChange={e => setAppData(d => ({ ...d, sparte: e.target.value }))} />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="text-xs font-medium text-muted-foreground">Produkt / Tarif</label>
              <Input placeholder="z.B. Hausarztmodell" value={appData.product}
                onChange={e => setAppData(d => ({ ...d, product: e.target.value }))} />
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
          <Button variant="outline" onClick={() => setStep(0)}>
            <ChevronLeft className="w-4 h-4 mr-1" /> Zurück
          </Button>
          <Button className="flex-1" disabled={!appData.insurer} onClick={() => setStep(2)}>
            Weiter: Bestätigen <ChevronRight className="w-4 h-4 ml-1" />
          </Button>
        </div>
      </div>
    )
  }

  // ── SCHRITT 2: Bestätigen ─────────────────────────────────────────────────
  if (step === 2) {
    const typeLabels = { neuantrag: 'Neuantrag', aenderungsantrag: 'Änderungsantrag', erneuerungsantrag: 'Erneuerungsantrag' }

    let customerLabel = ''
    if (customerAction === 'use_existing') {
      const match = customerMatches?.find(m => m.customer.id === selectedCustomerId)
      customerLabel = `${match?.customer.first_name} ${match?.customer.last_name} (bestehend)`
    } else if (customerAction === 'create_family_member') {
      const primary = availablePrimaryCustomers?.find(c => c.id === selectedPrimaryId) || matchedPrimaryCustomer
      customerLabel = `${newCustomerData.first_name} ${newCustomerData.last_name} (neues FM bei ${primary?.first_name} ${primary?.last_name})`
    } else {
      customerLabel = `${newCustomerData.first_name} ${newCustomerData.last_name} (neuer Hauptkontakt)`
    }

    return (
      <div className="space-y-4">
        <StepIndicator current={2} />

        <div className="p-4 bg-muted/30 rounded-lg space-y-3 text-sm">
          <p className="font-semibold text-base">Zusammenfassung</p>

          <div className="space-y-2">
            <div className="flex justify-between">
              <span className="text-muted-foreground">Dokumenttyp</span>
              <span className="font-medium">{typeLabels[documentType] || documentType}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Kunde</span>
              <span className="font-medium">{customerLabel}</span>
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
          Der Antrag wird mit Status <strong>«In Prüfung»</strong> erstellt. Ein Vertrag wird erst nach manueller Statusänderung automatisch erzeugt.
        </div>

        {createMutation.error && (
          <div className="p-3 bg-red-50 border border-red-200 rounded text-sm text-red-700">
            {createMutation.error?.response?.data?.error || createMutation.error?.message}
          </div>
        )}

        <div className="flex gap-2 pt-2 border-t">
          <Button variant="outline" onClick={() => setStep(1)} disabled={createMutation.isPending}>
            <ChevronLeft className="w-4 h-4 mr-1" /> Zurück
          </Button>
          <Button
            className="flex-1 gap-2"
            onClick={handleSubmit}
            disabled={createMutation.isPending}
          >
            {createMutation.isPending && <Loader2 className="w-4 h-4 animate-spin" />}
            {createMutation.isPending ? 'Wird erstellt...' : 'Antrag erstellen & speichern'}
          </Button>
        </div>
      </div>
    )
  }

  return null
}