import React, { useState } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { base44 } from '@/api/base44Client'
import { useNavigate } from 'react-router-dom'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Card, CardContent } from '@/components/ui/card'
import {
  ArrowLeft, Edit2, Trophy, Plus, CalendarClock, Building2,
  TrendingUp, FileText, AlertTriangle, CheckCircle2, Info, Upload
} from 'lucide-react'
import VerkaufschanceAiUpload from './VerkaufschanceAiUpload'
import VerkaufschanceStatusBadge, { ALLE_STATUS } from './VerkaufschanceStatusBadge'
import GesellschaftenTabelle from './GesellschaftenTabelle'
import VerkaufschanceForm from './VerkaufschanceForm'
import ContractFromVerkaufschanceDialog from './ContractFromVerkaufschanceDialog'
import { getSparteLabel } from '@/lib/insuranceSparten'
import { cn } from '@/lib/utils'
import { format, parseISO } from 'date-fns'

const PRIORITY_LABELS = { high: 'HOCH', medium: 'MITTEL', low: 'TIEF' }
const PRIORITY_COLORS = {
  high: 'bg-red-100 text-red-700',
  medium: 'bg-amber-100 text-amber-700',
  low: 'bg-slate-100 text-slate-600',
}

const NEXT_STEP = {
  neu:               'Gesellschaften kontaktieren und Anfragen stellen',
  in_ausschreibung:  'Offerten von Gesellschaften abwarten und einfordern',
  offerten_erhalten: 'Offerten vergleichen und Beratungsgespräch vorbereiten',
  beratung_erfolgt:  'Beratung dokumentieren und Entscheid abwarten',
  kunde_entscheidet: 'Kunden nachfassen und Entscheid einfordern',
  gewonnen:          'Vertrag erstellen und Police aktivieren',
  verloren:          'Verlustanalyse durchführen — keine weiteren Aktionen',
  wiedervorlage:     'Kunde zum geplanten Datum kontaktieren',
}

export default function VerkaufschanceDetail({ verkaufschance, customer, onClose, onUpdated }) {
  const queryClient = useQueryClient()
  const [editing, setEditing] = useState(false)
  const [showContractDialog, setShowContractDialog] = useState(false)
  const [activeTab, setActiveTab] = useState('offerten')
  const [showAiUpload, setShowAiUpload] = useState(false)

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
  const offerten = gesellschaften.filter(g => g.praemie_yearly)
  const bestOfferte = offerten.length > 0
    ? offerten.reduce((best, g) => (!best || g.praemie_yearly < best.praemie_yearly) ? g : best, null)
    : null
  const canCreateContract = !!selectedGes && !['gewonnen', 'verloren'].includes(verkaufschance.status)

  const handleStatusChange = (newStatus) => {
    updateMutation.mutate({ status: newStatus })
  }

  const handleAiDataExtracted = (data) => {
    const updates = {}
    if (data.insurer && !verkaufschance.gesellschaften?.some(g => g.gesellschaft === data.insurer)) {
      // Neue Gesellschaft aus KI-Analyse hinzufügen
      const newGes = data._gesellschaft
      if (newGes) {
        updates.gesellschaften = [...(verkaufschance.gesellschaften || []), { ...newGes, id: `ai_${Date.now()}` }]
      }
    }
    if (data.sparte && !verkaufschance.sparte) updates.sparte = data.sparte
    if (data.estimated_value && !verkaufschance.estimated_value) updates.estimated_value = data.estimated_value
    if (data.start_date_requested && !verkaufschance.start_date_requested) updates.start_date_requested = data.start_date_requested
    if (data.title && !verkaufschance.title) updates.title = data.title
    if (data.notes) updates.notes = data.notes

    if (Object.keys(updates).length > 0) {
      updateMutation.mutate(updates)
    }
    setShowAiUpload(false)
    onUpdated?.()
  }

  return (
    <div className="flex flex-col h-full">

      {/* ── Top Header ─────────────────────────────────────────────────── */}
      <div className="px-6 py-5 border-b border-border bg-gradient-to-r from-slate-50 to-blue-50/30">
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div className="flex items-start gap-3">
            <button onClick={onClose} className="mt-1 p-1 rounded text-muted-foreground hover:text-foreground hover:bg-muted transition-colors">
              <ArrowLeft className="w-4 h-4" />
            </button>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h2 className="text-xl font-bold">{verkaufschance.title || getSparteLabel(verkaufschance.sparte) || '–'}</h2>
                <VerkaufschanceStatusBadge status={verkaufschance.status} />
                {verkaufschance.priority && (
                  <span className={cn('text-[10px] px-1.5 py-0.5 rounded font-bold', PRIORITY_COLORS[verkaufschance.priority])}>
                    {PRIORITY_LABELS[verkaufschance.priority]}
                  </span>
                )}
              </div>
              <p className="text-sm text-muted-foreground mt-0.5">
                {customer ? `${customer.first_name} ${customer.last_name}` : '–'}
                {' · '}
                {getSparteLabel(verkaufschance.sparte) || verkaufschance.sparte}
              </p>
            </div>
          </div>
          <Button size="sm" variant="outline" onClick={() => setEditing(true)} className="gap-1.5 flex-shrink-0">
            <Edit2 className="w-3.5 h-3.5" /> Bearbeiten
          </Button>
        </div>

        {/* WICHTIGER HINWEIS: Keine aktive Police */}
        {!['gewonnen', 'verloren'].includes(verkaufschance.status) && (
          <div className="mt-3 flex items-center gap-2 px-3 py-2 bg-amber-50 border border-amber-200 rounded-lg text-xs text-amber-800">
            <Info className="w-3.5 h-3.5 flex-shrink-0 text-amber-600" />
            <span><strong>Verkaufschance:</strong> Noch keine aktive Police, keine Provision — erst nach Vertragsabschluss.</span>
          </div>
        )}
      </div>

      {/* ── Status Schnellwechsel ─────────────────────────────────────── */}
      <div className="px-6 py-3 border-b border-border bg-muted/20">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">STATUS:</span>
          {ALLE_STATUS.map(s => (
            <button
              key={s.value}
              onClick={() => handleStatusChange(s.value)}
              disabled={updateMutation.isPending}
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

      {/* ── Nächster Schritt Banner ───────────────────────────────────── */}
      {!['verloren'].includes(verkaufschance.status) && (
        <div className="px-6 py-2.5 bg-primary/5 border-b border-primary/10">
          <p className="text-xs text-primary font-semibold">
            → Nächster Schritt: {NEXT_STEP[verkaufschance.status] || '–'}
          </p>
        </div>
      )}

      {/* ── Kern-Metadaten ───────────────────────────────────────────── */}
      <div className="px-6 py-4 border-b border-border">
        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-3">
          <MetaBox label="Sparte" value={getSparteLabel(verkaufschance.sparte) || verkaufschance.sparte || '–'} />
          <MetaBox
            label="Geschätztes Volumen"
            value={verkaufschance.estimated_value ? `CHF ${verkaufschance.estimated_value.toLocaleString('de-CH')}/J.` : '–'}
            highlight="emerald"
          />
          <MetaBox
            label="Versicherungsbeginn"
            value={verkaufschance.start_date_requested ? format(parseISO(verkaufschance.start_date_requested), 'd.M.yyyy') : '–'}
          />
          <MetaBox
            label="Erwarteter Abschluss"
            value={verkaufschance.expected_close_date ? format(parseISO(verkaufschance.expected_close_date), 'd.M.yyyy') : '–'}
          />
          <MetaBox
            label="Ansprechperson"
            value={verkaufschance.contact_person || '–'}
          />
        </div>

        {/* Best Offer Summary */}
        {bestOfferte && (
          <div className="mt-3 flex items-center gap-3 p-3 bg-violet-50 border border-violet-200 rounded-lg">
            <TrendingUp className="w-4 h-4 text-violet-600 flex-shrink-0" />
            <div>
              <p className="text-xs font-bold text-violet-900">Günstigste Offerte: {bestOfferte.gesellschaft}</p>
              <p className="text-xs text-violet-700">CHF {bestOfferte.praemie_yearly.toLocaleString('de-CH')}/Jahr
                {bestOfferte.deckung && ` · ${bestOfferte.deckung}`}
              </p>
            </div>
          </div>
        )}

        {/* Wiedervorlage */}
        {verkaufschance.wiedervorlage_date && (
          <div className="mt-2 flex items-center gap-2 p-2.5 bg-orange-50 border border-orange-200 rounded-lg">
            <CalendarClock className="w-3.5 h-3.5 text-orange-600 flex-shrink-0" />
            <p className="text-xs font-semibold text-orange-900">
              Wiedervorlage: {format(parseISO(verkaufschance.wiedervorlage_date), 'd. MMMM yyyy')}
            </p>
          </div>
        )}
      </div>

      {/* ── Tabs: Offerten / Notizen ──────────────────────────────────── */}
      <div className="flex-1 overflow-auto">
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="px-6 border-b border-border rounded-none bg-transparent h-auto pt-3 pb-0 gap-0 justify-start">
            <TabsTrigger value="offerten" className="rounded-none rounded-t-lg border border-b-0 border-border data-[state=active]:bg-background data-[state=active]:border-border data-[state=active]:text-foreground mr-1">
              <Building2 className="w-3.5 h-3.5 mr-1.5" />
              Gesellschaften ({gesellschaften.length})
            </TabsTrigger>
            <TabsTrigger value="ki" className="rounded-none rounded-t-lg border border-b-0 border-border data-[state=active]:bg-background data-[state=active]:border-border data-[state=active]:text-foreground mr-1">
              <Upload className="w-3.5 h-3.5 mr-1.5" />
              KI-Analyse
            </TabsTrigger>
            <TabsTrigger value="notizen" className="rounded-none rounded-t-lg border border-b-0 border-border data-[state=active]:bg-background data-[state=active]:border-border data-[state=active]:text-foreground">
              <FileText className="w-3.5 h-3.5 mr-1.5" />
              Notizen
            </TabsTrigger>
          </TabsList>

          <TabsContent value="offerten" className="p-6 mt-0">
            <GesellschaftenTabelle
              verkaufschance={verkaufschance}
              onUpdate={onUpdated}
            />
          </TabsContent>

          <TabsContent value="ki" className="p-6 mt-0">
            <div className="space-y-4">
              <div>
                <p className="text-sm font-semibold mb-1">Offerte oder Police analysieren</p>
                <p className="text-xs text-muted-foreground mb-3">
                  KI erkennt Versicherer, Sparte, Prämie und Deckung automatisch — und trägt die Gesellschaft direkt in die Offerttabelle ein.
                </p>
              </div>
              <VerkaufschanceAiUpload onDataExtracted={handleAiDataExtracted} />
            </div>
          </TabsContent>

          <TabsContent value="notizen" className="p-6 mt-0">
            {verkaufschance.notes ? (
              <div className="p-4 bg-muted/40 border border-border rounded-xl">
                <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground mb-2">Notizen</p>
                <p className="text-sm whitespace-pre-wrap text-foreground">{verkaufschance.notes}</p>
              </div>
            ) : (
              <div className="py-8 text-center text-muted-foreground">
                <FileText className="w-8 h-8 mx-auto mb-2 opacity-20" />
                <p className="text-sm">Keine Notizen</p>
                <Button size="sm" variant="outline" className="mt-3" onClick={() => setEditing(true)}>Notizen hinzufügen</Button>
              </div>
            )}
          </TabsContent>
        </Tabs>
      </div>

      {/* ── Footer: CTA ──────────────────────────────────────────────── */}
      {canCreateContract && (
        <div className="px-6 py-4 border-t border-border bg-green-50">
          <div className="flex items-center justify-between gap-4 flex-wrap">
            <div>
              <p className="font-bold text-green-900 flex items-center gap-2">
                <Trophy className="w-4 h-4 text-green-600" />
                Gesellschaft ausgewählt: <strong>{selectedGes.gesellschaft}</strong>
              </p>
              {selectedGes.praemie_yearly && (
                <p className="text-sm text-green-700 mt-0.5">
                  Prämie: CHF {selectedGes.praemie_yearly.toLocaleString('de-CH')}/Jahr
                  <span className="ml-2 text-xs text-green-600 font-medium">→ Vertrag erstellen aktiviert Provision</span>
                </p>
              )}
            </div>
            <Button
              onClick={() => setShowContractDialog(true)}
              className="bg-green-700 hover:bg-green-800 text-white gap-2 flex-shrink-0"
            >
              <Trophy className="w-4 h-4" />
              Vertrag erstellen → Gewonnen
            </Button>
          </div>
        </div>
      )}

      {/* Gewonnen */}
      {verkaufschance.status === 'gewonnen' && (
        <div className="px-6 py-4 border-t border-green-200 bg-green-50 flex items-center gap-3">
          <CheckCircle2 className="w-5 h-5 text-green-600" />
          <div>
            <p className="font-semibold text-green-800">Abgeschlossen und gewonnen!</p>
            {verkaufschance.selected_insurer && (
              <p className="text-sm text-green-700">Gesellschaft: {verkaufschance.selected_insurer}</p>
            )}
          </div>
        </div>
      )}

      {/* Verloren */}
      {verkaufschance.status === 'verloren' && verkaufschance.lost_reason && (
        <div className="px-6 py-3 border-t border-red-200 bg-red-50">
          <p className="text-xs text-red-800"><strong>Verlustgrund:</strong> {verkaufschance.lost_reason}</p>
        </div>
      )}

      {/* Edit Dialog */}
      <Dialog open={editing} onOpenChange={setEditing}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
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

      {/* Contract Dialog */}
      {showContractDialog && customer && selectedGes && (
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

function MetaBox({ label, value, highlight }) {
  return (
    <div className="p-2.5 bg-card border border-border rounded-lg">
      <p className="text-[10px] text-muted-foreground uppercase tracking-wide">{label}</p>
      <p className={cn('text-xs font-semibold mt-0.5', highlight === 'emerald' ? 'text-emerald-700' : 'text-foreground')}>{value}</p>
    </div>
  )
}