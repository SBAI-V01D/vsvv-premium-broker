import React, { useState, useEffect } from 'react'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { User, Mail, Phone, Building2, Globe, UserCheck, FileText, Tag } from 'lucide-react'

const SOURCE_LABELS = {
  website: 'Website',
  referral: 'Empfehlung',
  campaign: 'Kampagne',
  manual: 'Manuell',
  import: 'Import',
}

const STATUS_LABELS = {
  new: 'Neu',
  contacted: 'Kontaktiert',
  qualified: 'Qualifiziert',
  converted: 'Konvertiert',
  lost: 'Verloren',
}

const EMPTY_FORM = {
  name: '',
  email: '',
  phone: '',
  company: '',
  source: 'manual',
  advisor_id: '',
  status: 'new',
  notes: '',
}

export default function LeadForm({ open, onClose, onSubmit, lead, advisors = [], isPending }) {
  const [form, setForm] = useState(EMPTY_FORM)
  const [errors, setErrors] = useState({})

  useEffect(() => {
    if (open) {
      if (lead) {
        setForm({
          name: lead.name || '',
          email: lead.email || '',
          phone: lead.phone || '',
          company: lead.company || '',
          source: lead.source || 'manual',
          advisor_id: lead.advisor_id || '',
          status: lead.status || 'new',
          notes: lead.notes || '',
        })
      } else {
        setForm(EMPTY_FORM)
      }
      setErrors({})
    }
  }, [open, lead])

  const set = (key, val) => setForm(p => ({ ...p, [key]: val }))

  const validate = () => {
    const errs = {}
    if (!form.name.trim()) errs.name = 'Name ist erforderlich'
    if (!form.email.trim()) errs.email = 'E-Mail ist erforderlich'
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email)) errs.email = 'Ungültige E-Mail-Adresse'
    return errs
  }

  const handleSubmit = (e) => {
    e.preventDefault()
    const errs = validate()
    if (Object.keys(errs).length > 0) { setErrors(errs); return }
    const advisor = advisors.find(a => a.id === form.advisor_id)
    onSubmit({
      ...form,
      advisor_name: advisor ? `${advisor.firstname} ${advisor.lastname}` : '',
    })
  }

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-xl font-bold flex items-center gap-2">
            <User className="w-5 h-5 text-primary" />
            {lead ? 'Lead bearbeiten' : 'Neuer Lead erfassen'}
          </DialogTitle>
          <p className="text-sm text-muted-foreground">
            {lead ? 'Lead-Daten anpassen' : 'Neuen Lead in der Datenbank erfassen, bevor er zum Kunden konvertiert wird.'}
          </p>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-5 mt-2">

          {/* KONTAKT */}
          <div className="space-y-3">
            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground border-b pb-1">Kontaktdaten</p>

            <div>
              <Label className="flex items-center gap-1.5 mb-1">
                <User className="w-3.5 h-3.5" /> Name *
              </Label>
              <Input
                value={form.name}
                onChange={e => set('name', e.target.value)}
                placeholder="Vor- und Nachname"
                className={errors.name ? 'border-red-400' : ''}
              />
              {errors.name && <p className="text-xs text-red-500 mt-1">{errors.name}</p>}
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="flex items-center gap-1.5 mb-1">
                  <Mail className="w-3.5 h-3.5" /> E-Mail *
                </Label>
                <Input
                  type="email"
                  value={form.email}
                  onChange={e => set('email', e.target.value)}
                  placeholder="name@beispiel.ch"
                  className={errors.email ? 'border-red-400' : ''}
                />
                {errors.email && <p className="text-xs text-red-500 mt-1">{errors.email}</p>}
              </div>
              <div>
                <Label className="flex items-center gap-1.5 mb-1">
                  <Phone className="w-3.5 h-3.5" /> Telefon
                </Label>
                <Input
                  value={form.phone}
                  onChange={e => set('phone', e.target.value)}
                  placeholder="+41 79 123 45 67"
                />
              </div>
            </div>

            <div>
              <Label className="flex items-center gap-1.5 mb-1">
                <Building2 className="w-3.5 h-3.5" /> Unternehmen
              </Label>
              <Input
                value={form.company}
                onChange={e => set('company', e.target.value)}
                placeholder="Firmenname (optional)"
              />
            </div>
          </div>

          {/* ZUWEISUNG */}
          <div className="space-y-3">
            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground border-b pb-1">Zuweisung & Quelle</p>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="flex items-center gap-1.5 mb-1">
                  <Globe className="w-3.5 h-3.5" /> Quelle
                </Label>
                <Select value={form.source} onValueChange={v => set('source', v)}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {Object.entries(SOURCE_LABELS).map(([k, v]) => (
                      <SelectItem key={k} value={k}>{v}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label className="flex items-center gap-1.5 mb-1">
                  <Tag className="w-3.5 h-3.5" /> Status
                </Label>
                <Select value={form.status} onValueChange={v => set('status', v)}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {Object.entries(STATUS_LABELS).map(([k, v]) => (
                      <SelectItem key={k} value={k}>{v}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div>
              <Label className="flex items-center gap-1.5 mb-1">
                <UserCheck className="w-3.5 h-3.5" /> Berater zuweisen
              </Label>
              <Select value={form.advisor_id} onValueChange={v => set('advisor_id', v)}>
                <SelectTrigger>
                  <SelectValue placeholder="Berater wählen (optional)" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">– Kein Berater –</SelectItem>
                  {advisors.map(a => (
                    <SelectItem key={a.id} value={a.id}>
                      {a.firstname} {a.lastname}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* NOTIZEN */}
          <div>
            <Label className="flex items-center gap-1.5 mb-1">
              <FileText className="w-3.5 h-3.5" /> Notizen / Hintergrund
            </Label>
            <Textarea
              value={form.notes}
              onChange={e => set('notes', e.target.value)}
              placeholder="Interessen, Bedürfnisse, wie wurde der Lead generiert..."
              className="h-24 resize-none"
            />
          </div>

          <DialogFooter className="pt-2 gap-2">
            <Button type="button" variant="outline" onClick={onClose}>Abbrechen</Button>
            <Button type="submit" disabled={isPending} className="min-w-[120px]">
              {isPending ? 'Wird gespeichert...' : lead ? 'Änderungen speichern' : 'Lead erfassen'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}