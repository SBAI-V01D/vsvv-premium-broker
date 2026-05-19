import React, { useState } from 'react'
import { base44 } from '@/api/base44Client'
import { Button } from '@/components/ui/button'
import { Sparkles, Upload, CheckCircle2, AlertCircle, Loader2, X, ChevronDown, ChevronUp } from 'lucide-react'
import { cn } from '@/lib/utils'

/**
 * KI-Dokumentenanalyse für Leads (Phase 1)
 * Analysiert hochgeladene Policen und füllt Lead-Felder automatisch vor.
 * KEINE Änderungen an Lifecycle, Guards oder Automationen.
 */
export default function LeadAiDocumentAnalysis({ onDataExtracted, className }) {
  const [uploading, setUploading] = useState(false)
  const [analyzing, setAnalyzing] = useState(false)
  const [result, setResult] = useState(null)
  const [error, setError] = useState(null)
  const [expanded, setExpanded] = useState(true)
  const [fileUrl, setFileUrl] = useState(null)
  const [fileName, setFileName] = useState(null)

  const handleFileUpload = async (e) => {
    const file = e.target.files?.[0]
    if (!file) return

    setError(null)
    setResult(null)
    setUploading(true)

    try {
      const { file_url } = await base44.integrations.Core.UploadFile({ file })
      setFileUrl(file_url)
      setFileName(file.name)
      setUploading(false)

      // Direkt analysieren
      await analyzeDocument(file_url, file.name)
    } catch (err) {
      setError('Upload fehlgeschlagen. Bitte erneut versuchen.')
      setUploading(false)
    }
    e.target.value = ''
  }

  const analyzeDocument = async (url, name) => {
    setAnalyzing(true)
    setError(null)

    try {
      const extracted = await base44.integrations.Core.InvokeLLM({
        prompt: `Du bist ein Schweizer Versicherungsexperte. Analysiere dieses Versicherungsdokument (Police oder Kundeninformation) und extrahiere alle relevanten Daten.

Gib die Daten als JSON zurück. Wenn ein Feld nicht im Dokument vorhanden ist, lasse es leer (null).

Analysiere besonders:
- Persönliche Daten des Versicherungsnehmers
- Versicherungsgesellschaft(en)
- Policennummer(n)
- Versicherungsarten/Sparten
- Prämienhöhe (monatlich/jährlich)
- Vertragslaufzeit (Beginn, Ende)
- Kündigungsfristen
- Deckungsumfang
- Produkte/Tarife

Dokument: ${name}`,
        file_urls: [url],
        response_json_schema: {
          type: 'object',
          properties: {
            person: {
              type: 'object',
              properties: {
                first_name: { type: 'string' },
                last_name: { type: 'string' },
                birthdate: { type: 'string', description: 'Format YYYY-MM-DD' },
                address: { type: 'string' },
                phone: { type: 'string' },
                email: { type: 'string' },
              }
            },
            policies: {
              type: 'array',
              items: {
                type: 'object',
                properties: {
                  insurer: { type: 'string' },
                  policy_number: { type: 'string' },
                  sparte: { type: 'string' },
                  product: { type: 'string' },
                  premium_monthly: { type: 'number' },
                  premium_yearly: { type: 'number' },
                  start_date: { type: 'string' },
                  end_date: { type: 'string' },
                  cancellation_deadline_months: { type: 'number' },
                  coverage_summary: { type: 'string' },
                }
              }
            },
            summary: { type: 'string', description: 'Kurze Zusammenfassung des Dokuments auf Deutsch' },
            confidence: { type: 'string', enum: ['high', 'medium', 'low'], description: 'Wie sicher ist die Erkennung?' },
            missing_sparten: {
              type: 'array',
              items: { type: 'string' },
              description: 'Potentiell fehlende Versicherungsarten basierend auf Profil'
            }
          }
        }
      })

      setResult(extracted)
      setExpanded(true)
    } catch (err) {
      setError('KI-Analyse fehlgeschlagen. Bitte Felder manuell ausfüllen.')
    }
    setAnalyzing(false)
  }

  const handleApply = () => {
    if (!result) return

    const p = result.person || {}
    const policies = result.policies || []
    const firstPolicy = policies[0]

    // Zusammenfassung für Notizen aufbauen
    const noteLines = []
    if (result.summary) noteLines.push(result.summary)
    if (policies.length > 0) {
      noteLines.push('\n--- Bestehende Policen ---')
      policies.forEach(pol => {
        const parts = [pol.insurer, pol.sparte, pol.policy_number].filter(Boolean)
        if (pol.premium_yearly) parts.push(`CHF ${pol.premium_yearly.toLocaleString('de-CH')}/J.`)
        noteLines.push('• ' + parts.join(' · '))
        if (pol.end_date) noteLines.push(`  Ablauf: ${pol.end_date}`)
      })
    }
    if (result.missing_sparten?.length > 0) {
      noteLines.push('\n--- Potenzial ---')
      noteLines.push('Fehlende Sparten: ' + result.missing_sparten.join(', '))
    }

    onDataExtracted({
      first_name: p.first_name || '',
      last_name: p.last_name || '',
      birthdate: p.birthdate || '',
      phone: p.phone || '',
      email: p.email || '',
      notes: noteLines.join('\n'),
      // Dokument als Anhang vormerken
      _aiDocument: { name: fileName, url: fileUrl, category: 'police' },
    })

    setExpanded(false)
  }

  const reset = () => {
    setResult(null)
    setError(null)
    setFileUrl(null)
    setFileName(null)
    setExpanded(true)
  }

  const isLoading = uploading || analyzing

  return (
    <div className={cn('rounded-xl border-2 border-dashed border-primary/30 bg-primary/[0.02] transition-all', className)}>
      {/* Header */}
      <div
        className="flex items-center gap-2 px-4 py-3 cursor-pointer"
        onClick={() => !isLoading && setExpanded(e => !e)}
      >
        <div className="w-7 h-7 rounded-lg bg-primary/10 flex items-center justify-center flex-shrink-0">
          <Sparkles className="w-3.5 h-3.5 text-primary" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold text-primary">KI-Dokumentenanalyse</p>
          <p className="text-xs text-muted-foreground truncate">
            {fileName
              ? (analyzing ? 'Analysiere...' : result ? `${result.policies?.length || 0} Police(n) erkannt` : fileName)
              : 'Police hochladen → Daten automatisch erkennen'}
          </p>
        </div>
        {result && (
          <div className={cn(
            'text-[10px] px-2 py-0.5 rounded-full font-medium border',
            result.confidence === 'high' ? 'bg-emerald-50 text-emerald-700 border-emerald-200' :
            result.confidence === 'medium' ? 'bg-amber-50 text-amber-700 border-amber-200' :
            'bg-slate-100 text-slate-600 border-slate-200'
          )}>
            {result.confidence === 'high' ? 'Hohe Konfidenz' : result.confidence === 'medium' ? 'Mittlere Konfidenz' : 'Niedrig'}
          </div>
        )}
        {!isLoading && (expanded ? <ChevronUp className="w-4 h-4 text-muted-foreground flex-shrink-0" /> : <ChevronDown className="w-4 h-4 text-muted-foreground flex-shrink-0" />)}
      </div>

      {/* Body */}
      {expanded && (
        <div className="px-4 pb-4 space-y-3">
          {/* Upload Zone */}
          {!result && !isLoading && (
            <label className="flex flex-col items-center gap-2 py-5 rounded-lg border border-dashed border-border bg-background cursor-pointer hover:border-primary/50 hover:bg-primary/[0.02] transition-all group">
              <Upload className="w-6 h-6 text-muted-foreground group-hover:text-primary transition-colors" />
              <div className="text-center">
                <p className="text-sm font-medium text-muted-foreground group-hover:text-foreground">Police oder Dokument hochladen</p>
                <p className="text-xs text-muted-foreground">PDF, JPG, PNG — KI erkennt automatisch Daten</p>
              </div>
              <input type="file" className="hidden" accept=".pdf,.jpg,.jpeg,.png" onChange={handleFileUpload} />
            </label>
          )}

          {/* Loading */}
          {isLoading && (
            <div className="flex flex-col items-center gap-3 py-6">
              <Loader2 className="w-7 h-7 text-primary animate-spin" />
              <div className="text-center">
                <p className="text-sm font-semibold">{uploading ? 'Dokument wird hochgeladen...' : 'KI analysiert Dokument...'}</p>
                <p className="text-xs text-muted-foreground mt-0.5">Versicherungsdaten werden erkannt</p>
              </div>
            </div>
          )}

          {/* Error */}
          {error && (
            <div className="flex items-start gap-2 p-3 bg-red-50 border border-red-200 rounded-lg text-xs text-red-800">
              <AlertCircle className="w-3.5 h-3.5 flex-shrink-0 mt-0.5" />
              <span>{error}</span>
            </div>
          )}

          {/* Results */}
          {result && !isLoading && (
            <div className="space-y-3">
              {/* Person */}
              {result.person && (result.person.first_name || result.person.last_name) && (
                <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg text-xs space-y-1">
                  <p className="font-semibold text-blue-900 uppercase tracking-wide text-[10px]">Person erkannt</p>
                  <p className="text-blue-800 font-medium">
                    {[result.person.first_name, result.person.last_name].filter(Boolean).join(' ')}
                    {result.person.birthdate && ` · Geb. ${result.person.birthdate}`}
                  </p>
                  {result.person.phone && <p className="text-blue-700">📞 {result.person.phone}</p>}
                  {result.person.email && <p className="text-blue-700">✉️ {result.person.email}</p>}
                </div>
              )}

              {/* Policen */}
              {result.policies?.length > 0 && (
                <div className="space-y-1.5">
                  <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                    {result.policies.length} Police(n) erkannt
                  </p>
                  {result.policies.map((pol, i) => (
                    <div key={i} className="p-2.5 bg-card border border-border rounded-lg text-xs">
                      <div className="flex items-center justify-between gap-2">
                        <span className="font-semibold">{pol.insurer || '–'}</span>
                        {pol.premium_yearly && (
                          <span className="text-emerald-700 font-bold">CHF {pol.premium_yearly.toLocaleString('de-CH')}/J.</span>
                        )}
                      </div>
                      <p className="text-muted-foreground mt-0.5">
                        {[pol.sparte, pol.product, pol.policy_number].filter(Boolean).join(' · ')}
                      </p>
                      {(pol.end_date || pol.cancellation_deadline_months) && (
                        <p className="text-orange-600 mt-0.5">
                          {pol.end_date && `Ablauf: ${pol.end_date}`}
                          {pol.cancellation_deadline_months && ` · Frist: ${pol.cancellation_deadline_months}M.`}
                        </p>
                      )}
                      {pol.coverage_summary && (
                        <p className="text-muted-foreground mt-0.5 line-clamp-1">{pol.coverage_summary}</p>
                      )}
                    </div>
                  ))}
                </div>
              )}

              {/* Missing Sparten */}
              {result.missing_sparten?.length > 0 && (
                <div className="p-2.5 bg-amber-50 border border-amber-200 rounded-lg text-xs">
                  <p className="font-semibold text-amber-900 mb-1">Potenzielle Lücken</p>
                  <div className="flex flex-wrap gap-1">
                    {result.missing_sparten.map((s, i) => (
                      <span key={i} className="px-2 py-0.5 bg-amber-100 text-amber-800 rounded-full border border-amber-200">{s}</span>
                    ))}
                  </div>
                </div>
              )}

              {/* Summary */}
              {result.summary && (
                <p className="text-xs text-muted-foreground italic px-1">{result.summary}</p>
              )}

              {/* Actions */}
              <div className="flex gap-2 pt-1">
                <Button size="sm" onClick={handleApply} className="gap-1.5 flex-1">
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  Daten übernehmen
                </Button>
                <Button size="sm" variant="outline" onClick={reset} className="gap-1.5">
                  <X className="w-3.5 h-3.5" /> Neu
                </Button>
              </div>
              {result.confidence === 'low' && (
                <p className="text-xs text-amber-600 text-center">⚠️ Niedrige Erkennungsqualität — bitte Felder prüfen</p>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  )
}