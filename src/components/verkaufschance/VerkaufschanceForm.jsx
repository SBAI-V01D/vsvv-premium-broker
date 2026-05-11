import React, { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'
import { ALLE_STATUS } from './VerkaufschanceStatusBadge'

const SPARTEN = [
  { value: 'kvg', label: 'KVG – Grundversicherung' },
  { value: 'vvg_krankenzusatz', label: 'VVG – Krankenzusatz' },
  { value: 'haftpflicht_privat', label: 'Haftpflicht Privat' },
  { value: 'hausrat', label: 'Hausrat' },
  { value: 'motorfahrzeug', label: 'Motorfahrzeug' },
  { value: 'leben', label: 'Leben / Vorsorge' },
  { value: 'bvg', label: 'BVG – Berufliche Vorsorge' },
  { value: 'uvg', label: 'UVG / Unfall' },
  { value: 'ktg', label: 'KTG – Krankentaggeld' },
  { value: 'rechtsschutz', label: 'Rechtsschutz' },
  { value: 'reise', label: 'Reise / Assistance' },
  { value: 'cyber', label: 'Cyber' },
  { value: 'other', label: 'Sonstiges' },
]

export default function VerkaufschanceForm({ verkaufschance, customer, onSave, onCancel, saving }) {
  const [form, setForm] = useState({
    title: verkaufschance?.title || '',
    sparte: verkaufschance?.sparte || '',
    status: verkaufschance?.status || 'neu',
    priority: verkaufschance?.priority || 'medium',
    estimated_value: verkaufschance?.estimated_value || '',
    expected_close_date: verkaufschance?.expected_close_date || '',
    start_date_requested: verkaufschance?.start_date_requested || '',
    contact_person: verkaufschance?.contact_person || '',
    notes: verkaufschance?.notes || '',
  })

  const set = (key, val) => setForm(prev => ({ ...prev, [key]: val }))

  const handleSubmit = () => {
    if (!form.sparte) return
    onSave({
      ...form,
      estimated_value: parseFloat(form.estimated_value) || null,
      expected_close_date: form.expected_close_date || null,
      start_date_requested: form.start_date_requested || null,
      customer_id: customer.id,
      customer_name: `${customer.first_name} ${customer.last_name}`,
      organization_id: customer.organization_id,
      advisor_id: customer.advisor_id,
      assigned_broker: customer.assigned_broker,
    })
  }

  return (
    <div className="space-y-4">
      {/* Titel + Sparte */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="space-y-1.5">
          <Label>Bezeichnung</Label>
          <Input
            placeholder="z.B. KVG Wechsel 2026, Hausrat-Offerte..."
            value={form.title}
            onChange={e => set('title', e.target.value)}
          />
        </div>
        <div className="space-y-1.5">
          <Label>Versicherungssparte <span className="text-destructive">*</span></Label>
          <Select value={form.sparte} onValueChange={v => set('sparte', v)}>
            <SelectTrigger><SelectValue placeholder="Sparte wählen..." /></SelectTrigger>
            <SelectContent>
              {SPARTEN.map(s => <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Status + Priorität */}
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-1.5">
          <Label>Status</Label>
          <Select value={form.status} onValueChange={v => set('status', v)}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              {ALLE_STATUS.map(s => <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1.5">
          <Label>Priorität</Label>
          <Select value={form.priority} onValueChange={v => set('priority', v)}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="low">Tief</SelectItem>
              <SelectItem value="medium">Mittel</SelectItem>
              <SelectItem value="high">Hoch</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Wert + Datum */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="space-y-1.5">
          <Label>Geschätzter Wert (CHF/J.)</Label>
          <Input type="number" placeholder="0.00"
            value={form.estimated_value}
            onChange={e => set('estimated_value', e.target.value)} />
        </div>
        <div className="space-y-1.5">
          <Label>Versicherungsbeginn</Label>
          <Input type="date"
            value={form.start_date_requested}
            onChange={e => set('start_date_requested', e.target.value)} />
        </div>
        <div className="space-y-1.5">
          <Label>Erwarteter Abschluss</Label>
          <Input type="date"
            value={form.expected_close_date}
            onChange={e => set('expected_close_date', e.target.value)} />
        </div>
      </div>

      {/* Kontaktperson + Notizen */}
      <div className="space-y-1.5">
        <Label>Ansprechperson beim Kunden</Label>
        <Input placeholder="Optional..."
          value={form.contact_person}
          onChange={e => set('contact_person', e.target.value)} />
      </div>
      <div className="space-y-1.5">
        <Label>Notizen / Kundenbedürfnis</Label>
        <Textarea placeholder="Bedürfnis, Ausgangslage, offene Fragen..." rows={3}
          value={form.notes}
          onChange={e => set('notes', e.target.value)} />
      </div>

      {/* Actions */}
      <div className="flex justify-end gap-2 pt-2">
        <Button variant="outline" onClick={onCancel}>Abbrechen</Button>
        <Button onClick={handleSubmit} disabled={!form.sparte || saving}>
          {saving ? 'Speichert...' : (verkaufschance ? 'Speichern' : 'Verkaufschance erstellen')}
        </Button>
      </div>
    </div>
  )
}