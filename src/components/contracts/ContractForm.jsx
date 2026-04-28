import React, { useState } from 'react'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Button } from '@/components/ui/button'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'
import { DialogFooter } from '@/components/ui/dialog'

const INSURANCE_TYPES = ['life', 'health', 'property', 'liability', 'motor', 'other']

export default function ContractForm({ contract, customers = [], onSave, onCancel, saving }) {
  const [form, setForm] = useState(contract || {
    customer_id: '',
    insurer: '',
    policy_number: '',
    insurance_type: '',
    product: '',
    premium_monthly: '',
    premium_yearly: '',
    start_date: '',
    end_date: '',
    cancellation_deadline: '',
    status: 'active',
    commission_rate: '',
    notes: '',
  })

  const selectedCustomer = customers.find(c => c.id === form.customer_id)
  const set = (k, v) => setForm(prev => ({ ...prev, [k]: v }))

  // Gruppiere Kunden (Hauptkunden mit ihren Familienmitgliedern)
  const primaryCustomers = customers.filter(c => !c.is_family_member)

  const handleSubmit = (e) => {
    e.preventDefault()
    onSave({
      ...form,
      customer_name: selectedCustomer ? `${selectedCustomer.first_name} ${selectedCustomer.last_name}` : '',
      primary_customer_id: selectedCustomer?.is_family_member ? selectedCustomer.primary_customer_id : selectedCustomer?.id,
      is_family_member: selectedCustomer?.is_family_member || false,
      premium_monthly: form.premium_monthly ? Number(form.premium_monthly) : undefined,
      premium_yearly: form.premium_yearly ? Number(form.premium_yearly) : undefined,
      commission_rate: form.commission_rate ? Number(form.commission_rate) : undefined,
    })
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <Label>Kunde *</Label>
        <Select value={form.customer_id} onValueChange={v => set('customer_id', v)}>
          <SelectTrigger className="mt-1"><SelectValue placeholder="Kunde auswählen" /></SelectTrigger>
          <SelectContent>
            {primaryCustomers.map(primary => {
              const isMember = customers.some(c => c.primary_customer_id === primary.id)
              const familyMembers = customers.filter(c => c.primary_customer_id === primary.id)

              return (
                <div key={primary.id}>
                  <SelectItem value={primary.id}>
                    {primary.first_name} {primary.last_name} (Hauptkunde)
                  </SelectItem>
                  {familyMembers.map(member => (
                    <SelectItem key={member.id} value={member.id} className="pl-8">
                      └ {member.first_name} {member.last_name} ({member.family_role})
                    </SelectItem>
                  ))}
                </div>
              )
            })}
          </SelectContent>
        </Select>
      </div>

      <div>
        <Label>Versicherungsgesellschaft *</Label>
        <Input value={form.insurer} onChange={e => set('insurer', e.target.value)} required className="mt-1" />
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <Label>Versicherungsart *</Label>
          <Select value={form.insurance_type} onValueChange={v => set('insurance_type', v)}>
            <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
            <SelectContent>
              {INSURANCE_TYPES.map(t => <SelectItem key={t} value={t} className="capitalize">{t}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <div>
          <Label>Produkt/Sparte</Label>
          <Input value={form.product} onChange={e => set('product', e.target.value)} className="mt-1" />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <Label>Policen-Nummer</Label>
          <Input value={form.policy_number} onChange={e => set('policy_number', e.target.value)} className="mt-1" />
        </div>
        <div>
          <Label>Status</Label>
          <Select value={form.status} onValueChange={v => set('status', v)}>
            <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="active">Aktiv</SelectItem>
              <SelectItem value="cancelled">Gekündigt</SelectItem>
              <SelectItem value="paused">Pausiert</SelectItem>
              <SelectItem value="expired">Abgelaufen</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <Label>Monatsprämie (CHF)</Label>
          <Input type="number" step="0.01" value={form.premium_monthly} onChange={e => set('premium_monthly', e.target.value)} className="mt-1" />
        </div>
        <div>
          <Label>Jahresprämie (CHF)</Label>
          <Input type="number" step="0.01" value={form.premium_yearly} onChange={e => set('premium_yearly', e.target.value)} className="mt-1" />
        </div>
      </div>

      <div className="grid grid-cols-3 gap-3">
        <div>
          <Label>Vertragsbeginn</Label>
          <Input type="date" value={form.start_date} onChange={e => set('start_date', e.target.value)} className="mt-1" />
        </div>
        <div>
          <Label>Vertragsende</Label>
          <Input type="date" value={form.end_date} onChange={e => set('end_date', e.target.value)} className="mt-1" />
        </div>
        <div>
          <Label>Kündigungsfrist</Label>
          <Input type="date" value={form.cancellation_deadline} onChange={e => set('cancellation_deadline', e.target.value)} className="mt-1" />
        </div>
      </div>

      <div>
        <Label>Provisionsquote (%)</Label>
        <Input type="number" step="0.01" value={form.commission_rate} onChange={e => set('commission_rate', e.target.value)} className="mt-1" />
      </div>

      <div>
        <Label>Notizen</Label>
        <Textarea value={form.notes} onChange={e => set('notes', e.target.value)} className="mt-1" rows={2} />
      </div>

      <DialogFooter>
        <Button type="button" variant="outline" onClick={onCancel} disabled={saving}>
          Abbrechen
        </Button>
        <Button type="submit" disabled={saving}>
          {saving ? 'Speichern...' : (contract ? 'Aktualisieren' : 'Erstellen')}
        </Button>
      </DialogFooter>
    </form>
  )
}