import React, { useState } from 'react'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Label } from '@/components/ui/label'
import { Upload, Loader2, CheckCircle2, AlertTriangle, Brain, FileText, User, Users } from 'lucide-react'
import { base44 } from '@/api/base44Client'

// ── Confidence Badge ─────────────────────────────────────────────────────────
function ConfidenceBadge({ score }) {
  const color = score >= 0.8 ? 'bg-green-100 text-green-700 border-green-200' 
    : score >= 0.6 ? 'bg-amber-100 text-amber-700 border-amber-200' 
    : 'bg-red-100 text-red-700 border-red-200'
  
  const label = score >= 0.8 ? 'Hoch' : score >= 0.6 ? 'Mittel' : 'Niedrig'
  
  return (
    <Badge className={color} variant="outline">
      {label} ({Math.round(score * 100)}%)
    </Badge>
  )
}

// ── Smart Question Component ───────────────────────────────────────────────
function SmartQuestion({ question, options, value, onChange }) {
  return (
    <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg space-y-3">
      <div className="flex items-start gap-2">
        <Brain className="w-5 h-5 text-blue-600 flex-shrink-0 mt-0.5" />
        <div>
          <p className="font-semibold text-blue-900 text-sm">{question}</p>
          <div className="flex gap-2 mt-2 flex-wrap">
            {options.map((opt, i) => (
              <button
                key={i}
                type="button"
                onClick={() => onChange(opt.value)}
                className={`px-4 py-2 rounded-lg text-sm font-medium border-2 transition-all ${
                  value === opt.value 
                    ? 'bg-blue-600 text-white border-blue-600' 
                    : 'bg-white border-blue-200 text-blue-800 hover:border-blue-400'
                }`}
              >
                {opt.label}
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}

// ── Main Component ──────────────────────────────────────────────────────────
export default function UniversalDocumentIntake({ open, onClose, customers = [], onProcessed }) {
  const [step, setStep] = useState('upload') // upload | analyzing | validation | success
  const [uploading, setUploading] = useState(false)
  const [analyzing, setAnalyzing] = useState(false)
  const [error, setError] = useState(null)
  const [fileUrl, setFileUrl] = useState(null)
  const [fileName, setFileName] = useState('')
  const [analysisResult, setAnalysisResult] = useState(null)
  const [validationAnswers, setValidationAnswers] = useState({})
  
  // Reset state when dialog closes
  const handleClose = () => {
    setStep('upload')
    setError(null)
    setFileUrl(null)
    setFileName('')
    setAnalysisResult(null)
    setValidationAnswers({})
    onClose?.()
  }
  
  // ── Step 1: Upload ─────────────────────────────────────────────────────
  const handleFileUpload = async (e) => {
    const file = e.target.files?.[0]
    if (!file) return
    e.target.value = ''
    
    setError(null)
    setUploading(true)
    setFileName(file.name)
    
    try {
      const { file_url } = await base44.integrations.Core.UploadFile({ file })
      setFileUrl(file_url)
      setUploading(false)
      setAnalyzing(true)
      
      // Auto-detect document type and extract
      const res = await base44.functions.invoke('extractPolicyData', { 
        file_url, 
        file_name: file.name 
      })
      
      setAnalyzing(false)
      setAnalysisResult(res.data)
      
      // Check if validation is needed
      const needsValidation = res.data?.extractedData?.requires_validation || false
      const validationQuestions = res.data?.extractedData?.validation_questions || []
      
      if (needsValidation && validationQuestions.length > 0) {
        setStep('validation')
      } else {
        // Auto-proceed to creation
        setStep('success')
      }
    } catch (err) {
      setAnalyzing(false)
      setError(`Fehler: ${err.message || 'Unbekannter Fehler'}`)
    }
  }
  
  // ── Step 2: Validation (only if needed) ───────────────────────────────
  const handleValidationComplete = () => {
    setStep('success')
  }
  
  // ── Render ────────────────────────────────────────────────────────────
  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Brain className="w-5 h-5 text-primary" />
            Intelligenter Dokumenten-Intake
          </DialogTitle>
        </DialogHeader>
        
        {error && (
          <div className="flex items-center gap-2 p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">
            <AlertTriangle className="w-4 h-4" /> {error}
          </div>
        )}
        
        {/* STEP 1: Upload */}
        {step === 'upload' && (
          <div className="py-8 flex flex-col items-center gap-4">
            {uploading || analyzing ? (
              <div className="text-center space-y-3">
                <Loader2 className="w-12 h-12 animate-spin text-primary mx-auto" />
                <p className="font-semibold">
                  {uploading ? 'Datei wird hochgeladen...' : 'KI analysiert Dokument...'}
                </p>
                {analyzing && (
                  <p className="text-sm text-muted-foreground">
                    Erkennt Dokumenttyp, Personen, Rollen und Vertragsdaten
                  </p>
                )}
              </div>
            ) : (
              <>
                <div className="w-20 h-20 rounded-2xl bg-primary/10 flex items-center justify-center">
                  <Upload className="w-10 h-10 text-primary" />
                </div>
                <div className="text-center">
                  <p className="font-semibold text-lg">Dokument hochladen</p>
                  <p className="text-sm text-muted-foreground mt-1">
                    Police, Offerte, Änderung oder Schaden – KI erkennt automatisch
                  </p>
                </div>
                <Label htmlFor="universal-upload" className="cursor-pointer">
                  <div className="px-6 py-3 rounded-lg bg-primary text-primary-foreground font-medium text-sm hover:bg-primary/90 transition-colors">
                    Datei auswählen
                  </div>
                </Label>
                <input 
                  id="universal-upload" 
                  type="file" 
                  accept=".pdf,.png,.jpg,.jpeg" 
                  className="hidden" 
                  onChange={handleFileUpload} 
                />
                <p className="text-xs text-muted-foreground">PDF, PNG, JPG</p>
              </>
            )}
          </div>
        )}
        
        {/* STEP 2: Validation (only if KI has questions) */}
        {step === 'validation' && analysisResult && (
          <div className="space-y-4 py-2">
            <div className="p-4 bg-green-50 border border-green-200 rounded-lg">
              <div className="flex items-start gap-3">
                <CheckCircle2 className="w-5 h-5 text-green-600 flex-shrink-0 mt-0.5" />
                <div>
                  <p className="font-semibold text-green-900 text-sm">Dokument analysiert</p>
                  <div className="mt-2 space-y-1 text-xs text-green-800">
                    <p>✓ Dokumenttyp: <strong>{analysisResult.extractedData?.document_type || 'Unbekannt'}</strong></p>
                    <p>✓ Versicherung: <strong>{analysisResult.extractedData?.insurer || 'Nicht erkannt'}</strong></p>
                    {analysisResult.extractedData?.confidence_score && (
                      <div className="flex items-center gap-2 mt-1">
                        <span>Konfidenz:</span>
                        <ConfidenceBadge score={analysisResult.extractedData.confidence_score} />
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>
            
            {/* Dynamic validation questions */}
            {analysisResult.extractedData?.validation_questions?.map((q, i) => (
              <SmartQuestion
                key={i}
                question={q.question}
                options={q.options}
                value={validationAnswers[q.field]}
                onChange={(val) => setValidationAnswers(prev => ({ ...prev, [q.field]: val }))}
              />
            ))}
            
            <div className="flex justify-between pt-4">
              <Button variant="outline" onClick={() => { setStep('upload'); setAnalysisResult(null); }}>Zurück</Button>
              <Button onClick={handleValidationComplete}>
                Weiter <CheckCircle2 className="w-4 h-4 ml-2" />
              </Button>
            </div>
          </div>
        )}
        
        {/* STEP 3: Success */}
        {step === 'success' && (
          <div className="flex flex-col items-center gap-4 py-10 text-center">
            <CheckCircle2 className="w-16 h-16 text-green-500" />
            <div>
              <p className="text-xl font-bold text-green-700">Dokument verarbeitet!</p>
              <p className="text-sm text-muted-foreground mt-1">
                {analysisResult?.extractedData?.document_type || 'Dokument'} wurde erfolgreich analysiert und gespeichert.
              </p>
            </div>
            <Button onClick={handleClose}>Schliessen</Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}