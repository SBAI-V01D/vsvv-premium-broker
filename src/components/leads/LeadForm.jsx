import React, { useState, useEffect } from 'react'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { User, Mail, Phone, Building2, Globe, UserCheck, FileText, Tag, Calendar, Upload, X, Paperclip } from 'lucide-react'
import { base44 } from '@/api/base44Client'
import LeadAiDocumentAnalysis from './LeadAiDocumentAnalysis'

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

const DOC_CATEGORIES = [
  { key: 'police', label: '📄 Police' },
  { key: 'ausweis', label: '🪪 Ausweis' },
  { key: 'kundeninformation', label: '📋 Kundeninformation' },
]

const EMPTY_FORM = {
  first_name: '',
  last_name: '',
  email: '',
  phone: '',
  birthdate: '',
  company: '',
  source: 'manual',
  advisor_id: '',
  status: 'new',
  notes: '',
  documents: [],
}

export default function LeadForm({ open, onClose, onSubmit, lead, advisors = [], isPending }) {
  const [form, setForm] = useState(EMPTY_FORM)
  const [errors, setErrors] = useState({})
  const [uploading, setUploading] = useState(false)
  const [uploadCategory, setUploadCategory] = useState('police')

  useEffect(() => {
    if (open) {
      if (lead) {
        setForm({
          first_name: lead.first_name || '',
          last_name: lead.last_name || '',
          email: lead.email || '',
          phone: lead.phone || '',
          birthdate: lead.birthdate || '',
          company: lead.company || '',
          source: lead.source || 'manual',
          advisor_id: lead.advisor_id || '',
          status: lead.status || 'new',
          notes: lead.notes || '',
          documents: lead.documents || [],
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
    if (!form.first_name.trim()) errs.first_name = 'Vorname ist erforderlich'
    if (!form.last_name.trim()) errs.last_name = 'Nachname ist erforderlich'
    if (!form.email.trim()) errs.email = 'E-Mail ist erforderlich'
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email)) errs.email = 'Ungültige E-Mail-Adresse'
    return errs
  }

  const handleAiExtracted = (data) => {
    setForm(prev => ({
      ...prev,
      first_name: data.first_name || prev.first_name,
      last_name: data.last_name || prev.last_name,
      birthdate: data.birthdate || prev.birthdate,
      phone: data.phone || prev.phone,
      email: data.email || prev.email,
      notes: data.notes || prev.notes,
    }))
    // Dokument als Anhang hinzufügen, falls vorhanden
    if (data._aiDocument) {
      setForm(prev => ({
        ...prev,
        documents: [...(prev.documents || []).filter(d => d.url !== data._aiDocument.url), data._aiDocument],
      }))
    }
  }

  const handleFileUpload = async (e) => {
    const file = e.target.files?.[0]
    if (!file) return
    setUploading(true)
    const { file_url } = await base44.integrations.Core.UploadFile({ file })
    const newDoc = {
      name: file.name,
      url: file_url,
      category: uploadCategory,
      uploaded_at: new Date().toISOString(),
    }
    set('documents', [...form.documents, newDoc])
    setUploading(false)
    e.target.value = ''
  }

  const removeDoc = (idx) => {
    set('documents', form.documents.filter((_, i) => i !== idx))
  }

  const handleSubmit = (e) => {
    e.preventDefault()
    const errs = validate()
    if (Object.keys(errs).length > 0) { setErrors(errs); return }
    const advisor = advisors.find(a => a.id === form.advisor_id)
    const fullName = `${form.first_name.trim()} ${form.last_name.trim()}`
    onSubmit({
      ...form,
      name: fullName,
      advisor_name: advisor ? `${advisor.firstname} ${advisor.lastname}` : '',
    })
  }

  const docsByCategory = DOC_CATEGORIES.map(cat => ({
    ...cat,
    docs: form.documents.filter(d => d.category === cat.key),
  }))

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-xl font-bold flex items-center gap-2">
            <User className="w-5 h-5 text-primary" />
            {lead ? 'Lead bearbeiten' : 'Neuer Lead erfassen'}
          </DialogTitle>
          <p className="text-sm text-muted-foreground">
            {lead ? 'Lead-Daten anpassen' : 'Neuen Lead erfassen, bevor er zum Kunden konvertiert wird.'}
          </p>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-5 mt-2">

          {/* KI-DOKUMENTENANALYSE */}
          <LeadAiDocumentAnalysis onDataExtracted={handleAiExtracted} />

          {/* KONTAKT */}
          <div className="space-y-3">
            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground border-b pb-1">Kontaktdaten</p>

            {/* Vorname / Nachname */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="flex items-center gap-1.5 mb-1">
                  <User className="w-3.5 h-3.5" /> Vorname *
                </Label>
                <Input
                  value={form.first_name}
                  onChange={e => set('first_name', e.target.value)}
                  placeholder="Max"
                  className={errors.first_name ? 'border-red-400' : ''}
                />
                {errors.first_name && <p className="text-xs text-red-500 mt-1">{errors.first_name}</p>}
              </div>
              <div>
                <Label className="flex items-center gap-1.5 mb-1">
                  <User className="w-3.5 h-3.5" /> Nachname *
                </Label>
                <Input
                  value={form.last_name}
                  onChange={e => set('last_name', e.target.value)}
                  placeholder="Mustermann"
                  className={errors.last_name ? 'border-red-400' : ''}
                />
                {errors.last_name && <p className="text-xs text-red-500 mt-1">{errors.last_name}</p>}
              </div>
            </div>

            {/* E-Mail / Telefon */}
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

            {/* Geburtsdatum / Unternehmen */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="flex items-center gap-1.5 mb-1">
                  <Calendar className="w-3.5 h-3.5" /> Geburtsdatum
                </Label>
                <Input
                  type="date"
                  value={form.birthdate}
                  onChange={e => set('birthdate', e.target.value)}
                />
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
                  <SelectTrigger><SelectValue /></SelectTrigger>
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
                  <SelectTrigger><SelectValue /></SelectTrigger>
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

          {/* DOKUMENTE */}
          <div className="space-y-3">
            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground border-b pb-1">Dokumente</p>

            {/* Upload-Bereich */}
            <div className="flex gap-2 items-end">
              <div className="flex-1">
                <Label className="text-xs mb-1 block">Kategorie</Label>
                <Select value={uploadCategory} onValueChange={setUploadCategory}>
                  <SelectTrigger className="h-9">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {DOC_CATEGORIES.map(c => (
                      <SelectItem key={c.key} value={c.key}>{c.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label
                  htmlFor="doc-upload"
                  className="cursor-pointer inline-flex items-center gap-2 px-3 py-2 rounded-md border border-input bg-background text-sm hover:bg-accent transition-colors"
                >
                  {uploading ? (
                    <span className="text-xs text-muted-foreground">Hochladen...</span>
                  ) : (
                    <><Upload className="w-4 h-4" /> Datei hochladen</>
                  )}
                </Label>
                <input
                  id="doc-upload"
                  type="file"
                  className="hidden"
                  onChange={handleFileUpload}
                  disabled={uploading}
                />
              </div>
            </div>

            {/* Dokumente nach Kategorie */}
            {docsByCategory.map(cat => cat.docs.length > 0 && (
              <div key={cat.key}>
                <p className="text-xs font-semibold text-muted-foreground mb-1.5">{cat.label}</p>
                <div className="space-y-1.5">
                  {cat.docs.map((doc, idx) => {
                    const globalIdx = form.documents.indexOf(doc)
                    return (
                      <div key={idx} className="flex items-center gap-2 p-2 bg-muted/40 rounded-lg border text-xs">
                        <Paperclip className="w-3.5 h-3.5 text-muted-foreground flex-shrink-0" />
                        <a
                          href={doc.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="flex-1 truncate text-primary hover:underline"
                        >
                          {doc.name}
                        </a>
                        <button
                          type="button"
                          onClick={() => removeDoc(globalIdx)}
                          className="text-muted-foreground hover:text-red-500 transition-colors"
                        >
                          <X className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    )
                  })}
                </div>
              </div>
            ))}

            {form.documents.length === 0 && (
              <p className="text-xs text-muted-foreground text-center py-2">Noch keine Dokumente hochgeladen</p>
            )}
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
            <Button type="submit" disabled={isPending || uploading} className="min-w-[120px]">
              {isPending ? 'Wird gespeichert...' : lead ? 'Änderungen speichern' : 'Lead erfassen'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}