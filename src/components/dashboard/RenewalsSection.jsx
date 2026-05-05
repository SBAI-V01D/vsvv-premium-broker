import React, { useState, useMemo } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { base44 } from '@/api/base44Client'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { AlertTriangle, CheckCircle2, Clock, Send, MoreHorizontal, Eye } from 'lucide-react'
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu'

const PRIORITY_COLORS = {
  high: 'border-red-500 bg-red-50',
  medium: 'border-yellow-500 bg-yellow-50',
  low: 'border-blue-500 bg-blue-50',
}

const PRIORITY_LABELS = {
  high: '🔴 Wichtig',
  medium: '🟡 Bald',
  low: '🟢 Später',
}

export default function RenewalsSection() {
  const [selectedPolicy, setSelectedPolicy] = useState(null)
  const [showOfferDialog, setShowOfferDialog] = useState(false)
  const queryClient = useQueryClient()

  const { data: contracts = [] } = useQuery({
    queryKey: ['contracts'],
    queryFn: () => base44.entities.Contract.list('-end_date'),
  })

  const { data: offers = [] } = useQuery({
    queryKey: ['renewal-offers'],
    queryFn: async () => {
      const all = await base44.entities.Contract.list('-end_date')
      return all.filter(c => c.renewal_offer_created)
    },
  })

  // ─── RENEWAL OFFERS (PENDING/SENT) ───
  const pendingOffers = useMemo(() => {
    return offers.filter(
      c => c.renewal_offer_status === 'pending' || c.renewal_offer_status === 'sent'
    )
  }, [offers])

  // ─── SOON TO EXPIRE ───
  const soonToExpire = useMemo(() => {
    const today = new Date()
    today.setHours(0, 0, 0, 0)
    return contracts
      .filter(
        c =>
          c.status === 'active' &&
          c.renewal_priority === 'high' &&
          !c.renewal_offer_created
      )
      .sort((a, b) => new Date(a.end_date) - new Date(b.end_date))
  }, [contracts])

  // ─── ACCEPTED RENEWALS (LAST 7 DAYS) ───
  const recentlyAccepted = useMemo(() => {
    const today = new Date()
    const weekAgo = new Date(today.getTime() - 7 * 24 * 60 * 60 * 1000)
    return contracts.filter(
      c =>
        c.status === 'renewed' &&
        c.renewal_accepted_date &&
        new Date(c.renewal_accepted_date) >= weekAgo
    )
  }, [contracts])

  // ─── MUTATIONS ───
  const prepareOfferMutation = useMutation({
    mutationFn: (contractId) =>
      base44.functions.invoke('prepareRenewalOffer', { contract_id: contractId }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['contracts', 'renewal-offers'] })
      setSelectedPolicy(null)
    },
  })

  const sendOfferMutation = useMutation({
    mutationFn: (contractId) =>
      base44.functions.invoke('sendRenewalOffer', { contract_id: contractId }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['contracts', 'renewal-offers'] })
      setShowOfferDialog(false)
      setSelectedPolicy(null)
    },
  })

  const acceptOfferMutation = useMutation({
    mutationFn: (contractId) =>
      base44.functions.invoke('acceptRenewalOffer', { contract_id: contractId }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['contracts', 'renewal-offers'] })
      setSelectedPolicy(null)
    },
  })

  return (
    <div className="space-y-6">
      {/* SOON TO EXPIRE – ohne Angebot */}
      {soonToExpire.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <AlertTriangle className="w-5 h-5 text-red-600" />
              Wichtige Verlängerungen ({soonToExpire.length})
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {soonToExpire.map(c => (
                <div
                  key={c.id}
                  className={`p-3 rounded-lg border-l-4 ${PRIORITY_COLORS.high}`}
                >
                  <div className="flex justify-between items-start gap-4">
                    <div className="flex-1">
                      <p className="font-semibold text-sm">{c.policy_number}</p>
                      <p className="text-xs text-muted-foreground">{c.customer_name}</p>
                      <p className="text-xs text-red-700 font-medium mt-1">Endet: {c.end_date}</p>
                    </div>
                    <div className="flex gap-1">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => {
                          setSelectedPolicy(c)
                          prepareOfferMutation.mutate(c.id)
                        }}
                        disabled={prepareOfferMutation.isPending}
                      >
                        Angebot erstellen
                      </Button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* OPEN OFFERS – PENDING/SENT ───  */}
      {pendingOffers.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Clock className="w-5 h-5 text-amber-600" />
              Ausstehende Angebote ({pendingOffers.length})
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {pendingOffers.map(c => (
                <div
                  key={c.id}
                  className={`p-3 rounded-lg border-l-4 ${PRIORITY_COLORS.medium}`}
                >
                  <div className="flex justify-between items-start gap-4">
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <p className="font-semibold text-sm">{c.policy_number}</p>
                        <span className="text-xs bg-amber-200 text-amber-900 px-2 py-0.5 rounded">
                          {c.renewal_offer_status}
                        </span>
                      </div>
                      <p className="text-xs text-muted-foreground">{c.customer_name}</p>
                      <p className="text-xs text-muted-foreground mt-1">
                        Angebot vom {c.renewal_offer_date}
                      </p>
                    </div>

                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button size="sm" variant="ghost">
                          <MoreHorizontal className="w-4 h-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        {c.renewal_offer_status === 'pending' && (
                          <DropdownMenuItem
                            onClick={() => {
                              setSelectedPolicy(c)
                              setShowOfferDialog(true)
                            }}
                          >
                            <Send className="w-4 h-4 mr-2" /> Angebot versenden
                          </DropdownMenuItem>
                        )}
                        {c.renewal_offer_status === 'sent' && (
                          <DropdownMenuItem
                            onClick={() => {
                              setSelectedPolicy(c)
                              acceptOfferMutation.mutate(c.id)
                            }}
                          >
                            <CheckCircle2 className="w-4 h-4 mr-2" /> Als angenommen
                            markieren
                          </DropdownMenuItem>
                        )}
                        <DropdownMenuItem
                          onClick={() => setSelectedPolicy(c)}
                        >
                          <Eye className="w-4 h-4 mr-2" /> Details ansehen
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* RECENTLY ACCEPTED ─────────────────────────── */}
      {recentlyAccepted.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <CheckCircle2 className="w-5 h-5 text-green-600" />
              Akzeptierte Verlängerungen (letzte 7 Tage: {recentlyAccepted.length})
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {recentlyAccepted.map(c => (
                <div key={c.id} className="p-3 rounded-lg border border-green-200 bg-green-50">
                  <div className="flex justify-between items-start">
                    <div className="flex-1">
                      <p className="font-semibold text-sm text-green-900">
                        {c.policy_number} ✓
                      </p>
                      <p className="text-xs text-green-700">{c.customer_name}</p>
                      <p className="text-xs text-green-600 mt-1">
                        Akzeptiert: {c.renewal_accepted_date}
                      </p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {pendingOffers.length === 0 && soonToExpire.length === 0 && recentlyAccepted.length === 0 && (
        <Card>
          <CardContent className="p-8 text-center text-muted-foreground">
            Keine aktiven Verlängerungen
          </CardContent>
        </Card>
      )}

      {/* SEND OFFER DIALOG ─────────────────────────── */}
      <Dialog open={showOfferDialog} onOpenChange={setShowOfferDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Angebot versenden</DialogTitle>
          </DialogHeader>

          {selectedPolicy && (
            <div className="space-y-4">
              <div>
                <p className="text-sm font-medium">Policy: {selectedPolicy.policy_number}</p>
                <p className="text-xs text-muted-foreground">
                  {selectedPolicy.customer_name}
                </p>
              </div>

              <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg text-xs text-blue-900">
                Das Angebot wird an den Kunden versendet. Optional kann der Kunde
                eine Kopie des Angebots erhalten.
              </div>
            </div>
          )}

          <DialogFooter>
            <Button variant="outline" onClick={() => setShowOfferDialog(false)}>
              Abbrechen
            </Button>
            <Button
              onClick={() => sendOfferMutation.mutate(selectedPolicy.id)}
              disabled={sendOfferMutation.isPending}
            >
              {sendOfferMutation.isPending ? 'Wird versendet...' : 'Angebot versenden'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}