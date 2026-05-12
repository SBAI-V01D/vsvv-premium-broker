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
  const [showPrimaryForm, setShowPrimaryForm] = useState(false)
  const [showFamilyForm, setShowFamilyForm] = useState(false)
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

      // 1. NEUEN HAUPTKUNDEN ERSTELLEN (falls nicht gefunden)
      if (!primaryCustomerId && insights.suggestedPrimaryCustomer && acceptedActions.createPrimary) {
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

      // 2. FAMILIENMITGLIED ERSTELLEN (falls akzeptiert)
      if (insights.suggestedFamilyMember && acceptedActions.createFamily && primaryCustomerId) {
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

      {/* STUFE 1: Neuer Hauptkunde */}
      {!insights.matchedPrimaryCustomer && insights.suggestedPrimaryCustomer && (
        <Card className="p-4 border-l-4 border-l-red-500 bg-red-50">
          <label className="flex items-start gap-3 cursor-pointer">
            <input
              type="checkbox"
              checked={acceptedActions.createPrimary || false}
              onChange={(e) => {
                setAcceptedActions(prev => ({ ...prev, createPrimary: e.target.checked }))
                setShowPrimaryForm(e.target.checked)
              }}
              className="mt-1"
            />
            <div className="flex-1">
              <p className="font-semibold flex items-center gap-2">
                <Users className="w-4 h-4" />
                🔴 Neuer Hauptkontakt (Versicherungsnehmer)
              </p>
              <p className="text-sm text-muted-foreground mt-1">
                {insights.suggestedPrimaryCustomer.first_name} {insights.suggestedPrimaryCustomer.last_name}
              </p>
            </div>
          </label>

          {showPrimaryForm && acceptedActions.createPrimary && (
            <div className="mt-3 p-3 bg-white rounded border border-red-200 space-y-2">
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
          )}
        </Card>
      )}

      {/* STUFE 2: Neues Familienmitglied (nur wenn Hauptkontakt existiert oder erstellt wird) */}
      {insights.suggestedFamilyMember && (insights.matchedPrimaryCustomer || acceptedActions.createPrimary) && (
        <Card className="p-4 border-l-4 border-l-amber-500 bg-amber-50">
          <label className="flex items-start gap-3 cursor-pointer">
            <input
              type="checkbox"
              checked={acceptedActions.createFamily || false}
              onChange={(e) => {
                setAcceptedActions(prev => ({ ...prev, createFamily: e.target.checked }))
                setShowFamilyForm(e.target.checked)
              }}
              className="mt-1"
            />
            <div className="flex-1">
              <p className="font-semibold flex items-center gap-2">
                <Users className="w-4 h-4" />
                🟡 Neues Familienmitglied
              </p>
              <p className="text-sm text-muted-foreground mt-1">
                {insights.suggestedFamilyMember.first_name} {insights.suggestedFamilyMember.last_name}
              </p>
            </div>
          </label>

          {showFamilyForm && acceptedActions.createFamily && (
            <div className="mt-3 p-3 bg-white rounded border border-amber-200 space-y-2">
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