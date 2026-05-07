import React, { useState } from 'react'
import { base44 } from '@/api/base44Client'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Progress } from '@/components/ui/progress'
import { AlertCircle, CheckCircle2, AlertTriangle, Upload, X } from 'lucide-react'

export default function ImportWizard({ open, onOpenChange, onSuccess }) {
  const [step, setStep] = useState('upload') // upload, preview, importing, summary
  const [file, setFile] = useState(null)
  const [progress, setProgress] = useState(0)
  const [result, setResult] = useState(null)
  const [error, setError] = useState(null)

  const handleFileSelect = (e) => {
    const selectedFile = e.target.files?.[0]
    if (selectedFile) {
      setFile(selectedFile)
      setError(null)
    }
  }

  const handleImport = async () => {
    if (!file) {
      setError('Bitte wählen Sie eine Datei')
      return
    }

    setStep('importing')
    setProgress(0)

    try {
      setProgress(30)

      // Upload file
      const uploadRes = await base44.integrations.Core.UploadFile({ file })
      const file_url = uploadRes.file_url

      setProgress(60)

      // Import data
      const importRes = await base44.functions.invoke('importEntityData', {
        entity_name: 'Customer',
        file_url
      })

      setProgress(100)
      setResult(importRes.data)
      setStep('summary')
      
      // Refresh data after successful import
      setTimeout(() => {
        onSuccess?.()
      }, 2000)
    } catch (err) {
      setError(err.message || 'Import fehlgeschlagen')
      setStep('upload')
    }
  }

  const closeDialog = () => {
    setStep('upload')
    setFile(null)
    setProgress(0)
    setResult(null)
    setError(null)
    onOpenChange(false)
  }

  return (
    <Dialog open={open} onOpenChange={closeDialog}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Kunden importieren</DialogTitle>
        </DialogHeader>

        {step === 'upload' && (
          <div className="space-y-4">
            <div className="border-2 border-dashed border-border rounded-lg p-8 text-center hover:bg-muted/50 transition-colors">
              <Upload className="w-12 h-12 mx-auto mb-3 text-muted-foreground" />
              <label className="cursor-pointer">
                <p className="text-sm font-medium mb-1">CSV- oder Excel-Datei auswählen</p>
                <p className="text-xs text-muted-foreground mb-3">oder hier ablegen</p>
                <input
                  type="file"
                  accept=".csv,.xlsx,.xls"
                  onChange={handleFileSelect}
                  className="hidden"
                />
                <Button variant="outline" size="sm">
                  Datei auswählen
                </Button>
              </label>
            </div>

            {file && (
              <div className="flex items-center gap-3 p-3 bg-muted rounded-lg">
                <CheckCircle2 className="w-5 h-5 text-green-600 flex-shrink-0" />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate">{file.name}</p>
                  <p className="text-xs text-muted-foreground">{(file.size / 1024).toFixed(1)} KB</p>
                </div>
                <button
                  onClick={() => setFile(null)}
                  className="text-muted-foreground hover:text-foreground"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            )}

            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
              <p className="text-sm font-semibold text-blue-900 mb-2">📋 Unterstützte Spalten:</p>
              <div className="grid grid-cols-2 gap-2 text-xs text-blue-800">
                <div>
                  <span className="font-mono bg-blue-100 px-2 py-1 rounded">first_name / Vorname</span>
                </div>
                <div>
                  <span className="font-mono bg-blue-100 px-2 py-1 rounded">last_name / Nachname</span>
                </div>
                <div>
                  <span className="font-mono bg-blue-100 px-2 py-1 rounded">email / E-Mail</span>
                </div>
                <div>
                  <span className="font-mono bg-blue-100 px-2 py-1 rounded">phone / Telefon</span>
                </div>
                <div>
                  <span className="font-mono bg-blue-100 px-2 py-1 rounded">mobile / Mobilnummer</span>
                </div>
                <div>
                  <span className="font-mono bg-blue-100 px-2 py-1 rounded">city / Ort</span>
                </div>
              </div>
              <p className="text-xs text-blue-700 mt-2">• CSV-Format wird automatisch erkannt (Komma, Semikolon, Tab)</p>
              <p className="text-xs text-blue-700">• UTF-8 und UTF-8 BOM werden unterstützt</p>
              <p className="text-xs text-blue-700">• Duplikate werden automatisch erkannt</p>
            </div>

            {error && (
              <div className="flex items-start gap-2 p-3 bg-red-50 border border-red-200 rounded-lg">
                <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
                <p className="text-sm text-red-800">{error}</p>
              </div>
            )}

            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={closeDialog}>
                Abbrechen
              </Button>
              <Button onClick={handleImport} disabled={!file}>
                Importieren
              </Button>
            </div>
          </div>
        )}

        {step === 'importing' && (
          <div className="space-y-4 py-8">
            <div className="text-center">
              <p className="font-medium mb-3">Import läuft...</p>
              <Progress value={progress} className="mb-2" />
              <p className="text-sm text-muted-foreground">{progress}%</p>
            </div>
          </div>
        )}

        {step === 'summary' && result && (
          <div className="space-y-4">
            {/* SUCCESS BANNER */}
            {result.summary.successful > 0 && (
              <div className="flex items-center gap-3 p-4 bg-green-50 border border-green-300 rounded-lg">
                <CheckCircle2 className="w-6 h-6 text-green-600 flex-shrink-0" />
                <div>
                  <p className="font-semibold text-green-900">Import erfolgreich!</p>
                  <p className="text-sm text-green-800 mt-1">
                    {result.summary.successful} Kunde{result.summary.successful !== 1 ? 'n' : ''} sind jetzt im System verfügbar.
                  </p>
                </div>
              </div>
            )}

            {/* METRICS */}
            <div className="grid grid-cols-2 gap-3">
              <div className="p-3 bg-green-50 border border-green-200 rounded-lg">
                <p className="text-xs text-green-700 font-medium">✓ Importiert</p>
                <p className="text-2xl font-bold text-green-600">{result.summary.successful}</p>
              </div>
              <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg">
                <p className="text-xs text-blue-700 font-medium">⚠ Duplikate</p>
                <p className="text-2xl font-bold text-blue-600">{result.summary.duplicates}</p>
              </div>
              {result.summary.failed > 0 && (
                <div className="p-3 bg-red-50 border border-red-200 rounded-lg">
                  <p className="text-xs text-red-700 font-medium">✗ Fehler</p>
                  <p className="text-2xl font-bold text-red-600">{result.summary.failed}</p>
                </div>
              )}
              {result.summary.skipped > 0 && (
                <div className="p-3 bg-amber-50 border border-amber-200 rounded-lg">
                  <p className="text-xs text-amber-700 font-medium">⊘ Übersprungen</p>
                  <p className="text-2xl font-bold text-amber-600">{result.summary.skipped}</p>
                </div>
              )}
            </div>

            {/* ERROR DETAILS */}
            {result.details.failed_records.length > 0 && (
              <div className="p-3 bg-red-50 border border-red-200 rounded-lg max-h-40 overflow-y-auto">
                <p className="text-sm font-medium text-red-900 mb-2">✗ Fehlerhafte Zeilen:</p>
                <div className="space-y-1 text-xs text-red-700">
                  {result.details.failed_records.map((rec, i) => (
                    <p key={i}>Zeile {rec.row}: {rec.error}</p>
                  ))}
                </div>
              </div>
            )}

            {/* DUPLICATES */}
            {result.details.duplicates.length > 0 && (
              <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg max-h-40 overflow-y-auto">
                <p className="text-sm font-medium text-blue-900 mb-2">⚠ Erkannte Duplikate:</p>
                <div className="space-y-1 text-xs text-blue-700">
                  {result.details.duplicates.map((dup, i) => (
                    <p key={i}>Zeile {dup.row}: {dup.name} ({dup.email}) — bereits im System</p>
                  ))}
                </div>
              </div>
            )}

            {/* ACTION BUTTON */}
            <div className="flex justify-end gap-2 pt-2 border-t">
              <Button onClick={closeDialog} className="bg-green-600 hover:bg-green-700">
                ✓ Importierte Kunden ansehen
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}