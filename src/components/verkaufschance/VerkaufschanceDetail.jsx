import React, { useState } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { base44 } from '@/api/base44Client'
import { useNavigate } from 'react-router-dom'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { ArrowLeft, Edit2, Trophy, XCircle, Plus, CalendarClock } from 'lucide-react'
import VerkaufschanceStatusBadge, { ALLE_STATUS } from './VerkaufschanceStatusBadge'
import GesellschaftenTabelle from './GesellschaftenTabelle'
import VerkaufschanceForm from './VerkaufschanceForm'
import ContractFromVerkaufschanceDialog from './ContractFromVerkaufschanceDialog'
import { getSparteLabel } from '@/lib/insuranceSparten'
import { cn } from '@/lib/utils'

const PRIORITY_COLORS = {
  high: 'bg-red-100 text-red-700',
  medium: 'bg-amber-100 text-amber-700',
  low: 'bg-slate-100 text-slate-600',
}

export default function VerkaufschanceDetail({ verkaufschance, customer, onClose, onUpdated }) {
  const queryClient = useQueryClient()
  const [editing, setEditing] = useState(false)
  const [showContractDialog, setShowContractDialog] = useState(false)

  const updateMutation = useMutation({
    mutationFn: (data) => base44.entities.Verkaufschance.update(verkaufschance.id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['verkaufschancen'] })
      queryClient.invalidateQueries({ queryKey: ['verkaufschancen', verkaufschance.customer_id] })
      setEditing(false)
      onUpdated?.()
    },
  })

  const gesellschaften = verkaufschance.gesellschaften || []
  const selectedGes = gesellschaften.find(g => g.status === 'ausgewaehlt')
  const canCreateContract = !!selectedGes

  const handleStatusChange = (newStatus) => {
    updateMutation.mutate({ status: newStatus })
  }

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div className="flex items-start gap-3">
          <button onClick={onClose} className="mt-1 text-muted-foreground hover:text-foreground">
            <ArrowLeft className="w-4 h-4" />
          </button>
          <div>
            <h2 className="text-xl font-bold text-foreground">
              {verkaufschance.title || getSparteLabel(verkaufschance.sparte)}
            </h2>
            <div className="flex items-center gap-2 mt-1 flex-wrap">
              <VerkaufschanceStatusBadge status={verkaufschance.status} />
              {verkaufschance.priority && (
                <span className={cn('text-[10px] px-1.5 py-0.5 rounded font-bold', PRIORITY_COLORS[verkaufschance.priority])}>
                  {verkaufschance.priority === 'high' ? 'HOCH' : verkaufschance.priority === 'medium' ? 'MITTEL' : 'TIEF'}
                </span>
              )}
              {verkaufschance.estimated_value && (
                <span className="text-xs text-emerald-700 font-semibold">CHF {verkaufschance.estimated_value.toLocaleString('de-CH')}/J.</span>
              )}
            </div>
          </div>
        </div>
        <div className="flex gap-2">
          <Button size="sm" variant="outline" onClick={() => setEditing(true)}>
            <Edit2 className="w-3.5 h-3.5 mr-1" /> Bearbeiten
          </Button>
        </div>
      </div>

      {/* Status-Schnellwechsel */}
      <div className="flex items-center gap-3 p-3 bg-muted/40 rounded-lg border border-border">
        <span className="text-xs font-semibold text-muted-foreground">STATUS:</span>
        <div className="flex gap-1.5 flex-wrap">
          {ALLE_STATUS.map(s => (
            <button
              key={s.value}
              onClick={() => handleStatusChange(s.value)}
              className={cn(
                'text-xs px-2.5 py-1 rounded-full border font-medium transition-all',
                verkaufschance.status === s.value
                  ? 'bg-primary text-primary-foreground border-primary shadow-sm'
                  : 'bg-background text-muted-foreground border-border hover:border-primary hover:text-primary'
              )}
            >
              {s.label}
            </button>
          ))}
        </div>
      </div>

      {/* Meta-Info */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-xs">
        <div className="p-2.5 bg-card border border-border rounded-lg">
          <p className="text-muted-foreground">Sparte</p>
          <p className="font-semibold mt-0.5">{getSparteLabel(verkaufschance.sparte) || verkaufschance.sparte || '–'}</p>
        </div>
        <div className="p-2.5 bg-card border border-border rounded-lg">
          <p className="text-muted-foreground">Gewünschter Beginn</p>
          <p className="font-semibold mt-0.5">{verkaufschance.start_date_requested ? new Date(verkaufschance.start_date_requested).toLocaleDateString('de-CH') : '–'}</p>
        </div>
        <div className="p-2.5 bg-card border border-border rounded-lg">
          <p className="text-muted-foreground">Abschlussdatum</p>
          <p className="font-semibold mt-0.5">{verkaufschance.expected_close_date ? new Date(verkaufschance.expected_close_date).toLocaleDateString('de-CH') : '–'}</p>
        </div>
        <div className="p-2.5 bg-card border border-border rounded-lg">
          <p className="text-muted-foreground">Ansprechperson</p>
          <p className="font-semibold mt-0.5">{verkaufschance.contact_person || '–'}</p>
        </div>
      </div>

      {/* Gesellschaften-Tabelle */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-sm font-semibold">Angefragte Gesellschaften</h3>
          <span className="text-xs text-muted-foreground">{gesellschaften.length} Gesellschaft(en)</span>
        </div>
        <GesellschaftenTabelle verkaufschance={verkaufschance} onUpdate={onUpdated} />
      </div>

      {/* Notizen */}
      {verkaufschance.notes && (
        <div className="p-3 bg-amber-50 border border-amber-100 rounded-lg">
          <p className="text-xs font-semibold text-amber-900 mb-1">Notizen</p>
          <p className="text-sm text-amber-800 whitespace-pre-wrap">{verkaufschance.notes}</p>
        </div>
      )}

      {/* CTA: Vertrag erstellen (nur wenn Gesellschaft ausgewählt) */}
      {canCreateContract && verkaufschance.status !== 'gewonnen' && (
        <div className="p-4 bg-green-50 border-2 border-green-300 rounded-xl">
          <div className="flex items-center justify-between gap-4 flex-wrap">
            <div>
              <p className="font-bold text-green-900 flex items-center gap-2">
                <Trophy className="w-4 h-4" />
                Kunde hat {selectedGes.gesellschaft} ausgewählt
              </p>
              {selectedGes.praemie_yearly && (
                <p className="text-sm text-green-700 mt-0.5">
                  Prämie: CHF {selectedGes.praemie_yearly.toLocaleString('de-CH')}/Jahr
                </p>
              )}
            </div>
            <Button onClick={() => setShowContractDialog(true)} className="bg-green-700 hover:bg-green-800 text-white gap-2">
              <Trophy className="w-4 h-4" />
              Vertrag erstellen → Gewonnen
            </Button>
          </div>
        </div>
      )}

      {/* Gewonnen */}
      {verkaufschance.status === 'gewonnen' && (
        <div className="p-3 bg-green-50 border border-green-200 rounded-lg flex items-center gap-3">
          <Trophy className="w-5 h-5 text-green-600" />
          <div>
            <p className="font-semibold text-green-800">Gewonnen!</p>
            {verkaufschance.selected_insurer && (
              <p className="text-sm text-green-700">Gesellschaft: {verkaufschance.selected_insurer}</p>
            )}
          </div>
        </div>
      )}

      {/* Edit Dialog */}
      <Dialog open={editing} onOpenChange={setEditing}>
        <DialogContent className="max-w-xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Verkaufschance bearbeiten</DialogTitle>
          </DialogHeader>
          <VerkaufschanceForm
            verkaufschance={verkaufschance}
            customer={customer}
            onSave={(data) => updateMutation.mutate(data)}
            onCancel={() => setEditing(false)}
            saving={updateMutation.isPending}
          />
        </DialogContent>
      </Dialog>

      {/* Contract Creation Dialog */}
      {showContractDialog && (
        <ContractFromVerkaufschanceDialog
          open={showContractDialog}
          onOpenChange={setShowContractDialog}
          verkaufschance={verkaufschance}
          customer={customer}
          selectedGesellschaft={selectedGes}
          onSuccess={onUpdated}
        />
      )}
    </div>
  )
}