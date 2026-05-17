import React, { useState, useRef } from 'react'
import { useMutation } from '@tanstack/react-query'
import { base44 } from '@/api/base44Client'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Upload, Loader2, FileText, FileEdit, RefreshCw } from 'lucide-react'
import SmartDocumentReview from './SmartDocumentReview'
import { cn } from '@/lib/utils'

const DOCUMENT_TYPES = [
  {
    key: 'neuantrag',
    label: 'Neuantrag',
    description: 'Neuer Versicherungsantrag',
    icon: FileText,
    color: 'border-blue-300 bg-blue-50 hover:bg-blue-100 text-blue-800',
  },
  {
    key: 'aenderungsantrag',
    label: 'Änderungsantrag',
    description: 'Mutation / Anpassung bestehender Vertrag',
    icon: FileEdit,
    color: 'border-amber-300 bg-amber-50 hover:bg-amber-100 text-amber-800',
  },
  {
    key: 'erneuerungsantrag',
    label: 'Erneuerungsantrag',
    description: 'Verlängerung / Erneuerung',
    icon: RefreshCw,
    color: 'border-green-300 bg-green-50 hover:bg-green-100 text-green-800',
  },
]

export default function SmartDocumentUpload({ open, onOpenChange, onSuccess }) {
  const fileInputRef = useRef(null)
  const [file, setFile] = useState(null)
  const [documentType, setDocumentType] = useState(null)
  const [step, setStep] = useState('type') // type | upload | uploading | analyzing | review
  const [uploadedDoc, setUploadedDoc] = useState(null)
  const [analysisResult, setAnalysisResult] = useState(null)
  const [errorMsg, setErrorMsg] = useState(null)

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
    if (f) { setFile(f); setErrorMsg(null) }
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
      const result = await analysisMutation.mutateAsync({
        file_url: fileUrl,
        document_type: documentType,
      })

      if (!result?.success) {
        throw new Error(result?.error || 'Analyse fehlgeschlagen')
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
              {DOCUMENT_TYPES.map(({ key, label, description, icon: Icon, color }) => (
                <button
                  key={key}
                  onClick={() => { setDocumentType(key); setStep('upload') }}
                  className={cn('w-full text-left p-4 rounded-lg border-2 transition flex items-center gap-3', color)}
                >
                  <Icon className="w-5 h-5 flex-shrink-0" />
                  <div>
                    <p className="font-semibold">{label}</p>
                    <p className="text-xs opacity-75">{description}</p>
                  </div>
                </button>
              ))}
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
            <p className="text-sm text-muted-foreground">Extrahiere Kundendaten, Versicherungsinfos und Konditionen</p>
            <p className="text-xs text-muted-foreground">Dauert ca. 15–30 Sekunden</p>
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
      </DialogContent>
    </Dialog>
  )
}