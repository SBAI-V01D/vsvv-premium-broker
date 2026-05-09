import React, { useState, useMemo } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { base44 } from '@/api/base44Client'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Input } from '@/components/ui/input'
import { FileText, Upload, Download, Trash2, Search } from 'lucide-react'
import { cn } from '@/lib/utils'

const CATEGORY_LABELS = {
  vertragsdokumente: '📋 Vertragsdokumente',
  courtagevereinbarungen: '🤝 Courtagevereinbarungen',
  provisionsabrechnungen: '💰 Provisionsabrechnungen',
  zielvereinbarungen: '🎯 Zielvereinbarungen',
  deals_spezialvereinbarungen: '⭐ Deals / Spezialvereinbarungen',
  korrespondenz: '✉️ Korrespondenz',
  schulungsunterlagen: '📚 Schulungsunterlagen',
  verkaufsfoerderung: '📢 Verkaufsförderung',
  sonstige: '📁 Sonstige'
}

const CATEGORY_COLORS = {
  vertragsdokumente: 'bg-blue-100 text-blue-700',
  courtagevereinbarungen: 'bg-green-100 text-green-700',
  provisionsabrechnungen: 'bg-purple-100 text-purple-700',
  zielvereinbarungen: 'bg-orange-100 text-orange-700',
  deals_spezialvereinbarungen: 'bg-red-100 text-red-700',
  korrespondenz: 'bg-gray-100 text-gray-700',
  schulungsunterlagen: 'bg-yellow-100 text-yellow-700',
  verkaufsfoerderung: 'bg-pink-100 text-pink-700',
  sonstige: 'bg-slate-100 text-slate-700'
}

const UploadDialog = ({ partnerId, partnerName, onClose, onSuccess }) => {
  const [category, setCategory] = useState('')
  const [notes, setNotes] = useState('')
  const [file, setFile] = useState(null)
  const [uploading, setUploading] = useState(false)
  const queryClient = useQueryClient()

  const handleUpload = async () => {
    if (!file || !category) return

    try {
      setUploading(true)
      const { file_url } = await base44.integrations.Core.UploadFile({ file })
      
      const currentUser = await base44.auth.me()
      
      await base44.entities.PartnerDocument.create({
        partner_id: partnerId,
        partner_name: partnerName,
        file_name: file.name,
        file_url,
        category,
        notes,
        file_size: file.size,
        uploaded_by: currentUser.email,
        uploaded_by_name: currentUser.full_name || currentUser.email
      })

      await base44.entities.PartnerActivity.create({
        partner_id: partnerId,
        partner_name: partnerName,
        activity_type: 'document_uploaded',
        description: `${file.name} hochgeladen`,
        document_name: file.name,
        performed_by: currentUser.email,
        performed_by_name: currentUser.full_name || currentUser.email
      })

      queryClient.invalidateQueries({ queryKey: ['partner-documents', partnerId] })
      queryClient.invalidateQueries({ queryKey: ['partner-activities', partnerId] })
      onSuccess()
    } catch (error) {
      console.error('Upload failed:', error)
    } finally {
      setUploading(false)
    }
  }

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Dokument hochladen — {partnerName}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div>
            <label className="text-xs font-semibold uppercase text-muted-foreground">Kategorie *</label>
            <Select value={category} onValueChange={setCategory}>
              <SelectTrigger className="mt-1"><SelectValue placeholder="Kategorie wählen" /></SelectTrigger>
              <SelectContent>
                {Object.entries(CATEGORY_LABELS).map(([key, label]) => (
                  <SelectItem key={key} value={key}>{label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <label className="text-xs font-semibold uppercase text-muted-foreground">Datei *</label>
            <div className="mt-1 border-2 border-dashed border-border rounded-lg p-6 text-center cursor-pointer hover:border-primary hover:bg-muted/50 transition-colors"
              onClick={() => document.getElementById('file-input').click()}>
              <FileText className="w-8 h-8 text-muted-foreground mx-auto mb-2" />
              <p className="text-sm font-semibold">{file?.name || 'Datei auswählen'}</p>
              {file && <p className="text-xs text-muted-foreground mt-1">{(file.size / 1024).toFixed(1)} KB</p>}
              <input id="file-input" type="file" onChange={e => setFile(e.target.files[0])} className="hidden" />
            </div>
          </div>
          <div>
            <label className="text-xs font-semibold uppercase text-muted-foreground">Bemerkungen</label>
            <Input value={notes} onChange={e => setNotes(e.target.value)} className="mt-1" placeholder="Optional..." />
          </div>
          <div className="flex gap-2 justify-end pt-2">
            <Button variant="outline" onClick={onClose} disabled={uploading}>Abbrechen</Button>
            <Button onClick={handleUpload} disabled={!file || !category || uploading} className="gap-2">
              {uploading ? 'Wird hochgeladen...' : <>
                <Upload className="w-4 h-4" /> Hochladen
              </>}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}

export default function PartnerDocumentsPanel({ partnerId, partnerName }) {
  const [showUpload, setShowUpload] = useState(false)
  const [filterCategory, setFilterCategory] = useState('all')
  const [search, setSearch] = useState('')
  const queryClient = useQueryClient()

  const { data: documents = [] } = useQuery({
    queryKey: ['partner-documents', partnerId],
    queryFn: async () => {
      try {
        return await base44.entities.PartnerDocument.filter({ partner_id: partnerId }, '-created_date', 1000)
      } catch {
        return []
      }
    },
    enabled: !!partnerId,
  })

  const deleteMutation = useMutation({
    mutationFn: async (docId) => {
      const doc = documents.find(d => d.id === docId)
      await base44.entities.PartnerDocument.delete(docId)
      
      const currentUser = await base44.auth.me()
      await base44.entities.PartnerActivity.create({
        partner_id: partnerId,
        partner_name: partnerName,
        activity_type: 'document_deleted',
        description: `${doc.file_name} gelöscht`,
        performed_by: currentUser.email,
        performed_by_name: currentUser.full_name || currentUser.email
      })
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['partner-documents', partnerId] })
      queryClient.invalidateQueries({ queryKey: ['partner-activities', partnerId] })
    }
  })

  const filtered = useMemo(() => {
    let result = documents
    if (filterCategory !== 'all') {
      result = result.filter(d => d.category === filterCategory)
    }
    if (search.trim()) {
      result = result.filter(d => d.file_name.toLowerCase().includes(search.toLowerCase()))
    }
    return result
  }, [documents, filterCategory, search])

  const formatDate = (dateStr) => {
    if (!dateStr) return '–'
    return new Date(dateStr).toLocaleDateString('de-CH')
  }

  return (
    <div className="space-y-4">
      {/* Toolbar */}
      <div className="flex gap-3 flex-wrap items-end">
        <Button onClick={() => setShowUpload(true)} className="gap-2">
          <Upload className="w-4 h-4" /> Dokument hochladen
        </Button>
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input placeholder="Suchen..." value={search} onChange={e => setSearch(e.target.value)} className="pl-9" />
        </div>
        <Select value={filterCategory} onValueChange={setFilterCategory}>
          <SelectTrigger className="w-48"><SelectValue placeholder="Kategorie" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Alle Kategorien</SelectItem>
            {Object.entries(CATEGORY_LABELS).map(([key, label]) => (
              <SelectItem key={key} value={key}>{label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Document List */}
      {filtered.length === 0 ? (
        <Card>
          <CardContent className="p-8 text-center text-muted-foreground">
            {documents.length === 0 ? 'Noch keine Dokumente hochgeladen' : 'Keine Dokumente gefunden'}
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-2">
          {filtered.map(doc => (
            <Card key={doc.id} className="hover:shadow-md transition-shadow">
              <CardContent className="p-4">
                <div className="flex items-start gap-3">
                  <FileText className="w-8 h-8 text-muted-foreground flex-shrink-0 mt-1" />
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold truncate">{doc.file_name}</p>
                    <div className="flex gap-2 flex-wrap mt-2">
                      <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${CATEGORY_COLORS[doc.category]}`}>
                        {CATEGORY_LABELS[doc.category]?.split(' ').slice(1).join(' ') || doc.category}
                      </span>
                      <span className="text-xs text-muted-foreground">📅 {formatDate(doc.created_date)}</span>
                      {doc.uploaded_by_name && <span className="text-xs text-muted-foreground">👤 {doc.uploaded_by_name}</span>}
                    </div>
                    {doc.notes && <p className="text-xs text-muted-foreground mt-2 italic">{doc.notes}</p>}
                  </div>
                  <div className="flex gap-2 flex-shrink-0">
                    {doc.file_url && (
                      <a href={doc.file_url} target="_blank" rel="noopener" className="p-2 rounded-lg hover:bg-muted transition-colors" title="Herunterladen">
                        <Download className="w-4 h-4 text-muted-foreground" />
                      </a>
                    )}
                    <button onClick={() => deleteMutation.mutate(doc.id)} className="p-2 rounded-lg hover:bg-red-100 transition-colors" title="Löschen">
                      <Trash2 className="w-4 h-4 text-red-500" />
                    </button>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {showUpload && (
        <UploadDialog
          partnerId={partnerId}
          partnerName={partnerName}
          onClose={() => setShowUpload(false)}
          onSuccess={() => {
            setShowUpload(false)
            setSearch('')
            setFilterCategory('all')
          }}
        />
      )}
    </div>
  )
}