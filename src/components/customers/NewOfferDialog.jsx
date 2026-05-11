import React, { useState } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { base44 } from '@/api/base44Client'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'
import { TrendingUp } from 'lucide-react'

const INSURANCE_TYPES = [
  { value: 'kvg', label: 'KVG – Grundversicherung' },
  { value: 'vvg_krankenzusatz', label: 'VVG – Krankenzusatz' },
  { value: 'haftpflicht_privat', label: 'Haftpflicht Privat' },
  { value: 'hausrat', label: 'Hausrat' },
  { value: 'motorfahrzeug', label: 'Motorfahrzeug' },
  { value: 'leben', label: 'Leben / Vorsorge' },
  { value: 'rechtsschutz', label: 'Rechtsschutz' },
  { value: 'reise', label: 'Reise / Assistance' },
  { value: 'unfall', label: 'Unfall / UVG' },
  { value: 'other', label: 'Sonstiges' },
]

const INSURERS = [
  'AXA', 'Zurich', 'Helvetia', 'Mobiliar', 'Allianz', 'CSS', 'Helsana',
  'Swica', 'Sanitas', 'KPT', 'Groupe Mutuel', 'Sympany', 'Visana',
  'Assura', 'Concordia', 'Atupri', 'Sonstige'
]

export default function NewOfferDialog({ open, onOpenChange, customer }) {
  const queryClient = useQueryClient()
  const [form, setForm] = useState({
    sparte: '',
    insurer: '',
    product: '',
    estimated_premium_yearly: '',
    requested_start_date: '',
    notes: '',
  })

  const set = (key, val) => setForm(prev => ({ ...prev, [key]: val }))

  const createMutation = useMutation({
    mutationFn: (data) => base44.entities.Application.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['applications-all'] })
      queryClient.invalidateQueries({ queryKey: ['applications'] })
      queryClient.invalidateQueries({ queryKey: ['tasks'] })
      onOpenChange(false)
      setForm({ sparte: '', insurer: '', product: '', estimated_premium_yearly: '', requested_start_date: '', notes: '' })
    },
  })

  const handleSubmit = () => {
    if (!form.sparte || !form.insurer) return

    const yearlyPremium = parseFloat(form.estimated_premium_yearly) || 0

    createMutation.mutate({
      customer_id: customer.id,
      customer_name: `${customer.first_name} ${customer.last_name}`,
      primary_customer_id: customer.primary_customer_id || customer.id,
      organization_id: customer.organization_id,
      advisor_id: customer.advisor_id,
      assigned_broker: customer.assigned_broker,
      sparte: form.sparte,
      insurance_type: form.sparte,
      insurer: form.insurer,
      product: form.product,
      estimated_premium_yearly: yearlyPremium,
      estimated_premium_monthly: yearlyPremium > 0 ? Math.round(yearlyPremium / 12) : 0,
      requested_start_date: form.requested_start_date || null,
      notes: form.notes,
      status: 'new',
      kundentyp: customer.customer_type === 'business' ? 'firma' : 'privat',
    })
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <TrendingUp className="w-5 h-5 text-primary" />
            Neue Anfrage / Angebot
          </DialogTitle>
          <p className="text-sm text-muted-foreground">
            Für: <strong>{customer?.first_name} {customer?.last_name}</strong>
          </p>
        </DialogHeader>

        <div className="space-y-4 py-2">
          {/* Sparte */}
          <div className="space-y-1.5">
            <Label>Versicherungsart <span className="text-destructive">*</span></Label>
            <Select value={form.sparte} onValueChange={v => set('sparte', v)}>
              <SelectTrigger>
                <SelectValue placeholder="Sparte wählen..." />
              </SelectTrigger>
              <SelectContent>
                {INSURANCE_TYPES.map(t => (
                  <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Versicherer */}
          <div className="space-y-1.5">
            <Label>Versicherungsgesellschaft <span className="text-destructive">*</span></Label>
            <Select value={form.insurer} onValueChange={v => set('insurer', v)}>
              <SelectTrigger>
                <SelectValue placeholder="Versicherer wählen..." />
              </SelectTrigger>
              <SelectContent>
                {INSURERS.map(i => (
                  <SelectItem key={i} value={i}>{i}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Produkt */}
          <div className="space-y-1.5">
            <Label>Produkt / Tarif</Label>
            <Input
              placeholder="z.B. Telemed, Kombi, HMO..."
              value={form.product}
              onChange={e => set('product', e.target.value)}
            />
          </div>

          {/* Prämie + Startdatum */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Jahresprämie (CHF)</Label>
              <Input
                type="number"
                placeholder="0.00"
                value={form.estimated_premium_yearly}
                onChange={e => set('estimated_premium_yearly', e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label>Startdatum</Label>
              <Input
                type="date"
                value={form.requested_start_date}
                onChange={e => set('requested_start_date', e.target.value)}
              />
            </div>
          </div>

          {/* Notizen */}
          <div className="space-y-1.5">
            <Label>Notizen / Abschlusspotenzial</Label>
            <Textarea
              placeholder="Kundenbedürfnis, Abschlusspotenzial, offene Fragen..."
              rows={3}
              value={form.notes}
              onChange={e => set('notes', e.target.value)}
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Abbrechen</Button>
          <Button
            onClick={handleSubmit}
            disabled={!form.sparte || !form.insurer || createMutation.isPending}
          >
            {createMutation.isPending ? 'Wird erstellt...' : 'Anfrage erstellen'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}