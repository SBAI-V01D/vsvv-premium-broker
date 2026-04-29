import React, { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { base44 } from '@/api/base44Client'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { FileText, Upload, ExternalLink, Trash2 } from 'lucide-react'

const CATEGORY_LABELS = {
  contract: 'Verträge',
  application: 'Anträge',
  identification: 'Ausweise',
  correspondence: 'Korrespondenz',
  other: 'Sonstiges',
  antrag: 'Antrag',
  offerte: 'Offerte',
  police: 'Police',
  ausweis: 'Ausweis / ID',
  gesundheit: 'Gesundheitsprüfung',
  lohn: 'Lohndeklaration',
  vertrag: 'Vertrag',
  sonstiges: 'Sonstiges',
}

const UPLOAD_CATEGORIES = [
  { value: 'contract', label: 'Vertrag' },
  { value: 'application', label: 'Antrag' },
  { value: 'identification', label: 'Ausweis / ID' },
  { value: 'correspondence', label: 'Korrespondenz' },
  { value: 'other', label: 'Sonstiges' },
]

export default function Documents() {
  const queryClient = useQueryClient()
  const [showUpload, setShowUpload] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [file, setFile] = useState(null)
  const [form, setForm] = useState({ name: '', category: 'other', notes: '' })

  const { data: documents = [] } = useQuery({
    queryKey: ['documents'],
    queryFn: () => base44.entities.Document.list('-created_date'),
  })

  const { data: customers = [] } = useQuery({
    queryKey: ['customers'],
    queryFn: () => base44.entities.Customer.list(),
  })

  const deleteMutation = useMutation({
    mutationFn: (id) => base44.entities.Document.delete(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['documents'] }),
  })

  const applyFile = (f) => {
    if (!f) return
    setFile(f)
    setForm(p => ({ ...p, name: p.name || f.name.replace(/\.[^.]+$/, '') }))
  }

  const handleUpload = async (e) => {
    e.preventDefault()
    if (!file) return
    setUploading(true)
    const { file_url } = await base44.integrations.Core.UploadFile({ file })
    await base44.entities.Document.create({
      name: form.name,
      file_url,
      category: form.category,
      notes: form.notes || undefined,
      uploaded_by: 'broker',
    })
    queryClient.invalidateQueries({ queryKey: ['documents'] })
    setUploading(false)
    setShowUpload(false)
    setFile(null)
    setForm({ name: '', category: 'other', notes: '' })
  }

  const summaryCategories = { contract: 0, application: 0, identification: 0, correspondence: 0, other: 0 }
  documents.forEach(d => {
    const mapped = ['contract','application','identification','correspondence'].includes(d.category) ? d.category : 'other'
    summaryCategories[mapped]++
  })

  return (
    <div>
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-3xl font-bold">Dokumente</h1>
          <p className="text-muted-foreground mt-1">{documents.length} Dokumente insgesamt</p>
        </div>
        <Button onClick={() => setShowUpload(true)}>
          <Upload className="w-4 h-4 mr-2" /> Dokument hochladen
        </Button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4 mb-6">
        {Object.entries(summaryCategories).map(([cat, count]) => (
          <Card key={cat}>
            <CardContent className="p-4 flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
                <FileText className="w-5 h-5 text-primary" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground">{CATEGORY_LABELS[cat]}</p>
                <p className="font-bold text-lg">{count}</p>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Alle Dokumente</CardTitle>
        </CardHeader>
        <CardContent>
          {documents.length === 0 ? (
            <p className="text-sm text-muted-foreground">Keine Dokumente vorhanden</p>
          ) : (
            <div className="space-y-2">
              {documents.map(d => (
                <div key={d.id} className="flex items-center justify-between p-3 bg-slate-50 rounded gap-3">
                  <div className="flex items-center gap-3 flex-1 min-w-0">
                    <FileText className="w-4 h-4 text-muted-foreground flex-shrink-0" />
                    <div className="min-w-0">
                      <p className="text-sm font-medium truncate">{d.name}</p>
                      <p className="text-xs text-muted-foreground">
                        {d.customer_name || '–'} · {d.created_date ? new Date(d.created_date).toLocaleDateString('de-CH') : ''}
                      </p>
                    </div>
                  </div>
                  <span className="text-xs bg-primary/10 text-primary px-2 py-1 rounded flex-shrink-0">
                    {CATEGORY_LABELS[d.category] || d.category}
                  </span>
                  <div className="flex items-center gap-1 flex-shrink-0">
                    <a href={d.file_url} target="_blank" rel="noopener noreferrer">
                      <Button variant="ghost" size="icon" className="h-7 w-7">
                        <ExternalLink className="w-3.5 h-3.5" />
                      </Button>
                    </a>
                    <Button
                      variant="ghost" size="icon" className="h-7 w-7 text-destructive hover:text-destructive"
                      onClick={() => { if (confirm('Dokument wirklich löschen?')) deleteMutation.mutate(d.id) }}
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Upload Dialog */}
      <Dialog open={showUpload} onOpenChange={setShowUpload}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle>Dokument hochladen</DialogTitle></DialogHeader>
          <form onSubmit={handleUpload} className="space-y-4">
            <div>
              <Label>Datei (PDF / JPG / PNG / DOCX)</Label>
              <Input type="file" accept=".pdf,.png,.jpg,.jpeg,.doc,.docx" onChange={e => applyFile(e.target.files[0])} required className="mt-1" />
            </div>
            <div>
              <Label>Name</Label>
              <Input value={form.name} onChange={e => setForm(p => ({ ...p, name: e.target.value }))} required placeholder="Dokumentname" className="mt-1" />
            </div>
            <div>
              <Label>Kategorie</Label>
              <Select value={form.category} onValueChange={v => setForm(p => ({ ...p, category: v }))}>
                <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {UPLOAD_CATEGORIES.map(c => <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Bemerkungen (optional)</Label>
              <Textarea value={form.notes} onChange={e => setForm(p => ({ ...p, notes: e.target.value }))} rows={2} className="mt-1" />
            </div>
            <div className="flex justify-end gap-2">
              <Button type="button" variant="outline" onClick={() => setShowUpload(false)}>Abbrechen</Button>
              <Button type="submit" disabled={uploading}>{uploading ? 'Hochladen...' : 'Hochladen'}</Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  )
}