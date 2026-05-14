/**
 * FORMULAR: Courtage & Provision
 * ==============================
 * Abschnitt A: Vertragsgrundlagen
 * Abschnitt B: COURTAGE  (Gesellschaft → Firma → Berater)
 * Abschnitt C: PROVISION (Gesellschaft → Firma → Berater)
 *
 * FORMELN:
 *   Beratercourtage  = Gesellschaftscourtage  × Beratercourtage-%  / 100
 *   Beraterprovision = Gesellschaftsprovision × Beraterprovision-% / 100
 */
import React, { useRef, useEffect, useState, useMemo } from 'react'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'
import { Search, X, User, CheckCircle2, Calculator, Landmark, TrendingUp, Clock, FileText, ShieldCheck } from 'lucide-react'
import { formatCHF, roundCHF, validateCommissionForm, STATUS_META, canTransitionTo, DEFAULT_STORNO_PCT } from '@/lib/commissionEngine'

const SWISS_INSURERS = [
  'Allianz', 'Axa', 'Baloise', 'CSS', 'Concordia', 'Die Mobiliar', 'Elvia', 'Generali',
  'Helvetia', 'Helsana', 'Mutuel', 'ÖKK', 'SWICA', 'Sanitas', 'Smile', 'Suva',
  'Swiss Life', 'Swiss Re', 'TCS', 'Visana', 'Zurich', 'Andere',
]
const ALL_SPARTEN = ['KVG', 'VVG', 'Leben', 'Sach', 'KFZ', 'BVG', 'Rechtsschutz', 'Haftpflicht', 'Hausrat']

const STATUS_OPTIONS = [
  { value: 'pending',   label: 'Ausstehend',  icon: Clock },
  { value: 'invoiced',  label: 'Eingereicht', icon: FileText },
  { value: 'received',  label: 'Erhalten',    icon: TrendingUp },
  { value: 'earned',    label: 'Freigegeben', icon: ShieldCheck },
  { value: 'paid',      label: 'Ausbezahlt',  icon: CheckCircle2 },
  { value: 'cancelled', label: 'Storniert',   icon: X },
]

// ─── Customer Search ──────────────────────────────────────────────────────────
function CustomerSearchField({ value, customerId, onChange, customers }) {
  const [query, setQuery] = useState(value || '')
  const [open, setOpen] = useState(false)
  const ref = useRef(null)

  useEffect(() => { setQuery(value || '') }, [value])
  useEffect(() => {
    const handler = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false) }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  const filtered = useMemo(() => {
    if (!query.trim() || query.length < 2) return []
    const q = query.toLowerCase()
    return customers.filter(c =>
      `${c.first_name || ''} ${c.last_name || ''} ${c.company_name || ''} ${c.customer_number || ''} ${c.email || ''}`.toLowerCase().includes(q)
    ).slice(0, 10)
  }, [query, customers])

  const handleSelect = (customer) => {
    const name = customer.company_name || `${customer.first_name} ${customer.last_name}`
    setQuery(name); setOpen(false)
    onChange({ customer_id: customer.id, customer_name: name })
  }
  const handleClear = () => { setQuery(''); onChange({ customer_id: '', customer_name: '' }) }

  return (
    <div ref={ref} className="relative">
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        <Input value={query} onChange={e => { setQuery(e.target.value); setOpen(true) }}
          onFocus={() => query.length >= 2 && setOpen(true)}
          placeholder="Name, Kundennummer, E-Mail suchen..."
          className={`pl-9 pr-8 mt-1 ${customerId ? 'border-green-400 bg-green-50/30' : ''}`} />
        {(query || customerId) && (
          <button onClick={handleClear} className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground">
            <X className="w-4 h-4" />
          </button>
        )}
      </div>
      {customerId && (
        <p className="text-xs text-green-600 mt-0.5 flex items-center gap-1">
          <CheckCircle2 className="w-3 h-3" /> Kunde verknüpft
        </p>
      )}
      {open && filtered.length > 0 && (
        <div className="absolute z-50 w-full mt-1 bg-white border border-border rounded-lg shadow-lg max-h-60 overflow-y-auto">
          {filtered.map(c => {
            const name = c.company_name || `${c.first_name} ${c.last_name}`
            return (
              <button key={c.id} onMouseDown={e => { e.preventDefault(); handleSelect(c) }}
                className="w-full text-left px-3 py-2.5 hover:bg-muted/50 flex items-center gap-2 text-sm border-b last:border-0">
                <User className="w-4 h-4 text-muted-foreground flex-shrink-0" />
                <div className="flex-1 min-w-0">
                  <p className="font-medium truncate">{name}</p>
                  <p className="text-xs text-muted-foreground">{c.customer_number && <span className="mr-2">{c.customer_number}</span>}{c.email}</p>
                </div>
              </button>
            )
          })}
        </div>
      )}
      {open && query.length >= 2 && filtered.length === 0 && (
        <div className="absolute z-50 w-full mt-1 bg-white border border-border rounded-lg shadow-sm px-3 py-2 text-sm text-muted-foreground">
          Kein Kunde gefunden
        </div>
      )}
    </div>
  )
}

// ─── Brutto/Netto-Vorschau Courtage ──────────────────────────────────────────
function CourtagePreview({ data }) {
  const company   = parseFloat(data.company_courtage_amount) || 0
  const pct       = parseFloat(data.advisor_courtage_percentage) || 0
  const stornoPct = parseFloat(data.courtage_storno_percentage) ?? DEFAULT_STORNO_PCT
  if (company <= 0) return null
  const brutto    = roundCHF((company * pct) / 100)
  const reserve   = roundCHF((brutto * stornoPct) / 100)
  const netto     = roundCHF(brutto - reserve)
  return (
    <div className="mt-2 rounded-lg border border-blue-200 overflow-hidden text-xs">
      <div className="bg-blue-100 px-3 py-1.5 flex items-center gap-1.5">
        <Calculator className="w-3.5 h-3.5 text-blue-700" />
        <span className="font-bold text-blue-700 uppercase tracking-wide">Courtage-Berechnung</span>
      </div>
      <div className="bg-blue-50/40 p-3 space-y-2">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-muted-foreground w-28">Ges.courtage × %</span>
          <span className="bg-blue-100 text-blue-800 px-2 py-0.5 rounded font-mono">{formatCHF(company)} × {pct}%</span>
          <span className="text-muted-foreground">=</span>
          <span className="font-bold text-blue-800">{formatCHF(brutto)} Brutto</span>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-muted-foreground w-28">− Stornoreserve</span>
          <span className="bg-orange-100 text-orange-700 px-2 py-0.5 rounded font-mono">{stornoPct}%</span>
          <span className="text-muted-foreground">=</span>
          <span className="font-semibold text-orange-600">−{formatCHF(reserve)} Einbehalt</span>
        </div>
        <div className="flex items-center gap-2 flex-wrap border-t border-blue-200 pt-2">
          <span className="text-muted-foreground w-28">= Netto auszahlbar</span>
          <span className="bg-blue-600 text-white px-3 py-1 rounded-lg font-bold">{formatCHF(netto)}</span>
        </div>
      </div>
    </div>
  )
}

// ─── Brutto/Netto-Vorschau Provision ─────────────────────────────────────────
function ProvisionPreview({ data }) {
  const company   = parseFloat(data.company_provision_amount) || 0
  const pct       = parseFloat(data.advisor_provision_percentage) || 0
  const stornoPct = parseFloat(data.provision_storno_percentage) ?? DEFAULT_STORNO_PCT
  if (company <= 0) return null
  const brutto    = roundCHF((company * pct) / 100)
  const reserve   = roundCHF((brutto * stornoPct) / 100)
  const netto     = roundCHF(brutto - reserve)
  return (
    <div className="mt-2 rounded-lg border border-emerald-200 overflow-hidden text-xs">
      <div className="bg-emerald-100 px-3 py-1.5 flex items-center gap-1.5">
        <Calculator className="w-3.5 h-3.5 text-emerald-700" />
        <span className="font-bold text-emerald-700 uppercase tracking-wide">Provisions-Berechnung</span>
      </div>
      <div className="bg-emerald-50/40 p-3 space-y-2">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-muted-foreground w-28">Ges.provision × %</span>
          <span className="bg-emerald-100 text-emerald-800 px-2 py-0.5 rounded font-mono">{formatCHF(company)} × {pct}%</span>
          <span className="text-muted-foreground">=</span>
          <span className="font-bold text-emerald-800">{formatCHF(brutto)} Brutto</span>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-muted-foreground w-28">− Stornoreserve</span>
          <span className="bg-orange-100 text-orange-700 px-2 py-0.5 rounded font-mono">{stornoPct}%</span>
          <span className="text-muted-foreground">=</span>
          <span className="font-semibold text-orange-600">−{formatCHF(reserve)} Einbehalt</span>
        </div>
        <div className="flex items-center gap-2 flex-wrap border-t border-emerald-200 pt-2">
          <span className="text-muted-foreground w-28">= Netto auszahlbar</span>
          <span className="bg-emerald-600 text-white px-3 py-1 rounded-lg font-bold">{formatCHF(netto)}</span>
        </div>
      </div>
    </div>
  )
}

// ─── Section Header ───────────────────────────────────────────────────────────
function SectionHeader({ letter, title, subtitle, color }) {
  const colors = {
    gray:    'bg-muted/50 border-border text-foreground',
    blue:    'bg-blue-50 border-blue-200 text-blue-800',
    emerald: 'bg-emerald-50 border-emerald-200 text-emerald-800',
  }
  return (
    <div className={`rounded-lg border px-3 py-2 flex items-center gap-3 ${colors[color]}`}>
      <div className={`w-7 h-7 rounded-full flex items-center justify-center font-bold text-sm flex-shrink-0 ${
        color === 'blue' ? 'bg-blue-600 text-white' : color === 'emerald' ? 'bg-emerald-600 text-white' : 'bg-muted-foreground/20 text-foreground'
      }`}>{letter}</div>
      <div>
        <p className="font-bold text-sm leading-tight">{title}</p>
        {subtitle && <p className="text-xs opacity-70 leading-tight">{subtitle}</p>}
      </div>
    </div>
  )
}

// ─── Main Dialog ──────────────────────────────────────────────────────────────
export default function CommissionFormDialog({
  open, onClose, editingEntry, formData, formErrors, submitAttempted,
  onChange, onSave, isSaving, customers, brokers, organizations
}) {
  const allowedStatuses = (key) => {
    if (!editingEntry) return STATUS_OPTIONS.slice(0, 2)
    const current = formData[key] || 'pending'
    return STATUS_OPTIONS.filter(s => s.value === current || canTransitionTo(current, s.value))
  }

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) onClose() }}>
      <DialogContent className="max-w-2xl max-h-[94vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Calculator className="w-5 h-5 text-primary" />
            {editingEntry ? 'Abrechnung bearbeiten' : 'Neue Abrechnung erfassen'}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-5 py-1">

          {/* ──────────────────────────────────────────────
              A. VERTRAGSGRUNDLAGEN
              ────────────────────────────────────────────── */}
          <div className="space-y-3">
            <SectionHeader letter="A" title="Vertragsgrundlagen" color="gray" />
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-sm font-semibold">Buchungsdatum *</label>
                <Input type="date" value={formData.entry_date || ''}
                  onChange={e => onChange({ entry_date: e.target.value })}
                  className={`mt-1 ${formErrors.entry_date ? 'border-red-400' : ''}`} />
                {formErrors.entry_date && <p className="text-xs text-red-500 mt-0.5">{formErrors.entry_date}</p>}
              </div>
              <div>
                <label className="text-sm font-semibold">Vertragsbeginn</label>
                <Input type="date" value={formData.start_date || ''}
                  onChange={e => onChange({ start_date: e.target.value })} className="mt-1" />
              </div>
            </div>
            <div>
              <label className="text-sm font-semibold">Kunde / Versicherungsnehmer *</label>
              <CustomerSearchField
                value={formData.customer_name || ''} customerId={formData.customer_id || ''}
                customers={customers}
                onChange={({ customer_id, customer_name }) => onChange({ customer_id, customer_name })}
              />
              {formErrors.customer_name && <p className="text-xs text-red-500 mt-0.5">{formErrors.customer_name}</p>}
            </div>
            <div className="grid grid-cols-1 gap-3">
              <div>
                <label className="text-sm font-semibold">Berater *</label>
                <Select value={formData.advisor_id || ''} onValueChange={v => {
                  const b = brokers.find(x => x.id === v)
                  onChange({ advisor_id: v, advisor_name: b?.name || '' })
                }}>
                  <SelectTrigger className={`mt-1 ${formErrors.advisor_id ? 'border-red-400' : ''}`}>
                    <SelectValue placeholder="Berater wählen..." />
                  </SelectTrigger>
                  <SelectContent>
                    {brokers.length === 0
                      ? <SelectItem value="_none" disabled>Keine Berater</SelectItem>
                      : brokers.map(b => <SelectItem key={b.id} value={b.id}>{b.name}</SelectItem>)
                    }
                  </SelectContent>
                </Select>
                {formErrors.advisor_id && <p className="text-xs text-red-500 mt-0.5">{formErrors.advisor_id}</p>}
              </div>
              <div>
                <label className="text-sm font-semibold">Organisation *</label>
                <Select value={formData.organization_id || ''} onValueChange={v => {
                  const o = organizations.find(x => x.id === v)
                  onChange({ organization_id: v, organization_name: o?.name || '' })
                }}>
                  <SelectTrigger className={`mt-1 ${formErrors.organization_id ? 'border-red-400' : ''}`}>
                    <SelectValue placeholder="Organisation wählen..." />
                  </SelectTrigger>
                  <SelectContent>
                    {organizations.length === 0
                      ? <SelectItem value="_none" disabled>Keine Organisationen</SelectItem>
                      : organizations.map(o => <SelectItem key={o.id} value={o.id}>{o.name}</SelectItem>)
                    }
                  </SelectContent>
                </Select>
                {formErrors.organization_id && <p className="text-xs text-red-500 mt-0.5">{formErrors.organization_id}</p>}
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-sm font-semibold">Gesellschaft *</label>
                <Select value={formData.insurer || ''} onValueChange={v => onChange({ insurer: v })}>
                  <SelectTrigger className={`mt-1 ${formErrors.insurer ? 'border-red-400' : ''}`}>
                    <SelectValue placeholder="Wählen..." />
                  </SelectTrigger>
                  <SelectContent>
                    {SWISS_INSURERS.map(i => <SelectItem key={i} value={i}>{i}</SelectItem>)}
                  </SelectContent>
                </Select>
                {formErrors.insurer && <p className="text-xs text-red-500 mt-0.5">{formErrors.insurer}</p>}
              </div>
              <div>
                <label className="text-sm font-semibold">Sparte *</label>
                <Select value={formData.product_category || ''} onValueChange={v => onChange({ product_category: v })}>
                  <SelectTrigger className={`mt-1 ${formErrors.product_category ? 'border-red-400' : ''}`}>
                    <SelectValue placeholder="Wählen..." />
                  </SelectTrigger>
                  <SelectContent>
                    {ALL_SPARTEN.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}
                  </SelectContent>
                </Select>
                {formErrors.product_category && <p className="text-xs text-red-500 mt-0.5">{formErrors.product_category}</p>}
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-sm font-semibold">Policen-Nummer</label>
                <Input value={formData.policy_number || ''}
                  onChange={e => onChange({ policy_number: e.target.value })}
                  className="mt-1" placeholder="POL-2024-001" />
              </div>
              <div>
                <label className="text-sm font-semibold">Jahresprämie (CHF) *</label>
                <Input type="number" step="0.01" min="0"
                  value={formData.premium_yearly || ''}
                  onChange={e => onChange({ premium_yearly: e.target.value })}
                  className={`mt-1 ${formErrors.premium_yearly ? 'border-red-400' : ''}`}
                  placeholder="0.00" />
                {formErrors.premium_yearly && <p className="text-xs text-red-500 mt-0.5">{formErrors.premium_yearly}</p>}
                <p className="text-xs text-muted-foreground mt-0.5">Nur Referenz – nicht Berechnungsgrundlage</p>
              </div>
            </div>
          </div>

          {/* ──────────────────────────────────────────────
              B. COURTAGE
              ────────────────────────────────────────────── */}
          <div className="space-y-3">
            <SectionHeader
              letter="B" color="blue"
              title="COURTAGE"
              subtitle="Gesellschaft → Firma → Berater · Formel: Gesellschaftscourtage × Beratercourtage-% = Beratercourtage"
            />
            {formErrors.company_courtage_amount && (
              <p className="text-xs text-amber-600 bg-amber-50 px-3 py-1.5 rounded border border-amber-200">
                {formErrors.company_courtage_amount}
              </p>
            )}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-sm font-semibold text-blue-700">
                  <Landmark className="w-3.5 h-3.5 inline mr-1" />
                  Gesellschaftscourtage (CHF)
                </label>
                <Input type="number" step="0.01" min="0"
                  value={formData.company_courtage_amount || ''}
                  onChange={e => onChange({ company_courtage_amount: e.target.value })}
                  className={`mt-1 border-blue-300 focus:border-blue-500 ${formErrors.company_courtage_amount ? 'border-red-400' : ''}`}
                  placeholder="0.00" />
                <p className="text-xs text-blue-600 mt-0.5 font-medium">← Berechnungsgrundlage Courtage</p>
              </div>
              <div>
                <label className="text-sm font-semibold text-blue-700">Beratercourtage (%)</label>
                <Input type="number" step="0.1" min="0" max="100"
                  value={formData.advisor_courtage_percentage || ''}
                  onChange={e => onChange({ advisor_courtage_percentage: e.target.value })}
                  className={`mt-1 border-blue-300 focus:border-blue-500 ${formErrors.advisor_courtage_percentage ? 'border-red-400' : ''}`}
                  placeholder="z.B. 50" />
                {formErrors.advisor_courtage_percentage && <p className="text-xs text-red-500 mt-0.5">{formErrors.advisor_courtage_percentage}</p>}
              </div>
              <div>
                <label className="text-sm font-semibold text-orange-700">Stornoabzug Courtage (%)</label>
                <Input type="number" step="0.1" min="0" max="100"
                  value={formData.courtage_storno_percentage ?? DEFAULT_STORNO_PCT}
                  onChange={e => onChange({ courtage_storno_percentage: e.target.value })}
                  className={`mt-1 border-orange-300 focus:border-orange-500 ${formErrors.courtage_storno_percentage ? 'border-red-400' : ''}`}
                  placeholder="10" />
                {formErrors.courtage_storno_percentage
                  ? <p className="text-xs text-red-500 mt-0.5">{formErrors.courtage_storno_percentage}</p>
                  : <p className="text-xs text-orange-600 mt-0.5">Standard: 10% · Brutto − Reserve = Netto</p>}
              </div>
              <div>
                <label className="text-sm font-semibold text-muted-foreground">Courtage erhalten am</label>
                <Input type="date" value={formData.courtage_received_date || ''}
                  onChange={e => onChange({ courtage_received_date: e.target.value })}
                  className="mt-1" />
              </div>
              <div>
                <label className="text-sm font-semibold">Courtage Status</label>
                <Select value={formData.courtage_status || 'pending'}
                  onValueChange={v => onChange({ courtage_status: v, status: v })}>
                  <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {allowedStatuses('courtage_status').map(s => (
                      <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <CourtagePreview data={formData} />
          </div>

          {/* ──────────────────────────────────────────────
              C. PROVISION
              ────────────────────────────────────────────── */}
          <div className="space-y-3">
            <SectionHeader
              letter="C" color="emerald"
              title="PROVISION"
              subtitle="Gesellschaft → Firma → Berater · Formel: Gesellschaftsprovision × Beraterprovision-% = Beraterprovision"
            />
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-sm font-semibold text-emerald-700">
                  <Landmark className="w-3.5 h-3.5 inline mr-1" />
                  Gesellschaftsprovision (CHF)
                </label>
                <Input type="number" step="0.01" min="0"
                  value={formData.company_provision_amount || ''}
                  onChange={e => onChange({ company_provision_amount: e.target.value })}
                  className="mt-1 border-emerald-300 focus:border-emerald-500"
                  placeholder="0.00 (optional)" />
                <p className="text-xs text-emerald-600 mt-0.5 font-medium">← Berechnungsgrundlage Provision</p>
              </div>
              <div>
                <label className="text-sm font-semibold text-emerald-700">Beraterprovision (%)</label>
                <Input type="number" step="0.1" min="0" max="100"
                  value={formData.advisor_provision_percentage || ''}
                  onChange={e => onChange({ advisor_provision_percentage: e.target.value })}
                  className={`mt-1 border-emerald-300 focus:border-emerald-500 ${formErrors.advisor_provision_percentage ? 'border-red-400' : ''}`}
                  placeholder="z.B. 50" />
                {formErrors.advisor_provision_percentage && <p className="text-xs text-red-500 mt-0.5">{formErrors.advisor_provision_percentage}</p>}
              </div>
              <div>
                <label className="text-sm font-semibold text-orange-700">Stornoabzug Provision (%)</label>
                <Input type="number" step="0.1" min="0" max="100"
                  value={formData.provision_storno_percentage ?? DEFAULT_STORNO_PCT}
                  onChange={e => onChange({ provision_storno_percentage: e.target.value })}
                  className={`mt-1 border-orange-300 focus:border-orange-500 ${formErrors.provision_storno_percentage ? 'border-red-400' : ''}`}
                  placeholder="10" />
                {formErrors.provision_storno_percentage
                  ? <p className="text-xs text-red-500 mt-0.5">{formErrors.provision_storno_percentage}</p>
                  : <p className="text-xs text-orange-600 mt-0.5">Standard: 10% · Brutto − Reserve = Netto</p>}
              </div>
              <div>
                <label className="text-sm font-semibold text-muted-foreground">Provision erhalten am</label>
                <Input type="date" value={formData.provision_received_date || ''}
                  onChange={e => onChange({ provision_received_date: e.target.value })}
                  className="mt-1" />
              </div>
              <div>
                <label className="text-sm font-semibold">Provisions Status</label>
                <Select value={formData.provision_status || 'pending'}
                  onValueChange={v => onChange({ provision_status: v })}>
                  <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {allowedStatuses('provision_status').map(s => (
                      <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <ProvisionPreview data={formData} />
          </div>

          {/* Notizen */}
          <div>
            <label className="text-sm font-semibold">Notizen</label>
            <Textarea value={formData.notes || ''}
              onChange={e => onChange({ notes: e.target.value })}
              className="mt-1" rows={2} placeholder="Interne Bemerkungen..." />
          </div>

          {/* Validation Summary */}
          {submitAttempted && Object.keys(formErrors).length > 0 && (
            <div className="bg-red-50 border border-red-200 rounded-lg p-3 text-sm text-red-700">
              <strong>Pflichtfelder ausfüllen:</strong>
              <ul className="mt-1 list-disc list-inside space-y-0.5">
                {Object.entries(formErrors).map(([k, v]) => <li key={k}>{v}</li>)}
              </ul>
            </div>
          )}
        </div>

        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={onClose}>Abbrechen</Button>
          <Button onClick={onSave} disabled={isSaving} className="min-w-36">
            {isSaving ? 'Speichern...' : editingEntry ? 'Änderungen speichern' : 'Abrechnung speichern'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}