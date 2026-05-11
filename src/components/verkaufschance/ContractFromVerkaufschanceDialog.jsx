import React, { useState } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { base44 } from '@/api/base44Client'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Trophy } from 'lucide-react'

export default function ContractFromVerkaufschanceDialog({
  open, onOpenChange, verkaufschance, customer, selectedGesellschaft, onSuccess
}) {
  const queryClient = useQueryClient()
  const [form, setForm] = useState({
    policy_number: '',
    start_date: verkaufschance.start_date_requested || '',
    end_date: '',
    premium_yearly: selectedGesellschaft?.praemie_yearly || '',
    notes: '',
  })
  const [loading, setLoading] = useState(false)

  const set = (k, v) => setForm(p => ({ ...p, [k]: v }))

  const handleCreate = async () => {
    setLoading(true)
    // 1. Vertrag erstellen
    const newContract = await base44.entities.Contract.create({
      customer_id: customer.id,
      customer_name: `${customer.first_name} ${customer.last_name}`,
      primary_customer_id: customer.primary_customer_id || customer.id,
      organization_id: customer.organization_id,
      advisor_id: customer.advisor_id,
      assigned_broker: customer.assigned_broker,
      insurer: selectedGesellschaft.gesellschaft,
      insurance_type: verkaufschance.sparte,
      sparte: verkaufschance.sparte,
      product: verkaufschance.title || '',
      policy_number: form.policy_number || '',
      premium_yearly: parseFloat(form.premium_yearly) || 0,
      premium_monthly: form.premium_yearly ? Math.round(parseFloat(form.premium_yearly) / 12) : 0,
      start_date: form.start_date || '',
      end_date: form.end_date || '',
      status: 'active',
      notes: [
        `Erstellt aus Verkaufschance: ${verkaufschance.title || verkaufschance.sparte}`,
        form.notes || null,
      ].filter(Boolean).join(' | '),
      source_application_id: verkaufschance.id,
    })

    // 2. Provision erstellen (falls Jahresprämie vorhanden)
    const premiumYearly = parseFloat(form.premium_yearly) || 0
    if (premiumYearly > 0) {
      await base44.entities.CommissionEntry.create({
        policy_id: newContract.id,
        policy_number: form.policy_number || '',
        advisor_id: customer.advisor_id || '',
        advisor_name: customer.assigned_broker || '',
        organization_id: customer.organization_id || '',
        customer_id: customer.id,
        customer_name: `${customer.first_name} ${customer.last_name}`,
        insurer: selectedGesellschaft.gesellschaft,
        product_category: verkaufschance.sparte,
        premium_yearly: premiumYearly,
        commission_percentage: 5,
        commission_amount: Math.round(premiumYearly * 0.05 * 100) / 100,
        status: 'pending',
        entry_date: new Date().toISOString().split('T')[0],
      })
    }

    // 3. Verkaufschance auf "Gewonnen" setzen
    await base44.entities.Verkaufschance.update(verkaufschance.id, {
      status: 'gewonnen',
      won_contract_id: newContract.id,
      selected_insurer: selectedGesellschaft.gesellschaft,
    })

    queryClient.invalidateQueries({ queryKey: ['contracts'] })
    queryClient.invalidateQueries({ queryKey: ['commissionEntries'] })
    queryClient.invalidateQueries({ queryKey: ['verkaufschancen'] })
    queryClient.invalidateQueries({ queryKey: ['verkaufschancen', customer.id] })
    setLoading(false)
    onOpenChange(false)
    onSuccess?.()
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-green-800">
            <Trophy className="w-5 h-5 text-green-600" />
            Vertrag erstellen
          </DialogTitle>
          <p className="text-sm text-muted-foreground">
            Gesellschaft: <strong>{selectedGesellschaft?.gesellschaft}</strong>
          </p>
        </DialogHeader>

        <div className="space-y-4 py-2">
          <div className="space-y-1.5">
            <Label>Policen-Nummer</Label>
            <Input placeholder="z.B. ABC-123456"
              value={form.policy_number} onChange={e => set('policy_number', e.target.value)} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Vertragsbeginn</Label>
              <Input type="date" value={form.start_date} onChange={e => set('start_date', e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label>Vertragsende</Label>
              <Input type="date" value={form.end_date} onChange={e => set('end_date', e.target.value)} />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label>Jahresprämie (CHF)</Label>
            <Input type="number" placeholder="0.00"
              value={form.premium_yearly} onChange={e => set('premium_yearly', e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label>Notizen</Label>
            <Input placeholder="Optionale Notiz..."
              value={form.notes} onChange={e => set('notes', e.target.value)} />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Abbrechen</Button>
          <Button onClick={handleCreate} disabled={loading} className="bg-green-700 hover:bg-green-800 text-white">
            {loading ? 'Erstellt...' : '✓ Vertrag erstellen & Gewonnen'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}