import React, { useState } from 'react'
import { useMutation, useQueryClient, useQuery } from '@tanstack/react-query'
import { base44 } from '@/api/base44Client'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'
import { Loader2, Save } from 'lucide-react'

const CATEGORY_OPTIONS = [
  { value: 'contract',       label: 'Police / Vertragsdokument' },
  { value: 'application',   label: 'Antrag' },
  { value: 'identification', label: 'Ausweis / Identifikation' },
  { value: 'correspondence', label: 'Korrespondenz' },
  { value: 'other',         label: 'Sonstiges' },
]

const DOC_TYPE_OPTIONS = [
  { value: 'antrag', label: 'Antrag (KI-Verarbeitung)' },
  { value: 'anlage', label: 'Anlage / Dokument' },
]

export default function DocumentEditDialog({ document, open, onOpenChange }) {
  const queryClient = useQueryClient()

  const [form, setForm] = useState({
    name:        document?.name || '',
    notes:       document?.notes || '',
    category:    document?.category || 'other',
    doc_type:    document?.doc_type || 'anlage',
    customer_id: document?.customer_id || '',
  })

  const { data: customers = [] } = useQuery({
    queryKey: ['customers-minimal'],
    queryFn: () => base44.entities.Customer.filter({ archived: false }, '-created_date', 500),
    staleTime: 5 * 60 * 1000,
    enabled: open,
  })

  const updateMutation = useMutation({
    mutationFn: (data) => base44.entities.Document.update(document.id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['documents'] })
      queryClient.invalidateQueries({ queryKey: ['documents', document?.customer_id] })
      queryClient.invalidateQueries({ queryKey: ['documents', form.customer_id] })
      onOpenChange(false)
    },
  })

  const handleSave = () => {
    const selectedCustomer = customers.find(c => c.id === form.customer_id)
    const updates = {
      name: form.name,
      notes: form.notes || null,
      category: form.category,
      doc_type: form.doc_type,
    }
    if (form.customer_id) {
      updates.customer_id = form.customer_id
      updates.customer_name = selectedCustomer
        ? (selectedCustomer.company_name || `${selectedCustomer.first_name} ${selectedCustomer.last_name}`)
        : document.customer_name
      if (selectedCustomer?.is_family_member) {
        updates.primary_customer_id = selectedCustomer.primary_customer_id || form.customer_id
        updates.is_family_member = true
      } else {
        updates.primary_customer_id = form.customer_id
        updates.is_family_member = false
      }
    }
    updateMutation.mutate(updates)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Dokument bearbeiten</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 py-2">
          <div>
            <Label>Name</Label>
            <Input value={form.name} onChange={e => setForm(p => ({ ...p, name: e.target.value }))} className="mt-1" />
          </div>

          <div>
            <Label>Kunde zuweisen</Label>
            <Select value={form.customer_id} onValueChange={v => setForm(p => ({ ...p, customer_id: v }))}>
              <SelectTrigger className="mt-1">
                <SelectValue placeholder="Kunden auswählen..." />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={null}>– Kein Kunde –</SelectItem>
                {customers.map(c => (
                  <SelectItem key={c.id} value={c.id}>
                    {c.customer_type === 'business'
                      ? (c.company_name || `${c.first_name} ${c.last_name}`)
                      : `${c.first_name} ${c.last_name}`
                    }
                    {c.is_family_member ? ' (FM)' : ''}
                    {c.customer_number ? ` · ${c.customer_number}` : ''}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Kategorie</Label>
              <Select value={form.category} onValueChange={v => setForm(p => ({ ...p, category: v }))}>
                <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {CATEGORY_OPTIONS.map(o => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Dokumenttyp</Label>
              <Select value={form.doc_type} onValueChange={v => setForm(p => ({ ...p, doc_type: v }))}>
                <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {DOC_TYPE_OPTIONS.map(o => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div>
            <Label>Bemerkungen</Label>
            <Textarea value={form.notes} onChange={e => setForm(p => ({ ...p, notes: e.target.value }))} rows={2} className="mt-1" />
          </div>

          {updateMutation.error && (
            <p className="text-xs text-red-600">{updateMutation.error.message}</p>
          )}

          <div className="flex justify-end gap-2 pt-1">
            <Button variant="outline" onClick={() => onOpenChange(false)}>Abbrechen</Button>
            <Button onClick={handleSave} disabled={updateMutation.isPending || !form.name}>
              {updateMutation.isPending ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Save className="w-4 h-4 mr-2" />}
              Speichern
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}