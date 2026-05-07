import React, { useState } from 'react'
import { base44 } from '@/api/base44Client'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Progress } from '@/components/ui/progress'
import { AlertCircle, CheckCircle2, AlertTriangle, Upload, X, Bug } from 'lucide-react'
import ImportPreviewDialog from './ImportPreviewDialog'
import FileUploadArea from './FileUploadArea'
import CSVParserDebugger from './CSVParserDebugger'

export default function ImportWizard({ open, onOpenChange, onSuccess }) {
  const [step, setStep] = useState('upload') // upload, preview, importing, summary
  const [file, setFile] = useState(null)
  const [progress, setProgress] = useState(0)
  const [result, setResult] = useState(null)
  const [previewData, setPreviewData] = useState(null)
  const [showPreview, setShowPreview] = useState(false)
  const [error, setError] = useState(null)
  const [debugLog, setDebugLog] = useState({
    fileName: null,
    fileSize: null,
    encoding: 'UTF-8',
    delimiter: ',',
    headerCount: 0,
    dataRowCount: 0,
    parseErrors: [],
    sampleRows: [],
    headers: []
  })
  const [uploadProgress, setUploadProgress] = useState(0)

  const handleFileSelect = (e) => {
    const selectedFile = e.target.files?.[0]
    if (selectedFile) {
      setFile(selectedFile)
      setError(null)
    }
  }

  const detectEncoding = (buffer) => {
    // UTF-8 BOM detection
    if (buffer[0] === 0xEF && buffer[1] === 0xBB && buffer[2] === 0xBF) {
      return 'UTF-8 BOM'
    }
    // UTF-16 BOM detection
    if ((buffer[0] === 0xFF && buffer[1] === 0xFE) || (buffer[0] === 0xFE && buffer[1] === 0xFF)) {
      return 'UTF-16'
    }
    return 'UTF-8'
  }

  const parseCSV = async (file) => {
    const parseErrors = []
    
    try {
      // Read file with proper encoding handling
      let fileContent = await file.text()
      
      // Detect and remove BOM
      const encoding = detectEncoding(new TextEncoder().encode(fileContent))
      if (fileContent.charCodeAt(0) === 0xFEFF) {
        fileContent = fileContent.slice(1)
      }

      const lines = fileContent.split('\n').filter(l => l.trim())
      
      if (lines.length === 0) {
        throw new Error('Datei ist leer')
      }

      // Auto-detect delimiter with tolerance
      let delimiter = ','
      const firstLine = lines[0]
      const semicolonCount = (firstLine.match(/;/g) || []).length
      const commaCount = (firstLine.match(/,/g) || []).length
      const tabCount = (firstLine.match(/\t/g) || []).length

      if (semicolonCount > commaCount) delimiter = ';'
      if (tabCount > semicolonCount && tabCount > commaCount) delimiter = '\t'

      console.log(`[CSV Parser] Detected delimiter: ${delimiter === ',' ? 'comma' : delimiter === ';' ? 'semicolon' : 'tab'}, Encoding: ${encoding}`)

      // Robust CSV line parser
      const parseCSVLine = (line) => {
        const fields = []
        let current = ''
        let inQuotes = false

        for (let i = 0; i < line.length; i++) {
          const char = line[i]
          
          if (char === '"') {
            if (inQuotes && line[i + 1] === '"') {
              current += '"'
              i++
            } else {
              inQuotes = !inQuotes
            }
          } else if (char === delimiter && !inQuotes) {
            fields.push(current.replace(/^"|"$/g, '').trim())
            current = ''
          } else {
            current += char
          }
        }
        fields.push(current.replace(/^"|"$/g, '').trim())
        return fields
      }

      // Parse headers with normalization
      const rawHeaders = parseCSVLine(lines[0])
      const normalizeHeader = (h) => h.toLowerCase().replace(/[\s\-_.]/g, '')
      const headers = rawHeaders.map(normalizeHeader)

      console.log(`[CSV Parser] Headers detected: ${headers.length}`)

      // Field mapping for flexibility
      const fieldMap = {
        'vorname': 'first_name',
        'firstname': 'first_name',
        'first_name': 'first_name',
        'name': 'last_name',
        'nachname': 'last_name',
        'lastname': 'last_name',
        'last_name': 'last_name',
        'email': 'email',
        'emailadresse': 'email',
        'emai': 'email',
        'telefon': 'phone',
        'phone': 'phone',
        'mobile': 'mobile',
        'mobilnummer': 'mobile',
        'strasse': 'street',
        'street': 'street',
        'plz': 'zip_code',
        'zipcode': 'zip_code',
        'zip_code': 'zip_code',
        'ort': 'city',
        'city': 'city',
        'stadt': 'city',
        'notes': 'notes',
        'notizen': 'notes',
      }

      const mappedHeaders = headers.map(h => fieldMap[h] || h)

      // Parse data rows
      const valid_records = []
      const invalid_records = []
      const duplicates = []
      const sampleRows = []

      // Get existing customers once
      console.log(`[CSV Parser] Checking for duplicates...`)
      let existingCustomers = []
      try {
        existingCustomers = await base44.entities.Customer.list('', 1000) || []
      } catch (err) {
        console.warn('[CSV Parser] Could not fetch existing customers:', err.message)
      }
      const existingEmails = new Set(existingCustomers.map(c => c.email?.toLowerCase()).filter(Boolean))

      // Process data rows with error handling
      for (let i = 1; i < lines.length; i++) {
        try {
          const values = parseCSVLine(lines[i])
          
          // Skip empty rows
          if (values.every(v => !v || v === '')) continue

          const record = {}
          mappedHeaders.forEach((mappedHeader, idx) => {
            const value = values[idx]?.trim()
            if (value) {
              record[mappedHeader] = value
            }
          })

          // Validation: require first_name and last_name (or email)
          if (!record.first_name || !record.last_name) {
            if (!record.email) {
              invalid_records.push({
                row: i + 1,
                error: 'Vorname/Nachname oder E-Mail erforderlich'
              })
              continue
            }
          }

          // Check duplicates
          if (record.email && existingEmails.has(record.email.toLowerCase())) {
            duplicates.push({
              row: i + 1,
              name: `${record.first_name || ''} ${record.last_name || ''}`.trim(),
              email: record.email
            })
            continue
          }

          valid_records.push(record)
          if (sampleRows.length < 5) sampleRows.push(record)
        } catch (err) {
          parseErrors.push(`Zeile ${i + 1}: ${err.message}`)
          invalid_records.push({
            row: i + 1,
            error: err.message
          })
        }
      }

      console.log(`[CSV Parser] Results: ${valid_records.length} valid, ${invalid_records.length} invalid, ${duplicates.length} duplicates`)

      // Update debug info
      setDebugLog({
        fileName: file.name,
        fileSize: file.size,
        encoding,
        delimiter,
        headerCount: headers.length,
        dataRowCount: valid_records.length + invalid_records.length,
        parseErrors,
        sampleRows,
        headers: rawHeaders
      })

      return {
        valid_records,
        invalid_records,
        duplicates,
        summary: { total: lines.length - 1 }
      }
    } catch (err) {
      const errorMsg = `CSV Parse Error: ${err.message}`
      console.error(`[CSV Parser] ${errorMsg}`)
      parseErrors.push(errorMsg)
      throw new Error(errorMsg)
    }
  }

  const handlePreview = async () => {
    if (!file) {
      setError('Bitte wählen Sie eine Datei');
      return;
    }

    setUploadProgress(50);
    try {
      console.log(`[ImportWizard] Starting preview for: ${file.name}`);
      const parsed = await parseCSV(file);
      setPreviewData(parsed);
      setShowPreview(true);
      setError(null);
    } catch (err) {
      const errorMsg = err.message || 'Parsing fehlgeschlagen';
      console.error(`[ImportWizard] Preview error: ${errorMsg}`);
      setError(errorMsg);
    }
    setUploadProgress(0);
  };

  const handleImport = async () => {
    if (!file) {
      setError('Bitte wählen Sie eine Datei');
      return;
    }

    setShowPreview(false);
    setStep('importing');
    setProgress(0);

    try {
      setProgress(30);
      console.log('[ImportWizard] Starting file upload...');

      // Upload file
      const uploadRes = await base44.integrations.Core.UploadFile({ file });
      const file_url = uploadRes.file_url;
      console.log('[ImportWizard] Upload complete, file_url:', file_url);

      setProgress(60);

      // Import data with timeout protection
      console.log('[ImportWizard] Starting import function...');
      const importPromise = base44.functions.invoke('importEntityData', {
        entity_name: 'Customer',
        file_url
      });

      // Set a timeout to catch hanging promises
      const timeoutPromise = new Promise((_, reject) =>
        setTimeout(() => reject(new Error('Import timeout - server nicht erreichbar')), 120000)
      );

      const importRes = await Promise.race([importPromise, timeoutPromise]);
      console.log('[ImportWizard] Import complete:', importRes);

      setProgress(100);
      setResult(importRes.data);
      setStep('summary');
      
      // Refresh data after successful import
      setTimeout(() => {
        onSuccess?.();
      }, 2000);
    } catch (err) {
      console.error('[ImportWizard] Error during import:', err);
      setProgress(0);
      setError(err.message || 'Import fehlgeschlagen');
      setStep('upload');
    }
  };

  const closeDialog = () => {
    setStep('upload')
    setFile(null)
    setProgress(0)
    setResult(null)
    setError(null)
    setUploadProgress(0)
    setPreviewData(null)
    setShowPreview(false)
    setDebugLog({
      fileName: null,
      fileSize: null,
      encoding: 'UTF-8',
      delimiter: ',',
      headerCount: 0,
      dataRowCount: 0,
      parseErrors: [],
      sampleRows: [],
      headers: []
    })
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
            <FileUploadArea
              onFileSelect={setFile}
              onError={setError}
              disabled={uploadProgress > 0}
              uploading={uploadProgress > 0}
            />

            {file && (
              <CSVParserDebugger
                fileName={debugLog.fileName}
                fileSize={debugLog.fileSize}
                encoding={debugLog.encoding}
                delimiter={debugLog.delimiter}
                headerCount={debugLog.headerCount}
                dataRowCount={debugLog.dataRowCount}
                parseErrors={debugLog.parseErrors}
                sampleRows={debugLog.sampleRows}
                headers={debugLog.headers}
              />
            )}



            {error && (
              <div className="flex items-start gap-2 p-3 bg-red-50 border border-red-200 rounded-lg">
                <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
                <p className="text-sm text-red-800">{error}</p>
              </div>
            )}

            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={closeDialog} disabled={uploadProgress > 0}>
                Abbrechen
              </Button>
              <Button variant="secondary" onClick={handlePreview} disabled={!file || uploadProgress > 0}>
                📋 Vorschau
              </Button>
              <Button onClick={handleImport} disabled={!file || uploadProgress > 0}>
                Importieren
              </Button>
            </div>
          </div>
        )}

        {/* PREVIEW DIALOG */}
        <ImportPreviewDialog
          open={showPreview}
          onOpenChange={setShowPreview}
          parsedData={previewData}
          onConfirm={handleImport}
          loading={step === 'importing'}
        />

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
          <div className="space-y-4 max-h-[70vh] overflow-y-auto">
            {/* SUCCESS BANNER */}
            {result.summary.successfully_imported > 0 && (
              <div className="flex items-start gap-3 p-4 bg-green-50 border border-green-300 rounded-lg">
                <CheckCircle2 className="w-6 h-6 text-green-600 flex-shrink-0 mt-0.5" />
                <div>
                  <p className="font-semibold text-green-900">✓ Partial Import erfolgreich!</p>
                  <p className="text-sm text-green-800 mt-1">
                    {result.summary.successfully_imported} von {result.summary.total_rows_in_file} Kunden importiert ({result.summary.success_rate}%)
                  </p>
                </div>
              </div>
            )}

            {/* METRICS */}
            <div className="grid grid-cols-2 gap-3">
              <div className="p-3 bg-green-50 border border-green-200 rounded-lg">
                <p className="text-xs text-green-700 font-medium">✓ Importiert</p>
                <p className="text-2xl font-bold text-green-600">{result.summary.successfully_imported}</p>
              </div>
              <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg">
                <p className="text-xs text-blue-700 font-medium">⚠ Duplikate</p>
                <p className="text-2xl font-bold text-blue-600">{result.summary.duplicates_skipped}</p>
              </div>
              {result.summary.failed > 0 && (
                <div className="p-3 bg-red-50 border border-red-200 rounded-lg">
                  <p className="text-xs text-red-700 font-medium">✗ Fehler</p>
                  <p className="text-2xl font-bold text-red-600">{result.summary.failed}</p>
                </div>
              )}
              {result.summary.validation_errors > 0 && (
                <div className="p-3 bg-amber-50 border border-amber-200 rounded-lg">
                  <p className="text-xs text-amber-700 font-medium">⊘ Validierung</p>
                  <p className="text-2xl font-bold text-amber-600">{result.summary.validation_errors}</p>
                </div>
              )}
            </div>

            {/* VALIDATION ERRORS */}
            {result.details.validation_errors?.length > 0 && (
              <div className="p-3 bg-amber-50 border border-amber-200 rounded-lg max-h-48 overflow-y-auto">
                <p className="text-sm font-medium text-amber-900 mb-2">⊘ Validierungsfehler:</p>
                <div className="space-y-1 text-xs text-amber-700">
                  {result.details.validation_errors.slice(0, 20).map((rec, i) => (
                    <div key={i} className="font-mono bg-white p-1 rounded">
                      Zeile {rec.row}: {rec.error}
                    </div>
                  ))}
                  {result.details.validation_errors.length > 20 && (
                    <p className="text-amber-600 italic font-medium mt-2">
                      ...und {result.details.validation_errors.length - 20} weitere
                    </p>
                  )}
                </div>
              </div>
            )}

            {/* ERROR DETAILS */}
            {result.details.failed_rows?.length > 0 && (
              <div className="p-3 bg-red-50 border border-red-200 rounded-lg max-h-48 overflow-y-auto">
                <p className="text-sm font-medium text-red-900 mb-2">✗ Fehlerhafte Zeilen:</p>
                <div className="space-y-1 text-xs text-red-700">
                  {result.details.failed_rows.slice(0, 20).map((rec, i) => (
                    <div key={i} className="font-mono bg-white p-1 rounded">
                      Zeile {rec.row} ({rec.email}): {rec.error}
                    </div>
                  ))}
                  {result.details.failed_rows.length > 20 && (
                    <p className="text-red-600 italic font-medium mt-2">
                      ...und {result.details.failed_rows.length - 20} weitere
                    </p>
                  )}
                </div>
              </div>
            )}

            {/* DUPLICATES */}
            {result.details.duplicates?.length > 0 && (
              <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg max-h-48 overflow-y-auto">
                <p className="text-sm font-medium text-blue-900 mb-2">⚠ Duplikate (übersprungen):</p>
                <div className="space-y-1 text-xs text-blue-700">
                  {result.details.duplicates.slice(0, 20).map((dup, i) => (
                    <div key={i} className="font-mono bg-white p-1 rounded">
                      Zeile {dup.row}: {dup.name} • {dup.email}
                    </div>
                  ))}
                  {result.details.duplicates.length > 20 && (
                    <p className="text-blue-600 italic font-medium mt-2">
                      ...und {result.details.duplicates.length - 20} weitere
                    </p>
                  )}
                </div>
              </div>
            )}

            {/* ACTION BUTTON */}
            <div className="flex justify-end gap-2 pt-4 border-t sticky bottom-0 bg-white">
              <Button onClick={closeDialog} className="bg-green-600 hover:bg-green-700">
                ✓ Kunden ansehen
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}