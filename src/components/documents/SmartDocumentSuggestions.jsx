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
  const [showNewFamilyForm, setShowNewFamilyForm] = useState(false)
  const [newFamilyData, setNewFamilyData] = useState({
    first_name: insights.suggestedFamilyMember?.first_name || '',
    last_name: insights.suggestedFamilyMember?.last_name || '',
    email: '',
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
      let customerId = insights.matchedPrimaryCustomer?.id

      // 1. Neuen Hauptkunden erstellen (falls keine Familie gefunden)
      if (!insights.matchedPrimaryCustomer && insights.suggestedFamilyMember?.family_role === 'primary' && acceptedActions.createPrimaryCustomer) {
        const user = await base44.auth.me()
        const primaryRes = await base44.entities.Customer.create({
          first_name: newFamilyData.first_name,
          last_name: newFamilyData.last_name,
          email: newFamilyData.email || `${newFamilyData.first_name.toLowerCase()}.${newFamilyData.last_name.toLowerCase()}@placeholder.local`,
          birthdate: newFamilyData.birthdate,
          organization_id: user.organization_id,
          is_family_member: false,
          family_role: 'primary',
        })
        customerId = primaryRes.id
      }

      // 2. Familienmitglied erstellen (falls vorgeschlagen + akzeptiert)
      if (insights.suggestedFamilyMember && acceptedActions.createFamily && insights.suggestedFamilyMember.family_role !== 'primary') {
        const familyRes = await createFamilyMutation.mutateAsync({
          first_name: newFamilyData.first_name,
          last_name: newFamilyData.last_name,
          birthdate: newFamilyData.birthdate,
          primary_customer_id: customerId || insights.matchedPrimaryCustomer.id,
          family_role: newFamilyData.birthdate ? 'child' : 'spouse',
        })
        customerId = familyRes.data.id
      }

      // 3. Vertrag erstellen (falls Vorschlag + akzeptiert)
      if (insights.suggestedContract && acceptedActions.createContract) {
        const primaryCustomer = insights.matchedPrimaryCustomer
        const contractData = {
          ...insights.suggestedContract,
          customer_id: customerId,
          organization_id: primaryCustomer?.organization_id,
          advisor_id: primaryCustomer?.advisor_id,
          status: 'pending',
          process_status: 'neu',
        }
        await createContractMutation.mutateAsync(contractData)
      }

      // 4. Dokument aktualisieren
      const updates = {
        customer_id: customerId,
        primary_customer_id: insights.matchedPrimaryCustomer?.id || customerId,
        processing_stage: 'customer_mapped',
        classification_status: 'klassifiziert',
      }
      if (insights.suggestedContract && acceptedActions.createContract) {
        updates.linked_contract_id = insights.suggestedContract.id
      }
      await updateDocMutation.mutateAsync(updates)

      queryClient.invalidateQueries({ queryKey: ['documents'] })
      onSuccess?.()
    } catch (error) {
      console.error('Error applying suggestions:', error)
    }
  }

  const isLoading = createFamilyMutation.isPending || createContractMutation.isPending || updateDocMutation.isPending

  return (
    <div className="space-y-4">
      {/* Konfidenz-Badge */}
      <div className={cn(
        'p-3 rounded-lg flex items-center gap-2',
        insights.matchConfidence >= 90
          ? 'bg-green-50 text-green-800 border border-green-200'
          : 'bg-amber-50 text-amber-800 border border-amber-200'
      )}>
        {insights.matchConfidence >= 90 ? (
          <CheckCircle2 className="w-4 h-4 flex-shrink-0" />
        ) : (
          <AlertCircle className="w-4 h-4 flex-shrink-0" />
        )}
        <span className="text-sm font-medium">
          {insights.matchConfidence}% Konfidenz – {insights.matchedPrimaryCustomer ? 'Hauptkontakt gefunden' : 'Neuer Kunde'}
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

      {/* Neuer Hauptkunde */}
      {!insights.matchedPrimaryCustomer && insights.suggestedFamilyMember?.family_role === 'primary' && (
        <Card className="p-4 border-l-4 border-l-amber-500">
          <label className="flex items-start gap-3 cursor-pointer">
            <input
              type="checkbox"
              checked={acceptedActions.createPrimaryCustomer || false}
              onChange={(e) => {
                setAcceptedActions(prev => ({ ...prev, createPrimaryCustomer: e.target.checked }))
                if (e.target.checked) setShowNewFamilyForm(true)
              }}
              className="mt-1"
            />
            <div className="flex-1">
              <p className="font-semibold">Neuer Kunde</p>
              <p className="text-sm text-muted-foreground mt-1">
                {insights.suggestedFamilyMember.first_name} {insights.suggestedFamilyMember.last_name}
              </p>
            </div>
          </label>

          {showNewFamilyForm && acceptedActions.createPrimaryCustomer && (
            <div className="mt-3 p-3 bg-muted/40 rounded space-y-2">
              <Input
                placeholder="Vorname"
                value={newFamilyData.first_name}
                onChange={(e) => setNewFamilyData(prev => ({ ...prev, first_name: e.target.value }))}
                className="text-sm"
              />
              <Input
                placeholder="Nachname"
                value={newFamilyData.last_name}
                onChange={(e) => setNewFamilyData(prev => ({ ...prev, last_name: e.target.value }))}
                className="text-sm"
              />
              <Input
                type="email"
                placeholder="E-Mail (optional)"
                value={newFamilyData.email}
                onChange={(e) => setNewFamilyData(prev => ({ ...prev, email: e.target.value }))}
                className="text-sm"
              />
              <Input
                type="date"
                placeholder="Geburtsdatum"
                value={newFamilyData.birthdate}
                onChange={(e) => setNewFamilyData(prev => ({ ...prev, birthdate: e.target.value }))}
                className="text-sm"
              />
            </div>
          )}
        </Card>
      )}

      {/* Vorschlag 2: Neues Familienmitglied */}
      {insights.suggestedFamilyMember && (
        <Card className="p-4 border-l-4 border-l-amber-500">
          <label className="flex items-start gap-3 cursor-pointer">
            <input
              type="checkbox"
              checked={acceptedActions.createFamily || false}
              onChange={(e) => {
                setAcceptedActions(prev => ({ ...prev, createFamily: e.target.checked }))
                if (e.target.checked) setShowNewFamilyForm(true)
              }}
              className="mt-1"
            />
            <div className="flex-1">
              <p className="font-semibold">Neues Familienmitglied hinzufügen</p>
              <p className="text-sm text-muted-foreground mt-1">
                {insights.insuredName}
                {insights.insuredBirthdate && ` (geb. ${insights.insuredBirthdate})`}
              </p>
            </div>
          </label>

          {showNewFamilyForm && acceptedActions.createFamily && (
            <div className="mt-3 p-3 bg-muted/40 rounded space-y-2">
              <Input
                placeholder="Vorname"
                value={newFamilyData.first_name}
                onChange={(e) => setNewFamilyData(prev => ({ ...prev, first_name: e.target.value }))}
                className="text-sm"
              />
              <Input
                placeholder="Nachname"
                value={newFamilyData.last_name}
                onChange={(e) => setNewFamilyData(prev => ({ ...prev, last_name: e.target.value }))}
                className="text-sm"
              />
              <Input
                type="date"
                placeholder="Geburtsdatum"
                value={newFamilyData.birthdate}
                onChange={(e) => setNewFamilyData(prev => ({ ...prev, birthdate: e.target.value }))}
                className="text-sm"
              />
            </div>
          )}
        </Card>
      )}

      {/* Vorschlag 3: Vertrag erstellen */}
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
                {insights.insurer} · {insights.insuranceType}
                {insights.premiumYearly && ` · CHF ${insights.premiumYearly.toLocaleString('de-CH')}/Jahr`}
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