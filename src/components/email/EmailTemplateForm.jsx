import React, { useState } from 'react'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Button } from '@/components/ui/button'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'
import { DialogFooter } from '@/components/ui/dialog'

export default function EmailTemplateForm({ template, onSave, onCancel, saving }) {
  const [form, setForm] = useState(template || {
    name: '',
    category: 'general',
    subject: '',
    body: '',
    description: '',
    is_active: true,
  })

  const set = (k, v) => setForm(prev => ({ ...prev, [k]: v }))

  const handleSubmit = (e) => {
    e.preventDefault()
    onSave(form)
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <Label>Vorlagenname *</Label>
        <Input value={form.name} onChange={e => set('name', e.target.value)} required className="mt-1" />
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <Label>Kategorie</Label>
          <Select value={form.category} onValueChange={v => set('category', v)}>
            <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="general">Allgemein</SelectItem>
              <SelectItem value="cancellation">Kündigung</SelectItem>
              <SelectItem value="renewal">Erneuerung</SelectItem>
              <SelectItem value="appointment">Termin</SelectItem>
              <SelectItem value="document_request">Dokument anfordern</SelectItem>
              <SelectItem value="claim">Schadensfall</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div>
          <Label className="flex items-center gap-2">
            <input type="checkbox" checked={form.is_active} onChange={e => set('is_active', e.target.checked)} />
            Aktiv
          </Label>
        </div>
      </div>

      <div>
        <Label>Betreff *</Label>
        <Input value={form.subject} onChange={e => set('subject', e.target.value)} required className="mt-1" placeholder="z.B. Versicherungserneuerung für {{customer_name}}" />
      </div>

      <div>
        <Label>Nachrichtentext *</Label>
        <Textarea value={form.body} onChange={e => set('body', e.target.value)} required className="mt-1" rows={6} placeholder="Verwende {{placeholder}} für dynamische Inhalte" />
      </div>

      <div>
        <Label>Beschreibung</Label>
        <Textarea value={form.description} onChange={e => set('description', e.target.value)} className="mt-1" rows={2} />
      </div>

      <DialogFooter>
        <Button type="button" variant="outline" onClick={onCancel} disabled={saving}>
          Abbrechen
        </Button>
        <Button type="submit" disabled={saving}>
          {saving ? 'Speichern...' : (template ? 'Aktualisieren' : 'Erstellen')}
        </Button>
      </DialogFooter>
    </form>
  )
}