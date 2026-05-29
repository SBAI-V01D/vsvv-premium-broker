import React, { useState, useRef } from 'react'
import { useMutation } from '@tanstack/react-query'
import { base44 } from '@/api/base44Client'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Upload, Loader2, FileText, FileEdit, RefreshCw, Paperclip, X } from 'lucide-react'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'
import { useQuery } from '@tanstack/react-query'
import SmartDocumentReview from './SmartDocumentReview'
import { cn } from '@/lib/utils'

const DOCUMENT_TYPES = [
  {
    key: 'neuantrag',
    label: 'Neuantrag',
    description: 'Neuer Versicherungsantrag – KI extrahiert Daten automatisch',
    icon: FileText,
    color: 'border-blue-300 bg-blue-50 hover:bg-blue-100 text-blue-800',
  },
  {
    key: 'aenderungsantrag',
    label: 'Änderungsantrag',
    description: 'Mutation / Anpassung bestehender Vertrag – KI extrahiert Daten',
    icon: FileEdit,
    color: 'border-amber-300 bg-amber-50 hover:bg-amber-100 text-amber-800',
  },
  {
    key: 'erneuerungsantrag',
    label: 'Erneuerungsantrag',
    description: 'Verlängerung / Erneuerung – KI extrahiert Daten',
    icon: RefreshCw,
    color: 'border-green-300 bg-green-50 hover:bg-green-100 text-green-800',
  },
  {
    key: 'anlage',
    label: 'Anlage / Zusatzdokument',
    description: 'Police-Kopie, Korrespondenz, Rechnung – direkt einem Kunden/Vertrag zuweisen',
    icon: Paperclip,
    color: 'border-slate-300 bg-slate-50 hover:bg-slate-100 text-slate-700',
  },
]

export default function SmartDocumentUpload({ open, onOpenChange, onSuccess }) {
  const fileInputRef = useRef(null)
  const [file, setFile] = useState(null)
  const [documentType, setDocumentType] = useState(null)
  const [step, setStep] = useState('type') // type | upload | uploading | analyzing | review | anlage_form
  const [analysisSeconds, setAnalysisSeconds] = useState(0)
  const [uploadedDoc, setUploadedDoc] = useState(null)
  const [analysisResult, setAnalysisResult] = useState(null)
  const [errorMsg, setErrorMsg] = useState(null)
  const [anlageForm, setAnlageForm] = useState({ name: '', notes: '', customer_id: '', contract_id: '' })
  const [anlageUploading, setAnlageUploading] = useState(false)

  const { data: customers = [] } = useQuery({
    queryKey: ['customers'],
    queryFn: () => base44.entities.Customer.list('-created_date', 500),
    enabled: open && documentType === 'anlage',
  })
  const { data: contracts = [] } = useQuery({
    queryKey: ['contracts'],
    queryFn: () => base44.entities.Contract.list(null, 1000),
    enabled: open && documentType === 'anlage',
  })
  const customerContracts = contracts.filter(c => c.customer_id === anlageForm.customer_id)

  const uploadMutation = useMutation({
    mutationFn: async (f) => {
      const { file_url } = await base44.integrations.Core.UploadFile({ file: f })
      return file_url
    },
  })

  const analysisMutation = useMutation({
    mutationFn: async ({ file_url, document_type }) => {
      const res = await base44.functions.invoke('smartDocumentAnalysis', { file_url, document_type })
      return res.data
    },
  })

  const handleFileSelect = (e) => {
    const f = e.target.files?.[0]
    if (f) {
      setFile(f)
      setErrorMsg(null)
      setAnlageForm(prev => ({ ...prev, name: prev.name || f.name.replace(/\.[^/.]+$/, '') }))
    }
  }

  const handleAnlageUpload = async (e) => {
    e.preventDefault()
    if (!file) return
    setAnlageUploading(true)
    setErrorMsg(null)
    try {
      const { file_url } = await base44.integrations.Core.UploadFile({ file })
      const selectedCustomer = customers.find(c => c.id === anlageForm.customer_id)
      await base44.entities.Document.create({
        name: anlageForm.name || file.name,
        file_url,
        category: 'other',
        doc_type: 'anlage',
        classification_status: 'klassifiziert',
        notes: anlageForm.notes || undefined,
        uploaded_by: 'broker',
        customer_id: anlageForm.customer_id || undefined,
        customer_name: selectedCustomer ? `${selectedCustomer.first_name} ${selectedCustomer.last_name}` : undefined,
        primary_customer_id: selectedCustomer?.is_family_member ? selectedCustomer.primary_customer_id : (selectedCustomer?.id || undefined),
        is_family_member: selectedCustomer?.is_family_member || false,
        linked_contract_id: anlageForm.contract_id || undefined,
      })
      onSuccess?.()
      handleClose()
    } catch (err) {
      setErrorMsg(err?.message || 'Upload fehlgeschlagen')
    } finally {
      setAnlageUploading(false)
    }
  }

  const handleUploadAndAnalyze = async () => {
    if (!file || !documentType) return
    setErrorMsg(null)

    try {
      setStep('uploading')
      const fileUrl = await uploadMutation.mutateAsync(file)

      // Dokument-Eintrag erstellen
      const doc = await base44.entities.Document.create({
        name: file.name.replace(/\.[^/.]+$/, ''), // ohne Extension
        file_url: fileUrl,
        category: 'application',
        doc_type: 'antrag',
        processing_stage: 'uploaded',
        classification_status: 'ausstehend',
      })
      setUploadedDoc(doc)

      setStep('analyzing')
      setAnalysisSeconds(0)
      const timer = setInterval(() => setAnalysisSeconds(s => s + 1), 1000)
      let result
      try {
        result = await analysisMutation.mutateAsync({
        file_url: fileUrl,
        document_type: documentType,
      })

        } finally {
          clearInterval(timer)
        }

      if (!result?.success) {
        throw new Error(result?.error || 'KI-Analyse fehlgeschlagen. Bitte prüfen Sie das Dokument.')
      }

      setAnalysisResult(result)
      setStep('review')
    } catch (err) {
      console.error('Upload/Analyse Fehler:', err)
      setErrorMsg(err?.response?.data?.error || err?.message || 'Fehler beim Upload')
      setStep('upload')
    }
  }

  const handleClose = () => {
    setFile(null)
    setDocumentType(null)
    setStep('type')
    setUploadedDoc(null)
    setAnalysisResult(null)
    setErrorMsg(null)
    setAnlageForm({ name: '', notes: '', customer_id: '', contract_id: '' })
    setAnlageUploading(false)
    onOpenChange(false)
  }

  const handleSuccess = () => {
    handleClose()
    onSuccess?.()
  }

  const handleRestart = () => {
    setFile(null)
    setStep('upload')
    setAnalysisResult(null)
    setErrorMsg(null)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Upload className="w-5 h-5" />
            Intelligenter Dokumenten-Upload
            {documentType && (
              <span className="text-sm font-normal text-muted-foreground ml-2">
                – {DOCUMENT_TYPES.find(t => t.key === documentType)?.label}
              </span>
            )}
          </DialogTitle>
        </DialogHeader>

        {/* SCHRITT 1: Dokumenttyp wählen */}
        {step === 'type' && (
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">
              Wählen Sie den Dokumenttyp, damit die KI gezielter analysieren kann.
            </p>
            <div className="grid gap-3">
              {DOCUMENT_TYPES.map(({ key, label, description, icon: Icon, color }) => {
                const ResolvedIcon = Icon || Paperclip
                return (
                  <button
                    key={key}
                    onClick={() => {
                      setDocumentType(key)
                      setStep(key === 'anlage' ? 'anlage_form' : 'upload')
                    }}
                    className={cn('w-full text-left p-4 rounded-lg border-2 transition flex items-center gap-3', color)}
                  >
                    <ResolvedIcon className="w-5 h-5 flex-shrink-0" />
                    <div>
                      <p className="font-semibold">{label}</p>
                      <p className="text-xs opacity-75">{description}</p>
                    </div>
                  </button>
                )
              })}
            </div>
            <Button variant="outline" onClick={handleClose} className="w-full">Abbrechen</Button>
          </div>
        )}

        {/* SCHRITT 2: Datei hochladen */}
        {step === 'upload' && (
          <div className="space-y-4">
            <div className="flex items-center gap-2 p-2 bg-muted/40 rounded text-sm">
              {(() => {
                const t = DOCUMENT_TYPES.find(t => t.key === documentType)
                const Icon = t?.icon || FileText
                return <><Icon className="w-4 h-4" /><span>{t?.label}</span></>
              })()}
              <button
                onClick={() => setStep('type')}
                className="ml-auto text-xs text-muted-foreground hover:text-foreground"
              >
                Ändern
              </button>
            </div>

            <div
              onClick={() => fileInputRef.current?.click()}
              className="border-2 border-dashed border-border rounded-lg p-8 text-center cursor-pointer hover:bg-muted/30 transition"
            >
              <Upload className="w-8 h-8 mx-auto mb-2 text-muted-foreground" />
              <p className="font-medium">PDF oder Bild hochladen</p>
              <p className="text-sm text-muted-foreground">Antragsdokument (PDF, JPG, PNG)</p>
            </div>

            <input
              ref={fileInputRef}
              type="file"
              accept=".pdf,.jpg,.jpeg,.png"
              onChange={handleFileSelect}
              className="hidden"
            />

            {file && (
              <div className="p-3 bg-muted/40 rounded-lg flex items-center justify-between">
                <span className="text-sm font-medium truncate">{file.name}</span>
                <button onClick={() => setFile(null)} className="text-xs text-muted-foreground hover:text-foreground">
                  Ändern
                </button>
              </div>
            )}

            {errorMsg && (
              <div className="p-3 bg-red-50 border border-red-200 rounded text-sm text-red-700">
                {errorMsg}
              </div>
            )}

            <div className="flex gap-2">
              <Button variant="outline" onClick={() => setStep('type')}>Zurück</Button>
              <Button
                onClick={handleUploadAndAnalyze}
                disabled={!file}
                className="flex-1 gap-2"
              >
                Hochladen & KI-Analyse starten
              </Button>
            </div>
          </div>
        )}

        {/* SCHRITT 3: Hochladen */}
        {step === 'uploading' && (
          <div className="py-10 text-center space-y-3">
            <Loader2 className="w-10 h-10 mx-auto animate-spin text-primary" />
            <p className="font-medium">Dokument wird hochgeladen...</p>
          </div>
        )}

        {/* SCHRITT 4: KI-Analyse */}
        {step === 'analyzing' && (
          <div className="py-10 text-center space-y-4">
            <Loader2 className="w-10 h-10 mx-auto animate-spin text-primary" />
            <p className="font-semibold">KI analysiert Ihr Dokument...</p>
            <p className="text-sm text-muted-foreground">Extrahiere Personen, KVG/VVG-Produkte und Konditionen</p>
            <p className="text-xs text-muted-foreground">{analysisSeconds}s — dauert ca. 20–45 Sekunden</p>
            {analysisSeconds > 30 && (
              <p className="text-xs text-amber-600 bg-amber-50 border border-amber-200 rounded px-3 py-2 mx-auto max-w-xs">
                Komplexes Dokument wird verarbeitet — bitte warten...
              </p>
            )}
          </div>
        )}

        {/* SCHRITT 5: Review & Bestätigung */}
        {step === 'review' && analysisResult && uploadedDoc && (
          <SmartDocumentReview
            document={uploadedDoc}
            documentType={documentType}
            analysisResult={analysisResult}
            onSuccess={handleSuccess}
            onRestart={handleRestart}
          />
        )}

        {/* SCHRITT Anlage: Direktes Upload ohne KI */}
        {step === 'anlage_form' && (
          <form onSubmit={handleAnlageUpload} className="space-y-4">
            <div className="flex items-center gap-2 p-2 bg-slate-50 border border-slate-200 rounded text-sm text-slate-700">
              <Paperclip className="w-4 h-4" />
              <span>Anlage / Zusatzdokument – keine KI-Verarbeitung</span>
              <button type="button" onClick={() => setStep('type')} className="ml-auto text-xs text-muted-foreground hover:text-foreground">Ändern</button>
            </div>

            {/* Datei-Auswahl */}
            <div
              onClick={() => fileInputRef.current?.click()}
              className={cn(
                'border-2 border-dashed rounded-lg p-6 text-center cursor-pointer transition',
                file ? 'border-emerald-400 bg-emerald-50' : 'border-border hover:bg-muted/30'
              )}
            >
              {file ? (
                <div className="flex items-center justify-center gap-2">
                  <FileText className="w-5 h-5 text-emerald-600" />
                  <span className="text-sm font-medium text-emerald-800">{file.name}</span>
                  <button type="button" onClick={e => { e.stopPropagation(); setFile(null) }} className="ml-2 text-muted-foreground hover:text-foreground"><X className="w-4 h-4" /></button>
                </div>
              ) : (
                <>
                  <Upload className="w-7 h-7 mx-auto mb-2 text-muted-foreground" />
                  <p className="text-sm text-muted-foreground">Datei auswählen oder ablegen (PDF, JPG, PNG, DOCX)</p>
                </>
              )}
            </div>
            <input ref={fileInputRef} type="file" accept=".pdf,.jpg,.jpeg,.png,.doc,.docx" onChange={handleFileSelect} className="hidden" />

            <div>
              <Label>Name</Label>
              <Input value={anlageForm.name} onChange={e => setAnlageForm(p => ({ ...p, name: e.target.value }))} required placeholder="Dokumentname" className="mt-1" />
            </div>

            <div>
              <Label>Kunde (optional)</Label>
              <Select value={anlageForm.customer_id} onValueChange={v => setAnlageForm(p => ({ ...p, customer_id: v, contract_id: '' }))}>
                <SelectTrigger className="mt-1"><SelectValue placeholder="Kunden auswählen..." /></SelectTrigger>
                <SelectContent>
                  {customers.map(c => (
                    <SelectItem key={c.id} value={c.id}>{c.first_name} {c.last_name}{c.is_family_member ? ' (FM)' : ''}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {anlageForm.customer_id && customerContracts.length > 0 && (
              <div>
                <Label>Verknüpfter Vertrag (optional)</Label>
                <Select value={anlageForm.contract_id} onValueChange={v => setAnlageForm(p => ({ ...p, contract_id: v }))}>
                  <SelectTrigger className="mt-1"><SelectValue placeholder="Vertrag auswählen..." /></SelectTrigger>
                  <SelectContent>
                    {customerContracts.map(c => (
                      <SelectItem key={c.id} value={c.id}>{c.insurer} – {c.product || c.insurance_type || ''}{c.policy_number ? ` (${c.policy_number})` : ''}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            <div>
              <Label>Bemerkungen (optional)</Label>
              <Textarea value={anlageForm.notes} onChange={e => setAnlageForm(p => ({ ...p, notes: e.target.value }))} rows={2} className="mt-1" />
            </div>

            {errorMsg && <div className="p-3 bg-red-50 border border-red-200 rounded text-sm text-red-700">{errorMsg}</div>}

            <div className="flex gap-2">
              <Button type="button" variant="outline" onClick={() => setStep('type')}>Zurück</Button>
              <Button type="submit" disabled={anlageUploading || !file} className="flex-1 gap-2">
                {anlageUploading ? <><Loader2 className="w-4 h-4 animate-spin" /> Hochladen...</> : <><Upload className="w-4 h-4" /> Hochladen</>}
              </Button>
            </div>
          </form>
        )}
      </DialogContent>
    </Dialog>
  )
}