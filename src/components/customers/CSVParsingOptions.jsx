import React, { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { AlertCircle } from 'lucide-react'

export default function CSVParsingOptions({ 
  onRetryWithOptions, 
  disabled = false 
}) {
  const [delimiter, setDelimiter] = useState('auto')
  const [encoding, setEncoding] = useState('utf-8')

  const handleRetry = () => {
    onRetryWithOptions?.({ delimiter, encoding })
  }

  return (
    <div className="border border-amber-200 rounded-lg bg-amber-50 p-4 space-y-4">
      <div className="flex items-start gap-2">
        <AlertCircle className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" />
        <div className="text-sm text-amber-800">
          <p className="font-semibold mb-1">CSV-Parsing-Optionen</p>
          <p>Falls die automatische Erkennung fehlschlägt, können Sie die Einstellungen manuell anpassen:</p>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="text-xs font-medium text-amber-900 block mb-1">Trennzeichen</label>
          <Select value={delimiter} onValueChange={setDelimiter} disabled={disabled}>
            <SelectTrigger className="bg-white"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="auto">Automatisch erkennen</SelectItem>
              <SelectItem value="comma">Komma (,)</SelectItem>
              <SelectItem value="semicolon">Semikolon (;)</SelectItem>
              <SelectItem value="tab">Tab</SelectItem>
              <SelectItem value="pipe">Pipe (|)</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div>
          <label className="text-xs font-medium text-amber-900 block mb-1">Encoding</label>
          <Select value={encoding} onValueChange={setEncoding} disabled={disabled}>
            <SelectTrigger className="bg-white"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="utf-8">UTF-8</SelectItem>
              <SelectItem value="utf-8-bom">UTF-8 BOM</SelectItem>
              <SelectItem value="iso-8859-1">ISO-8859-1 (Latin-1)</SelectItem>
              <SelectItem value="windows-1252">Windows-1252</SelectItem>
              <SelectItem value="utf-16">UTF-16</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      <Button
        onClick={handleRetry}
        disabled={disabled}
        className="w-full bg-amber-600 hover:bg-amber-700"
      >
        ↻ Mit diesen Optionen erneut versuchen
      </Button>
    </div>
  )
}