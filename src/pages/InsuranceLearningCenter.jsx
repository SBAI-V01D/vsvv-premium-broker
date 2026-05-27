import React, { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { base44 } from '@/api/base44Client'
import { Brain, BookOpen, CheckCircle2, AlertTriangle, TrendingUp, Filter, Shield, RefreshCw } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { cn } from '@/lib/utils'

const ERROR_LABELS = {
  role_error: { label: 'Rollenfehler', color: 'bg-red-100 text-red-700' },
  ocr_error: { label: 'OCR-Fehler', color: 'bg-orange-100 text-orange-700' },
  product_error: { label: 'Produktfehler', color: 'bg-violet-100 text-violet-700' },
  date_error: { label: 'Datumsfehler', color: 'bg-amber-100 text-amber-700' },
  premium_error: { label: 'Prämien-Fehler', color: 'bg-yellow-100 text-yellow-700' },
  address_error: { label: 'Adressfehler', color: 'bg-slate-100 text-slate-700' },
  unknown: { label: 'Sonstiger Fehler', color: 'bg-gray-100 text-gray-700' },
}

const PATTERN_TYPE_LABELS = {
  field_signal: 'Feldsignal',
  role_mapping: 'Rollenzuordnung',
  product_indicator: 'Produktindikator',
  layout_rule: 'Layoutregel',
  date_format: 'Datumsformat',
  premium_location: 'Prämienposition',
}

function PatternCard({ pattern, onValidate }) {
  const conf = Math.round((pattern.confidence_boost || 0.1) * 100)
  return (
    <div className={cn('p-3 rounded-xl border transition-all', pattern.validated_by_admin ? 'bg-green-50/30 border-green-200' : 'bg-white border-slate-200')}>
      <div className="flex items-start justify-between gap-2 mb-2">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5 flex-wrap">
            <span className="font-semibold text-sm text-slate-800">{pattern.insurer}</span>
            <span className="text-muted-foreground text-xs">/</span>
            <span className="text-xs text-muted-foreground">{pattern.document_type || 'Alle'}</span>
            <span className="px-1.5 py-0.5 rounded text-[10px] bg-blue-100 text-blue-700 font-medium">
              {PATTERN_TYPE_LABELS[pattern.pattern_type] || pattern.pattern_type}
            </span>
            {pattern.validated_by_admin && <span className="px-1.5 py-0.5 rounded text-[10px] bg-green-100 text-green-700 font-medium flex items-center gap-0.5"><Shield className="w-2.5 h-2.5" /> Validiert</span>}
          </div>
        </div>
        <div className="flex items-center gap-1 shrink-0">
          <span className="text-[10px] font-medium text-emerald-600">+{conf}% Konfidenz</span>
        </div>
      </div>

      <div className="flex items-center gap-2 text-sm mb-1.5">
        <span className="px-2 py-0.5 bg-amber-50 border border-amber-200 rounded text-amber-800 font-mono text-xs">{pattern.signal}</span>
        <span className="text-muted-foreground text-xs">mappt auf</span>
        <span className="px-2 py-0.5 bg-primary/10 rounded text-primary font-medium text-xs">{pattern.maps_to}</span>
        {pattern.maps_to_value && <span className="text-xs text-muted-foreground">= <strong>{pattern.maps_to_value}</strong></span>}
      </div>

      {pattern.description && <p className="text-xs text-muted-foreground mb-2">{pattern.description}</p>}

      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="text-[10px] text-muted-foreground">{pattern.correction_count} Bestätigung{pattern.correction_count !== 1 ? 'en' : ''}</span>
          {pattern.last_confirmed_date && <span className="text-[10px] text-muted-foreground">Zuletzt: {pattern.last_confirmed_date}</span>}
        </div>
        {!pattern.validated_by_admin && (
          <button onClick={() => onValidate(pattern.id)} className="text-[10px] text-primary hover:underline font-medium flex items-center gap-1">
            <CheckCircle2 className="w-3 h-3" /> Admin validieren
          </button>
        )}
      </div>
    </div>
  )
}

function CorrectionCard({ log }) {
  const [expanded, setExpanded] = useState(false)
  return (
    <div className="p-3 rounded-xl border bg-white border-slate-200">
      <div className="flex items-start justify-between gap-2 mb-1.5">
        <div>
          <span className="font-medium text-sm">{log.insurer}</span>
          <span className="text-muted-foreground text-xs ml-2">{log.document_type}</span>
          <span className="text-muted-foreground text-xs ml-2">{log.file_name}</span>
        </div>
        <div className="flex items-center gap-1 shrink-0">
          <span className="text-[10px] text-muted-foreground">{new Date(log.created_date).toLocaleDateString('de-CH')}</span>
          <span className="text-xs font-bold text-red-600">{log.correction_count} Korrekturen</span>
        </div>
      </div>

      <div className="flex gap-1 flex-wrap mb-1.5">
        {(log.error_categories || []).map(ec => {
          const cfg = ERROR_LABELS[ec] || ERROR_LABELS.unknown
          return <span key={ec} className={cn('text-[10px] px-1.5 py-0.5 rounded font-medium', cfg.color)}>{cfg.label}</span>
        })}
      </div>

      {log.ai_analysis && <p className="text-xs text-muted-foreground italic mb-1.5">KI-Analyse: {log.ai_analysis}</p>}

      {log.field_corrections?.length > 0 && (
        <>
          <button onClick={() => setExpanded(e => !e)} className="text-[10px] text-primary hover:underline mb-1">
            {expanded ? 'Details ausblenden' : `${log.field_corrections.length} Feldkorrekturen anzeigen`}
          </button>
          {expanded && (
            <div className="space-y-1">
              {log.field_corrections.map((fc, i) => (
                <div key={i} className="flex items-center gap-2 text-xs">
                  <span className="font-medium text-slate-600 shrink-0 w-28">{fc.field}:</span>
                  <span className="text-red-500 truncate max-w-[100px]">{fc.original_value || '(leer)'}</span>
                  <span className="text-muted-foreground">→</span>
                  <span className="text-green-600 truncate max-w-[100px]">{fc.corrected_value || '(leer)'}</span>
                </div>
              ))}
            </div>
          )}
        </>
      )}

      {log.patterns_extracted?.length > 0 && (
        <p className="text-[10px] text-emerald-600 font-medium mt-1.5">
          {log.patterns_extracted.length} Muster gelernt
        </p>
      )}
    </div>
  )
}

export default function InsuranceLearningCenter() {
  const [activeTab, setActiveTab] = useState('patterns')
  const [filterInsurer, setFilterInsurer] = useState('all')
  const qc = useQueryClient()

  const { data: patterns = [], isLoading: loadingPatterns } = useQuery({
    queryKey: ['insurance_patterns'],
    queryFn: () => base44.entities.InsuranceKnowledgePattern.filter({ is_active: true }, '-correction_count', 100),
  })

  const { data: corrections = [], isLoading: loadingCorrections } = useQuery({
    queryKey: ['extraction_corrections'],
    queryFn: () => base44.entities.ExtractionCorrectionLog.list('-created_date', 50),
  })

  const validateMutation = useMutation({
    mutationFn: (id) => base44.entities.InsuranceKnowledgePattern.update(id, { validated_by_admin: true }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['insurance_patterns'] }),
  })

  const insurers = ['all', ...new Set([...patterns.map(p => p.insurer), ...corrections.map(c => c.insurer)].filter(Boolean))]

  const filteredPatterns = filterInsurer === 'all' ? patterns : patterns.filter(p => p.insurer === filterInsurer)
  const filteredCorrections = filterInsurer === 'all' ? corrections : corrections.filter(c => c.insurer === filterInsurer)

  // Stats
  const totalCorrections = corrections.reduce((s, c) => s + (c.correction_count || 0), 0)
  const errorTypeCounts = {}
  for (const c of corrections) for (const e of (c.error_categories || [])) errorTypeCounts[e] = (errorTypeCounts[e] || 0) + 1
  const topError = Object.entries(errorTypeCounts).sort((a, b) => b[1] - a[1])[0]

  return (
    <div className="p-6 max-w-6xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center">
            <Brain className="w-5 h-5 text-primary" />
          </div>
          <div>
            <h1 className="text-xl font-bold">Insurance Learning Center</h1>
            <p className="text-sm text-muted-foreground">KI-Lernfortschritt aus Broker-Korrekturen</p>
          </div>
        </div>
        <Button variant="outline" size="sm" onClick={() => qc.invalidateQueries()}>
          <RefreshCw className="w-3.5 h-3.5 mr-1" /> Aktualisieren
        </Button>
      </div>

      {/* KPI Strip */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {[
          { label: 'Gelernte Muster', value: patterns.length, icon: BookOpen, color: 'text-primary' },
          { label: 'Validierte Muster', value: patterns.filter(p => p.validated_by_admin).length, icon: Shield, color: 'text-green-600' },
          { label: 'Korrektionssessions', value: corrections.length, icon: TrendingUp, color: 'text-amber-600' },
          { label: 'Häufigster Fehler', value: topError ? (ERROR_LABELS[topError[0]]?.label || topError[0]) : '–', icon: AlertTriangle, color: 'text-red-500' },
        ].map(k => (
          <div key={k.label} className="bg-white border border-slate-200 rounded-xl p-3">
            <div className="flex items-center gap-2 mb-1">
              <k.icon className={cn('w-4 h-4', k.color)} />
              <span className="text-xs text-muted-foreground">{k.label}</span>
            </div>
            <p className="text-lg font-bold">{k.value}</p>
          </div>
        ))}
      </div>

      {/* Filter + Tabs */}
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="flex gap-1">
          {['patterns', 'corrections'].map(t => (
            <button key={t} onClick={() => setActiveTab(t)} className={cn('px-3 py-1.5 rounded-lg text-sm font-medium transition-colors', activeTab === t ? 'bg-primary text-primary-foreground' : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-50')}>
              {t === 'patterns' ? `Muster (${patterns.length})` : `Korrekturen (${corrections.length})`}
            </button>
          ))}
        </div>
        <select value={filterInsurer} onChange={e => setFilterInsurer(e.target.value)} className="text-sm border rounded-lg px-3 py-1.5 bg-white">
          {insurers.map(ins => <option key={ins} value={ins}>{ins === 'all' ? 'Alle Versicherer' : ins}</option>)}
        </select>
      </div>

      {/* Content */}
      {activeTab === 'patterns' && (
        <div className="space-y-2">
          {loadingPatterns ? (
            <div className="text-center py-8 text-muted-foreground text-sm">Lade Muster...</div>
          ) : filteredPatterns.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <Brain className="w-12 h-12 mx-auto mb-3 opacity-30" />
              <p className="font-medium">Noch keine Muster gelernt</p>
              <p className="text-xs mt-1">Muster entstehen wenn Broker KI-Extraktionen korrigieren</p>
            </div>
          ) : (
            filteredPatterns.map(p => <PatternCard key={p.id} pattern={p} onValidate={id => validateMutation.mutate(id)} />)
          )}
        </div>
      )}

      {activeTab === 'corrections' && (
        <div className="space-y-2">
          {loadingCorrections ? (
            <div className="text-center py-8 text-muted-foreground text-sm">Lade Korrekturen...</div>
          ) : filteredCorrections.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <TrendingUp className="w-12 h-12 mx-auto mb-3 opacity-30" />
              <p className="font-medium">Noch keine Korrektionen geloggt</p>
            </div>
          ) : (
            filteredCorrections.map(c => <CorrectionCard key={c.id} log={c} />)
          )}
        </div>
      )}
    </div>
  )
}