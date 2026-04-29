import React, { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { base44 } from '@/api/base44Client'
import { Upload, FileText, Trash2, ExternalLink } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'

const CATEGORIES = [
  { value: 'antrag', label: 'Antrag', color: 'bg-blue-50 text-blue-700 border-blue-200' },
  { value: 'offerte', label: 'Offerte', color: 'bg-teal-50 text-teal-700 border-teal-200' },
  { value: 'police', label: 'Police', color: 'bg-green-50 text-green-700 border-green-200' },
  { value: 'ausweis', label: 'Ausweis / ID', color: 'bg-purple-50 text-purple-700 border-purple-200' },
  { value: 'gesundheit', label: 'Gesundheitsprüfung', color: 'bg-red-50 text-red-700 border-red-200' },
  { value: 'lohn', label: 'Lohndeklaration', color: 'bg-orange-50 text-orange-700 border-orange-200' },
  { value: 'vertrag', label: 'Vertrag', color: 'bg-indigo-50 text-indigo-700 border-indigo-200' },
  { value: 'sonstiges', label: 'Sonstiges', color: 'bg-slate-100 text-slate-600 border-slate-200' },
]

export default function ApplicationDocumentsPanel({ application }) {
  const queryClient = useQueryClient()
  const [showUpload, setShowUpload] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [file, setFile] = useState(null)
  const [dragOver, setDragOver] = useState(false)
  const [form, setForm] = useState({ name: '', category: 'antrag', notes: '' })

  const { data: documents = [], isLoading } = useQuery({
    queryKey: ['documents', 'application', application.id],
    queryFn: () => base44.entities.Document.filter({ linked_application_id: application.id }, '-created_date'),
    enabled: !!application.id,
  })

  const deleteMutation = useMutation({
    mutationFn: (id) => base44.entities.Document.delete(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['documents', 'application', application.id] }),
  })

  const applyFile = (f) => {
    if (!f) return
    setFile(f)
    setForm(p => ({ ...p, name: p.name || f.name.replace(/\.[^.]+$/, '') }))
  }

  const handleDrop = (e) => {
    e.preventDefault()
    setDragOver(false)
    applyFile(e.dataTransfer.files[0])
    setShowUpload(true)
  }

  const handleUpload = async (e) => {
    e.preventDefault()
    if (!file) return
    setUploading(true)
    const { file_url } = await base44.integrations.Core.UploadFile({ file })
    await base44.entities.Document.create({
      customer_id: application.customer_id,
      customer_name: application.customer_name,
      primary_customer_id: application.primary_customer_id,
      linked_application_id: application.id,
      name: form.name,
      file_url,
      category: form.category,
      notes: form.notes || undefined,
      uploaded_by: 'broker',
    })
    queryClient.invalidateQueries({ queryKey: ['documents', 'application', application.id] })
    setUploading(false)
    setShowUpload(false)
    setFile(null)
    setForm({ name: '', category: 'antrag', notes: '' })
  }

  return (
    <div className="mt-4">
      <div className="flex items-center justify-between mb-3">
        <h4 className="text-sm font-semibold text-muted-foreground flex items-center gap-2">
          <FileText className="w-4 h-4" />
          Dokumente ({documents.length})
        </h4>
        <Button size="sm" variant="outline" onClick={() => setShowUpload(true)}>
          <Upload className="w-3.5 h-3.5 mr-1" /> Hochladen
        </Button>
      </div>

      {/* Drag & Drop */}
      <div
        onDragOver={(e) => { e.preventDefault(); setDragOver(true) }}
        onDragLeave={() => setDragOver(false)}
        onDrop={handleDrop}
        onClick={() => setShowUpload(true)}
        className={`mb-3 border-2 border-dashed rounded-lg p-4 flex items-center justify-center gap-2 cursor-pointer transition-colors text-sm ${
          dragOver ? 'border-primary bg-primary/5' : 'border-border hover:border-primary/50 hover:bg-muted/30'
        }`}
      >
        <Upload className={`w-4 h-4 ${dragOver ? 'text-primary' : 'text-muted-foreground'}`} />
        <span className="text-muted-foreground">PDF, JPG, PNG, DOCX hier ablegen oder klicken</span>
      </div>

      {isLoading ? (
        <p className="text-xs text-muted-foreground">Laden...</p>
      ) : documents.length === 0 ? (
        <p className="text-xs text-muted-foreground text-center py-2">Noch keine Dokumente hochgeladen</p>
      ) : (
        <div className="space-y-2">
          {documents.map(doc => {
            const cat = CATEGORIES.find(c => c.value === doc.category)
            return (
              <div key={doc.id} className="flex items-center justify-between gap-2 p-2.5 rounded-lg bg-muted/40 text-sm">
                <div className="flex items-center gap-2 min-w-0">
                  <FileText className="w-4 h-4 text-primary flex-shrink-0" />
                  <div className="min-w-0">
                    <p className="font-medium truncate">{doc.name}</p>
                    <div className="flex items-center gap-1.5 mt-0.5">
                      {cat && (
                        <span className={`text-xs border px-1.5 py-0.5 rounded-full ${cat.color}`}>{cat.label}</span>
                      )}
                      <span className="text-xs text-muted-foreground">
                        {doc.created_date ? new Date(doc.created_date).toLocaleDateString('de-CH') : ''}
                      </span>
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-1 flex-shrink-0">
                  <a href={doc.file_url} target="_blank" rel="noopener noreferrer">
                    <Button variant="ghost" size="icon" className="h-7 w-7">
                      <ExternalLink className="w-3.5 h-3.5" />
                    </Button>
                  </a>
                  <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive hover:text-destructive"
                    onClick={() => deleteMutation.mutate(doc.id)}>
                    <Trash2 className="w-3.5 h-3.5" />
                  </Button>
                </div>
              </div>
            )
          })}
        </div>
      )}

      <Dialog open={showUpload} onOpenChange={setShowUpload}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle>Dokument für Antrag hochladen</DialogTitle></DialogHeader>
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
                  {CATEGORIES.map(c => <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>)}
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