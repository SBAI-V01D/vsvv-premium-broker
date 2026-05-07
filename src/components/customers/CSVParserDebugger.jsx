import React, { useState } from 'react'
import { ChevronDown, ChevronUp, Bug } from 'lucide-react'
import { Button } from '@/components/ui/button'

export default function CSVParserDebugger({ 
  fileName, 
  fileSize, 
  encoding, 
  delimiter, 
  headerCount,
  dataRowCount,
  parseErrors = [],
  sampleRows = [],
  headers = []
}) {
  const [expanded, setExpanded] = useState(false)

  if (!fileName) return null

  return (
    <div className="border border-slate-200 rounded-lg overflow-hidden bg-slate-50">
      {/* HEADER */}
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center justify-between p-3 hover:bg-slate-100 transition-colors"
      >
        <div className="flex items-center gap-2">
          <Bug className="w-4 h-4 text-slate-600" />
          <span className="text-sm font-medium text-slate-700">Parser Debug Info</span>
          {parseErrors.length > 0 && (
            <span className="text-xs bg-red-100 text-red-700 px-2 py-0.5 rounded-full font-medium">
              {parseErrors.length} Fehler
            </span>
          )}
        </div>
        {expanded ? (
          <ChevronUp className="w-4 h-4 text-slate-600" />
        ) : (
          <ChevronDown className="w-4 h-4 text-slate-600" />
        )}
      </button>

      {/* CONTENT */}
      {expanded && (
        <div className="border-t border-slate-200 bg-white space-y-3 p-3">
          {/* BASIC INFO */}
          <div className="grid grid-cols-3 gap-2 text-xs">
            <div>
              <p className="text-slate-500 font-medium">Dateiname</p>
              <p className="text-slate-700 font-mono">{fileName}</p>
            </div>
            <div>
              <p className="text-slate-500 font-medium">Größe</p>
              <p className="text-slate-700">{(fileSize / 1024).toFixed(1)} KB</p>
            </div>
            <div>
              <p className="text-slate-500 font-medium">Encoding</p>
              <p className="text-slate-700">{encoding || 'UTF-8'}</p>
            </div>
          </div>

          {/* PARSER DETECTION */}
          <div className="grid grid-cols-3 gap-2 text-xs">
            <div>
              <p className="text-slate-500 font-medium">Trennzeichen</p>
              <p className="text-slate-700 font-mono">
                {delimiter === ',' ? 'Komma (,)' : delimiter === ';' ? 'Semikolon (;)' : 'Tab'}
              </p>
            </div>
            <div>
              <p className="text-slate-500 font-medium">Spalten</p>
              <p className="text-slate-700">{headerCount || 0}</p>
            </div>
            <div>
              <p className="text-slate-500 font-medium">Datenzeilen</p>
              <p className="text-slate-700">{dataRowCount || 0}</p>
            </div>
          </div>

          {/* HEADERS */}
          {headers.length > 0 && (
            <div>
              <p className="text-xs text-slate-500 font-medium mb-2">Erkannte Spalten:</p>
              <div className="flex flex-wrap gap-1">
                {headers.map((header, i) => (
                  <span
                    key={i}
                    className="text-xs bg-slate-100 border border-slate-300 text-slate-700 px-2 py-1 rounded font-mono"
                  >
                    {header}
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* SAMPLE ROWS */}
          {sampleRows.length > 0 && (
            <div>
              <p className="text-xs text-slate-500 font-medium mb-2">Beispielzeilen:</p>
              <div className="bg-slate-100 rounded p-2 font-mono text-xs overflow-x-auto">
                {sampleRows.slice(0, 3).map((row, i) => (
                  <div key={i} className="text-slate-700 break-all mb-1">
                    {JSON.stringify(row).substring(0, 100)}...
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* PARSE ERRORS */}
          {parseErrors.length > 0 && (
            <div>
              <p className="text-xs text-red-700 font-medium mb-2">Parser-Fehler:</p>
              <div className="bg-red-50 border border-red-200 rounded p-2 max-h-32 overflow-y-auto">
                {parseErrors.map((error, i) => (
                  <div key={i} className="text-xs text-red-700 font-mono mb-1">
                    {error}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* ACTIONS */}
          <div className="pt-2 border-t border-slate-200 flex justify-end">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setExpanded(false)}
              className="text-xs"
            >
              Schließen
            </Button>
          </div>
        </div>
      )}
    </div>
  )
}