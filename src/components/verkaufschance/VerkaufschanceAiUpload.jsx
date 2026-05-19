import React, { useState } from 'react'
import { base44 } from '@/api/base44Client'
import { Button } from '@/components/ui/button'
import { Sparkles, Upload, CheckCircle2, AlertCircle, Loader2, X, ChevronDown, ChevronUp } from 'lucide-react'
import { cn } from '@/lib/utils'

/**
 * KI-Offertenanalyse für Verkaufschancen (Phase 2)
 * Analysiert hochgeladene Offerten/Policen und füllt Felder automatisch vor.
 * KEINE Änderungen an Lifecycle, Guards oder Automationen.
 */
export default function VerkaufschanceAiUpload({ onDataExtracted, className }) {
  const [uploading, setUploading] = useState(false)
  const [analyzing, setAnalyzing] = useState(false)
  const [result, setResult] = useState(null)
  const [error, setError] = useState(null)
  const [expanded, setExpanded] = useState(true)
  const [fileName, setFileName] = useState(null)
  const [fileUrl, setFileUrl] = useState(null)

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
      await analyzeDocument(file_url, file.name)
    } catch {
      setError('Upload fehlgeschlagen.')
      setUploading(false)
    }
    e.target.value = ''
  }

  const analyzeDocument = async (url, name) => {
    setAnalyzing(true)
    setError(null)

    try {
      const extracted = await base44.integrations.Core.InvokeLLM({
        prompt: `Du bist ein Schweizer Versicherungsexperte. Analysiere diese Offerte oder Police und extrahiere alle relevanten Daten für eine Verkaufschance.

Dokument: ${name}

Gib alle erkannten Daten als JSON zurück. Fehlende Felder: null.

Identifiziere besonders:
- Versicherungsgesellschaft
- Versicherungsart/Sparte (z.B. KVG, Hausrat, Motorfahrzeug, Haftpflicht, Leben, BVG, UVG, KTG, Rechtsschutz)
- Prämie (monatlich und/oder jährlich in CHF)
- Deckungsumfang
- Laufzeit / Versicherungsbeginn
- Produktname / Tarif
- Versicherungsnehmer
- Offerttyp (Neuantrag, Wechsel, Erneuerung)
- Umsatzpotenzial (geschätzter Jahresprämien-Wert)`,
        file_urls: [url],
        response_json_schema: {
          type: 'object',
          properties: {
            insurer: { type: 'string', description: 'Versicherungsgesellschaft' },
            sparte: { type: 'string', description: 'Versicherungsart (z.B. kvg, hausrat, motorfahrzeug, haftpflicht_privat, leben, bvg, uvg, ktg, rechtsschutz)' },
            product: { type: 'string', description: 'Produktname / Tarif' },
            premium_monthly: { type: 'number', description: 'Monatsprämie CHF' },
            premium_yearly: { type: 'number', description: 'Jahresprämie CHF' },
            coverage_summary: { type: 'string', description: 'Deckungsumfang kurz beschrieben' },
            start_date: { type: 'string', description: 'Versicherungsbeginn YYYY-MM-DD' },
            end_date: { type: 'string', description: 'Vertragsende YYYY-MM-DD' },
            offer_type: { type: 'string', enum: ['neuantrag', 'wechsel', 'erneuerung', 'unbekannt'] },
            customer_name: { type: 'string', description: 'Name des Versicherungsnehmers' },
            policy_number: { type: 'string' },
            title_suggestion: { type: 'string', description: 'Vorgeschlagene Bezeichnung für die Verkaufschance' },
            confidence: { type: 'string', enum: ['high', 'medium', 'low'] },
            notes_suggestion: { type: 'string', description: 'Relevante Hinweise zur Offerte als Notiz' },
          }
        }
      })

      setResult(extracted)
    } catch {
      setError('KI-Analyse fehlgeschlagen. Felder bitte manuell ausfüllen.')
    }
    setAnalyzing(false)
  }

  const handleApply = () => {
    if (!result) return

    const premiumYearly = result.premium_yearly || (result.premium_monthly ? Math.round(result.premium_monthly * 12) : null)

    onDataExtracted({
      insurer: result.insurer || '',
      sparte: result.sparte || '',
      product: result.product || '',
      estimated_value: premiumYearly || '',
      start_date_requested: result.start_date || '',
      title: result.title_suggestion || '',
      notes: result.notes_suggestion || '',
      // Für GesellschaftenTabelle: direkt eine Gesellschaft vorausfüllen
      _gesellschaft: result.insurer ? {
        gesellschaft: result.insurer,
        status: 'angefragt',
        praemie_yearly: premiumYearly || null,
        deckung: result.coverage_summary || '',
        dokument_url: fileUrl,
        dokument_name: fileName,
        antwort_datum: new Date().toISOString().slice(0, 10),
        ist_favorit: false,
        bemerkung: result.notes_suggestion || '',
      } : null,
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
    <div className={cn('rounded-xl border-2 border-dashed border-violet-300/60 bg-violet-50/30 transition-all', className)}>
      {/* Header */}
      <div
        className="flex items-center gap-2 px-4 py-3 cursor-pointer"
        onClick={() => !isLoading && setExpanded(e => !e)}
      >
        <div className="w-7 h-7 rounded-lg bg-violet-100 flex items-center justify-center flex-shrink-0">
          <Sparkles className="w-3.5 h-3.5 text-violet-600" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold text-violet-800">KI-Offerten-Analyse</p>
          <p className="text-xs text-muted-foreground truncate">
            {fileName
              ? (analyzing ? 'Analysiere Offerte...' : result ? `${result.insurer || 'Erkannt'} · ${result.sparte || ''}` : fileName)
              : 'Offerte hochladen → Verkaufschance automatisch strukturieren'}
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
            <label className="flex flex-col items-center gap-2 py-5 rounded-lg border border-dashed border-violet-200 bg-white cursor-pointer hover:border-violet-400 hover:bg-violet-50/50 transition-all group">
              <Upload className="w-6 h-6 text-violet-300 group-hover:text-violet-500 transition-colors" />
              <div className="text-center">
                <p className="text-sm font-medium text-muted-foreground group-hover:text-foreground">Offerte oder Police hochladen</p>
                <p className="text-xs text-muted-foreground">PDF, JPG, PNG — KI erkennt Versicherer, Prämie, Sparte</p>
              </div>
              <input type="file" className="hidden" accept=".pdf,.jpg,.jpeg,.png" onChange={handleFileUpload} />
            </label>
          )}

          {/* Loading */}
          {isLoading && (
            <div className="flex flex-col items-center gap-3 py-6">
              <Loader2 className="w-7 h-7 text-violet-600 animate-spin" />
              <div className="text-center">
                <p className="text-sm font-semibold">{uploading ? 'Wird hochgeladen...' : 'KI analysiert Offerte...'}</p>
                <p className="text-xs text-muted-foreground mt-0.5">Versicherer, Sparte und Prämie werden erkannt</p>
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

          {/* Result */}
          {result && !isLoading && (
            <div className="space-y-3">
              {/* Erkannte Daten */}
              <div className="p-3 bg-white border border-violet-200 rounded-lg text-xs space-y-2">
                <p className="font-semibold text-violet-900 uppercase tracking-wide text-[10px]">Erkannte Daten</p>
                <div className="grid grid-cols-2 gap-x-4 gap-y-1.5">
                  {result.insurer && <Row label="Versicherer" value={result.insurer} />}
                  {result.sparte && <Row label="Sparte" value={result.sparte} />}
                  {result.product && <Row label="Produkt" value={result.product} />}
                  {result.offer_type && <Row label="Offerttyp" value={result.offer_type} />}
                  {result.premium_yearly && (
                    <Row label="Jahresprämie" value={`CHF ${result.premium_yearly.toLocaleString('de-CH')}`} highlight />
                  )}
                  {result.premium_monthly && (
                    <Row label="Monatsprämie" value={`CHF ${result.premium_monthly.toLocaleString('de-CH')}`} />
                  )}
                  {result.start_date && <Row label="Beginn" value={result.start_date} />}
                  {result.policy_number && <Row label="Police-Nr." value={result.policy_number} />}
                </div>
                {result.coverage_summary && (
                  <p className="text-muted-foreground mt-1 pt-1 border-t border-border">{result.coverage_summary}</p>
                )}
              </div>

              {result.title_suggestion && (
                <div className="px-3 py-2 bg-blue-50 border border-blue-200 rounded-lg text-xs">
                  <span className="font-semibold text-blue-900">Bezeichnung: </span>
                  <span className="text-blue-800">{result.title_suggestion}</span>
                </div>
              )}

              {/* Actions */}
              <div className="flex gap-2 pt-1">
                <Button size="sm" onClick={handleApply} className="gap-1.5 flex-1 bg-violet-700 hover:bg-violet-800">
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

function Row({ label, value, highlight }) {
  return (
    <div>
      <p className="text-[10px] text-muted-foreground uppercase tracking-wide">{label}</p>
      <p className={cn('font-medium truncate', highlight ? 'text-emerald-700' : 'text-foreground')}>{value}</p>
    </div>
  )
}