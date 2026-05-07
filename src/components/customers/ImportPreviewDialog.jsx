import React, { useState } from 'react'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { AlertCircle, CheckCircle2, AlertTriangle } from 'lucide-react'

export default function ImportPreviewDialog({ open, onOpenChange, parsedData, onConfirm, loading }) {
  const [showDetails, setShowDetails] = useState(false)

  if (!parsedData) return null

  const { valid_records = [], invalid_records = [], duplicates = [], summary = {} } = parsedData

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>📋 Import-Vorschau</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {/* SUMMARY STATS */}
          <div className="grid grid-cols-2 gap-3">
            <div className="p-3 bg-green-50 border border-green-200 rounded-lg">
              <p className="text-xs text-green-700 font-medium">✓ Gültige Kunden</p>
              <p className="text-2xl font-bold text-green-600">{valid_records.length}</p>
            </div>
            <div className="p-3 bg-red-50 border border-red-200 rounded-lg">
              <p className="text-xs text-red-700 font-medium">✗ Fehlerhafte Zeilen</p>
              <p className="text-2xl font-bold text-red-600">{invalid_records.length}</p>
            </div>
            <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg">
              <p className="text-xs text-blue-700 font-medium">⚠ Duplikate</p>
              <p className="text-2xl font-bold text-blue-600">{duplicates.length}</p>
            </div>
            <div className="p-3 bg-amber-50 border border-amber-200 rounded-lg">
              <p className="text-xs text-amber-700 font-medium">📊 Gesamt gültig</p>
              <p className="text-2xl font-bold text-amber-600">
                {((valid_records.length / (valid_records.length + invalid_records.length)) * 100 || 0).toFixed(0)}%
              </p>
            </div>
          </div>

          {/* SAMPLE VALID RECORDS */}
          {valid_records.length > 0 && (
            <div className="p-3 bg-green-50 border border-green-200 rounded-lg">
              <button
                onClick={() => setShowDetails(!showDetails)}
                className="flex items-center gap-2 w-full text-left text-sm font-medium text-green-900 hover:bg-green-100 p-2 rounded transition-colors"
              >
                <CheckCircle2 className="w-4 h-4" />
                Beispiele gültiger Kunden ({valid_records.length})
              </button>
              {showDetails && (
                <div className="mt-2 space-y-2 border-t border-green-200 pt-2">
                  {valid_records.slice(0, 3).map((record, i) => (
                    <div key={i} className="text-xs text-green-800 bg-white p-2 rounded">
                      <p className="font-medium">
                        {record.first_name} {record.last_name}
                      </p>
                      <p className="text-green-700">{record.email}</p>
                    </div>
                  ))}
                  {valid_records.length > 3 && (
                    <p className="text-xs text-green-700 italic">
                      ...und {valid_records.length - 3} weitere
                    </p>
                  )}
                </div>
              )}
            </div>
          )}

          {/* VALIDATION ERRORS */}
          {invalid_records.length > 0 && (
            <div className="p-3 bg-red-50 border border-red-200 rounded-lg max-h-32 overflow-y-auto">
              <p className="text-sm font-medium text-red-900 mb-2">✗ Fehlerhafte Zeilen:</p>
              <div className="space-y-1 text-xs text-red-700">
                {invalid_records.slice(0, 5).map((record, i) => (
                  <p key={i}>
                    Zeile {record.row}: {record.error}
                  </p>
                ))}
                {invalid_records.length > 5 && (
                  <p className="text-red-600 italic">...und {invalid_records.length - 5} weitere</p>
                )}
              </div>
            </div>
          )}

          {/* DUPLICATES */}
          {duplicates.length > 0 && (
            <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg max-h-32 overflow-y-auto">
              <p className="text-sm font-medium text-blue-900 mb-2">⚠ Duplikate (überspringen):</p>
              <div className="space-y-1 text-xs text-blue-700">
                {duplicates.slice(0, 5).map((dup, i) => (
                  <p key={i}>
                    Zeile {dup.row}: {dup.name} ({dup.email})
                  </p>
                ))}
                {duplicates.length > 5 && (
                  <p className="text-blue-600 italic">...und {duplicates.length - 5} weitere</p>
                )}
              </div>
            </div>
          )}

          {/* WARNING */}
          <div className="flex items-start gap-2 p-3 bg-amber-50 border border-amber-200 rounded-lg">
            <AlertTriangle className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" />
            <div className="text-sm text-amber-800">
              <p className="font-medium">Aktion:</p>
              <p>{valid_records.length} Kunden werden importiert.</p>
              <p>{duplicates.length} Duplikate werden übersprungen.</p>
              {invalid_records.length > 0 && (
                <p className="text-amber-700 font-medium mt-1">
                  ⚠ {invalid_records.length} fehlerhafte Zeilen können nicht importiert werden.
                </p>
              )}
            </div>
          </div>

          {/* ACTIONS */}
          <div className="flex gap-2 justify-end pt-2 border-t">
            <Button variant="outline" onClick={() => onOpenChange(false)} disabled={loading}>
              Abbrechen
            </Button>
            <Button
              onClick={() => onConfirm()}
              disabled={loading || valid_records.length === 0}
              className="bg-green-600 hover:bg-green-700"
            >
              {loading ? 'Importiert...' : `✓ ${valid_records.length} Kunden importieren`}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}