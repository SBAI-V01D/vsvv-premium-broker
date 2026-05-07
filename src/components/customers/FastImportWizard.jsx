import React, { useState } from 'react'
import { base44 } from '@/api/base44Client'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Progress } from '@/components/ui/progress'
import { AlertCircle, CheckCircle2 } from 'lucide-react'

export default function FastImportWizard({ open, onOpenChange, onSuccess }) {
  const [file, setFile] = useState(null)
  const [progress, setProgress] = useState(0)
  const [status, setStatus] = useState('')
  const [result, setResult] = useState(null)
  const [error, setError] = useState(null)

  const handleImport = async () => {
    if (!file) return
    setError(null)
    setStatus('Datei wird gelesen...')
    setProgress(5)

    try {
      // Parse CSV
      const text = await file.text()
      let content = text
      if (content.charCodeAt(0) === 0xFEFF) content = content.slice(1)

      const lines = content.split('\n').filter(l => l.trim())
      console.log(`📄 Total lines: ${lines.length}`)

      // Detect delimiter
      const countChar = (line, char) => {
        let count = 0, inQuotes = false
        for (let i = 0; i < line.length; i++) {
          if (line[i] === '"') inQuotes = !inQuotes
          else if (line[i] === char && !inQuotes) count++
        }
        return count
      }

      let delimiter = ','
      if (countChar(lines[0], ';') > countChar(lines[0], ',')) delimiter = ';'
      if (countChar(lines[0], '\t') > countChar(lines[0], ';')) delimiter = '\t'

      // Parse CSV
      const parseCSV = (line) => {
        const fields = []
        let field = '', inQuotes = false
        for (let i = 0; i < line.length; i++) {
          const char = line[i]
          if (char === '"') inQuotes = !inQuotes
          else if (char === delimiter && !inQuotes) {
            fields.push(field.trim().replace(/^"|"$/g, ''))
            field = ''
          } else {
            field += char
          }
        }
        fields.push(field.trim().replace(/^"|"$/g, ''))
        return fields
      }

      const headerLine = parseCSV(lines[0])
      console.log(`📋 Headers: ${headerLine.slice(0, 5).join(' | ')}`)

      // Find columns
      const findIdx = (keywords) => headerLine.findIndex(h => 
        keywords.some(k => h.toLowerCase().includes(k))
      )

      const firstNameIdx = findIdx(['vorname', 'firstname', 'first name'])
      const lastNameIdx = findIdx(['nachname', 'lastname', 'last name', 'name'])
      const emailIdx = findIdx(['email', 'e-mail', 'mail'])
      const phoneIdx = findIdx(['telefon', 'phone', 'tel'])
      const cityIdx = findIdx(['ort', 'city', 'stadt'])

      console.log(`🔍 Columns: first=${firstNameIdx}, last=${lastNameIdx}, email=${emailIdx}`)

      // Get default org
      const orgs = await base44.entities.Organization.list('', 1)
      const defaultOrgId = orgs?.[0]?.id

      // Parse records
      const records = []
      const usedEmails = new Set()

      for (let i = 1; i < lines.length; i++) {
        const values = parseCSV(lines[i])
        if (values.every(v => !v || v.trim() === '')) continue

        const firstName = firstNameIdx >= 0 ? values[firstNameIdx]?.trim() : ''
        const lastName = lastNameIdx >= 0 ? values[lastNameIdx]?.trim() : ''
        const email = emailIdx >= 0 ? values[emailIdx]?.trim() : ''
        const phone = phoneIdx >= 0 ? values[phoneIdx]?.trim() : ''
        const city = cityIdx >= 0 ? values[cityIdx]?.trim() : ''

        if (!firstName && !lastName) continue

        let finalEmail = email?.toLowerCase()
        if (!finalEmail) {
          const base = `${(firstName?.[0] || 'x').toLowerCase()}${(lastName || 'user').toLowerCase().replace(/\s/g, '')}@import.local`
          let e = base
          let counter = 1
          while (usedEmails.has(e)) {
            e = `${(firstName?.[0] || 'x').toLowerCase()}${(lastName || 'user').toLowerCase().replace(/\s/g, '')}${counter}@import.local`
            counter++
          }
          finalEmail = e
        }

        usedEmails.add(finalEmail)

        records.push({
          first_name: firstName || 'N/A',
          last_name: lastName || 'N/A',
          email: finalEmail,
          phone: phone || '',
          city: city || '',
          customer_type: 'private',
          status: 'active',
          mandate_status: 'pending',
          is_family_member: false,
          organization_id: defaultOrgId
        })
      }

      console.log(`✅ Parsed ${records.length} records`)
      setProgress(15)

      // Insert records
      let successful = 0
      let failed = 0
      const failedRows = []

      for (let i = 0; i < records.length; i++) {
        try {
          await base44.entities.Customer.create(records[i])
          successful++
        } catch (e) {
          failed++
          failedRows.push({ email: records[i].email, error: e.message?.substring(0, 50) })
        }

        // Update progress
        const pct = 15 + Math.round((i / records.length) * 80)
        setProgress(pct)
        setStatus(`${successful} / ${records.length}`)
      }

      setProgress(100)
      setResult({ successful, failed, failedRows })
      console.log(`🎉 Done: ${successful} OK, ${failed} failed`)

      setTimeout(() => {
        onSuccess?.()
        onOpenChange(false)
      }, 1500)

    } catch (err) {
      console.error('❌ Error:', err)
      setError(err.message)
      setProgress(0)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Kunden importieren</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {!result ? (
            <>
              <div>
                <input
                  type="file"
                  accept=".csv,.xlsx,.xls"
                  onChange={(e) => {
                    setFile(e.target.files?.[0])
                    setError(null)
                  }}
                  className="w-full p-2 border rounded"
                />
              </div>

              {error && (
                <div className="flex gap-2 p-3 bg-red-50 border border-red-200 rounded-lg">
                  <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0" />
                  <p className="text-sm text-red-800">{error}</p>
                </div>
              )}

              <div className="space-y-2">
                <Progress value={progress} />
                <p className="text-xs text-muted-foreground text-center">{status}</p>
              </div>

              <div className="flex gap-2 justify-end">
                <Button variant="outline" onClick={() => onOpenChange(false)}>
                  Abbrechen
                </Button>
                <Button onClick={handleImport} disabled={!file || progress > 0}>
                  {progress > 0 ? 'Importiert...' : 'Importieren'}
                </Button>
              </div>
            </>
          ) : (
            <div className="space-y-3">
              <div className="flex items-start gap-2 p-3 bg-green-50 border border-green-200 rounded-lg">
                <CheckCircle2 className="w-5 h-5 text-green-600 flex-shrink-0 mt-0.5" />
                <div>
                  <p className="font-semibold text-green-900">✓ Import erfolgreich!</p>
                  <p className="text-xs text-green-800 mt-1">{result.successful} Kunden importiert</p>
                  {result.failed > 0 && <p className="text-xs text-green-700 mt-1">{result.failed} Fehler</p>}
                </div>
              </div>
              <Button onClick={() => onOpenChange(false)} className="w-full">
                Schließen
              </Button>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
}