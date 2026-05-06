import React, { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { base44 } from '@/api/base44Client'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu'
import {
  Search, Plus, MoreHorizontal, FileText, ExternalLink,
  Zap, Paperclip, Tag, Trash2, Eye, RefreshCw, Clock
} from 'lucide-react'
import DocumentTypeBadge from '@/components/documents/DocumentTypeBadge'
import DocumentUploadDialog from '@/components/documents/DocumentUploadDialog'
import DocumentReviewPanel from '@/components/documents/DocumentReviewPanel'

const TABS = [
  { key: 'all', label: 'Alle Dokumente' },
  { key: 'antrag', label: 'Anträge' },
  { key: 'anlage', label: 'Anlagen' },
  { key: 'pruefung_erforderlich', label: 'Prüfung erforderlich' },
]

export default function Documents() {
  const queryClient = useQueryClient()
  const [search, setSearch] = useState('')
  const [tab, setTab] = useState('all')
  const [uploadOpen, setUploadOpen] = useState(false)
  const [reviewDoc, setReviewDoc] = useState(null)

  const { data: documents = [], isLoading } = useQuery({
    queryKey: ['documents'],
    queryFn: () => base44.entities.Document.list('-created_date'),
  })

  const updateMutation = useMutation({
    mutationFn: ({ id, data }) => base44.entities.Document.update(id, data),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['documents'] }),
  })

  const deleteMutation = useMutation({
    mutationFn: (id) => base44.entities.Document.delete(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['documents'] }),
  })

  const handleReclassify = (doc, newType) => {
    updateMutation.mutate({
      id: doc.id,
      data: {
        doc_type: newType,
        classification_status: newType === 'antrag' ? 'klassifiziert' : 'manuell',
      },
    })
  }

  const handleRequeue = async (doc) => {
    // Re-queue a failed/pending document for KI processing
    await base44.entities.AutomationQueue.create({
      job_type: 'ki_extraction',
      status: 'pending',
      related_document_id: doc.id,
      related_entity_type: 'Document',
      related_entity_id: doc.id,
      payload: JSON.stringify({ file_url: doc.file_url, file_name: doc.name, document_id: doc.id }),
    })
    updateMutation.mutate({ id: doc.id, data: { classification_status: 'ausstehend' } })
  }

  const filtered = documents.filter(doc => {
    const matchSearch = !search.trim() ||
      `${doc.name} ${doc.customer_name} ${doc.notes}`.toLowerCase().includes(search.toLowerCase())

    const matchTab =
      tab === 'all' ? true :
      tab === 'antrag' ? doc.doc_type === 'antrag' :
      tab === 'anlage' ? doc.doc_type === 'anlage' :
      tab === 'pruefung_erforderlich' ? doc.classification_status === 'pruefung_erforderlich' :
      true

    return matchSearch && matchTab
  })

  const counts = {
    all: documents.length,
    antrag: documents.filter(d => d.doc_type === 'antrag').length,
    anlage: documents.filter(d => d.doc_type === 'anlage').length,
    pruefung_erforderlich: documents.filter(d => d.classification_status === 'pruefung_erforderlich').length,
  }

  const formatDate = (d) => d ? new Date(d).toLocaleDateString('de-CH') : '–'
  const isImage = (url) => url?.match(/\.(jpg|jpeg|png)$/i)

  // Full-Page Review Mode — ersetzt die ganze Seite, kein Modal
  if (reviewDoc) {
    return (
      <div style={{ position: 'fixed', inset: 0, zIndex: 50, background: 'hsl(var(--background))', display: 'flex', flexDirection: 'column' }}>
        <DocumentReviewPanel
          document={reviewDoc}
          onClose={() => setReviewDoc(null)}
          onSaved={() => {
            setReviewDoc(null)
            queryClient.invalidateQueries({ queryKey: ['documents'] })
          }}
        />
      </div>
    )
  }

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold">Dokumente ({documents.length})</h1>
          <p className="text-muted-foreground mt-1">Intelligente Klassifizierung & automatische Antragserfassung</p>
        </div>
        <Button onClick={() => setUploadOpen(true)} className="gap-2">
          <Plus className="w-4 h-4" /> Dokument hochladen
        </Button>
      </div>

      {/* KPI strip */}
      <div className="grid grid-cols-4 gap-3">
        <div className="p-3 rounded-lg bg-card border flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-slate-100 flex items-center justify-center">
            <FileText className="w-4 h-4 text-slate-600" />
          </div>
          <div>
            <p className="text-xl font-bold">{documents.length}</p>
            <p className="text-xs text-muted-foreground">Total</p>
          </div>
        </div>
        <div className="p-3 rounded-lg bg-card border flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-green-100 flex items-center justify-center">
            <Zap className="w-4 h-4 text-green-600" />
          </div>
          <div>
            <p className="text-xl font-bold text-green-700">{counts.antrag}</p>
            <p className="text-xs text-muted-foreground">Anträge</p>
          </div>
        </div>
        <div className="p-3 rounded-lg bg-card border flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-slate-100 flex items-center justify-center">
            <Paperclip className="w-4 h-4 text-slate-600" />
          </div>
          <div>
            <p className="text-xl font-bold">{counts.anlage}</p>
            <p className="text-xs text-muted-foreground">Anlagen</p>
          </div>
        </div>
        <div className="p-3 rounded-lg bg-card border flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-amber-100 flex items-center justify-center">
            <Tag className="w-4 h-4 text-amber-600" />
          </div>
          <div>
            <p className="text-xl font-bold text-amber-700">{counts.pruefung_erforderlich}</p>
            <p className="text-xs text-muted-foreground">Prüfung erforderlich</p>
          </div>
        </div>
      </div>

      {/* Filter tabs + search */}
      <div className="flex items-center gap-3 flex-wrap">
        <div className="flex border rounded-lg overflow-hidden bg-card">
          {TABS.map(t => (
            <button
              key={t.key}
              onClick={() => setTab(t.key)}
              className={`px-3 py-1.5 text-sm font-medium transition-colors flex items-center gap-1.5 ${
                tab === t.key
                  ? 'bg-primary text-primary-foreground'
                  : 'text-muted-foreground hover:bg-muted'
              }`}
            >
              {t.label}
              <span className={`text-xs px-1.5 py-0.5 rounded-full ${tab === t.key ? 'bg-white/20' : 'bg-muted'}`}>
                {counts[t.key] ?? 0}
              </span>
            </button>
          ))}
        </div>
        <div className="relative flex-1 min-w-48">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="Suche nach Name, Kunde..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>
      </div>

      {/* Document list */}
      <Card>
        <CardContent className="p-0">
          <div className="hidden md:grid grid-cols-[2fr_1.5fr_1fr_1fr_1.2fr_auto] gap-3 px-4 py-2 border-b bg-muted/40 text-xs font-semibold text-muted-foreground uppercase tracking-wide">
            <div>Dokument</div>
            <div>Kunde</div>
            <div>Typ</div>
            <div>Kategorie</div>
            <div>Hochgeladen</div>
            <div className="w-24"></div>
          </div>

          {isLoading ? (
            <div className="py-12 text-center text-muted-foreground">Lädt...</div>
          ) : filtered.length === 0 ? (
            <div className="py-12 text-center text-muted-foreground">Keine Dokumente gefunden</div>
          ) : (
            filtered.map((doc, idx) => (
              <div
                key={doc.id}
                className={`grid grid-cols-1 md:grid-cols-[2fr_1.5fr_1fr_1fr_1.2fr_auto] gap-3 px-4 py-3 items-center hover:bg-muted/20 transition-colors ${idx > 0 ? 'border-t' : ''}`}
              >
                <div className="flex items-center gap-3 min-w-0">
                  <div className={`w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0 ${doc.doc_type === 'antrag' ? 'bg-green-100' : 'bg-slate-100'}`}>
                    {isImage(doc.file_url)
                      ? <img src={doc.file_url} alt="" className="w-9 h-9 rounded-lg object-cover" />
                      : <FileText className={`w-4 h-4 ${doc.doc_type === 'antrag' ? 'text-green-600' : 'text-slate-500'}`} />
                    }
                  </div>
                  <div className="min-w-0">
                    <p className="text-sm font-medium truncate">{doc.name}</p>
                    {doc.classification_status === 'ausstehend' && doc.doc_type === 'antrag' ? (
                      <p className="text-xs text-amber-600 flex items-center gap-1">
                        <Clock className="w-3 h-3" /> KI-Verarbeitung ausstehend...
                      </p>
                    ) : doc.classification_reason ? (
                      <p className="text-xs text-muted-foreground truncate">{doc.classification_reason}</p>
                    ) : null}
                  </div>
                </div>

                <div className="text-sm text-muted-foreground truncate">{doc.customer_name || '–'}</div>

                <div><DocumentTypeBadge doc={doc} /></div>

                <div className="text-xs text-muted-foreground capitalize">{doc.category || '–'}</div>

                <div className="text-xs text-muted-foreground">{formatDate(doc.created_date)}</div>

                <div className="flex items-center gap-1">
                  {doc.doc_type === 'antrag' && (
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7 text-primary"
                      title="KI-Extraktion & Antrag erstellen"
                      onClick={() => setReviewDoc(doc)}
                    >
                      <Eye className="w-4 h-4" />
                    </Button>
                  )}
                  {doc.file_url && (
                    <a href={doc.file_url} target="_blank" rel="noopener noreferrer">
                      <Button variant="ghost" size="icon" className="h-7 w-7 text-muted-foreground">
                        <ExternalLink className="w-3.5 h-3.5" />
                      </Button>
                    </a>
                  )}
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" size="icon" className="h-7 w-7">
                        <MoreHorizontal className="w-4 h-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      {doc.doc_type === 'antrag' && (
                        <DropdownMenuItem onClick={() => setReviewDoc(doc)}>
                          <Zap className="w-4 h-4 mr-2 text-primary" /> KI-Extraktion starten
                        </DropdownMenuItem>
                      )}
                      {doc.doc_type === 'antrag' && ['ausstehend', 'pruefung_erforderlich'].includes(doc.classification_status) && (
                        <DropdownMenuItem onClick={() => handleRequeue(doc)}>
                          <RefreshCw className="w-4 h-4 mr-2 text-amber-600" /> Neu verarbeiten
                        </DropdownMenuItem>
                      )}
                      <DropdownMenuItem onClick={() => {
                        handleReclassify(doc, 'antrag')
                        setTimeout(() => setReviewDoc({ ...doc, doc_type: 'antrag' }), 300)
                      }}>
                        <Zap className="w-4 h-4 mr-2 text-green-600" /> Als ANTRAG markieren & verarbeiten
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={() => handleReclassify(doc, 'anlage')}>
                        <Paperclip className="w-4 h-4 mr-2 text-slate-500" /> Als ANLAGE markieren
                      </DropdownMenuItem>
                      {doc.file_url && (
                        <DropdownMenuItem asChild>
                          <a href={doc.file_url} target="_blank" rel="noopener noreferrer" className="flex items-center">
                            <ExternalLink className="w-4 h-4 mr-2" /> Öffnen
                          </a>
                        </DropdownMenuItem>
                      )}
                      <DropdownMenuItem
                        className="text-destructive"
                        onClick={() => { if (confirm('Dokument wirklich löschen?')) deleteMutation.mutate(doc.id) }}
                      >
                        <Trash2 className="w-4 h-4 mr-2" /> Löschen
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
              </div>
            ))
          )}
        </CardContent>
      </Card>

      <DocumentUploadDialog
        open={uploadOpen}
        onOpenChange={setUploadOpen}
        onSuccess={() => queryClient.invalidateQueries({ queryKey: ['documents'] })}
      />
    </div>
  )
}