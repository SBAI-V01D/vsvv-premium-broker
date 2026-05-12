import React, { useState } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { base44 } from '@/api/base44Client'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { AlertCircle, CheckCircle2, Users, FileText, Plus, Loader2 } from 'lucide-react'
import { cn } from '@/lib/utils'

export default function SmartDocumentSuggestions({ document, insights, onSuccess, onEdit }) {
  const queryClient = useQueryClient()
  const [acceptedActions, setAcceptedActions] = useState({})
  const [personType, setPersonType] = useState(null) // 'new_primary' | 'family_member'
  const [selectedPrimaryId, setSelectedPrimaryId] = useState(null)
  const [primaryData, setPrimaryData] = useState({
    first_name: insights.suggestedPrimaryCustomer?.first_name || '',
    last_name: insights.suggestedPrimaryCustomer?.last_name || '',
    email: '',
    birthdate: insights.suggestedPrimaryCustomer?.birthdate || '',
  })
  const [familyData, setFamilyData] = useState({
    first_name: insights.suggestedFamilyMember?.first_name || '',
    last_name: insights.suggestedFamilyMember?.last_name || '',
    birthdate: insights.suggestedFamilyMember?.birthdate || '',
  })

  const createFamilyMutation = useMutation({
    mutationFn: async (data) => {
      return base44.functions.invoke('createFamilyMember', data)
    },
  })

  const createContractMutation = useMutation({
    mutationFn: async (data) => {
      return base44.entities.Contract.create(data)
    },
  })

  const updateDocMutation = useMutation({
    mutationFn: async (data) => {
      return base44.entities.Document.update(document.id, data)
    },
  })

  const handleApplyAll = async () => {
    try {
      const user = await base44.auth.me()
      let primaryCustomerId = insights.matchedPrimaryCustomer?.id
      let customerId = primaryCustomerId

      // 1. NEUEN HAUPTKUNDEN ERSTELLEN (falls gewählt)
      if (personType === 'new_primary' && insights.suggestedPrimaryCustomer) {
        const newPrimary = await base44.entities.Customer.create({
          first_name: primaryData.first_name,
          last_name: primaryData.last_name,
          email: primaryData.email || `noemail@${user.organization_id}.local`,
          birthdate: primaryData.birthdate || null,
          organization_id: user.organization_id,
          is_family_member: false,
          family_role: 'primary',
        })
        primaryCustomerId = newPrimary.id
        customerId = primaryCustomerId
      }

      // 2. FAMILIENMITGLIED ERSTELLEN (falls gewählt + Hauptkontakt vorhanden)
      if (personType === 'family_member' && insights.suggestedFamilyMember && selectedPrimaryId) {
        primaryCustomerId = selectedPrimaryId
        const newFamily = await createFamilyMutation.mutateAsync({
          first_name: familyData.first_name,
          last_name: familyData.last_name,
          birthdate: familyData.birthdate,
          primary_customer_id: primaryCustomerId,
          family_role: familyData.birthdate ? 'child' : 'spouse',
        })
        customerId = newFamily.data.id
      }

      // 3. VERTRAG ERSTELLEN (falls akzeptiert)
      if (insights.suggestedContract && acceptedActions.createContract && customerId) {
        const primaryCustomer = insights.matchedPrimaryCustomer || { organization_id: user.organization_id, advisor_id: user.id }
        const contractData = {
          ...insights.suggestedContract,
          customer_id: customerId,
          primary_customer_id: primaryCustomerId,
          organization_id: primaryCustomer.organization_id,
          advisor_id: primaryCustomer.advisor_id,
          status: 'pending',
          process_status: 'neu',
        }
        await createContractMutation.mutateAsync(contractData)
      }

      // 4. DOKUMENT AKTUALISIEREN
      const updates = {
        customer_id: customerId,
        primary_customer_id: primaryCustomerId,
        processing_stage: 'customer_mapped',
        classification_status: 'klassifiziert',
      }
      await updateDocMutation.mutateAsync(updates)

      queryClient.invalidateQueries({ queryKey: ['documents'] })
      onSuccess?.()
    } catch (error) {
      console.error('Error applying suggestions:', error)
    }
  }

  const isLoading = createFamilyMutation.isPending || createContractMutation.isPending || updateDocMutation.isPending

  // Bestimme höchste Konfidenz aus allen Phasen
  const highestConfidence = Math.max(
    insights.familyConfidence || 0,
    insights.personConfidence || 0,
    insights.contractConfidence || 0
  );

  // Bestimme Erkennungs-Label
  let detectionLabel = 'Analyse läuft...';
  if (insights.detectionPhase === 'family_via_address' || insights.detectionPhase === 'family_via_lastname') {
    detectionLabel = 'Familie erkannt';
  } else if (insights.detectionPhase === 'person_in_family_found') {
    detectionLabel = 'Person in Familie gefunden';
  } else if (insights.detectionPhase === 'new_family_member_suggested') {
    detectionLabel = 'Neues Familienmitglied erkannt';
  } else if (insights.detectionPhase === 'new_contract_detected') {
    detectionLabel = 'Neuer Vertrag erkannt';
  } else if (insights.detectionPhase === 'new_primary_customer_last_resort') {
    detectionLabel = 'Neuer Kunde (keine Familie gefunden)';
  }

  return (
    <div className="space-y-4">
      {/* Konfidenz-Badge */}
      <div className={cn(
        'p-3 rounded-lg flex items-center gap-2',
        highestConfidence >= 85
          ? 'bg-green-50 text-green-800 border border-green-200'
          : 'bg-amber-50 text-amber-800 border border-amber-200'
      )}>
        {highestConfidence >= 85 ? (
          <CheckCircle2 className="w-4 h-4 flex-shrink-0" />
        ) : (
          <AlertCircle className="w-4 h-4 flex-shrink-0" />
        )}
        <span className="text-sm font-medium">
          {Math.round(highestConfidence)}% – {detectionLabel}
        </span>
      </div>

      {/* Vorschlag 1: Hauptkontakt gefunden oder neuer Kunde */}
      {insights.matchedPrimaryCustomer && (
        <Card className="p-4 border-l-4 border-l-blue-500">
          <div className="flex items-start justify-between">
            <div>
              <p className="font-semibold flex items-center gap-2">
                <Users className="w-4 h-4" />
                Familie erkannt
              </p>
              <p className="text-sm text-muted-foreground mt-1">
                {insights.matchedPrimaryCustomer.first_name} {insights.matchedPrimaryCustomer.last_name}
                {insights.matchedFamily.length > 0 && ` + ${insights.matchedFamily.length} Familienmitglied(er)`}
              </p>
            </div>
            <div className="w-2 h-2 rounded-full bg-green-500" />
          </div>
        </Card>
      )}

      {/* Entscheidungsfrage: Neuer Hauptkontakt ODER Familienmitglied? */}
      {(insights.suggestedPrimaryCustomer || insights.suggestedFamilyMember) && (
        <Card className="p-4 border-l-4 border-l-blue-500 bg-blue-50">
          <p className="font-semibold mb-3">❓ Person hinzufügen als:</p>
          
          <div className="space-y-3">
            {/* Option 1: Neuer Hauptkontakt */}
            {insights.suggestedPrimaryCustomer && (
              <label className="flex items-start gap-3 cursor-pointer p-3 rounded border border-blue-200 hover:bg-blue-100 transition">
                <input
                  type="radio"
                  name="person_type"
                  value="new_primary"
                  checked={personType === 'new_primary'}
                  onChange={() => {
                    setPersonType('new_primary')
                    setSelectedPrimaryId(null)
                  }}
                  className="mt-1"
                />
                <div className="flex-1">
                  <p className="font-semibold">🔴 Neuer Hauptkontakt</p>
                  <p className="text-xs text-muted-foreground">
                    {insights.suggestedPrimaryCustomer.first_name} {insights.suggestedPrimaryCustomer.last_name}
                  </p>
                </div>
              </label>
            )}

            {/* Option 2: Familienmitglied zu bestehendem Hauptkontakt */}
            {insights.suggestedFamilyMember && (
              <label className="flex items-start gap-3 cursor-pointer p-3 rounded border border-blue-200 hover:bg-blue-100 transition">
                <input
                  type="radio"
                  name="person_type"
                  value="family_member"
                  checked={personType === 'family_member'}
                  onChange={() => setPersonType('family_member')}
                  className="mt-1"
                />
                <div className="flex-1">
                  <p className="font-semibold">🟡 Familienmitglied hinzufügen</p>
                  <p className="text-xs text-muted-foreground">
                    {insights.suggestedFamilyMember.first_name} {insights.suggestedFamilyMember.last_name}
                  </p>
                </div>
              </label>
            )}
          </div>
        </Card>
      )}

      {/* OPTION 1: Neuer Hauptkontakt – Formular */}
      {personType === 'new_primary' && insights.suggestedPrimaryCustomer && (
        <Card className="p-4 border-l-4 border-l-red-500 bg-red-50">
          <p className="font-semibold mb-3">🔴 Neuer Hauptkontakt Daten</p>
          <div className="space-y-2">
            <Input
              placeholder="Vorname"
              value={primaryData.first_name}
              onChange={(e) => setPrimaryData(prev => ({ ...prev, first_name: e.target.value }))}
              className="text-sm"
            />
            <Input
              placeholder="Nachname"
              value={primaryData.last_name}
              onChange={(e) => setPrimaryData(prev => ({ ...prev, last_name: e.target.value }))}
              className="text-sm"
            />
            <Input
              type="email"
              placeholder="E-Mail (optional)"
              value={primaryData.email}
              onChange={(e) => setPrimaryData(prev => ({ ...prev, email: e.target.value }))}
              className="text-sm"
            />
            <Input
              type="date"
              placeholder="Geburtsdatum"
              value={primaryData.birthdate}
              onChange={(e) => setPrimaryData(prev => ({ ...prev, birthdate: e.target.value }))}
              className="text-sm"
            />
          </div>
        </Card>
      )}

      {/* OPTION 2: Familienmitglied – Hauptkontakt wählen + Formular */}
      {personType === 'family_member' && insights.suggestedFamilyMember && (
        <Card className="p-4 border-l-4 border-l-amber-500 bg-amber-50">
          <p className="font-semibold mb-3">🟡 Zu welchem Hauptkontakt hinzufügen?</p>
          
          <select
            value={selectedPrimaryId || ''}
            onChange={(e) => setSelectedPrimaryId(e.target.value)}
            className="w-full mb-4 p-2 border rounded text-sm"
          >
            <option value="">-- Hauptkontakt auswählen --</option>
            {insights.availablePrimaryCustomers?.map(customer => (
              <option key={customer.id} value={customer.id}>
                {customer.first_name} {customer.last_name} ({customer.customer_number})
              </option>
            ))}
          </select>

          {selectedPrimaryId && (
            <div className="space-y-2">
              <p className="text-xs text-muted-foreground mb-2">Familienmitglied Daten:</p>
              <Input
                placeholder="Vorname"
                value={familyData.first_name}
                onChange={(e) => setFamilyData(prev => ({ ...prev, first_name: e.target.value }))}
                className="text-sm"
              />
              <Input
                placeholder="Nachname"
                value={familyData.last_name}
                onChange={(e) => setFamilyData(prev => ({ ...prev, last_name: e.target.value }))}
                className="text-sm"
              />
              <Input
                type="date"
                placeholder="Geburtsdatum"
                value={familyData.birthdate}
                onChange={(e) => setFamilyData(prev => ({ ...prev, birthdate: e.target.value }))}
                className="text-sm"
              />
            </div>
          )}
        </Card>
      )}

      {/* Vorschlag 4: Vertrag erstellen */}
      {insights.suggestedContract && (
        <Card className="p-4 border-l-4 border-l-emerald-500">
          <label className="flex items-start gap-3 cursor-pointer">
            <input
              type="checkbox"
              checked={acceptedActions.createContract || false}
              onChange={(e) => setAcceptedActions(prev => ({ ...prev, createContract: e.target.checked }))}
              className="mt-1"
            />
            <div className="flex-1">
              <p className="font-semibold flex items-center gap-2">
                <FileText className="w-4 h-4" />
                Vertrag erstellen
              </p>
              <p className="text-sm text-muted-foreground mt-1">
                {insights.suggestedContract.insurer} · {insights.suggestedContract.insurance_type}
                {insights.suggestedContract.premium_yearly && ` · CHF ${insights.suggestedContract.premium_yearly.toLocaleString('de-CH')}/Jahr`}
              </p>
            </div>
          </label>
        </Card>
      )}

      {/* Aktionen */}
      <div className="flex gap-2 pt-4 border-t">
        <Button variant="outline" onClick={onEdit} disabled={isLoading}>
          Zurück
        </Button>
        <Button onClick={handleApplyAll} disabled={isLoading} className="flex-1 gap-2">
          {isLoading && <Loader2 className="w-4 h-4 animate-spin" />}
          {isLoading ? 'Wird verarbeitet...' : 'Bestätigen & Weiter'}
        </Button>
      </div>
    </div>
  )
}