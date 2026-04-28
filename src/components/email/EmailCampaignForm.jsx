import React, { useState } from 'react'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Button } from '@/components/ui/button'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'
import { DialogFooter } from '@/components/ui/dialog'

export default function EmailCampaignForm({ campaign, customers = [], onSave, onCancel, saving }) {
  const [form, setForm] = useState(campaign || {
    name: '',
    subject: '',
    body: '',
    status: 'draft',
    scheduled_at: '',
    filter_status: 'all',
    filter_canton: '',
  })

  const set = (k, v) => setForm(prev => ({ ...prev, [k]: v }))

  const handleSubmit = (e) => {
    e.preventDefault()
    onSave(form)
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <Label>Kampagnenname *</Label>
        <Input value={form.name} onChange={e => set('name', e.target.value)} required className="mt-1" />
      </div>

      <div>
        <Label>E-Mail-Betreff *</Label>
        <Input value={form.subject} onChange={e => set('subject', e.target.value)} required className="mt-1" />
      </div>

      <div>
        <Label>Nachrichtentext *</Label>
        <Textarea value={form.body} onChange={e => set('body', e.target.value)} required className="mt-1" rows={6} />
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <Label>Kundenfilter (Status)</Label>
          <Select value={form.filter_status} onValueChange={v => set('filter_status', v)}>
            <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Alle</SelectItem>
              <SelectItem value="active">Aktiv</SelectItem>
              <SelectItem value="inactive">Inaktiv</SelectItem>
              <SelectItem value="prospect">Interessent</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div>
          <Label>Kundenfilter (Kanton, optional)</Label>
          <Input value={form.filter_canton} onChange={e => set('filter_canton', e.target.value)} placeholder="z.B. ZH" className="mt-1" />
        </div>
      </div>

      <div>
        <Label>Status</Label>
        <Select value={form.status} onValueChange={v => set('status', v)}>
          <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="draft">Entwurf</SelectItem>
            <SelectItem value="scheduled">Geplant</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {form.status === 'scheduled' && (
        <div>
          <Label>Sendezeitpunkt</Label>
          <Input type="datetime-local" value={form.scheduled_at} onChange={e => set('scheduled_at', e.target.value)} className="mt-1" />
        </div>
      )}

      <DialogFooter>
        <Button type="button" variant="outline" onClick={onCancel} disabled={saving}>
          Abbrechen
        </Button>
        <Button type="submit" disabled={saving}>
          {saving ? 'Speichern...' : (campaign ? 'Aktualisieren' : 'Erstellen')}
        </Button>
      </DialogFooter>
    </form>
  )
}