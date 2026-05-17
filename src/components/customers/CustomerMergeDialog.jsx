import React, { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { base44 } from '@/api/base44Client'
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card } from '@/components/ui/card'
import {
  AlertCircle, CheckCircle2, Loader2, Search, ArrowRight,
  Users, Archive, Shield, ChevronRight
} from 'lucide-react'
import { cn } from '@/lib/utils'

// ── Konfidenz-Farbe ────────────────────────────────────────────────────────
function ConfidenceBadge({ score }) {
  const color = score >= 90 ? 'bg-green-100 text-green-800' :
                score >= 70 ? 'bg-amber-100 text-amber-800' :
                              'bg-red-100 text-red-800'
  return (
    <span className={cn('text-xs px-2 py-0.5 rounded-full font-medium', color)}>
      {score}%
    </span>
  )
}

// ── Kunden-Card ────────────────────────────────────────────────────────────
function CustomerCard({ customer, label, labelColor, selected, onClick }) {
  if (!customer) return null
  const name = customer.company_name || `${customer.first_name || ''} ${customer.last_name || ''}`.trim()
  return (
    <button
      onClick={onClick}
      className={cn(
        'w-full text-left p-3 rounded-lg border-2 transition',
        selected ? 'border-primary bg-primary/5' : 'border-border hover:bg-muted/40'
      )}
    >
      <div className="flex items-center gap-2 mb-1">
        <span className={cn('text-xs font-bold px-2 py-0.5 rounded uppercase tracking-wide', labelColor)}>
          {label}
        </span>
        {customer.customer_number && (
          <span className="text-xs text-muted-foreground">{customer.customer_number}</span>
        )}
      </div>
      <p className="font-semibold text-sm">{name}</p>
      {customer.birthdate && <p className="text-xs text-muted-foreground">GD: {customer.birthdate}</p>}
      {customer.email && <p className="text-xs text-muted-foreground">{customer.email}</p>}
      {(customer.city || customer.zip_code) && (
        <p className="text-xs text-muted-foreground">{customer.zip_code} {customer.city}</p>
      )}
      {customer.archived && (
        <p className="text-xs text-red-600 mt-1 font-medium">⚠ Bereits archiviert</p>
      )}
    </button>
  )
}

export default function CustomerMergeDialog({ open, onOpenChange, preselectedDuplicateId }) {
  const queryClient = useQueryClient()
  const [step, setStep] = useState(0) // 0=auswahl, 1=bestätigung, 2=fertig
  const [masterId, setMasterId] = useState(null)
  const [duplicateId, setDuplicateId] = useState(preselectedDuplicateId || null)
  const [reason, setReason] = useState('')
  const [searchMaster, setSearchMaster] = useState('')
  const [searchDup, setSearchDup] = useState('')
  const [result, setResult] = useState(null)

  const { data: customers = [] } = useQuery({
    queryKey: ['customers-for-merge'],
    queryFn: () => base44.entities.Customer.list('-created_date', 200),
    enabled: open,
  })

  const mergeMutation = useMutation({
    mutationFn: async () => {
      const res = await base44.functions.invoke('mergeCustomers', { masterId, duplicateId, reason })
      return res.data
    },
    onSuccess: (data) => {
      setResult(data)
      setStep(2)
      queryClient.invalidateQueries({ queryKey: ['customers'] })
      queryClient.invalidateQueries({ queryKey: ['customers-for-merge'] })
    },
  })

  const activeCustomers = customers.filter(c => !c.archived)

  const filteredMaster = activeCustomers.filter(c => {
    if (!searchMaster) return true
    const name = `${c.first_name || ''} ${c.last_name || ''} ${c.customer_number || ''} ${c.email || ''}`.toLowerCase()
    return name.includes(searchMaster.toLowerCase())
  })

  const filteredDup = activeCustomers.filter(c => {
    if (!searchDup) return true
    const name = `${c.first_name || ''} ${c.last_name || ''} ${c.customer_number || ''} ${c.email || ''}`.toLowerCase()
    return name.includes(searchDup.toLowerCase())
  })

  const masterCustomer = customers.find(c => c.id === masterId)
  const dupCustomer = customers.find(c => c.id === duplicateId)

  const handleClose = () => {
    setStep(0)
    setMasterId(null)
    setDuplicateId(preselectedDuplicateId || null)
    setReason('')
    setSearchMaster('')
    setSearchDup('')
    setResult(null)
    onOpenChange(false)
  }

  // ── DONE ────────────────────────────────────────────────────────────────────
  if (step === 2 && result) {
    return (
      <Dialog open={open} onOpenChange={handleClose}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Merge abgeschlossen</DialogTitle>
          </DialogHeader>
          <div className="py-4 space-y-4">
            <div className="text-center">
              <CheckCircle2 className="w-12 h-12 text-green-500 mx-auto mb-2" />
              <p className="font-semibold text-green-700">Erfolgreich zusammengeführt</p>
            </div>
            <div className="bg-muted/40 rounded-lg p-4 text-sm space-y-2">
              <p><span className="text-muted-foreground">Master:</span> <strong>{result.masterName}</strong></p>
              <p><span className="text-muted-foreground">Duplikat:</span> <strong>{result.duplicateName}</strong> → archiviert</p>
              <div className="pt-2 border-t grid grid-cols-2 gap-1 text-xs">
                <span>Verträge migriert:</span><span className="font-semibold">{result.migrated?.contracts || 0}</span>
                <span>Anträge migriert:</span><span className="font-semibold">{result.migrated?.applications || 0}</span>
                <span>Dokumente migriert:</span><span className="font-semibold">{result.migrated?.documents || 0}</span>
                <span>Tasks migriert:</span><span className="font-semibold">{result.migrated?.tasks || 0}</span>
                <span>Familienmitglieder:</span><span className="font-semibold">{result.migrated?.familyMembers || 0}</span>
                {result.enriched?.length > 0 && (
                  <><span>Felder angereichert:</span><span className="font-semibold">{result.enriched.join(', ')}</span></>
                )}
              </div>
            </div>
            <Button onClick={handleClose} className="w-full">Fertig</Button>
          </div>
        </DialogContent>
      </Dialog>
    )
  }

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Users className="w-5 h-5" />
            Kunden zusammenführen (Merge)
          </DialogTitle>
          <DialogDescription>
            Alle Beziehungen werden auf den Master-Kunden migriert. Der Duplikat-Datensatz wird archiviert — nicht gelöscht.
          </DialogDescription>
        </DialogHeader>

        {/* ── SCHRITT 0: Auswahl ── */}
        {step === 0 && (
          <div className="space-y-5">
            <div className="grid grid-cols-2 gap-4">
              {/* Master */}
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-bold px-2 py-0.5 bg-green-100 text-green-800 rounded uppercase">Master (bleibt)</span>
                </div>
                <div className="relative">
                  <Search className="absolute left-2 top-2.5 w-4 h-4 text-muted-foreground" />
                  <Input placeholder="Kunde suchen..." value={searchMaster}
                    onChange={e => setSearchMaster(e.target.value)} className="pl-8 text-sm" />
                </div>
                <div className="max-h-52 overflow-y-auto space-y-1 border rounded-lg p-2">
                  {filteredMaster.filter(c => c.id !== duplicateId).map(c => {
                    const name = c.company_name || `${c.first_name || ''} ${c.last_name || ''}`.trim()
                    return (
                      <button key={c.id}
                        onClick={() => setMasterId(c.id)}
                        className={cn('w-full text-left p-2 rounded text-xs transition',
                          masterId === c.id ? 'bg-green-100 font-semibold' : 'hover:bg-muted/60'
                        )}
                      >
                        <p className="font-medium">{name}</p>
                        {c.birthdate && <p className="text-muted-foreground">GD: {c.birthdate}</p>}
                        {c.customer_number && <p className="text-muted-foreground">{c.customer_number}</p>}
                      </button>
                    )
                  })}
                  {filteredMaster.length === 0 && <p className="text-xs text-center text-muted-foreground py-3">Keine Ergebnisse</p>}
                </div>
              </div>

              {/* Duplikat */}
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-bold px-2 py-0.5 bg-red-100 text-red-800 rounded uppercase">Duplikat (wird archiviert)</span>
                </div>
                <div className="relative">
                  <Search className="absolute left-2 top-2.5 w-4 h-4 text-muted-foreground" />
                  <Input placeholder="Duplikat suchen..." value={searchDup}
                    onChange={e => setSearchDup(e.target.value)} className="pl-8 text-sm" />
                </div>
                <div className="max-h-52 overflow-y-auto space-y-1 border rounded-lg p-2">
                  {filteredDup.filter(c => c.id !== masterId).map(c => {
                    const name = c.company_name || `${c.first_name || ''} ${c.last_name || ''}`.trim()
                    return (
                      <button key={c.id}
                        onClick={() => setDuplicateId(c.id)}
                        className={cn('w-full text-left p-2 rounded text-xs transition',
                          duplicateId === c.id ? 'bg-red-100 font-semibold' : 'hover:bg-muted/60'
                        )}
                      >
                        <p className="font-medium">{name}</p>
                        {c.birthdate && <p className="text-muted-foreground">GD: {c.birthdate}</p>}
                        {c.customer_number && <p className="text-muted-foreground">{c.customer_number}</p>}
                      </button>
                    )
                  })}
                  {filteredDup.length === 0 && <p className="text-xs text-center text-muted-foreground py-3">Keine Ergebnisse</p>}
                </div>
              </div>
            </div>

            {/* Vorschau gewählte Kunden */}
            {(masterId || duplicateId) && (
              <div className="grid grid-cols-[1fr_auto_1fr] gap-2 items-center">
                <CustomerCard customer={masterCustomer} label="Master" labelColor="bg-green-100 text-green-800" selected />
                <ArrowRight className="w-5 h-5 text-muted-foreground mx-2" />
                <CustomerCard customer={dupCustomer} label="Duplikat" labelColor="bg-red-100 text-red-800" selected />
              </div>
            )}

            <div>
              <label className="text-xs font-medium text-muted-foreground">Grund für den Merge (optional)</label>
              <Input
                placeholder="z.B. Tippfehler im Nachnamen, Doppelerfassung..."
                value={reason}
                onChange={e => setReason(e.target.value)}
                className="mt-1"
              />
            </div>

            <div className="flex gap-2 pt-2 border-t">
              <Button variant="outline" onClick={handleClose}>Abbrechen</Button>
              <Button
                className="flex-1 gap-2"
                disabled={!masterId || !duplicateId}
                onClick={() => setStep(1)}
              >
                Weiter: Bestätigen <ChevronRight className="w-4 h-4" />
              </Button>
            </div>
          </div>
        )}

        {/* ── SCHRITT 1: Bestätigung ── */}
        {step === 1 && masterCustomer && dupCustomer && (
          <div className="space-y-4">
            <div className="p-3 bg-amber-50 border border-amber-200 rounded flex items-start gap-2 text-sm text-amber-800">
              <AlertCircle className="w-4 h-4 mt-0.5 flex-shrink-0" />
              <div>
                <p className="font-semibold">Achtung: Irreversibler Vorgang</p>
                <p className="text-xs mt-0.5">Alle Beziehungen des Duplikats werden auf den Master migriert. Der Duplikat-Datensatz wird archiviert.</p>
              </div>
            </div>

            <div className="grid grid-cols-[1fr_auto_1fr] gap-2 items-center">
              <Card className="p-3 border-2 border-green-300 bg-green-50">
                <p className="text-xs font-bold text-green-800 mb-1">✅ MASTER (bleibt aktiv)</p>
                <p className="font-semibold text-sm">
                  {masterCustomer.company_name || `${masterCustomer.first_name} ${masterCustomer.last_name}`}
                </p>
                {masterCustomer.birthdate && <p className="text-xs text-muted-foreground">GD: {masterCustomer.birthdate}</p>}
                {masterCustomer.customer_number && <p className="text-xs text-muted-foreground">Nr: {masterCustomer.customer_number}</p>}
              </Card>
              <div className="text-center">
                <ArrowRight className="w-5 h-5 text-muted-foreground mx-2" />
                <p className="text-xs text-muted-foreground mt-1">Migration</p>
              </div>
              <Card className="p-3 border-2 border-red-300 bg-red-50">
                <p className="text-xs font-bold text-red-800 mb-1 flex items-center gap-1">
                  <Archive className="w-3 h-3" /> DUPLIKAT (wird archiviert)
                </p>
                <p className="font-semibold text-sm">
                  {dupCustomer.company_name || `${dupCustomer.first_name} ${dupCustomer.last_name}`}
                </p>
                {dupCustomer.birthdate && <p className="text-xs text-muted-foreground">GD: {dupCustomer.birthdate}</p>}
                {dupCustomer.customer_number && <p className="text-xs text-muted-foreground">Nr: {dupCustomer.customer_number}</p>}
              </Card>
            </div>

            <div className="p-3 bg-muted/30 rounded text-xs space-y-1">
              <p className="font-semibold text-sm mb-2 flex items-center gap-1"><Shield className="w-4 h-4" /> Was passiert:</p>
              <p>✓ Alle Verträge, Anträge, Dokumente, Tasks werden auf Master umgehängt</p>
              <p>✓ Familienmitglieder-Verknüpfungen werden aktualisiert</p>
              <p>✓ Fehlende Felder im Master werden aus Duplikat ergänzt</p>
              <p>✓ Duplikat wird archiviert (kein physisches Löschen)</p>
              <p>✓ Vollständiger Audit-Trail wird geschrieben</p>
              {reason && <p className="pt-1 font-medium">Grund: {reason}</p>}
            </div>

            {mergeMutation.error && (
              <div className="p-3 bg-red-50 border border-red-200 rounded text-sm text-red-700">
                {mergeMutation.error?.response?.data?.error || mergeMutation.error?.message}
              </div>
            )}

            <div className="flex gap-2 pt-2 border-t">
              <Button variant="outline" onClick={() => setStep(0)} disabled={mergeMutation.isPending}>
                Zurück
              </Button>
              <Button
                className="flex-1 gap-2 bg-red-600 hover:bg-red-700"
                onClick={() => mergeMutation.mutate()}
                disabled={mergeMutation.isPending}
              >
                {mergeMutation.isPending && <Loader2 className="w-4 h-4 animate-spin" />}
                {mergeMutation.isPending ? 'Merge läuft...' : 'Jetzt zusammenführen'}
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}