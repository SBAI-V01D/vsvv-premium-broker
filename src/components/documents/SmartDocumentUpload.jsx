import React, { useState, useRef } from 'react'
import { useMutation } from '@tanstack/react-query'
import { base44 } from '@/api/base44Client'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { AlertCircle, Upload, Loader2, CheckCircle2 } from 'lucide-react'
import SmartDocumentSuggestions from './SmartDocumentSuggestions'

export default function SmartDocumentUpload({ open, onOpenChange, onSuccess }) {
  const fileInputRef = useRef(null)
  const [file, setFile] = useState(null)
  const [uploadStep, setUploadStep] = useState('select') // select | uploading | analyzing | suggestions
  const [uploadedDoc, setUploadedDoc] = useState(null)
  const [insights, setInsights] = useState(null)

  // Upload PDF
  const uploadMutation = useMutation({
    mutationFn: async (file) => {
      const { file_url } = await base44.integrations.Core.UploadFile({ file })
      return file_url
    },
  })

  // Analyse durchführen
  const analysisMutation = useMutation({
    mutationFn: async ({ file_url, document_id }) => {
      const res = await base44.functions.invoke('smartDocumentAnalysis', {
        file_url,
        document_id,
      })
      return res.data
    },
  })

  const handleFileSelect = (e) => {
    const selectedFile = e.target.files?.[0]
    if (selectedFile) setFile(selectedFile)
  }

  const handleUpload = async () => {
    if (!file) return
    
    try {
      setUploadStep('uploading')
      
      // 1. Datei hochladen
      const fileUrl = await uploadMutation.mutateAsync(file)
      
      // 2. Document-Eintrag erstellen
      const doc = await base44.entities.Document.create({
        name: file.name,
        file_url: fileUrl,
        category: 'contract',
        processing_stage: 'uploaded',
        classification_status: 'ausstehend',
      })
      setUploadedDoc(doc)
      
      // 3. Analyse starten
      setUploadStep('analyzing')
      const analysisResult = await analysisMutation.mutateAsync({
        file_url: fileUrl,
        document_id: doc.id,
      })
      
      setInsights(analysisResult.insights)
      setUploadStep('suggestions')
    } catch (error) {
      console.error('Upload/Analysis error:', error)
      setUploadStep('select')
    }
  }

  const handleClose = () => {
    setFile(null)
    setUploadStep('select')
    setUploadedDoc(null)
    setInsights(null)
    onOpenChange(false)
  }

  const handleSuccess = () => {
    handleClose()
    onSuccess?.()
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Intelligenter Dokumenten-Upload</DialogTitle>
        </DialogHeader>

        {uploadStep === 'select' && (
          <div className="space-y-4">
            <div
              onClick={() => fileInputRef.current?.click()}
              className="border-2 border-dashed border-border rounded-lg p-8 text-center cursor-pointer hover:bg-muted/30 transition"
            >
              <Upload className="w-8 h-8 mx-auto mb-2 text-muted-foreground" />
              <p className="font-medium">PDF hochladen</p>
              <p className="text-sm text-muted-foreground">Antrag, Police oder Vertragsdokument</p>
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
                <button
                  onClick={() => setFile(null)}
                  className="text-xs text-muted-foreground hover:text-foreground"
                >
                  Ändern
                </button>
              </div>
            )}

            <div className="flex gap-2">
              <Button variant="outline" onClick={() => onOpenChange(false)}>
                Abbrechen
              </Button>
              <Button
                onClick={handleUpload}
                disabled={!file || uploadMutation.isPending}
                className="flex-1 gap-2"
              >
                {uploadMutation.isPending && <Loader2 className="w-4 h-4 animate-spin" />}
                {file ? 'Hochladen & Analysieren' : 'Datei wählen'}
              </Button>
            </div>
          </div>
        )}

        {uploadStep === 'uploading' && (
          <div className="py-8 text-center space-y-3">
            <Loader2 className="w-8 h-8 mx-auto animate-spin text-primary" />
            <p className="font-medium">Dokument wird hochgeladen...</p>
          </div>
        )}

        {uploadStep === 'analyzing' && (
          <div className="py-8 text-center space-y-3">
            <Loader2 className="w-8 h-8 mx-auto animate-spin text-primary" />
            <p className="font-medium">KI-Analyse läuft...</p>
            <p className="text-sm text-muted-foreground">Wird 15-30 Sekunden dauern</p>
          </div>
        )}

        {uploadStep === 'suggestions' && insights && (
          <SmartDocumentSuggestions
            document={uploadedDoc}
            insights={insights}
            onSuccess={handleSuccess}
            onEdit={() => setUploadStep('select')}
          />
        )}
      </DialogContent>
    </Dialog>
  )
}