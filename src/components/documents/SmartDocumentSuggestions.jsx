import React, { useState } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { base44 } from '@/api/base44Client'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import {
  AlertCircle, CheckCircle2, Users, FileText,
  UserPlus, Home, Loader2, ChevronRight, ChevronLeft, User
} from 'lucide-react'
import { cn } from '@/lib/utils'

// ─────────────────────────────────────────────
// STEP INDICATOR
// ─────────────────────────────────────────────
function StepIndicator({ steps, current }) {
  return (
    <div className="flex items-center gap-1 mb-4">
      {steps.map((label, i) => (
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
          {i < steps.length - 1 && <ChevronRight className="w-3 h-3 text-muted-foreground flex-shrink-0" />}
        </div>
      ))}
    </div>
  )
}

// ─────────────────────────────────────────────
// MAIN COMPONENT
// ─────────────────────────────────────────────
export default function SmartDocumentSuggestions({ document, insights, onSuccess, onEdit }) {
  const queryClient = useQueryClient()

  // Modus: 'new_primary' | 'family_member' | 'existing_person'
  const [mode, setMode] = useState(null)
  // Für family_member-Modus: welcher Schritt (0=Hauptkontakt wählen, 1=Person anlegen, 2=Vertrag)
  const [step, setStep] = useState(0)
  // Für new_primary-Modus: welcher Schritt (0=Kundendaten, 1=Vertrag)
  const [primaryStep, setPrimaryStep] = useState(0)

  const [selectedPrimaryId, setSelectedPrimaryId] = useState(
    insights.matchedPrimaryCustomer?.id || null
  )
  const [familySearchQuery, setFamilySearchQuery] = useState('')

  const [personData, setPersonData] = useState({
    first_name: insights.suggestedFamilyMember?.first_name || insights.extractedData?.insured_first_name || '',
    last_name: insights.suggestedFamilyMember?.last_name || insights.extractedData?.insured_last_name || '',
    birthdate: insights.suggestedFamilyMember?.birthdate || insights.extractedData?.birthdate || '',
    family_role: 'other',
  })

  const [primaryData, setPrimaryData] = useState({
    first_name: insights.suggestedPrimaryCustomer?.first_name || insights.extractedData?.policy_holder_first_name || '',
    last_name: insights.suggestedPrimaryCustomer?.last_name || insights.extractedData?.policy_holder_last_name || '',
    email: insights.suggestedPrimaryCustomer?.email || insights.extractedData?.email || '',
    phone: insights.suggestedPrimaryCustomer?.phone || insights.extractedData?.phone || '',
    birthdate: insights.suggestedPrimaryCustomer?.birthdate || insights.extractedData?.birthdate || '',
    street: insights.suggestedPrimaryCustomer?.street || insights.extractedData?.street || '',
    zip_code: insights.suggestedPrimaryCustomer?.zip_code || insights.extractedData?.zip_code || '',
    city: insights.suggestedPrimaryCustomer?.city || insights.extractedData?.city || '',
  })

  const [contractData, setContractData] = useState({
    insurer: insights.suggestedContract?.insurer || '',
    insurance_type: insights.suggestedContract?.insurance_type || 'other',
    policy_number: insights.suggestedContract?.policy_number || '',
    premium_yearly: insights.suggestedContract?.premium_yearly || '',
  })

  const [createContract, setCreateContract] = useState(true)
  const [createdCustomerId, setCreatedCustomerId] = useState(null)
  const [done, setDone] = useState(false)

  // ── Mutations ──
  const createCustomerMut = useMutation({
    mutationFn: async (data) => base44.entities.Customer.create(data),
  })
  const createFamilyMut = useMutation({
    mutationFn: async (data) => base44.functions.invoke('createFamilyMember', data),
  })
  const createContractMut = useMutation({
    mutationFn: async (data) => base44.entities.Contract.create(data),
  })
  const updateDocMut = useMutation({
    mutationFn: async ({ id, updates }) => base44.entities.Document.update(id, updates),
  })

  const isLoading = createCustomerMut.isPending || createFamilyMut.isPending
    || createContractMut.isPending || updateDocMut.isPending

  // ─────────────────────────────────────────────
  // HELPERS
  // ─────────────────────────────────────────────
  const confidence = Math.max(
    insights.familyConfidence || 0,
    insights.personConfidence || 0,
    insights.contractConfidence || 0
  )

  const detectionLabel = {
    family_via_address: 'Familie über Adresse erkannt',
    family_via_lastname: 'Familie über Nachname erkannt',
    person_in_family_found: 'Person in Familie gefunden',
    new_family_member_suggested: 'Neues Familienmitglied erkannt',
    new_contract_detected: 'Neuer Vertrag erkannt',
    new_primary_customer_last_resort: 'Kein bestehender Kunde gefunden',
    extraction_failed: 'Extraktion fehlgeschlagen',
  }[insights.detectionPhase] || 'Analyse abgeschlossen'

  // Filtere Hauptkontakte für Suche
  const filteredPrimaries = (insights.availablePrimaryCustomers || []).filter(c => {
    const q = familySearchQuery.toLowerCase()
    if (!q) return true
    return `${c.first_name} ${c.last_name} ${c.customer_number}`.toLowerCase().includes(q)
  })

  // ─────────────────────────────────────────────
  // FINALIZE: Vertrag + Dokument abschliessen
  // ─────────────────────────────────────────────
  const finalize = async (customerId, primaryCustomerId, orgId, advisorId) => {
    if (createContract && contractData.insurer) {
      await createContractMut.mutateAsync({
        customer_id: customerId,
        primary_customer_id: primaryCustomerId,
        organization_id: orgId,
        advisor_id: advisorId,
        insurer: contractData.insurer,
        insurance_type: contractData.insurance_type || 'other',
        policy_number: contractData.policy_number || null,
        premium_yearly: contractData.premium_yearly ? Number(contractData.premium_yearly) : null,
        status: 'active',
        process_status: 'neu',
      })
    }

    await updateDocMut.mutateAsync({
      id: document.id,
      updates: {
        customer_id: customerId,
        primary_customer_id: primaryCustomerId,
        processing_stage: 'customer_mapped',
        classification_status: 'klassifiziert',
      }
    })

    queryClient.invalidateQueries({ queryKey: ['documents'] })
    setDone(true)
  }

  // ─────────────────────────────────────────────
  // FLOW A: Neues Familienmitglied
  // ─────────────────────────────────────────────
  const handleSaveFamilyMember = async () => {
    const user = await base44.auth.me()
    const primaryId = selectedPrimaryId

    // Finde Hauptkontakt-Daten für Org/Advisor – lade vollständige Daten aus DB
    let primary = insights.matchedPrimaryCustomer?.id === primaryId
      ? insights.matchedPrimaryCustomer
      : null
    if (!primary?.organization_id) {
      const results = await base44.entities.Customer.filter({ id: primaryId })
      primary = results[0] || primary
    }

    const orgId = primary?.organization_id || user.organization_id
    const advisorId = primary?.advisor_id || null

    let res
    try {
      res = await createFamilyMut.mutateAsync({
        primaryCustomerId: primaryId,
        primaryCustomerName: primary ? `${primary.first_name} ${primary.last_name}` : '',
        firstName: personData.first_name,
        birthdate: personData.birthdate || null,
        familyRole: personData.family_role || 'other',
      })
    } catch (err) {
      const msg = err?.response?.data?.error || err?.message || 'Fehler beim Anlegen'
      alert(`Fehler: ${msg}`)
      return
    }

    const newMemberId = res.data?.familyMemberId || res.data?.familyMember?.id
    if (!newMemberId) {
      alert('Fehler: Kein Familienmitglied erstellt. Bitte prüfen Sie die Eingaben.')
      return
    }

    setCreatedCustomerId(newMemberId)
    setStep(2) // Weiter zum Vertragsschritt
    // Store for finalize
    window.__tmpPrimary = { primaryId, orgId, advisorId, newMemberId }
  }

  const handleFinalizeFamily = async () => {
    const { primaryId, orgId, advisorId, newMemberId } = window.__tmpPrimary || {}
    await finalize(newMemberId, primaryId, orgId, advisorId)
  }

  // ─────────────────────────────────────────────
  // FLOW B: Neuer Hauptkontakt
  // ─────────────────────────────────────────────
  const handleSavePrimary = async () => {
    const user = await base44.auth.me()
    const newCustomer = await createCustomerMut.mutateAsync({
      first_name: primaryData.first_name,
      last_name: primaryData.last_name,
      email: primaryData.email || `noemail.${Date.now()}@placeholder.local`,
      phone: primaryData.phone || null,
      birthdate: primaryData.birthdate || null,
      street: primaryData.street || null,
      zip_code: primaryData.zip_code || null,
      city: primaryData.city || null,
      organization_id: user.organization_id,
      is_family_member: false,
      family_role: 'primary',
      status: 'active',
    })
    setCreatedCustomerId(newCustomer.id)
    window.__tmpNewPrimary = { id: newCustomer.id, orgId: user.organization_id, advisorId: null }
    setPrimaryStep(1)
  }

  const handleFinalizePrimary = async () => {
    const { id, orgId, advisorId } = window.__tmpNewPrimary || {}
    await finalize(id, id, orgId, advisorId)
  }

  // ─────────────────────────────────────────────
  // FLOW C: Bestehende Person (matchedPerson found)
  // ─────────────────────────────────────────────
  const handleFinalizeExisting = async () => {
    const user = await base44.auth.me()
    const person = insights.matchedPerson || insights.matchedPrimaryCustomer
    await finalize(
      person.id,
      insights.matchedPrimaryCustomer?.id || person.id,
      person.organization_id || user.organization_id,
      person.advisor_id || null
    )
  }

  // ─────────────────────────────────────────────
  // DONE STATE
  // ─────────────────────────────────────────────
  if (done) {
    return (
      <div className="py-8 text-center space-y-3">
        <CheckCircle2 className="w-10 h-10 mx-auto text-green-500" />
        <p className="font-semibold text-green-700">Erfolgreich verarbeitet!</p>
        <p className="text-sm text-muted-foreground">Dokument, Person und Vertrag wurden gespeichert.</p>
        <Button onClick={onSuccess} className="mt-2">Fertig</Button>
      </div>
    )
  }

  // ─────────────────────────────────────────────
  // RENDER
  // ─────────────────────────────────────────────
  return (
    <div className="space-y-4 max-h-[70vh] overflow-y-auto pr-1">

      {/* ── Ergebnis-Banner ── */}
      <div className={cn(
        'p-3 rounded-lg flex items-center gap-2 text-sm font-medium',
        confidence >= 85
          ? 'bg-green-50 text-green-800 border border-green-200'
          : 'bg-amber-50 text-amber-800 border border-amber-200'
      )}>
        {confidence >= 85
          ? <CheckCircle2 className="w-4 h-4 flex-shrink-0" />
          : <AlertCircle className="w-4 h-4 flex-shrink-0" />}
        {confidence > 0 && <span>{Math.round(confidence)}% – </span>}
        <span>{detectionLabel}</span>
      </div>

      {/* ── MODUS-AUSWAHL (wenn noch nicht gewählt) ── */}
      {!mode && (
        <div className="space-y-3">
          <p className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">
            Wie soll das Dokument verarbeitet werden?
          </p>

          {/* Option A: Bestehende Person gefunden */}
          {insights.matchedPerson && (
            <button
              onClick={() => setMode('existing_person')}
              className="w-full text-left p-4 rounded-lg border-2 border-green-200 bg-green-50 hover:bg-green-100 transition"
            >
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-full bg-green-200 flex items-center justify-center flex-shrink-0">
                  <User className="w-4 h-4 text-green-700" />
                </div>
                <div>
                  <p className="font-semibold text-green-800">
                    ✅ Bestehende Person – {insights.matchedPerson.first_name} {insights.matchedPerson.last_name}
                  </p>
                  <p className="text-xs text-green-700">
                    Vertrag direkt dieser Person zuweisen
                  </p>
                </div>
              </div>
            </button>
          )}

          {/* Option B: Als Familienmitglied hinzufügen */}
          <button
            onClick={() => { setMode('family_member'); setStep(0) }}
            className="w-full text-left p-4 rounded-lg border-2 border-amber-200 bg-amber-50 hover:bg-amber-100 transition"
          >
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-full bg-amber-200 flex items-center justify-center flex-shrink-0">
                <Users className="w-4 h-4 text-amber-700" />
              </div>
              <div>
                <p className="font-semibold text-amber-800">🟡 Als Familienmitglied hinzufügen</p>
                <p className="text-xs text-amber-700">
                  Kind, Partner oder weiteres Mitglied einer bestehenden Familie
                </p>
              </div>
            </div>
          </button>

          {/* Option C: Neuer Hauptkontakt */}
          <button
            onClick={() => { setMode('new_primary'); setPrimaryStep(0) }}
            className="w-full text-left p-4 rounded-lg border-2 border-border bg-muted/30 hover:bg-muted/60 transition"
          >
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-full bg-muted flex items-center justify-center flex-shrink-0">
                <UserPlus className="w-4 h-4 text-muted-foreground" />
              </div>
              <div>
                <p className="font-semibold">🔴 Neuer Hauptkontakt</p>
                <p className="text-xs text-muted-foreground">
                  Komplett neuer Kunde, keine bestehende Familie
                </p>
              </div>
            </div>
          </button>
        </div>
      )}

      {/* ══════════════════════════════════════════════
          FLOW A: BESTEHENDE PERSON
      ══════════════════════════════════════════════ */}
      {mode === 'existing_person' && insights.matchedPerson && (
        <div className="space-y-4">
          <Card className="p-4 border-l-4 border-l-green-500 bg-green-50">
            <p className="font-semibold flex items-center gap-2 text-green-800">
              <User className="w-4 h-4" />
              {insights.matchedPerson.first_name} {insights.matchedPerson.last_name}
            </p>
            <p className="text-xs text-green-700 mt-1">
              Person in Familie von {insights.matchedPrimaryCustomer?.first_name} {insights.matchedPrimaryCustomer?.last_name}
            </p>
          </Card>

          {ContractForm({ contractData, setContractData, createContract, setCreateContract })}

          <ActionBar
            onBack={() => setMode(null)}
            onConfirm={handleFinalizeExisting}
            isLoading={isLoading}
            confirmLabel="Vertrag zuweisen & Speichern"
          />
        </div>
      )}

      {/* ══════════════════════════════════════════════
          FLOW B: FAMILIENMITGLIED – SCHRITT 0: Hauptkontakt wählen
      ══════════════════════════════════════════════ */}
      {mode === 'family_member' && step === 0 && (
        <div className="space-y-4">
          <StepIndicator steps={['Familie wählen', 'Person anlegen', 'Vertrag']} current={0} />

          <div>
            <p className="text-sm font-semibold mb-2 flex items-center gap-2">
              <Home className="w-4 h-4" />
              Zu welchem Hauptkontakt / Haushalt?
            </p>

            {/* Vorgefundene Familie direkt vorschlagen */}
            {insights.matchedPrimaryCustomer && (
              <button
                onClick={() => { setSelectedPrimaryId(insights.matchedPrimaryCustomer.id); setStep(1) }}
                className={cn(
                  'w-full text-left p-3 rounded-lg border-2 mb-2 transition',
                  selectedPrimaryId === insights.matchedPrimaryCustomer.id
                    ? 'border-primary bg-primary/5'
                    : 'border-green-300 bg-green-50 hover:bg-green-100'
                )}
              >
                <p className="font-semibold text-green-800 text-sm">
                  ✅ {insights.matchedPrimaryCustomer.first_name} {insights.matchedPrimaryCustomer.last_name}
                </p>
                <p className="text-xs text-green-700">Automatisch erkannt · {insights.familyConfidence}% Konfidenz</p>
              </button>
            )}

            <Input
              placeholder="Familie suchen (Name, Kundennummer)..."
              value={familySearchQuery}
              onChange={(e) => setFamilySearchQuery(e.target.value)}
              className="mb-2"
            />

            <div className="max-h-48 overflow-y-auto space-y-1 border rounded-lg p-2">
              {filteredPrimaries.length === 0 && (
                <p className="text-xs text-muted-foreground text-center py-4">Keine Ergebnisse</p>
              )}
              {filteredPrimaries.map(c => (
                <button
                  key={c.id}
                  onClick={() => { setSelectedPrimaryId(c.id); setStep(1) }}
                  className={cn(
                    'w-full text-left p-2 rounded text-sm transition',
                    selectedPrimaryId === c.id
                      ? 'bg-primary/10 font-semibold'
                      : 'hover:bg-muted/60'
                  )}
                >
                  {c.first_name} {c.last_name}
                  {c.customer_number && <span className="text-xs text-muted-foreground ml-1">({c.customer_number})</span>}
                </button>
              ))}
            </div>
          </div>

          <ActionBar onBack={() => setMode(null)} onConfirm={() => { if (selectedPrimaryId) setStep(1) }}
            isLoading={false} confirmLabel="Weiter" confirmDisabled={!selectedPrimaryId} />
        </div>
      )}

      {/* ══════════════════════════════════════════════
          FLOW B: FAMILIENMITGLIED – SCHRITT 1: Person anlegen
      ══════════════════════════════════════════════ */}
      {mode === 'family_member' && step === 1 && (
        <div className="space-y-4">
          <StepIndicator steps={['Familie wählen', 'Person anlegen', 'Vertrag']} current={1} />

          <Card className="p-4 border-l-4 border-l-amber-400">
            <p className="font-semibold text-sm mb-3 flex items-center gap-2">
              <UserPlus className="w-4 h-4" />
              Neues Familienmitglied
            </p>
            <div className="space-y-2">
              <div className="grid grid-cols-2 gap-2">
                <Input
                  placeholder="Vorname *"
                  value={personData.first_name}
                  onChange={(e) => setPersonData(p => ({ ...p, first_name: e.target.value }))}
                />
                <Input
                  placeholder="Nachname *"
                  value={personData.last_name}
                  onChange={(e) => setPersonData(p => ({ ...p, last_name: e.target.value }))}
                />
              </div>
              <Input
                type="date"
                placeholder="Geburtsdatum"
                value={personData.birthdate}
                onChange={(e) => setPersonData(p => ({ ...p, birthdate: e.target.value }))}
              />
              <select
                value={personData.family_role}
                onChange={(e) => setPersonData(p => ({ ...p, family_role: e.target.value }))}
                className="w-full p-2 border rounded text-sm bg-background"
              >
                <option value="spouse">Partner/Ehepartner</option>
                <option value="child">Kind</option>
                <option value="parent">Elternteil</option>
                <option value="other">Sonstige</option>
              </select>
            </div>
          </Card>

          <ActionBar
            onBack={() => setStep(0)}
            onConfirm={handleSaveFamilyMember}
            isLoading={createFamilyMut.isPending}
            confirmLabel="Person anlegen & weiter"
            confirmDisabled={!personData.first_name || !personData.last_name}
          />
        </div>
      )}

      {/* ══════════════════════════════════════════════
          FLOW B: FAMILIENMITGLIED – SCHRITT 2: Vertrag
      ══════════════════════════════════════════════ */}
      {mode === 'family_member' && step === 2 && (
        <div className="space-y-4">
          <StepIndicator steps={['Familie wählen', 'Person anlegen', 'Vertrag']} current={2} />

          <Card className="p-3 bg-green-50 border border-green-200 text-sm text-green-800">
            <CheckCircle2 className="w-4 h-4 inline mr-1" />
            <strong>{personData.first_name} {personData.last_name}</strong> wurde angelegt und der Familie zugeordnet.
          </Card>

          {ContractForm({ contractData, setContractData, createContract, setCreateContract })}

          <ActionBar
            onBack={() => setStep(1)}
            onConfirm={handleFinalizeFamily}
            isLoading={isLoading}
            confirmLabel="Vertrag erstellen & Abschliessen"
          />
        </div>
      )}

      {/* ══════════════════════════════════════════════
          FLOW C: NEUER HAUPTKONTAKT – SCHRITT 0: Kundendaten
      ══════════════════════════════════════════════ */}
      {mode === 'new_primary' && primaryStep === 0 && (
        <div className="space-y-4">
          <StepIndicator steps={['Kundendaten', 'Vertrag']} current={0} />

          <Card className="p-4 border-l-4 border-l-red-400">
            <p className="font-semibold text-sm mb-3 flex items-center gap-2">
              <UserPlus className="w-4 h-4" />
              Neuer Hauptkontakt
            </p>
            <div className="space-y-2">
              <div className="grid grid-cols-2 gap-2">
                <Input
                  placeholder="Vorname *"
                  value={primaryData.first_name}
                  onChange={(e) => setPrimaryData(p => ({ ...p, first_name: e.target.value }))}
                />
                <Input
                  placeholder="Nachname *"
                  value={primaryData.last_name}
                  onChange={(e) => setPrimaryData(p => ({ ...p, last_name: e.target.value }))}
                />
              </div>
              <Input
                type="email"
                placeholder="E-Mail"
                value={primaryData.email}
                onChange={(e) => setPrimaryData(p => ({ ...p, email: e.target.value }))}
              />
              <Input
                placeholder="Telefon"
                value={primaryData.phone}
                onChange={(e) => setPrimaryData(p => ({ ...p, phone: e.target.value }))}
              />
              <Input
                type="date"
                placeholder="Geburtsdatum"
                value={primaryData.birthdate}
                onChange={(e) => setPrimaryData(p => ({ ...p, birthdate: e.target.value }))}
              />
              <div className="grid grid-cols-3 gap-2">
                <Input
                  placeholder="Strasse"
                  value={primaryData.street}
                  onChange={(e) => setPrimaryData(p => ({ ...p, street: e.target.value }))}
                  className="col-span-2"
                />
                <Input
                  placeholder="PLZ"
                  value={primaryData.zip_code}
                  onChange={(e) => setPrimaryData(p => ({ ...p, zip_code: e.target.value }))}
                />
              </div>
              <Input
                placeholder="Ort"
                value={primaryData.city}
                onChange={(e) => setPrimaryData(p => ({ ...p, city: e.target.value }))}
              />
            </div>
          </Card>

          <ActionBar
            onBack={() => setMode(null)}
            onConfirm={handleSavePrimary}
            isLoading={createCustomerMut.isPending}
            confirmLabel="Kunden speichern & weiter"
            confirmDisabled={!primaryData.first_name || !primaryData.last_name}
          />
        </div>
      )}

      {/* ══════════════════════════════════════════════
          FLOW C: NEUER HAUPTKONTAKT – SCHRITT 1: Vertrag
      ══════════════════════════════════════════════ */}
      {mode === 'new_primary' && primaryStep === 1 && (
        <div className="space-y-4">
          <StepIndicator steps={['Kundendaten', 'Vertrag']} current={1} />

          <Card className="p-3 bg-green-50 border border-green-200 text-sm text-green-800">
            <CheckCircle2 className="w-4 h-4 inline mr-1" />
            <strong>{primaryData.first_name} {primaryData.last_name}</strong> wurde als neuer Kunde gespeichert.
          </Card>

          {ContractForm({ contractData, setContractData, createContract, setCreateContract })}

          <ActionBar
            onBack={() => setPrimaryStep(0)}
            onConfirm={handleFinalizePrimary}
            isLoading={isLoading}
            confirmLabel="Vertrag erstellen & Abschliessen"
          />
        </div>
      )}
    </div>
  )
}

// ─────────────────────────────────────────────
// SHARED: Vertragsformular
// ─────────────────────────────────────────────
function ContractForm({ contractData, setContractData, createContract, setCreateContract }) {
  return (
    <Card className="p-4 border-l-4 border-l-emerald-500">
      <label className="flex items-center gap-2 cursor-pointer mb-3">
        <input
          type="checkbox"
          checked={createContract}
          onChange={(e) => setCreateContract(e.target.checked)}
          className="w-4 h-4"
        />
        <span className="font-semibold flex items-center gap-2">
          <FileText className="w-4 h-4" />
          Vertrag aus Police erstellen
        </span>
      </label>

      {createContract && (
        <div className="space-y-2 pt-2 border-t">
          <div className="grid grid-cols-2 gap-2">
            <Input
              placeholder="Versicherer *"
              value={contractData.insurer}
              onChange={(e) => setContractData(p => ({ ...p, insurer: e.target.value }))}
            />
            <Input
              placeholder="Policennummer"
              value={contractData.policy_number}
              onChange={(e) => setContractData(p => ({ ...p, policy_number: e.target.value }))}
            />
          </div>
          <div className="grid grid-cols-2 gap-2">
            <select
              value={contractData.insurance_type}
              onChange={(e) => setContractData(p => ({ ...p, insurance_type: e.target.value }))}
              className="p-2 border rounded text-sm bg-background"
            >
              <option value="life">Leben</option>
              <option value="health">Kranken</option>
              <option value="property">Sach</option>
              <option value="liability">Haftpflicht</option>
              <option value="motor">Motorfahrzeug</option>
              <option value="other">Sonstiges</option>
            </select>
            <Input
              type="number"
              placeholder="Jahresprämie CHF"
              value={contractData.premium_yearly}
              onChange={(e) => setContractData(p => ({ ...p, premium_yearly: e.target.value }))}
            />
          </div>
        </div>
      )}
    </Card>
  )
}

// ─────────────────────────────────────────────
// SHARED: Action Bar
// ─────────────────────────────────────────────
function ActionBar({ onBack, onConfirm, isLoading, confirmLabel, confirmDisabled }) {
  return (
    <div className="flex gap-2 pt-2 border-t">
      <Button variant="outline" onClick={onBack} disabled={isLoading} className="gap-1">
        <ChevronLeft className="w-4 h-4" />
        Zurück
      </Button>
      <Button
        onClick={onConfirm}
        disabled={isLoading || confirmDisabled}
        className="flex-1 gap-2"
      >
        {isLoading && <Loader2 className="w-4 h-4 animate-spin" />}
        {isLoading ? 'Wird verarbeitet...' : confirmLabel}
      </Button>
    </div>
  )
}