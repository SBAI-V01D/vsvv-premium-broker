import React, { useState } from 'react'
import { base44 } from '@/api/base44Client'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { AlertTriangle, CheckCircle, Loader } from 'lucide-react'
import { cn } from '@/lib/utils'

export default function ImportValidationPanel() {
  const [entityType, setEntityType] = useState('customer')
  const [validation, setValidation] = useState(null)
  const [loading, setLoading] = useState(false)
  const [file, setFile] = useState(null)

  const handleFileSelect = (e) => {
    const selectedFile = e.target.files?.[0];
    if (!selectedFile) return;
    
    setFile(selectedFile);
    setValidation(null);
  };

  const validateImport = async () => {
    if (!file) return;

    setLoading(true);
    try {
      // Parse CSV/JSON
      const text = await file.text();
      let records = [];

      if (file.name.endsWith('.json')) {
        records = JSON.parse(text);
      } else if (file.name.endsWith('.csv')) {
        const lines = text.split('\n');
        const headers = lines[0].split(',').map(h => h.trim());
        records = lines.slice(1).map(line => {
          const values = line.split(',').map(v => v.trim());
          return Object.fromEntries(headers.map((h, i) => [h, values[i]]));
        });
      }

      // Upload file first
      const { file_url } = await base44.integrations.Core.UploadFile({ file });

      // Validate
      const result = await base44.functions.invoke('validateImportBatch', {
        records,
        entity_type: entityType,
        key_fields: entityType === 'customer' ? ['email'] : ['id']
      });

      setValidation(result);
    } catch (err) {
      setValidation({ error: err.message });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <AlertTriangle className="w-5 h-5 text-amber-500" />
          Import-Validierung
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-2">
          <label className="text-sm font-medium">Entity Type</label>
          <Select value={entityType} onValueChange={setEntityType}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="customer">Customer</SelectItem>
              <SelectItem value="contract">Contract</SelectItem>
              <SelectItem value="application">Application</SelectItem>
              <SelectItem value="task">Task</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-2">
          <label className="text-sm font-medium">Datei (CSV/JSON)</label>
          <input
            type="file"
            accept=".csv,.json"
            onChange={handleFileSelect}
            className="w-full px-3 py-2 border border-input rounded-md"
          />
        </div>

        <Button
          onClick={validateImport}
          disabled={!file || loading}
          className="w-full"
        >
          {loading ? (
            <>
              <Loader className="w-4 h-4 mr-2 animate-spin" /> Validiere...
            </>
          ) : (
            '🔍 Validieren'
          )}
        </Button>

        {validation && !validation.error && (
          <div className="space-y-3">
            <div className={cn(
              'p-3 rounded border',
              validation.invalid > 0 ? 'bg-red-50 border-red-200' : 'bg-green-50 border-green-200'
            )}>
              <div className="flex items-center gap-2 mb-2">
                {validation.invalid > 0 ? (
                  <>
                    <AlertTriangle className="w-4 h-4 text-red-600" />
                    <span className="font-semibold text-red-700">Fehler gefunden</span>
                  </>
                ) : (
                  <>
                    <CheckCircle className="w-4 h-4 text-green-600" />
                    <span className="font-semibold text-green-700">Alle gültig</span>
                  </>
                )}
              </div>
              <div className="grid grid-cols-3 gap-2 text-xs">
                <div>
                  <p className="text-muted-foreground">Total</p>
                  <p className="font-bold">{validation.total}</p>
                </div>
                <div>
                  <p className="text-muted-foreground">Gültig</p>
                  <p className="font-bold text-green-600">{validation.valid}</p>
                </div>
                <div>
                  <p className="text-muted-foreground">Ungültig</p>
                  <p className="font-bold text-red-600">{validation.invalid}</p>
                </div>
              </div>
            </div>

            {validation.duplicates > 0 && (
              <div className="p-2 rounded bg-amber-50 border border-amber-200 text-xs">
                <p className="font-semibold text-amber-700">⚠️ {validation.duplicates} Dubletten in Batch</p>
              </div>
            )}

            {validation.conflicts > 0 && (
              <div className="p-2 rounded bg-red-50 border border-red-200 text-xs">
                <p className="font-semibold text-red-700">❌ {validation.conflicts} Konflikte mit bestehenden Daten</p>
                <p className="text-muted-foreground mt-1">Import wird Daten überschreiben!</p>
              </div>
            )}

            {validation.issues.length > 0 && (
              <div className="p-2 rounded bg-muted max-h-32 overflow-y-auto">
                <p className="text-xs font-semibold mb-2">Probleme:</p>
                {validation.issues.slice(0, 5).map((issue, i) => (
                  <div key={i} className="text-xs text-muted-foreground mb-1">
                    Reihe {issue.row}: {issue.issues.join(', ')}
                  </div>
                ))}
                {validation.issues.length > 5 && (
                  <p className="text-xs text-muted-foreground">... und {validation.issues.length - 5} weitere</p>
                )}
              </div>
            )}
          </div>
        )}

        {validation?.error && (
          <div className="p-3 rounded bg-red-50 border border-red-200 text-sm text-red-700">
            Fehler: {validation.error}
          </div>
        )}
      </CardContent>
    </Card>
  )
}