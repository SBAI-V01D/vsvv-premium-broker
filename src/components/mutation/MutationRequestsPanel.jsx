import React, { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { base44 } from '@/api/base44Client'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Check, X, Loader2 } from 'lucide-react'
import { ALL_SPARTEN, getFieldsForSparte, FRANCHISE_OPTIONS } from '@/lib/insuranceSparten'

const grouped = ALL_SPARTEN.reduce((acc, s) => {
  if (!acc[s.group]) acc[s.group] = []
  acc[s.group].push(s)
  return acc
}, {})

const REQUEST_TYPE_LABELS = {
  address_change: 'Adresse ändern',
  coverage_change: 'Deckung ändern',
  vehicle_change: 'Fahrzeug ändern',
  other: 'Sonstiges',
}

export default function MutationRequestsPanel() {
  const [selectedRequest, setSelectedRequest] = useState(null)
  const [selectedContract, setSelectedContract] = useState(null)
  const [form, setForm] = useState(null)
  const [adminNotes, setAdminNotes] = useState('')
  const [saving, setSaving] = useState(false)
  const queryClient = useQueryClient()

  const { data: mutations = [] } = useQuery({
    queryKey: ['mutation-requests'],
    queryFn: () => base44.entities.MutationRequest.filter({ status: 'pending' }, '-created_date'),
  })

  const { data: customers = [] } = useQuery({
    queryKey: ['customers'],
    queryFn: () => base44.entities.Customer.list(),
  })

  const { data: contracts = [] } = useQuery({
    queryKey: ['contracts'],
    queryFn: () => base44.entities.Contract.list(),
  })

  const rejectMutation = useMutation({
    mutationFn: async (mutationId) => {
      const user = await base44.auth.me()
      return base44.entities.MutationRequest.update(mutationId, {
        status: 'rejected',
        reviewed_by: user.email,
        reviewed_at: new Date().toISOString(),
      })
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['mutation-requests'] })
    },
  })

  const openApproval = (mutReq) => {
    const contract = contracts.find(c => c.id === mutReq.policy_id)
    setSelectedRequest(mutReq)
    setSelectedContract(contract || null)
    setAdminNotes('')
    // Pre-fill form with existing contract data
    setForm(contract ? {
      insurer: contract.insurer || '',
      policy_number: contract.policy_number || '',
      sparte: contract.sparte || contract.insurance_type || '',
      product: contract.product || '',
      premium_monthly: contract.premium_monthly || '',
      premium_yearly: contract.premium_yearly || '',
      start_date: contract.start_date || '',
      end_date: contract.end_date || '',
      cancellation_deadline: contract.cancellation_deadline || '',
      notes: contract.notes || '',
      sparte_data: contract.sparte_data || {},
    } : {
      insurer: '', policy_number: '', sparte: '', product: '',
      premium_monthly: '', premium_yearly: '', start_date: '', end_date: '',
      cancellation_deadline: '', notes: '', sparte_data: {},
    })
  }

  const handleApprove = async () => {
    if (!selectedRequest || !form) return
    setSaving(true)
    const user = await base44.auth.me()

    // Archive old policy
    await base44.entities.Contract.update(selectedRequest.policy_id, { status: 'pending_change' })

    // Create new version with updated data
    await base44.entities.Contract.create({
      ...(selectedContract || {}),
      id: undefined,
      created_date: undefined,
      updated_date: undefined,
      created_by: undefined,
      insurer: form.insurer,
      policy_number: form.policy_number,
      insurance_type: form.sparte,
      sparte: form.sparte,
      sparte_data: form.sparte_data && Object.keys(form.sparte_data).length > 0 ? form.sparte_data : undefined,
      product: form.product,
      premium_monthly: form.premium_monthly ? Number(form.premium_monthly) : undefined,
      premium_yearly: form.premium_yearly ? Number(form.premium_yearly) : undefined,
      start_date: form.start_date || undefined,
      end_date: form.end_date || undefined,
      cancellation_deadline: form.cancellation_deadline || undefined,
      notes: form.notes || undefined,
      version_number: (selectedContract?.version_number || 1) + 1,
      parent_policy_id: selectedRequest.policy_id,
      status: 'active',
    })

    // Update mutation request
    await base44.entities.MutationRequest.update(selectedRequest.id, {
      status: 'approved',
      reviewed_by: user.email,
      reviewed_at: new Date().toISOString(),
      notes: adminNotes || undefined,
    })

    queryClient.invalidateQueries({ queryKey: ['mutation-requests'] })
    queryClient.invalidateQueries({ queryKey: ['contracts'] })
    setSaving(false)
    setSelectedRequest(null)
    setForm(null)
  }

  const set = (k, v) => setForm(p => ({ ...p, [k]: v }))
  const setSparte = (v) => setForm(p => ({ ...p, sparte: v, sparte_data: {} }))
  const setSparteData = (k, v) => setForm(p => ({ ...p, sparte_data: { ...p.sparte_data, [k]: v } }))
  const sparteFields = form ? getFieldsForSparte(form.sparte) : []
  const franchiseOptions = form ? (FRANCHISE_OPTIONS[form.sparte_data?.age_group] || FRANCHISE_OPTIONS.default) : []

  if (mutations.length === 0) {
    return (
      <Card>
        <CardContent className="p-8 text-center text-muted-foreground">
          Keine ausstehenden Mutations-Anfragen
        </CardContent>
      </Card>
    )
  }

  return (
    <div className="space-y-4">
      <h2 className="text-lg font-bold">Mutations-Anfragen ({mutations.length})</h2>

      <div className="space-y-3">
        {mutations.map(mutReq => {
          const customer = customers.find(c => c.id === mutReq.customer_id)
          const contract = contracts.find(c => c.id === mutReq.policy_id)
          return (
            <Card key={mutReq.id}>
              <CardContent className="p-4">
                <div className="flex justify-between items-start gap-4">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-2">
                      <span className="text-xs px-2 py-1 rounded-full bg-amber-100 text-amber-700 font-medium">PENDENT</span>
                      <p className="font-semibold text-sm">{REQUEST_TYPE_LABELS[mutReq.request_type] || mutReq.request_type}</p>
                    </div>
                    <div className="grid grid-cols-2 gap-3 text-xs mb-3">
                      <div>
                        <p className="text-muted-foreground">Kunde</p>
                        <p className="font-medium">{customer ? `${customer.first_name} ${customer.last_name}` : '—'}</p>
                      </div>
                      <div>
                        <p className="text-muted-foreground">Police-Nr.</p>
                        <p className="font-medium">{contract?.policy_number || mutReq.policy_number}</p>
                      </div>
                      <div className="col-span-2">
                        <p className="text-muted-foreground">Beschreibung</p>
                        <p className="font-medium">{mutReq.description}</p>
                      </div>
                    </div>
                    <p className="text-xs text-muted-foreground">{new Date(mutReq.created_date).toLocaleDateString('de-CH')}</p>
                  </div>
                  <div className="flex gap-2 flex-shrink-0">
                    <Button size="sm" variant="outline" onClick={() => openApproval(mutReq)} className="gap-1">
                      <Check className="w-3 h-3" /> Genehmigen
                    </Button>
                    <Button size="sm" variant="outline" className="text-destructive gap-1"
                      onClick={() => rejectMutation.mutate(mutReq.id)}
                      disabled={rejectMutation.isPending}>
                      <X className="w-3 h-3" /> Ablehnen
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          )
        })}
      </div>

      {/* APPROVAL DIALOG – same contract form as upload wizard / manual entry */}
      <Dialog open={!!selectedRequest} onOpenChange={(open) => { if (!open) { setSelectedRequest(null); setForm(null) } }}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Mutation genehmigen – Vertragsdaten anpassen</DialogTitle>
          </DialogHeader>

          {selectedRequest && form && (
            <div className="space-y-4">
              {/* Context banner */}
              <div className="p-3 bg-amber-50 border border-amber-200 rounded-lg text-xs text-amber-900">
                <p className="font-semibold">Kundenanfrage: {REQUEST_TYPE_LABELS[selectedRequest.request_type]}</p>
                <p className="mt-1 text-amber-800">{selectedRequest.description}</p>
              </div>

              {/* Same field layout as ContractForm / PolicyUploadWizard */}
              <div className="grid grid-cols-2 gap-3">
                <div className="col-span-2">
                  <Label className="text-xs">Versicherungsgesellschaft *</Label>
                  <Input value={form.insurer} onChange={e => set('insurer', e.target.value)} className="mt-1 h-8 text-sm" />
                </div>
                <div>
                  <Label className="text-xs">Versicherungssparte</Label>
                  <Select value={form.sparte} onValueChange={setSparte}>
                    <SelectTrigger className="mt-1 h-8 text-sm"><SelectValue placeholder="Wählen..." /></SelectTrigger>
                    <SelectContent>
                      {Object.entries(grouped).map(([group, items]) => (
                        <div key={group}>
                          <div className="px-2 py-1 text-xs font-semibold text-muted-foreground bg-muted/50">{group}</div>
                          {items.map(s => <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>)}
                        </div>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label className="text-xs">Policen-Nummer</Label>
                  <Input value={form.policy_number} onChange={e => set('policy_number', e.target.value)} className="mt-1 h-8 text-sm" />
                </div>
                <div className="col-span-2">
                  <Label className="text-xs font-semibold text-primary">Produkt / Tarif</Label>
                  <Input
                    value={form.product}
                    onChange={e => set('product', e.target.value)}
                    placeholder="z.B. COMPACT, HMO 1500, Vollkasko SB500, NATURA, TELEMED..."
                    className="mt-1 h-8 text-sm border-primary/30 focus:border-primary"
                  />
                </div>
                <div>
                  <Label className="text-xs">Monatsprämie (CHF)</Label>
                  <Input type="number" step="0.01" value={form.premium_monthly} onChange={e => set('premium_monthly', e.target.value)} className="mt-1 h-8 text-sm" />
                </div>
                <div>
                  <Label className="text-xs">Jahresprämie (CHF)</Label>
                  <Input type="number" step="0.01" value={form.premium_yearly} onChange={e => set('premium_yearly', e.target.value)} className="mt-1 h-8 text-sm" />
                </div>
                <div>
                  <Label className="text-xs">Vertragsbeginn</Label>
                  <Input type="date" value={form.start_date} onChange={e => set('start_date', e.target.value)} className="mt-1 h-8 text-sm" />
                </div>
                <div>
                  <Label className="text-xs">Vertragsende</Label>
                  <Input type="date" value={form.end_date} onChange={e => set('end_date', e.target.value)} className="mt-1 h-8 text-sm" />
                </div>
                <div className="col-span-2">
                  <Label className="text-xs">Kündigungsfrist</Label>
                  <Input type="date" value={form.cancellation_deadline} onChange={e => set('cancellation_deadline', e.target.value)} className="mt-1 h-8 text-sm" />
                </div>
              </div>

              {/* Sparte-specific fields */}
              {sparteFields.length > 0 && (
                <div className="p-3 bg-muted/30 rounded-lg border space-y-3">
                  <p className="text-xs font-semibold text-muted-foreground uppercase">Spartenspezifische Angaben</p>
                  <div className="grid grid-cols-2 gap-2">
                    {sparteFields.map(field => (
                      <div key={field.key}>
                        <Label className="text-xs">{field.label}</Label>
                        {field.type === 'franchise' ? (
                          <Select value={form.sparte_data?.[field.key] || ''} onValueChange={v => setSparteData(field.key, v)}>
                            <SelectTrigger className="mt-1 h-8 text-sm"><SelectValue placeholder="Wählen" /></SelectTrigger>
                            <SelectContent>{franchiseOptions.map(o => <SelectItem key={o} value={o}>CHF {o}</SelectItem>)}</SelectContent>
                          </Select>
                        ) : field.type === 'select' ? (
                          <Select value={form.sparte_data?.[field.key] || ''} onValueChange={v => setSparteData(field.key, v)}>
                            <SelectTrigger className="mt-1 h-8 text-sm"><SelectValue /></SelectTrigger>
                            <SelectContent>{field.options.map(o => <SelectItem key={o} value={o}>{o}</SelectItem>)}</SelectContent>
                          </Select>
                        ) : (
                          <Input type={field.type} value={form.sparte_data?.[field.key] || ''} onChange={e => setSparteData(field.key, e.target.value)} placeholder={field.placeholder || ''} className="mt-1 h-8 text-sm" />
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <div>
                <Label className="text-xs">Notizen</Label>
                <textarea
                  value={form.notes}
                  onChange={e => set('notes', e.target.value)}
                  rows={2}
                  className="mt-1 w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring resize-none"
                />
              </div>

              <div>
                <Label className="text-xs">Admin-Notiz (intern)</Label>
                <textarea
                  value={adminNotes}
                  onChange={e => setAdminNotes(e.target.value)}
                  placeholder="Interne Bemerkung zur Genehmigung..."
                  rows={2}
                  className="mt-1 w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring resize-none"
                />
              </div>
            </div>
          )}

          <DialogFooter>
            <Button variant="outline" onClick={() => { setSelectedRequest(null); setForm(null) }}>Abbrechen</Button>
            <Button onClick={handleApprove} disabled={saving} className="gap-2">
              {saving ? <><Loader2 className="w-4 h-4 animate-spin" /> Wird gespeichert...</> : <><Check className="w-4 h-4" /> Genehmigen & neue Version erstellen</>}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}