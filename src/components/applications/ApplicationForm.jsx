import React, { useState } from 'react'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Button } from '@/components/ui/button'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'
import { DialogFooter } from '@/components/ui/dialog'
import { ALL_SPARTEN, SPARTEN_PRIVAT, SPARTEN_FIRMA, getFieldsForSparte } from '@/lib/insuranceSparten'

const SWISS_INSURERS = [
  'Allianz','Axa','Baloise','CSS','Concordia','Die Mobiliar','Elvia','Generali',
  'Helvetia','Helsana','Mutuel','ÖKK','SWICA','Sanitas','Smile','Suva',
  'Swiss Life','Swiss Re','TCS','Visana','Zurich','Andere',
]

// Group sparten by group label
const grouped = ALL_SPARTEN.reduce((acc, s) => {
  if (!acc[s.group]) acc[s.group] = []
  acc[s.group].push(s)
  return acc
}, {})

export default function ApplicationForm({ application, customers = [], onSave, onCancel, saving }) {
  const [form, setForm] = useState(application || {
    customer_id: '',
    insurance_type: 'other',
    sparte: '',
    product: '',
    insurer: '',
    status: 'draft',
    estimated_premium_monthly: '',
    estimated_premium_yearly: '',
    requested_start_date: '',
    policy_number: '',
    contract_start_date: '',
    contract_end_date: '',
    commission_estimate: '',
    assigned_broker: '',
    notes: '',
    sparte_data: {},
  })

  const selectedCustomer = customers.find(c => c.id === form.customer_id)
  const set = (k, v) => setForm(prev => ({ ...prev, [k]: v }))
  const setSparteData = (k, v) => setForm(prev => ({ ...prev, sparte_data: { ...prev.sparte_data, [k]: v } }))

  const primaryCustomers = customers.filter(c => !c.is_family_member)
  const sparteFields = getFieldsForSparte(form.sparte)

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
      notes: form.notes,
      product: form.product || form.sparte,
      policy_number: form.policy_number,
      contract_start_date: form.contract_start_date,
      contract_end_date: form.contract_end_date,
    })
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      {/* Kunde */}
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

      {/* Sparte */}
      <div>
        <Label>Versicherungssparte *</Label>
        <Select value={form.sparte} onValueChange={v => set('sparte', v)}>
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

      {/* Versicherer */}
      <div className="grid grid-cols-2 gap-3">
        <div>
          <Label>Versicherungsgesellschaft *</Label>
          <Select value={form.insurer} onValueChange={v => set('insurer', v)}>
            <SelectTrigger className="mt-1"><SelectValue placeholder="Gesellschaft wählen" /></SelectTrigger>
            <SelectContent>
              {SWISS_INSURERS.map(ins => <SelectItem key={ins} value={ins}>{ins}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <div>
          <Label>Produkt / Tarif</Label>
          <Input value={form.product} onChange={e => set('product', e.target.value)} className="mt-1" placeholder="z.B. myFlex, 3a-Protect..." />
        </div>
      </div>

      {/* Dynamische Sparten-Felder */}
      {sparteFields.length > 0 && (
        <div className="p-4 bg-muted/30 rounded-lg border border-border space-y-4">
          <p className="text-sm font-semibold text-foreground">Spartenspezifische Angaben</p>
          <div className="grid grid-cols-2 gap-3">
            {sparteFields.map(field => (
              <div key={field.key} className={field.type === 'text' && !field.placeholder?.includes('756') ? '' : ''}>
                <Label>{field.label}</Label>
                {field.type === 'select' ? (
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

      {/* Prämien */}
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

      {/* Dates & Commission */}
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

      {/* Police & Vertragsdaten */}
      <div className="p-4 bg-muted/30 rounded-lg border border-border space-y-3">
        <p className="text-sm font-semibold text-foreground">Police & Vertragsdaten</p>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <Label>Policennummer</Label>
            <Input value={form.policy_number} onChange={e => set('policy_number', e.target.value)} className="mt-1" placeholder="z.B. POL-2024-001" />
          </div>
          <div />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <Label>Vertragsbeginn</Label>
            <Input type="date" value={form.contract_start_date} onChange={e => set('contract_start_date', e.target.value)} className="mt-1" />
          </div>
          <div>
            <Label>Vertragsende</Label>
            <Input type="date" value={form.contract_end_date} onChange={e => set('contract_end_date', e.target.value)} className="mt-1" />
          </div>
        </div>
      </div>

      {/* Berater */}
      <div>
        <Label>Zuständiger Berater (E-Mail)</Label>
        <Input type="email" value={form.assigned_broker} onChange={e => set('assigned_broker', e.target.value)} className="mt-1" placeholder="berater@firma.ch" />
      </div>

      {/* Notizen */}
      <div>
        <Label>Notizen</Label>
        <Textarea value={form.notes} onChange={e => set('notes', e.target.value)} className="mt-1" rows={3} placeholder="Interne Notizen, Besonderheiten, Vorbehalte..." />
      </div>

      <DialogFooter>
        <Button type="button" variant="outline" onClick={onCancel} disabled={saving}>Abbrechen</Button>
        <Button type="submit" disabled={saving}>
          {saving ? 'Speichern...' : (application ? 'Aktualisieren' : 'Erstellen')}
        </Button>
      </DialogFooter>
    </form>
  )
}