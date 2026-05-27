import React, { useState } from 'react'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Button } from '@/components/ui/button'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'
import { DialogFooter } from '@/components/ui/dialog'
import { ALL_SPARTEN, getFieldsForSparte, FRANCHISE_OPTIONS } from '@/lib/insuranceSparten'
import { AlertTriangle, Brain, CheckCircle2 } from 'lucide-react'

const NON_RENEWAL_REASONS = [
  { value: 'better_conditions',    label: 'Bessere Konditionen beim Mitbewerber' },
  { value: 'health_reasons',       label: 'Gesundheitsgründe / Risikoausschluss' },
  { value: 'price',                label: 'Preis zu hoch' },
  { value: 'competitive_offer',    label: 'Konkurrenzangebot angenommen' },
  { value: 'customer_request',     label: 'Kundenwunsch (ohne Begründung)' },
  { value: 'policy_ended_naturally', label: 'Natürlicher Ablauf / kein Bedarf' },
  { value: 'other',                label: 'Andere Gründe' },
]

const grouped = ALL_SPARTEN.reduce((acc, s) => {
  if (!acc[s.group]) acc[s.group] = []
  acc[s.group].push(s)
  return acc
}, {})

export default function ContractForm({ contract, customers = [], onSave, onCancel, saving }) {
  const [form, setForm] = useState(() => {
    if (contract) {
      const normalized = {}
      for (const [k, v] of Object.entries(contract)) {
        normalized[k] = v === null || v === undefined ? '' : v
      }
      return {
        ...normalized,
        sparte: contract.sparte || contract.insurance_type || '',
        sparte_data: contract.sparte_data || {},
      }
    }
    return {
      customer_id: '',
      insurer: '',
      policy_number: '',
      insurance_type: '',
      sparte: '',
      product: '',
      premium_monthly: '',
      premium_yearly: '',
      start_date: '',
      end_date: '',
      cancellation_deadline: '',
      status: 'active',
      commission_rate: '',
      notes: '',
      renewal_statistics_note: '',
      sparte_data: {},
    }
  })

  const selectedCustomer = customers.find(c => c.id === form.customer_id)
  const set = (k, v) => setForm(prev => ({ ...prev, [k]: v }))
  const setSparte = (v) => setForm(prev => ({ ...prev, sparte: v, insurance_type: v, sparte_data: {} }))
  const setSparteData = (k, v) => setForm(prev => ({ ...prev, sparte_data: { ...prev.sparte_data, [k]: v } }))

  const sparteFields = getFieldsForSparte(form.sparte)
  const franchiseOptions = FRANCHISE_OPTIONS[form.sparte_data?.age_group] || FRANCHISE_OPTIONS.default
  const primaryCustomers = customers.filter(c => !c.is_family_member)

  const missingEndDate = !form.end_date || form.end_date === ''
  const missingCancelDate = !form.cancellation_deadline || form.cancellation_deadline === ''

  const handleSubmit = (e) => {
    e.preventDefault()
    const customer = customers.find(c => c.id === form.customer_id)
    const organization_id = customer?.organization_id || form.organization_id || ''

    // Placeholder-Logik: fehlende Daten → 9999-12-31 setzen + requires_review markieren
    let end_date = form.end_date || ''
    let cancellation_deadline = form.cancellation_deadline || ''
    let requires_review = false
    let date_quality_status = 'verified'

    if (!end_date || !cancellation_deadline) {
      if (!end_date) end_date = '9999-12-31'
      if (!cancellation_deadline) cancellation_deadline = '9999-12-31'
      requires_review = true
      date_quality_status = 'placeholder'
    }

    onSave({
      customer_id: form.customer_id,
      customer_name: customer ? `${customer.first_name} ${customer.last_name}` : (form.customer_name || ''),
      primary_customer_id: customer?.is_family_member ? customer.primary_customer_id : (customer?.id || form.primary_customer_id),
      is_family_member: customer?.is_family_member ?? form.is_family_member ?? false,
      organization_id,
      advisor_id: customer?.advisor_id || form.advisor_id,
      insurer: form.insurer,
      policy_number: form.policy_number || '',
      insurance_type: form.sparte || '',
      sparte: form.sparte || '',
      sparte_data: form.sparte_data || {},
      product: form.product || '',
      premium_monthly: form.premium_monthly ? Number(form.premium_monthly) : undefined,
      premium_yearly: form.premium_yearly ? Number(form.premium_yearly) : undefined,
      start_date: form.start_date || '',
      end_date,
      cancellation_deadline,
      requires_review,
      date_quality_status,
      status: form.status || 'active',
      custom_status: form.custom_status,
      commission_rate: form.commission_rate ? Number(form.commission_rate) : undefined,
      notes: form.notes || '',
      non_renewal_reason: form.non_renewal_reason || null,
      exclude_from_renewal_statistics: form.exclude_from_renewal_statistics === true,
      renewal_statistics_note: form.renewal_statistics_note || '',
    })
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <Label>Kunde *</Label>
        <Select value={form.customer_id} onValueChange={v => set('customer_id', v)}>
          <SelectTrigger className="mt-1"><SelectValue placeholder="Kunde auswählen" /></SelectTrigger>
          <SelectContent>
            {primaryCustomers.map(primary => {
              const familyMembers = customers.filter(c => c.primary_customer_id === primary.id)
              return (
                <div key={primary.id}>
                  <SelectItem value={primary.id}>
                    {primary.first_name} {primary.last_name} (Hauptkunde)
                  </SelectItem>
                  {familyMembers.map(member => (
                    <SelectItem key={member.id} value={member.id} className="pl-8">
                      └ {member.first_name} {member.last_name} ({member.family_role})
                    </SelectItem>
                  ))}
                </div>
              )
            })}
          </SelectContent>
        </Select>
      </div>

      <div>
        <Label>Versicherungsgesellschaft *</Label>
        <Input value={form.insurer} onChange={e => set('insurer', e.target.value)} required className="mt-1" />
      </div>

      <div>
        <Label>Versicherungssparte *</Label>
        <Select value={form.sparte} onValueChange={setSparte}>
          <SelectTrigger className="mt-1"><SelectValue placeholder="Sparte wählen" /></SelectTrigger>
          <SelectContent>
            {Object.entries(grouped).map(([group, items]) => (
              <div key={group}>
                <div className="px-2 py-1 text-xs font-semibold text-muted-foreground bg-muted/50 sticky top-0">{group}</div>
                {items.map(s => (
                  <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>
                ))}
              </div>
            ))}
          </SelectContent>
        </Select>
      </div>

      {sparteFields.length > 0 && (
        <div className="p-4 bg-muted/30 rounded-lg border border-border space-y-4">
          <p className="text-sm font-semibold text-foreground">Spartenspezifische Angaben</p>
          <div className="grid grid-cols-2 gap-3">
            {sparteFields.map(field => (
              <div key={field.key}>
                <Label>{field.label}</Label>
                {field.type === 'franchise' ? (
                  <Select value={form.sparte_data?.[field.key] || ''} onValueChange={v => setSparteData(field.key, v)}>
                    <SelectTrigger className="mt-1"><SelectValue placeholder="Franchise wählen" /></SelectTrigger>
                    <SelectContent>
                      {franchiseOptions.map(o => <SelectItem key={o} value={o}>CHF {o}</SelectItem>)}
                    </SelectContent>
                  </Select>
                ) : field.type === 'select' ? (
                  <Select value={form.sparte_data?.[field.key] || ''} onValueChange={v => setSparteData(field.key, v)}>
                    <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {field.options.map(o => <SelectItem key={o} value={o}>{o}</SelectItem>)}
                    </SelectContent>
                  </Select>
                ) : (
                  <Input
                    type={field.type}
                    value={form.sparte_data?.[field.key] || ''}
                    onChange={e => setSparteData(field.key, e.target.value)}
                    placeholder={field.placeholder || ''}
                    className="mt-1"
                  />
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      <div>
        <Label>Policen-Nummer</Label>
        <Input value={form.policy_number} onChange={e => set('policy_number', e.target.value)} className="mt-1" />
      </div>

      <div>
        <Label>Produkt / Tarif</Label>
        <Input value={form.product} onChange={e => set('product', e.target.value)} className="mt-1" />
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <Label>Monatsprämie (CHF)</Label>
          <Input type="number" step="0.01" value={form.premium_monthly} onChange={e => set('premium_monthly', e.target.value)} className="mt-1" />
        </div>
        <div>
          <Label>Jahresprämie (CHF)</Label>
          <Input type="number" step="0.01" value={form.premium_yearly} onChange={e => set('premium_yearly', e.target.value)} className="mt-1" />
        </div>
      </div>

      <div className="grid grid-cols-3 gap-3">
        <div>
          <Label>Vertragsbeginn</Label>
          <Input type="date" value={form.start_date} onChange={e => set('start_date', e.target.value)} className="mt-1" />
        </div>
        <div>
          <Label>Vertragsende</Label>
          <Input type="date" value={form.end_date} onChange={e => set('end_date', e.target.value)} className="mt-1" />
          {missingEndDate && (
            <p className="text-[10px] text-amber-600 mt-1 flex items-center gap-1">
              <AlertTriangle className="w-2.5 h-2.5" /> Leer → Platzhalter 9999-12-31
            </p>
          )}
        </div>
        <div>
          <Label>Kündigungsfrist</Label>
          <Input type="date" value={form.cancellation_deadline} onChange={e => set('cancellation_deadline', e.target.value)} className="mt-1" />
          {missingCancelDate && (
            <p className="text-[10px] text-amber-600 mt-1 flex items-center gap-1">
              <AlertTriangle className="w-2.5 h-2.5" /> Leer → Platzhalter wird gesetzt
            </p>
          )}
        </div>
      </div>

      {(missingEndDate || missingCancelDate) && (
        <div className="flex items-start gap-2 px-3 py-2 rounded-lg bg-amber-50 border border-amber-200 text-xs text-amber-800">
          <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5 text-amber-600" />
          <span>
            Fehlende Daten werden als <strong>Platzhalter (9999-12-31)</strong> gespeichert.
            Der Vertrag wird als <strong>«Datumsprüfung ausstehend»</strong> markiert und im Renewal-Center separat angezeigt.
          </span>
        </div>
      )}

      <div>
        <Label>Provisionsquote (%)</Label>
        <Input type="number" step="0.01" value={form.commission_rate} onChange={e => set('commission_rate', e.target.value)} className="mt-1" />
      </div>

      <div>
        <Label>Notizen</Label>
        <Textarea value={form.notes} onChange={e => set('notes', e.target.value)} className="mt-1" rows={2} />
      </div>

      {/* Nicht-Erneuerung */}
      <div className="rounded-lg border border-border p-3 space-y-3 bg-muted/20">
        <p className="text-xs font-semibold text-foreground flex items-center gap-1.5">
          <Brain className="w-3.5 h-3.5 text-primary" /> Nicht-Erneuerung
        </p>

        {form.ai_non_renewal_suggestion && !form.non_renewal_reason && (
          <div className="flex items-start gap-2 px-3 py-2 rounded-md bg-blue-50 border border-blue-200 text-xs text-blue-800">
            <Brain className="w-3.5 h-3.5 shrink-0 mt-0.5 text-blue-500" />
            <div>
              <p className="font-semibold mb-0.5">KI-Vorschlag (noch nicht bestätigt)</p>
              <p>{form.ai_non_renewal_suggestion}</p>
              <p className="text-blue-600 mt-1">Bitte Grund unten auswählen und bestätigen.</p>
            </div>
          </div>
        )}

        <div>
          <Label className="text-xs">Grund für Nicht-Erneuerung</Label>
          <Select value={form.non_renewal_reason || ''} onValueChange={v => set('non_renewal_reason', v || null)}>
            <SelectTrigger className="mt-1 h-8 text-xs"><SelectValue placeholder="Kein Grund erfasst" /></SelectTrigger>
            <SelectContent>
              <SelectItem value={null}>– Kein Grund erfasst –</SelectItem>
              {NON_RENEWAL_REASONS.map(r => (
                <SelectItem key={r.value} value={r.value}>{r.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <label className="flex items-start gap-2 cursor-pointer group">
          <input
            type="checkbox"
            checked={!!form.exclude_from_renewal_statistics}
            onChange={e => set('exclude_from_renewal_statistics', e.target.checked)}
            className="mt-0.5 w-3.5 h-3.5 accent-primary"
          />
          <div>
            <p className="text-xs font-medium text-foreground group-hover:text-primary transition-colors">
              Aus Erneuerungsstatistik ausschliessen
            </p>
            <p className="text-[10px] text-muted-foreground">
              Vertrag erscheint weiterhin in der Liste, wird aber nicht in der Erneuerungs-KPI gezählt.
            </p>
          </div>
        </label>

        {form.exclude_from_renewal_statistics && (
          <div className="space-y-2">
            <div className="flex items-center gap-1.5 text-[10px] text-emerald-700 bg-emerald-50 border border-emerald-200 rounded px-2 py-1">
              <CheckCircle2 className="w-3 h-3" /> Berater hat diesen Vertrag manuell ausgeschlossen.
            </div>
            <div>
              <Label className="text-xs">Begründung für Ausschluss <span className="text-red-500">*</span></Label>
              <Textarea
                value={form.renewal_statistics_note || ''}
                onChange={e => set('renewal_statistics_note', e.target.value)}
                placeholder="z.B. Vertrag wird aus gesundheitlichen Gründen weitergeführt, kein regulärer Ablauf erwartet..."
                className="mt-1 text-xs"
                rows={2}
              />
              <p className="text-[10px] text-muted-foreground mt-1">Erscheint als Tooltip im Renewal-Center.</p>
            </div>
          </div>
        )}
      </div>

      <DialogFooter>
        <Button type="button" variant="outline" onClick={onCancel} disabled={saving}>
          Abbrechen
        </Button>
        <Button type="submit" disabled={saving}>
          {saving ? 'Speichern...' : (contract ? 'Aktualisieren' : 'Erstellen')}
        </Button>
      </DialogFooter>
    </form>
  )
}