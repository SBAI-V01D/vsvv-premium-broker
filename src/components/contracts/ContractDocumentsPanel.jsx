import React, { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { base44 } from '@/api/base44Client'
import { ChevronDown, ChevronUp, Upload, FileText, Trash2, ExternalLink } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Card } from '@/components/ui/card'

// Mapping to valid Document entity enum values
const CATEGORIES = [
  { value: 'contract', label: 'Police', color: 'bg-blue-50 text-blue-700 border-blue-200' },
  { value: 'correspondence', label: 'Korrespondenz', color: 'bg-amber-50 text-amber-700 border-amber-200' },
  { value: 'application', label: 'Antrag', color: 'bg-indigo-50 text-indigo-700 border-indigo-200' },
  { value: 'identification', label: 'Ausweis', color: 'bg-green-50 text-green-700 border-green-200' },
  { value: 'other', label: 'Sonstiges', color: 'bg-slate-100 text-slate-600 border-slate-200' },
]

export default function ContractDocumentsPanel({ contract }) {
  const queryClient = useQueryClient()
  const [open, setOpen] = useState(false)
  const [showUpload, setShowUpload] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [file, setFile] = useState(null)
  const [form, setForm] = useState({ name: '', category: 'contract', notes: '' })

  const { data: documents = [] } = useQuery({
    queryKey: ['documents', 'contract', contract.id],
    queryFn: () => base44.entities.Document.filter({ linked_contract_id: contract.id }, '-created_date'),
  })

  const deleteMutation = useMutation({
    mutationFn: (id) => base44.entities.Document.delete(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['documents', 'contract', contract.id] }),
  })

  const handleFileChange = (e) => {
    const f = e.target.files[0]
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
      customer_id: contract.customer_id,
      customer_name: contract.customer_name,
      primary_customer_id: contract.primary_customer_id,
      linked_contract_id: contract.id,
      name: form.name,
      file_url,
      category: form.category,
      notes: form.notes || undefined,
      uploaded_by: 'broker',
    })
    queryClient.invalidateQueries({ queryKey: ['documents', 'contract', contract.id] })
    setUploading(false)
    setShowUpload(false)
    setFile(null)
    setForm({ name: '', category: 'contract', notes: '' })
  }

  return (
    <div className="mt-3 space-y-2">
      <div className="flex items-center justify-between">
        <h4 className="text-sm font-semibold text-muted-foreground flex items-center gap-2">
          <FileText className="w-4 h-4" />
          Dokumente ({documents.length})
        </h4>
        <Button size="sm" variant="outline" onClick={() => setShowUpload(true)}>
          <Upload className="w-3.5 h-3.5 mr-1" /> Hochladen
        </Button>
      </div>

      {documents.length === 0 ? (
        <p className="text-xs text-muted-foreground text-center py-3">Keine Dokumente hochgeladen</p>
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
                    {cat && (
                      <span className={`text-xs border px-1.5 py-0.5 rounded-full inline-block mt-1 ${cat.color}`}>{cat.label}</span>
                    )}
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

      {/* Dialog ausserhalb des open-Blocks damit er immer im DOM ist */}
      <Dialog open={showUpload} onOpenChange={setShowUpload}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle>Dokument / Police hochladen</DialogTitle></DialogHeader>
          <form onSubmit={handleUpload} className="space-y-4">
            <div>
              <Label>Datei</Label>
              <Input type="file" accept=".pdf,.png,.jpg,.jpeg,.doc,.docx" onChange={handleFileChange} required className="mt-1" />
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