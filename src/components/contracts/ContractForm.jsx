import React, { useState } from 'react'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Button } from '@/components/ui/button'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'
import { DialogFooter } from '@/components/ui/dialog'
import { ALL_SPARTEN, getFieldsForSparte, FRANCHISE_OPTIONS } from '@/lib/insuranceSparten'

const grouped = ALL_SPARTEN.reduce((acc, s) => {
  if (!acc[s.group]) acc[s.group] = []
  acc[s.group].push(s)
  return acc
}, {})

export default function ContractForm({ contract, customers = [], onSave, onCancel, saving }) {
  const [form, setForm] = useState(() => {
    if (contract) {
      return {
        ...contract,
        sparte: contract.sparte || contract.insurance_type || '',
        sparte_data: contract.sparte_data || {},
      }
    }
    return {
      customer_id: '',
      insurer: '',
      policy_number: '',
      insurance_type: '',
      sparte: '',
      product: '',
      premium_monthly: '',
      premium_yearly: '',
      start_date: '',
      end_date: '',
      cancellation_deadline: '',
      status: 'active',
      commission_rate: '',
      notes: '',
      sparte_data: {},
    }
  })

  const selectedCustomer = customers.find(c => c.id === form.customer_id)
  const set = (k, v) => setForm(prev => ({ ...prev, [k]: v }))
  const setSparte = (v) => setForm(prev => ({ ...prev, sparte: v, insurance_type: v, sparte_data: {} }))
  const setSparteData = (k, v) => setForm(prev => ({ ...prev, sparte_data: { ...prev.sparte_data, [k]: v } }))
  
  const sparteFields = getFieldsForSparte(form.sparte)
  const franchiseOptions = FRANCHISE_OPTIONS[form.sparte_data?.age_group] || FRANCHISE_OPTIONS.default

  // Gruppiere Kunden (Hauptkunden mit ihren Familienmitgliedern)
  const primaryCustomers = customers.filter(c => !c.is_family_member)

  const handleSubmit = (e) => {
    e.preventDefault()
    const customer = customers.find(c => c.id === form.customer_id)
    // organization_id: prefer from customer lookup, fallback to existing form value (important for edit!)
    const organization_id = customer?.organization_id || form.organization_id || ''
    onSave({
      customer_id: form.customer_id,
      customer_name: customer ? `${customer.first_name} ${customer.last_name}` : (form.customer_name || ''),
      primary_customer_id: customer?.is_family_member ? customer.primary_customer_id : (customer?.id || form.primary_customer_id),
      is_family_member: customer?.is_family_member ?? form.is_family_member ?? false,
      organization_id,
      advisor_id: customer?.advisor_id || form.advisor_id,
      insurer: form.insurer,
      policy_number: form.policy_number || '',
      insurance_type: form.sparte || '',
      sparte: form.sparte || '',
      sparte_data: form.sparte_data || {},
      product: form.product || '',
      premium_monthly: form.premium_monthly ? Number(form.premium_monthly) : undefined,
      premium_yearly: form.premium_yearly ? Number(form.premium_yearly) : undefined,
      start_date: form.start_date || '',
      end_date: form.end_date || '',
      cancellation_deadline: form.cancellation_deadline || '',
      status: form.status || 'active',
      custom_status: form.custom_status,
      commission_rate: form.commission_rate ? Number(form.commission_rate) : undefined,
      notes: form.notes || '',
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

      <div>
        <Label>Versicherungssparte *</Label>
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
      </div>

      {sparteFields.length > 0 && (
        <div className="p-4 bg-muted/30 rounded-lg border border-border space-y-4">
          <p className="text-sm font-semibold text-foreground">Spartenspezifische Angaben</p>
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

      <div>
        <Label>Versicherungssparte *</Label>
        <div className="mt-1 p-3 rounded-lg bg-muted/40 text-sm font-medium">
          {form.sparte ? ALL_SPARTEN.find(s => s.value === form.sparte)?.label || form.sparte : '–'}
        </div>
      </div>

      <div>
        <Label>Policen-Nummer</Label>
        <Input value={form.policy_number} onChange={e => set('policy_number', e.target.value)} className="mt-1" />
      </div>

      <div>
        <Label>Produkt / Tarif</Label>
        <Input value={form.product} onChange={e => set('product', e.target.value)} className="mt-1" />
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