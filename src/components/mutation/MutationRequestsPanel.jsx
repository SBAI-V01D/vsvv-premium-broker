import React, { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { base44 } from '@/api/base44Client'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { AlertCircle, Check, X, MessageCircle } from 'lucide-react'

const REQUEST_TYPE_LABELS = {
  'address_change': 'Adresse ändern',
  'coverage_change': 'Deckung ändern',
  'vehicle_change': 'Fahrzeug ändern',
  'other': 'Sonstiges',
}

export default function MutationRequestsPanel() {
  const [selectedRequest, setSelectedRequest] = useState(null)
  const [showNotes, setShowNotes] = useState(false)
  const [adminNotes, setAdminNotes] = useState('')
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

  const approveMutation = useMutation({
    mutationFn: async (mutationId) => {
      return base44.functions.invoke('approveMutationRequest', {
        mutation_request_id: mutationId,
        notes: adminNotes,
      })
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['mutation-requests'] })
      queryClient.invalidateQueries({ queryKey: ['contracts'] })
      setSelectedRequest(null)
      setAdminNotes('')
    },
  })

  const rejectMutation = useMutation({
    mutationFn: async (mutationId) => {
      return base44.entities.MutationRequest.update(mutationId, {
        status: 'rejected',
        reviewed_by: (await base44.auth.me()).email,
        reviewed_at: new Date().toISOString(),
        notes: adminNotes,
      })
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['mutation-requests'] })
      setSelectedRequest(null)
      setAdminNotes('')
    },
  })

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
      <div className="flex justify-between items-center">
        <h2 className="text-lg font-bold">Mutations-Anfragen ({mutations.length})</h2>
      </div>

      <div className="space-y-3">
        {mutations.map(mutReq => {
          const customer = customers.find(c => c.id === mutReq.customer_id)
          const contract = contracts.find(c => c.id === mutReq.policy_id)

          return (
            <Card key={mutReq.id} className="overflow-hidden">
              <CardContent className="p-4">
                <div className="flex justify-between items-start gap-4">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-2">
                      <span className="text-xs px-2 py-1 rounded-full bg-amber-100 text-amber-700 font-medium">
                        PENDENT
                      </span>
                      <p className="font-semibold text-sm">
                        {REQUEST_TYPE_LABELS[mutReq.request_type] || mutReq.request_type}
                      </p>
                    </div>

                    <div className="grid grid-cols-2 gap-3 text-xs mb-3">
                      <div>
                        <p className="text-muted-foreground">Kunde</p>
                        <p className="font-medium">
                          {customer ? `${customer.first_name} ${customer.last_name}` : '—'}
                        </p>
                      </div>
                      <div>
                        <p className="text-muted-foreground">Police-Nr.</p>
                        <p className="font-medium">{contract?.policy_number || mutReq.policy_number}</p>
                      </div>
                      <div className="col-span-2">
                        <p className="text-muted-foreground">Beschreibung</p>
                        <p className="font-medium text-foreground">{mutReq.description}</p>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 text-xs text-muted-foreground">
                      <span>
                        {new Date(mutReq.created_date).toLocaleDateString('de-CH')}
                      </span>
                    </div>
                  </div>

                  <div className="flex gap-2 flex-shrink-0">
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => {
                        setSelectedRequest(mutReq)
                        setShowNotes(true)
                      }}
                      className="gap-1"
                    >
                      <Check className="w-3 h-3" /> Genehmigen
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      className="text-destructive gap-1"
                      onClick={() => {
                        setSelectedRequest(mutReq)
                        rejectMutation.mutate(mutReq.id)
                      }}
                      disabled={rejectMutation.isPending}
                    >
                      <X className="w-3 h-3" /> Ablehnen
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          )
        })}
      </div>

      {/* APPROVAL DIALOG */}
      <Dialog open={showNotes} onOpenChange={setShowNotes}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Mutations-Anfrage genehmigen</DialogTitle>
          </DialogHeader>

          {selectedRequest && (
            <div className="space-y-4">
              <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg text-xs">
                <p className="text-blue-900 font-semibold mb-1">ℹ️ Aktion</p>
                <ul className="text-blue-800 space-y-1 ml-4 list-disc">
                  <li>Neue Policy-Version wird erstellt</li>
                  <li>Alte Policy wird archiviert (unverändert)</li>
                  <li>Kunde wird benachrichtigt</li>
                </ul>
              </div>

              <div>
                <label className="text-sm font-semibold">Admin-Notizen (optional)</label>
                <Textarea
                  value={adminNotes}
                  onChange={e => setAdminNotes(e.target.value)}
                  placeholder="Notizen für den Kunden und das System..."
                  className="mt-1 h-20"
                />
              </div>
            </div>
          )}

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setShowNotes(false)
                setSelectedRequest(null)
                setAdminNotes('')
              }}
            >
              Abbrechen
            </Button>
            <Button
              onClick={() => approveMutation.mutate(selectedRequest.id)}
              disabled={approveMutation.isPending}
              className="gap-2"
            >
              <Check className="w-4 h-4" />
              {approveMutation.isPending ? 'Wird genehmigt...' : 'Genehmigen'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}