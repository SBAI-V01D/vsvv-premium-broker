import React, { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { base44 } from '@/api/base44Client'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu'
import {
  Search, Plus, MoreHorizontal, FileText, ExternalLink,
  Zap, Paperclip, Tag, Trash2, Eye, RefreshCw, Clock, Download, AlertCircle, CheckCircle2, Sparkles, Loader2
} from 'lucide-react'
import DocumentTypeBadge from '@/components/documents/DocumentTypeBadge'
import DocumentTagBadge from '@/components/documents/DocumentTagBadge'
import DocumentReviewPanel from '@/components/documents/DocumentReviewPanel'
import SmartDocumentUpload from '@/components/documents/SmartDocumentUpload'
import SmartDocumentReview from '@/components/documents/SmartDocumentReview'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'

const TABS = [
  { key: 'all', label: 'Alle' },
  { key: 'antrag', label: 'Anträge' },
  { key: 'anlage', label: 'Anlagen' },
  { key: 'pruefung_erforderlich', label: 'Prüfung nötig' },
]

// Extract doc_tag from classification_reason or category
function extractTag(doc) {
  const reason = (doc.classification_reason || '').toLowerCase()
  if (reason.includes('police') || doc.category === 'contract') return 'police'
  if (reason.includes('kündigung')) return 'kuendigung'
  if (reason.includes('offerte')) return 'offerte'
  if (reason.includes('nachtrag')) return 'nachtrag'
  if (reason.includes('antrag')) return 'antrag'
  if (reason.includes('schaden')) return 'schadensmeldung'
  if (reason.includes('gesundheit')) return 'gesundheitsdeklaration'
  if (reason.includes('rechnung')) return 'rechnung'
  if (reason.includes('mahnung')) return 'mahnung'
  if (reason.includes('vollmacht')) return 'vollmacht'
  if (doc.doc_type === 'antrag') return 'antrag'
  return null
}

export default function Documents() {
  const queryClient = useQueryClient()
  const [search, setSearch] = useState('')
  const [tab, setTab] = useState('all')
  const [smartUploadOpen, setSmartUploadOpen] = useState(false)
  const [reviewDoc, setReviewDoc] = useState(null)
  // Neuer KI-Analyse-Flow (smartDocumentAnalysis)
  const [smartReviewDoc, setSmartReviewDoc] = useState(null)
  const [smartReviewResult, setSmartReviewResult] = useState(null)
  const [smartAnalyzing, setSmartAnalyzing] = useState(false)
  const [smartAnalyzingId, setSmartAnalyzingId] = useState(null)

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
    onSuccess: (_, deletedId) => {
      // Optimistic update: entferne lokal aus dem Cache statt alles neu zu laden
      queryClient.setQueryData(['documents'], (old) => 
        old ? old.filter(doc => doc.id !== deletedId) : old
      )
    },
  })

  const deleteBulkMutation = useMutation({
    mutationFn: async () => {
      const toDelete = documents.filter(d => d.doc_type === 'unbekannt')
      for (const doc of toDelete) {
        await base44.entities.Document.delete(doc.id)
      }
      return toDelete.length
    },
    onSuccess: () => {
      queryClient.setQueryData(['documents'], (old) =>
        old ? old.filter(doc => doc.doc_type !== 'unbekannt') : old
      )
    },
  })

  const handleReclassify = (doc, newType) => {
    updateMutation.mutate({
      id: doc.id,
      data: {
        doc_type: newType,
        classification_status: 'klassifiziert',
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

  const handleSmartAnalyze = async (doc) => {
    setSmartAnalyzingId(doc.id)
    setSmartAnalyzing(true)
    try {
      const res = await base44.functions.invoke('smartDocumentAnalysis', {
        file_url: doc.file_url,
        document_type: doc.category || doc.doc_type || 'police',
      })
      if (res.data?.success) {
        setSmartReviewDoc(doc)
        setSmartReviewResult(res.data)
      } else {
        alert('KI-Analyse fehlgeschlagen: ' + (res.data?.error || 'Unbekannter Fehler'))
      }
    } catch (err) {
      alert('KI-Analyse fehlgeschlagen: ' + (err?.response?.data?.error || err.message))
    } finally {
      setSmartAnalyzing(false)
      setSmartAnalyzingId(null)
    }
  }

  const handleFixClassificationStatus = async () => {
    // Alle Dokumente mit "pruefung_erforderlich" aber bereits zugewiesener Kategorie → klassifiziert
    const docsToFix = documents.filter(d => 
      d.classification_status === 'pruefung_erforderlich' && 
      (d.doc_type === 'antrag' || d.doc_type === 'anlage' || d.category)
    )
    if (docsToFix.length === 0) return
    
    // Update lokal im Cache statt einzelne Mutations
    queryClient.setQueryData(['documents'], (old) =>
      old ? old.map(doc =>
        docsToFix.find(d => d.id === doc.id)
          ? { ...doc, classification_status: 'klassifiziert' }
          : doc
      ) : old
    )
    
    // Dann Server aktualisieren
    for (const doc of docsToFix) {
      base44.entities.Document.update(doc.id, { classification_status: 'klassifiziert' }).catch(err => {
        console.error('Update failed:', err)
        queryClient.invalidateQueries({ queryKey: ['documents'] })
      })
    }
  }

  const filtered = documents.filter(doc => {
    const matchSearch = !search.trim() ||
      `${doc.name} ${doc.customer_name} ${doc.notes} ${doc.classification_reason}`.toLowerCase().includes(search.toLowerCase())

    const matchTab =
      tab === 'all' ? true :
      tab === 'antrag' ? doc.doc_type === 'antrag' :
      tab === 'anlage' ? doc.doc_type === 'anlage' :
      tab === 'pruefung_erforderlich' ? doc.classification_status === 'pruefung_erforderlich' :
      true

    return matchSearch && matchTab
  })

  // Sort: pruefung_erforderlich first, then by date
  filtered.sort((a, b) => {
    const pa = a.classification_status === 'pruefung_erforderlich' ? 0 : a.classification_status === 'ausstehend' ? 1 : 2
    const pb = b.classification_status === 'pruefung_erforderlich' ? 0 : b.classification_status === 'ausstehend' ? 1 : 2
    if (pa !== pb) return pa - pb
    return new Date(b.created_date) - new Date(a.created_date)
  })

  const counts = {
    all: documents.length,
    antrag: documents.filter(d => d.doc_type === 'antrag').length,
    anlage: documents.filter(d => d.doc_type === 'anlage').length,
    pruefung_erforderlich: documents.filter(d => d.classification_status === 'pruefung_erforderlich').length,
  }

  const formatDate = (d) => d ? new Date(d).toLocaleDateString('de-CH') : '–'
  const isImage = (url) => url?.match(/\.(jpg|jpeg|png)$/i)

  const openDocument = (url, name) => {
    if (!url) return
    // Open in new tab — safest cross-browser method for PDFs
    const win = window.open(url, '_blank', 'noopener,noreferrer')
    if (!win) {
      // Popup blocked — fallback to direct navigation
      window.location.href = url
    }
  }

  const downloadDocument = (url, name) => {
    if (!url) return
    const a = document.createElement('a')
    a.href = url
    a.download = name || 'dokument'
    a.target = '_blank'
    a.rel = 'noopener noreferrer'
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
  }

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
          <p className="text-muted-foreground mt-1">Intelligente Klassifizierung &amp; automatische Antragserfassung</p>
        </div>
        <div className="flex gap-2">
           {counts.pruefung_erforderlich > 0 && (
             <>
               <Button 
                 onClick={() => {
                   if (confirm(`${counts.pruefung_erforderlich} Dokumente mit Status "Prüfung erforderlich" löschen?`)) {
                     deleteBulkMutation.mutate()
                   }
                 }} 
                 variant="outline" 
                 className="gap-2 text-red-600 border-red-200 hover:bg-red-50"
                 disabled={deleteBulkMutation.isPending}
               >
                 <Trash2 className="w-4 h-4" /> {counts.pruefung_erforderlich} löschen
               </Button>
               <Button onClick={handleFixClassificationStatus} variant="outline" className="gap-2 text-amber-600 border-amber-200 hover:bg-amber-50">
                 <CheckCircle2 className="w-4 h-4" /> {counts.pruefung_erforderlich} Status korrigieren
               </Button>
             </>
           )}
           <Button onClick={() => setSmartUploadOpen(true)} className="gap-2 bg-emerald-600 hover:bg-emerald-700">
              <Plus className="w-4 h-4" /> Dokument hochladen
            </Button>
         </div>
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
                className={`grid grid-cols-1 md:grid-cols-[2fr_1.5fr_1fr_1fr_1.2fr_auto] gap-3 px-4 py-2 items-center hover:bg-muted/20 transition-colors ${idx > 0 ? 'border-t' : ''}`}
              >
                <div className="flex items-center gap-3 min-w-0">
                  <div className={`w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0 ${doc.doc_type === 'antrag' ? 'bg-green-100' : 'bg-slate-100'}`}>
                    {isImage(doc.file_url)
                      ? <img src={doc.file_url} alt="" className="w-9 h-9 rounded-lg object-cover" />
                      : <FileText className={`w-4 h-4 ${doc.doc_type === 'antrag' ? 'text-green-600' : 'text-slate-500'}`} />
                    }
                  </div>
                  <div className="min-w-0">
                    <p className="text-xs font-medium truncate">{doc.name}</p>
                    {doc.classification_status === 'ausstehend' && doc.doc_type === 'antrag' ? (
                      <p className="text-xs text-amber-600 flex items-center gap-1">
                        <Clock className="w-3 h-3" /> KI-Verarbeitung ausstehend...
                      </p>
                    ) : doc.classification_reason ? (
                      <p className="text-xs text-muted-foreground truncate">{doc.classification_reason}</p>
                    ) : null}
                  </div>
                </div>

                <div className="text-xs text-muted-foreground truncate">{doc.customer_name || '–'}</div>

                <div><DocumentTypeBadge doc={doc} /></div>

                <div className="flex items-center gap-1 flex-wrap">
                  {extractTag(doc) && <DocumentTagBadge tag={extractTag(doc)} />}
                  {doc.linked_contract_id && <span className="text-[9px] px-1 py-0.5 bg-emerald-50 text-emerald-700 border border-emerald-200 rounded font-semibold">Vertrag</span>}
                  {doc.linked_application_id && <span className="text-[9px] px-1 py-0.5 bg-blue-50 text-blue-700 border border-blue-200 rounded font-semibold">Antrag</span>}
                </div>

                <div className="text-xs text-muted-foreground">{formatDate(doc.created_date)}</div>

                <div className="flex items-center gap-1">
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7 text-primary"
                    title="KI-Analyse: Kunden/Antrag erkennen"
                    disabled={smartAnalyzingId === doc.id}
                    onClick={() => handleSmartAnalyze(doc)}
                  >
                    {smartAnalyzingId === doc.id
                      ? <Loader2 className="w-4 h-4 animate-spin" />
                      : <Sparkles className="w-4 h-4" />
                    }
                  </Button>
                  {doc.doc_type === 'antrag' && (
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7 text-muted-foreground"
                      title="Alte KI-Extraktion (extractApplicationData)"
                      onClick={() => setReviewDoc(doc)}
                    >
                      <Eye className="w-4 h-4" />
                    </Button>
                  )}
                  {doc.file_url && (
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7 text-muted-foreground"
                      title="Dokument öffnen"
                      onClick={() => openDocument(doc.file_url, doc.name)}
                    >
                      <ExternalLink className="w-3.5 h-3.5" />
                    </Button>
                  )}
                  {doc.file_url && (
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7 text-muted-foreground"
                      title="Herunterladen"
                      onClick={() => downloadDocument(doc.file_url, doc.name)}
                    >
                      <Download className="w-3.5 h-3.5" />
                    </Button>
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
                        <Zap className="w-4 h-4 mr-2 text-green-600" /> Als ANTRAG markieren &amp; verarbeiten
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={() => handleReclassify(doc, 'anlage')}>
                        <Paperclip className="w-4 h-4 mr-2 text-slate-500" /> Als ANLAGE markieren
                      </DropdownMenuItem>
                      {doc.file_url && (
                        <DropdownMenuItem onClick={() => openDocument(doc.file_url, doc.name)}>
                          <ExternalLink className="w-4 h-4 mr-2" /> Öffnen
                        </DropdownMenuItem>
                      )}
                      {doc.file_url && (
                        <DropdownMenuItem onClick={() => downloadDocument(doc.file_url, doc.name)}>
                          <Download className="w-4 h-4 mr-2" /> Herunterladen
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

      {/* Neuer KI-Analyse Flow (smartDocumentAnalysis + SmartDocumentReview) */}
      <Dialog
        open={!!smartReviewDoc && !!smartReviewResult}
        onOpenChange={(open) => { if (!open) { setSmartReviewDoc(null); setSmartReviewResult(null) } }}
      >
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Sparkles className="w-5 h-5 text-primary" />
              KI-Analyse: {smartReviewDoc?.name}
            </DialogTitle>
          </DialogHeader>
          {smartReviewDoc && smartReviewResult && (
            <SmartDocumentReview
              document={smartReviewDoc}
              documentType={smartReviewResult.extracted?.document_subtype || 'neuantrag'}
              analysisResult={smartReviewResult}
              onSuccess={() => {
                setSmartReviewDoc(null)
                setSmartReviewResult(null)
                queryClient.invalidateQueries({ queryKey: ['documents'] })
                queryClient.invalidateQueries({ queryKey: ['applications'] })
                queryClient.invalidateQueries({ queryKey: ['customers'] })
              }}
              onRestart={() => {
                setSmartReviewDoc(null)
                setSmartReviewResult(null)
              }}
            />
          )}
        </DialogContent>
      </Dialog>

      <SmartDocumentUpload
        open={smartUploadOpen}
        onOpenChange={setSmartUploadOpen}
        onSuccess={() => queryClient.invalidateQueries({ queryKey: ['documents'] })}
      />
    </div>
  )
}