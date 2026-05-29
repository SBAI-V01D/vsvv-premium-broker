/**
 * ExtractionValidationPanel
 * Phase 1: Confidence pro Feld sichtbar
 * Phase 2: KVG/VVG Regelwerk Validator
 */
import React, { useState } from 'react'
import { AlertTriangle, XCircle, CheckCircle2, ChevronDown, ChevronUp, Shield, Info } from 'lucide-react'
import { cn } from '@/lib/utils'

// ── VVG-Produkte: dürfen NIEMALS als KVG klassifiziert werden ──────────────
const STRICTLY_VVG_KEYWORDS = [
  'h-capital', 'h-bonus', 'kh', ' hb ', 'mundo', 'global', 'supra', 'hospita',
  'complementa', 'dentaire', 'legis sana', 'acrobat', 'myFlex', 'my flex',
  'completa', 'top', 'sana', 'omni', 'vita', 'prevea', 'denta', 'hospital',
  'plus ', 'tourist', 'protect', 'balance', 'comfort', 'premium', 'ambulant',
  'spital', 'halbprivat', 'privat', 'reise', 'rechtsschutz', 'dental',
]

// ── KVG-Produkte: dürfen NIEMALS als VVG klassifiziert werden ──────────────
const STRICTLY_KVG_KEYWORDS = [
  'casamed', 'primacare', 'primaflex', 'sanatel', 'beneFit', 'benefit', ' hmo',
  'grundversicherung', 'pflegeversicherung kvg', 'standard kvg',
]

function isProductMisclassified(product, sparte) {
  if (!product || !sparte) return null
  const lower = product.toLowerCase()
  if (sparte === 'kvg') {
    const vvgMatch = STRICTLY_VVG_KEYWORDS.find(kw => lower.includes(kw.toLowerCase().trim()))
    if (vvgMatch) return { type: 'error', msg: `«${product}» ist ein VVG-Produkt — nicht KVG` }
  }
  if (sparte === 'vvg_zusatz') {
    const kvgMatch = STRICTLY_KVG_KEYWORDS.find(kw => lower.includes(kw.toLowerCase().trim()))
    if (kvgMatch) return { type: 'error', msg: `«${product}» ist ein KVG-Produkt — nicht VVG` }
  }
  return null
}

function validatePolicy(pol, index) {
  const issues = []

  // Regel: KVG ohne Franchise
  if (pol.sparte === 'kvg' && (pol.franchise == null || pol.franchise === 0)) {
    issues.push({ type: 'warning', msg: 'KVG ohne Franchise — bitte ergänzen (CHF 300–2500)' })
  }

  // Regel: KVG Franchise ausserhalb Bereich
  if (pol.sparte === 'kvg' && pol.franchise != null && pol.franchise > 0) {
    const valid = [300, 500, 1000, 1500, 2000, 2500]
    if (!valid.includes(Number(pol.franchise))) {
      issues.push({ type: 'warning', msg: `Franchise CHF ${pol.franchise} ist kein Standard-KVG-Wert (300/500/1000/1500/2000/2500)` })
    }
  }

  // Regel: VVG mit Franchise
  if (pol.sparte === 'vvg_zusatz' && pol.franchise != null && pol.franchise > 0) {
    issues.push({ type: 'warning', msg: 'VVG-Produkt mit Franchise — VVG hat keine Pflicht-Franchise' })
  }

  // Regel: Falsch klassifiziertes Produkt
  const misclass = isProductMisclassified(pol.product, pol.sparte)
  if (misclass) issues.push(misclass)

  // Regel: Prämie fehlt
  if (!pol.premium_monthly && !pol.premium_yearly) {
    issues.push({ type: 'warning', msg: 'Prämie nicht erkannt — bitte manuell eingeben' })
  }

  // Regel: Beginn fehlt
  if (!pol.start_date) {
    issues.push({ type: 'info', msg: 'Vertragsbeginn nicht erkannt' })
  }

  // Regel: Produkt fehlt
  if (!pol.product && !pol.product_short) {
    issues.push({ type: 'warning', msg: 'Produktname nicht erkannt' })
  }

  return issues
}

function getConfidenceColor(c) {
  if (c == null) return 'text-slate-400'
  if (c >= 0.8) return 'text-emerald-600'
  if (c >= 0.6) return 'text-amber-600'
  return 'text-red-600'
}

function getConfidenceBg(c) {
  if (c == null) return 'bg-slate-100'
  if (c >= 0.8) return 'bg-emerald-100'
  if (c >= 0.6) return 'bg-amber-100'
  return 'bg-red-100'
}

function ConfidencePill({ label, value }) {
  const pct = value != null ? Math.round(value * 100) : null
  return (
    <div className="flex items-center justify-between text-[10px] py-0.5">
      <span className="text-muted-foreground">{label}</span>
      <span className={cn('font-bold px-1.5 py-0.5 rounded-full', getConfidenceBg(value), getConfidenceColor(value))}>
        {pct != null ? `${pct}%` : '–'}
      </span>
    </div>
  )
}

function IssueRow({ issue }) {
  const icons = {
    error: <XCircle className="w-3.5 h-3.5 text-red-500 flex-shrink-0" />,
    warning: <AlertTriangle className="w-3.5 h-3.5 text-amber-500 flex-shrink-0" />,
    info: <Info className="w-3.5 h-3.5 text-blue-400 flex-shrink-0" />,
  }
  const colors = {
    error: 'bg-red-50 border-red-200 text-red-800',
    warning: 'bg-amber-50 border-amber-200 text-amber-800',
    info: 'bg-blue-50 border-blue-200 text-blue-800',
  }
  return (
    <div className={cn('flex items-start gap-1.5 px-2 py-1 rounded border text-[10px]', colors[issue.type])}>
      {icons[issue.type]}
      <span>{issue.msg}</span>
    </div>
  )
}

export default function ExtractionValidationPanel({ extracted, policies }) {
  const [expanded, setExpanded] = useState(false)

  if (!extracted && (!policies || policies.length === 0)) return null

  // Collect all issues across all policies
  const allIssues = []
  const policyIssues = policies.map((pol, i) => {
    const issues = validatePolicy(pol, i)
    allIssues.push(...issues)
    return { pol, issues }
  })

  const errorCount = allIssues.filter(i => i.type === 'error').length
  const warningCount = allIssues.filter(i => i.type === 'warning').length

  // Overall extraction confidence
  const overallConf = extracted?.document_confidence ?? null
  const allConfsFromPolicies = policies.flatMap(p =>
    p.confidence ? Object.values(p.confidence).filter(v => v != null) : []
  )
  const avgPolicyConf = allConfsFromPolicies.length > 0
    ? allConfsFromPolicies.reduce((a, b) => a + b, 0) / allConfsFromPolicies.length
    : null

  const displayConf = overallConf ?? avgPolicyConf

  const statusColor = errorCount > 0 ? 'border-red-300 bg-red-50/50' :
    warningCount > 0 ? 'border-amber-300 bg-amber-50/50' : 'border-emerald-300 bg-emerald-50/50'

  const StatusIcon = errorCount > 0 ? XCircle : warningCount > 0 ? AlertTriangle : CheckCircle2
  const statusIconColor = errorCount > 0 ? 'text-red-500' : warningCount > 0 ? 'text-amber-500' : 'text-emerald-600'

  const statusLabel = errorCount > 0
    ? `${errorCount} Fehler${warningCount > 0 ? ` · ${warningCount} Warnungen` : ''}`
    : warningCount > 0
    ? `${warningCount} Warnung${warningCount > 1 ? 'en' : ''} — bitte prüfen`
    : 'Extraktion plausibel'

  return (
    <div className={cn('rounded-lg border text-xs', statusColor)}>
      {/* Header – always visible */}
      <button
        type="button"
        className="w-full flex items-center gap-2 px-3 py-2 text-left"
        onClick={() => setExpanded(!expanded)}
      >
        <Shield className="w-3.5 h-3.5 text-slate-500 flex-shrink-0" />
        <span className="font-semibold text-slate-700 flex-1">Validierungsprotokoll</span>
        <StatusIcon className={cn('w-3.5 h-3.5 flex-shrink-0', statusIconColor)} />
        <span className={cn('font-medium', statusIconColor)}>{statusLabel}</span>
        {displayConf != null && (
          <span className={cn('ml-2 px-1.5 py-0.5 rounded-full font-bold text-[10px]',
            getConfidenceBg(displayConf), getConfidenceColor(displayConf)
          )}>
            {Math.round(displayConf * 100)}%
          </span>
        )}
        {expanded ? <ChevronUp className="w-3.5 h-3.5 text-slate-400" /> : <ChevronDown className="w-3.5 h-3.5 text-slate-400" />}
      </button>

      {/* Expanded detail */}
      {expanded && (
        <div className="px-3 pb-3 space-y-3 border-t border-slate-200/50">

          {/* Per-policy confidence + issues */}
          {policyIssues.map(({ pol, issues }, i) => (
            <div key={i} className="space-y-1">
              <p className="font-semibold text-slate-700 mt-2">
                {i + 1}. {pol.product || pol.product_short || pol.insurer || `Police ${i + 1}`}
                <span className="ml-1 font-normal text-muted-foreground">({pol.sparte || '?'})</span>
              </p>

              {/* Confidence pro Feld */}
              {pol.confidence && Object.keys(pol.confidence).some(k => pol.confidence[k] != null) && (
                <div className="bg-white/70 rounded p-2 space-y-0.5">
                  {pol.confidence.product != null && <ConfidencePill label="Produkt" value={pol.confidence.product} />}
                  {pol.confidence.premium_monthly != null && <ConfidencePill label="Prämie/Monat" value={pol.confidence.premium_monthly} />}
                  {pol.confidence.franchise != null && <ConfidencePill label="Franchise" value={pol.confidence.franchise} />}
                  {pol.confidence.section != null && <ConfidencePill label="KVG/VVG" value={pol.confidence.section} />}
                  {pol.confidence.dates != null && <ConfidencePill label="Datum" value={pol.confidence.dates} />}
                  {pol.confidence.policy_number != null && <ConfidencePill label="Policennummer" value={pol.confidence.policy_number} />}
                </div>
              )}

              {/* Validation issues */}
              {issues.length > 0 && (
                <div className="space-y-1">
                  {issues.map((issue, j) => <IssueRow key={j} issue={issue} />)}
                </div>
              )}
              {issues.length === 0 && (
                <div className="flex items-center gap-1 text-emerald-700 text-[10px]">
                  <CheckCircle2 className="w-3 h-3" /> Keine Regelabweichungen
                </div>
              )}
            </div>
          ))}

          {/* Person-level confidence */}
          {extracted?.confidence_persons && (
            <div>
              <p className="font-semibold text-slate-700 mt-2">Personendaten</p>
              <div className="bg-white/70 rounded p-2 space-y-0.5">
                {extracted.confidence_persons.policy_holder_name != null && (
                  <ConfidencePill label="Name Versicherungsnehmer" value={extracted.confidence_persons.policy_holder_name} />
                )}
                {extracted.confidence_persons.policy_holder_address != null && (
                  <ConfidencePill label="Adresse" value={extracted.confidence_persons.policy_holder_address} />
                )}
                {extracted.confidence_persons.insured_name != null && (
                  <ConfidencePill label="Name Versicherte Person" value={extracted.confidence_persons.insured_name} />
                )}
                {extracted.confidence_persons.role_distinction != null && (
                  <ConfidencePill label="VN ≠ VP Erkennung" value={extracted.confidence_persons.role_distinction} />
                )}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}