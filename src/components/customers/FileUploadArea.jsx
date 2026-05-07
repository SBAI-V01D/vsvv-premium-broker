import React, { useState, useRef } from 'react'
import { Upload, AlertCircle, CheckCircle2, Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'

export default function FileUploadArea({ 
  onFileSelect, 
  onError, 
  disabled = false,
  uploading = false 
}) {
  const [dragOver, setDragOver] = useState(false)
  const [selectedFile, setSelectedFile] = useState(null)
  const [validationError, setValidationError] = useState(null)
  const fileInputRef = useRef(null)

  const ACCEPTED_TYPES = [
    'text/csv',
    'application/csv',
    'application/vnd.ms-excel',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'text/plain',
  ]

  const ACCEPTED_EXTENSIONS = ['.csv', '.xlsx', '.xls', '.tsv', '.txt']

  const validateFile = (file) => {
    // Check size (max 50MB for enterprise)
    if (file.size > 50 * 1024 * 1024) {
      const error = `Datei zu groß (${(file.size / 1024 / 1024).toFixed(1)}MB). Maximum: 50MB`
      setValidationError(error)
      onError?.(error)
      return false
    }

    // Check extension
    const ext = `.${file.name.split('.').pop()?.toLowerCase()}`
    const hasValidExt = ACCEPTED_EXTENSIONS.includes(ext)

    if (!hasValidExt) {
      const error = `Dateityp nicht unterstützt. Bitte verwenden Sie: CSV, XLSX, XLS oder TSV`
      setValidationError(error)
      onError?.(error)
      return false
    }

    // MIME type check is tolerant — we'll try to parse anyway
    const hasValidMime = ACCEPTED_TYPES.includes(file.type) || file.type === ''
    console.log(`[FileUpload] File: ${file.name}, MIME: ${file.type}, Ext: ${ext}, Valid: ${hasValidMime || 'tolerant mode'}`)

    setValidationError(null)
    return true
  }

  const handleFileSelection = (file) => {
    if (!validateFile(file)) {
      return
    }

    setSelectedFile(file)
    onFileSelect?.(file)
  }

  const handleInputChange = (e) => {
    const file = e.target.files?.[0]
    if (file) handleFileSelection(file)
  }

  const handleDragOver = (e) => {
    e.preventDefault()
    e.stopPropagation()
    setDragOver(true)
  }

  const handleDragLeave = (e) => {
    e.preventDefault()
    e.stopPropagation()
    setDragOver(false)
  }

  const handleDrop = (e) => {
    e.preventDefault()
    e.stopPropagation()
    setDragOver(false)

    const file = e.dataTransfer?.files?.[0]
    if (file) handleFileSelection(file)
  }

  const handleClear = () => {
    setSelectedFile(null)
    setValidationError(null)
    if (fileInputRef.current) {
      fileInputRef.current.value = ''
    }
  }

  return (
    <div className="space-y-3">
      {/* DRAG & DROP AREA */}
      <div
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        onClick={() => !disabled && !uploading && fileInputRef.current?.click()}
        className={`
          relative border-2 border-dashed rounded-lg p-8 text-center
          transition-all cursor-pointer
          ${dragOver 
            ? 'border-primary bg-primary/5' 
            : 'border-border hover:border-primary/50 hover:bg-muted/30'
          }
          ${disabled || uploading ? 'opacity-50 cursor-not-allowed' : ''}
        `}
      >
        <input
          ref={fileInputRef}
          type="file"
          accept=".csv,.xlsx,.xls,.tsv,.txt"
          onChange={handleInputChange}
          disabled={disabled || uploading}
          className="hidden"
        />

        {!selectedFile ? (
          <>
            <Upload className="w-12 h-12 mx-auto mb-3 text-muted-foreground" />
            <p className="text-sm font-medium mb-1">CSV- oder Excel-Datei auswählen</p>
            <p className="text-xs text-muted-foreground mb-3">oder hier ablegen</p>
            <Button 
              variant="outline" 
              size="sm" 
              disabled={disabled || uploading}
              onClick={(e) => {
                e.stopPropagation()
                fileInputRef.current?.click()
              }}
            >
              Datei auswählen
            </Button>
          </>
        ) : (
          <>
            {uploading ? (
              <>
                <Loader2 className="w-8 h-8 mx-auto mb-2 text-primary animate-spin" />
                <p className="text-sm font-medium text-primary">Datei wird hochgeladen...</p>
              </>
            ) : (
              <>
                <CheckCircle2 className="w-8 h-8 mx-auto mb-2 text-green-600" />
                <p className="text-sm font-medium text-foreground">{selectedFile.name}</p>
                <p className="text-xs text-muted-foreground mt-1">
                  {(selectedFile.size / 1024).toFixed(1)} KB
                </p>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={(e) => {
                    e.stopPropagation()
                    handleClear()
                  }}
                  className="mt-2"
                  disabled={uploading}
                >
                  Andere Datei
                </Button>
              </>
            )}
          </>
        )}
      </div>

      {/* VALIDATION ERROR */}
      {validationError && (
        <div className="flex items-start gap-2 p-3 bg-red-50 border border-red-200 rounded-lg">
          <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
          <div className="text-sm text-red-800">
            <p className="font-medium">Datei konnte nicht akzeptiert werden:</p>
            <p className="mt-1">{validationError}</p>
            <p className="text-xs mt-2 text-red-700 font-medium">
              Unterstützte Formate: CSV, XLSX, XLS, TSV (max. 50MB)
            </p>
          </div>
        </div>
      )}

      {/* INFO BOX */}
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
        <p className="text-sm font-semibold text-blue-900 mb-2">📋 Dateiformat-Anforderungen:</p>
        <ul className="text-xs text-blue-800 space-y-1">
          <li>✓ CSV-Dateien (Komma, Semikolon oder Tab getrennt)</li>
          <li>✓ Excel XLSX / XLS Dateien</li>
          <li>✓ UTF-8 Encoding (auch mit BOM)</li>
          <li>✓ Deutsche und Schweizer Excel-Exports</li>
          <li>✓ Bis zu 50 MB Dateigröße</li>
        </ul>
      </div>
    </div>
  )
}