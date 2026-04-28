import React, { useState } from 'react'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Button } from '@/components/ui/button'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'
import { DialogFooter } from '@/components/ui/dialog'

const INSURANCE_TYPES = ['life', 'health', 'property', 'liability', 'motor', 'other']

export default function ApplicationForm({ application, customers = [], onSave, onCancel, saving }) {
  const [form, setForm] = useState(application || {
    customer_id: '',
    insurance_type: '',
    product: '',
    insurer: '',
    status: 'draft',
    estimated_premium_monthly: '',
    estimated_premium_yearly: '',
    requested_start_date: '',
    commission_estimate: '',
    notes: '',
  })

  const selectedCustomer = customers.find(c => c.id === form.customer_id)
  const set = (k, v) => setForm(prev => ({ ...prev, [k]: v }))

  const primaryCustomers = customers.filter(c => !c.is_family_member)

  const handleSubmit = (e) => {
    e.preventDefault()
    onSave({
      ...form,
      customer_name: selectedCustomer ? `${selectedCustomer.first_name} ${selectedCustomer.last_name}` : '',
      primary_customer_id: selectedCustomer?.is_family_member ? selectedCustomer.primary_customer_id : selectedCustomer?.id,
      is_family_member: selectedCustomer?.is_family_member || false,
      estimated_premium_monthly: form.estimated_premium_monthly ? Number(form.estimated_premium_monthly) : undefined,
      estimated_premium_yearly: form.estimated_premium_yearly ? Number(form.estimated_premium_yearly) : undefined,
      commission_estimate: form.commission_estimate ? Number(form.commission_estimate) : undefined,
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

      <div>
        <Label>Status</Label>
        <Select value={form.status} onValueChange={v => set('status', v)}>
          <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="draft">Entwurf</SelectItem>
            <SelectItem value="submitted">Eingereicht</SelectItem>
            <SelectItem value="under_review">In Prüfung</SelectItem>
            <SelectItem value="approved">Genehmigt</SelectItem>
            <SelectItem value="rejected">Abgelehnt</SelectItem>
          </SelectContent>
        </Select>
      </div>

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

      <div>
        <Label>Notizen</Label>
        <Textarea value={form.notes} onChange={e => set('notes', e.target.value)} className="mt-1" rows={2} />
      </div>

      <DialogFooter>
        <Button type="button" variant="outline" onClick={onCancel} disabled={saving}>
          Abbrechen
        </Button>
        <Button type="submit" disabled={saving}>
          {saving ? 'Speichern...' : (application ? 'Aktualisieren' : 'Erstellen')}
        </Button>
      </DialogFooter>
    </form>
  )
}