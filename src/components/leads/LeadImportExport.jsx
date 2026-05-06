import React, { useRef, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { Download, Upload, CheckCircle2, AlertTriangle, Loader2 } from 'lucide-react'

const CSV_HEADERS = ['first_name', 'last_name', 'email', 'phone', 'birthdate', 'company', 'source', 'status', 'notes']
const SOURCE_VALUES = ['website', 'referral', 'campaign', 'manual', 'import']
const STATUS_VALUES = ['new', 'contacted', 'qualified', 'converted', 'lost']

// ── CSV Export ────────────────────────────────────────────────────────────────
function exportLeadsToCSV(leads) {
  const rows = [CSV_HEADERS.join(';')]
  leads.forEach(l => {
    const row = CSV_HEADERS.map(h => {
      const val = l[h] ?? ''
      // Escape semicolons and quotes
      return `"${String(val).replace(/"/g, '""')}"`
    })
    rows.push(row.join(';'))
  })
  const blob = new Blob(['\uFEFF' + rows.join('\n')], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `leads_export_${new Date().toISOString().slice(0, 10)}.csv`
  a.click()
  URL.revokeObjectURL(url)
}

// ── CSV Parse ─────────────────────────────────────────────────────────────────
function parseCSV(text) {
  const lines = text.split(/\r?\n/).filter(l => l.trim())
  if (lines.length < 2) return { records: [], errors: ['Datei ist leer oder hat nur einen Header'] }

  // Detect separator
  const sep = lines[0].includes(';') ? ';' : ','
  const headers = lines[0].split(sep).map(h => h.replace(/^"|"$/g, '').trim().toLowerCase())

  const records = []
  const errors = []

  lines.slice(1).forEach((line, idx) => {
    // Simple CSV parse (handles quoted fields)
    const values = []
    let inQuote = false
    let cur = ''
    for (let i = 0; i < line.length; i++) {
      const ch = line[i]
      if (ch === '"') { inQuote = !inQuote; continue }
      if (ch === sep && !inQuote) { values.push(cur); cur = ''; continue }
      cur += ch
    }
    values.push(cur)

    const record = {}
    headers.forEach((h, i) => { record[h] = values[i]?.trim() || '' })

    // Validate required
    if (!record.first_name && !record.name) {
      errors.push(`Zeile ${idx + 2}: Vorname fehlt`)
      return
    }
    if (!record.email) {
      errors.push(`Zeile ${idx + 2}: E-Mail fehlt`)
      return
    }

    // Normalize source/status
    const source = SOURCE_VALUES.includes(record.source) ? record.source : 'import'
    const status = STATUS_VALUES.includes(record.status) ? record.status : 'new'

    records.push({
      first_name: record.first_name || record.name || '',
      last_name: record.last_name || '',
      name: `${record.first_name || record.name || ''} ${record.last_name || ''}`.trim(),
      email: record.email,
      phone: record.phone || '',
      birthdate: record.birthdate || '',
      company: record.company || '',
      source,
      status,
      notes: record.notes || '',
    })
  })

  return { records, errors }
}

// ── Main Component ────────────────────────────────────────────────────────────
export default function LeadImportExport({ leads = [], onImport }) {
  const fileRef = useRef(null)
  const [importDialog, setImportDialog] = useState(false)
  const [importPreview, setImportPreview] = useState(null) // { records, errors }
  const [importing, setImporting] = useState(false)
  const [importDone, setImportDone] = useState(false)

  const handleExport = () => exportLeadsToCSV(leads)

  const handleFileChange = (e) => {
    const file = e.target.files?.[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = (ev) => {
      const text = ev.target.result
      const result = parseCSV(text)
      setImportPreview(result)
      setImportDialog(true)
      setImportDone(false)
    }
    reader.readAsText(file, 'UTF-8')
    e.target.value = ''
  }

  const handleImportConfirm = async () => {
    if (!importPreview?.records?.length) return
    setImporting(true)
    await onImport(importPreview.records)
    setImporting(false)
    setImportDone(true)
  }

  const handleClose = () => {
    setImportDialog(false)
    setImportPreview(null)
    setImportDone(false)
  }

  return (
    <div className="flex gap-2">
      {/* Export */}
      <Button variant="outline" size="sm" onClick={handleExport} className="gap-2">
        <Download className="w-4 h-4" /> Export CSV
      </Button>

      {/* Import */}
      <Button variant="outline" size="sm" onClick={() => fileRef.current?.click()} className="gap-2">
        <Upload className="w-4 h-4" /> Import CSV
      </Button>
      <input ref={fileRef} type="file" accept=".csv,.txt" className="hidden" onChange={handleFileChange} />

      {/* Import Preview Dialog */}
      <Dialog open={importDialog} onOpenChange={handleClose}>
        <DialogContent className="max-w-lg max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>CSV Import – Vorschau</DialogTitle>
          </DialogHeader>

          {importDone ? (
            <div className="flex flex-col items-center gap-3 py-8">
              <CheckCircle2 className="w-12 h-12 text-green-500" />
              <p className="font-semibold text-green-700">Import erfolgreich!</p>
              <p className="text-sm text-muted-foreground">{importPreview?.records?.length} Leads importiert</p>
              <Button onClick={handleClose}>Schliessen</Button>
            </div>
          ) : (
            <>
              {importPreview?.errors?.length > 0 && (
                <div className="p-3 bg-amber-50 border border-amber-200 rounded-lg space-y-1 mb-3">
                  <p className="text-xs font-semibold text-amber-700 flex items-center gap-1.5">
                    <AlertTriangle className="w-3.5 h-3.5" /> {importPreview.errors.length} Warnungen (werden übersprungen)
                  </p>
                  {importPreview.errors.slice(0, 5).map((e, i) => (
                    <p key={i} className="text-xs text-amber-600">{e}</p>
                  ))}
                </div>
              )}

              <p className="text-sm text-muted-foreground mb-3">
                <strong>{importPreview?.records?.length || 0}</strong> Leads werden importiert:
              </p>

              <div className="border rounded-lg overflow-hidden max-h-64 overflow-y-auto">
                <table className="w-full text-xs">
                  <thead className="bg-muted/50 border-b">
                    <tr>
                      <th className="text-left p-2">Vorname</th>
                      <th className="text-left p-2">Nachname</th>
                      <th className="text-left p-2">E-Mail</th>
                      <th className="text-left p-2">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {importPreview?.records?.slice(0, 20).map((r, i) => (
                      <tr key={i} className="hover:bg-muted/30">
                        <td className="p-2">{r.first_name}</td>
                        <td className="p-2">{r.last_name}</td>
                        <td className="p-2 text-muted-foreground truncate max-w-[120px]">{r.email}</td>
                        <td className="p-2">{r.status}</td>
                      </tr>
                    ))}
                    {importPreview?.records?.length > 20 && (
                      <tr>
                        <td colSpan={4} className="p-2 text-center text-muted-foreground">
                          … und {importPreview.records.length - 20} weitere
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>

              <DialogFooter className="mt-4 gap-2">
                <Button variant="outline" onClick={handleClose}>Abbrechen</Button>
                <Button
                  onClick={handleImportConfirm}
                  disabled={importing || !importPreview?.records?.length}
                >
                  {importing ? (
                    <><Loader2 className="w-4 h-4 animate-spin mr-2" /> Importieren...</>
                  ) : (
                    `${importPreview?.records?.length || 0} Leads importieren`
                  )}
                </Button>
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  )
}