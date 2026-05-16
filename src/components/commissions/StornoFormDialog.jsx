/**
 * STORNO-FORMULAR
 * Erfasst einen Storno-Betrag direkt – ohne vorherige Provisionsbuchung.
 * Erstellt einen CommissionEntry mit is_storno=true und negativen Beträgen.
 */
import React, { useState, useMemo, useRef, useEffect } from 'react'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'
import { Search, X, User, CheckCircle2, AlertTriangle } from 'lucide-react'

const SWISS_INSURERS = [
  'Allianz', 'Axa', 'Baloise', 'CSS', 'Concordia', 'Die Mobiliar', 'Elvia', 'Generali',
  'Helvetia', 'Helsana', 'Mutuel', 'ÖKK', 'SWICA', 'Sanitas', 'Smile', 'Suva',
  'Swiss Life', 'Swiss Re', 'TCS', 'Visana', 'Zurich', 'Andere',
]
const ALL_SPARTEN = ['KVG', 'VVG', 'Leben', 'Sach', 'KFZ', 'BVG', 'Rechtsschutz', 'Haftpflicht', 'Hausrat']

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

const EMPTY_FORM = {
  storno_date: new Date().toISOString().split('T')[0],
  insurer: '',
  product_category: '',
  policy_number: '',
  customer_id: '',
  customer_name: '',
  advisor_id: '',
  advisor_name: '',
  organization_id: '',
  organization_name: '',
  // Courtage-Storno
  storno_courtage_amount: '',
  // Provisions-Storno
  storno_provision_amount: '',
  reason: '',
  notes: '',
}

export default function StornoFormDialog({ open, onClose, onSave, isSaving, customers, brokers, organizations }) {
  const [form, setForm] = useState(EMPTY_FORM)
  const [errors, setErrors] = useState({})

  useEffect(() => {
    if (open) { setForm(EMPTY_FORM); setErrors({}) }
  }, [open])

  const set = (updates) => setForm(prev => ({ ...prev, ...updates }))

  const validate = () => {
    const e = {}
    if (!form.storno_date) e.storno_date = 'Datum erforderlich'
    if (!form.insurer) e.insurer = 'Gesellschaft erforderlich'
    if (!form.advisor_id) e.advisor_id = 'Berater erforderlich'
    if (!form.organization_id) e.organization_id = 'Organisation erforderlich'
    if (!form.storno_courtage_amount && !form.storno_provision_amount)
      e.amount = 'Mindestens Courtage- oder Provisions-Storno-Betrag erforderlich'
    return e
  }

  const handleSave = () => {
    const e = validate()
    setErrors(e)
    if (Object.keys(e).length > 0) return

    const courtageAmt = parseFloat(form.storno_courtage_amount) || 0
    const provisionAmt = parseFloat(form.storno_provision_amount) || 0

    onSave({
      entry_date: form.storno_date,
      insurer: form.insurer,
      product_category: form.product_category || null,
      policy_number: form.policy_number || null,
      customer_id: form.customer_id || null,
      customer_name: form.customer_name || null,
      advisor_id: form.advisor_id,
      advisor_name: form.advisor_name,
      organization_id: form.organization_id,
      organization_name: form.organization_name,
      // Negative Courtage
      company_courtage_amount: courtageAmt > 0 ? -courtageAmt : 0,
      advisor_courtage_percentage: 100,
      advisor_courtage_amount: courtageAmt > 0 ? -courtageAmt : 0,
      courtage_payout_amount: courtageAmt > 0 ? -courtageAmt : 0,
      courtage_storno_percentage: 0,
      courtage_storno_amount: 0,
      courtage_status: 'cancelled',
      // Negative Provision
      company_provision_amount: provisionAmt > 0 ? -provisionAmt : 0,
      advisor_provision_percentage: 100,
      advisor_provision_amount: provisionAmt > 0 ? -provisionAmt : 0,
      provision_payout_amount: provisionAmt > 0 ? -provisionAmt : 0,
      provision_storno_percentage: 0,
      provision_storno_amount: 0,
      provision_status: 'cancelled',
      premium_yearly: 0,
      status: 'cancelled',
      is_storno: true,
      notes: [form.reason && `Grund: ${form.reason}`, form.notes].filter(Boolean).join(' | ') || 'Direkter Storno-Eintrag',
    })
  }

  const totalStorno = (parseFloat(form.storno_courtage_amount) || 0) + (parseFloat(form.storno_provision_amount) || 0)

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) onClose() }}>
      <DialogContent className="max-w-xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-red-700">
            <AlertTriangle className="w-5 h-5" />
            Storno erfassen
          </DialogTitle>
        </DialogHeader>

        <div className="bg-red-50 border border-red-200 rounded-lg p-3 text-sm text-red-700 mb-2">
          Erfasst einen <strong>negativen Storno-Eintrag</strong> direkt – ohne vorherige Provisionsbuchung im System.
        </div>

        <div className="space-y-4">
          {/* Datum + Gesellschaft */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-sm font-semibold">Storno-Datum *</label>
              <Input type="date" value={form.storno_date} onChange={e => set({ storno_date: e.target.value })}
                className={`mt-1 ${errors.storno_date ? 'border-red-400' : ''}`} />
              {errors.storno_date && <p className="text-xs text-red-500 mt-0.5">{errors.storno_date}</p>}
            </div>
            <div>
              <label className="text-sm font-semibold">Gesellschaft *</label>
              <Select value={form.insurer} onValueChange={v => set({ insurer: v })}>
                <SelectTrigger className={`mt-1 ${errors.insurer ? 'border-red-400' : ''}`}>
                  <SelectValue placeholder="Wählen..." />
                </SelectTrigger>
                <SelectContent>
                  {SWISS_INSURERS.map(i => <SelectItem key={i} value={i}>{i}</SelectItem>)}
                </SelectContent>
              </Select>
              {errors.insurer && <p className="text-xs text-red-500 mt-0.5">{errors.insurer}</p>}
            </div>
          </div>

          {/* Sparte + Police */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-sm font-semibold">Sparte</label>
              <Select value={form.product_category} onValueChange={v => set({ product_category: v })}>
                <SelectTrigger className="mt-1"><SelectValue placeholder="Wählen..." /></SelectTrigger>
                <SelectContent>
                  {ALL_SPARTEN.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="text-sm font-semibold">Policen-Nummer</label>
              <Input value={form.policy_number} onChange={e => set({ policy_number: e.target.value })}
                className="mt-1" placeholder="Optional" />
            </div>
          </div>

          {/* Kunde */}
          <div>
            <label className="text-sm font-semibold">Kunde / Versicherungsnehmer</label>
            <CustomerSearchField
              value={form.customer_name} customerId={form.customer_id}
              customers={customers}
              onChange={({ customer_id, customer_name }) => set({ customer_id, customer_name })}
            />
          </div>

          {/* Berater + Org */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-sm font-semibold">Berater *</label>
              <Select value={form.advisor_id} onValueChange={v => {
                const b = brokers.find(x => x.id === v)
                set({ advisor_id: v, advisor_name: b?.name || '' })
              }}>
                <SelectTrigger className={`mt-1 ${errors.advisor_id ? 'border-red-400' : ''}`}>
                  <SelectValue placeholder="Wählen..." />
                </SelectTrigger>
                <SelectContent>
                  {brokers.map(b => <SelectItem key={b.id} value={b.id}>{b.name}</SelectItem>)}
                </SelectContent>
              </Select>
              {errors.advisor_id && <p className="text-xs text-red-500 mt-0.5">{errors.advisor_id}</p>}
            </div>
            <div>
              <label className="text-sm font-semibold">Organisation *</label>
              <Select value={form.organization_id} onValueChange={v => {
                const o = organizations.find(x => x.id === v)
                set({ organization_id: v, organization_name: o?.name || '' })
              }}>
                <SelectTrigger className={`mt-1 ${errors.organization_id ? 'border-red-400' : ''}`}>
                  <SelectValue placeholder="Wählen..." />
                </SelectTrigger>
                <SelectContent>
                  {organizations.map(o => <SelectItem key={o.id} value={o.id}>{o.name}</SelectItem>)}
                </SelectContent>
              </Select>
              {errors.organization_id && <p className="text-xs text-red-500 mt-0.5">{errors.organization_id}</p>}
            </div>
          </div>

          {/* Storno-Beträge */}
          <div className="rounded-lg border border-red-200 overflow-hidden">
            <div className="bg-red-100 px-3 py-2 text-sm font-bold text-red-800">
              Storno-Beträge (werden negativ gebucht)
            </div>
            <div className="p-3 space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-sm font-semibold text-blue-700">Courtage-Storno (CHF)</label>
                  <Input type="number" step="0.01" min="0"
                    value={form.storno_courtage_amount}
                    onChange={e => set({ storno_courtage_amount: e.target.value })}
                    className="mt-1 border-blue-300" placeholder="0.00" />
                  <p className="text-xs text-blue-600 mt-0.5">Wird als −{form.storno_courtage_amount || '0.00'} CHF gebucht</p>
                </div>
                <div>
                  <label className="text-sm font-semibold text-emerald-700">Provisions-Storno (CHF)</label>
                  <Input type="number" step="0.01" min="0"
                    value={form.storno_provision_amount}
                    onChange={e => set({ storno_provision_amount: e.target.value })}
                    className="mt-1 border-emerald-300" placeholder="0.00" />
                  <p className="text-xs text-emerald-600 mt-0.5">Wird als −{form.storno_provision_amount || '0.00'} CHF gebucht</p>
                </div>
              </div>
              {errors.amount && <p className="text-xs text-red-500">{errors.amount}</p>}
              {totalStorno > 0 && (
                <div className="bg-red-50 border border-red-200 rounded px-3 py-2 text-sm font-bold text-red-700">
                  Gesamt-Storno: −CHF {totalStorno.toFixed(2)}
                </div>
              )}
            </div>
          </div>

          {/* Grund + Notizen */}
          <div>
            <label className="text-sm font-semibold">Storno-Grund</label>
            <Input value={form.reason} onChange={e => set({ reason: e.target.value })}
              className="mt-1" placeholder="z.B. Kündigung innert Stornoperiode, Nichtbezahlung..." />
          </div>
          <div>
            <label className="text-sm font-semibold">Notizen</label>
            <Textarea value={form.notes} onChange={e => set({ notes: e.target.value })}
              className="mt-1" rows={2} placeholder="Interne Bemerkungen..." />
          </div>
        </div>

        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={onClose} disabled={isSaving}>Abbrechen</Button>
          <Button onClick={handleSave} disabled={isSaving} className="min-w-40 bg-red-600 hover:bg-red-700">
            {isSaving ? 'Wird gespeichert...' : 'Storno buchen'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}