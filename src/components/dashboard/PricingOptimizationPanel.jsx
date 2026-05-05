import React, { useState, useMemo } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { base44 } from '@/api/base44Client'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { TrendingDown, AlertTriangle, CheckCircle2, MoreHorizontal } from 'lucide-react'
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu'

const PRIORITY_COLORS = {
  high: 'border-red-500 bg-red-50',
  medium: 'border-yellow-500 bg-yellow-50',
  low: 'border-blue-500 bg-blue-50',
}

const PRIORITY_BADGES = {
  high: '🔴 Hochprioritär',
  medium: '🟡 Mittel',
  low: '🟢 Niedrig',
}

export default function PricingOptimizationPanel() {
  const [selectedSuggestion, setSelectedSuggestion] = useState(null)
  const [showApprovalDialog, setShowApprovalDialog] = useState(false)
  const queryClient = useQueryClient()

  const { data: suggestions = [] } = useQuery({
    queryKey: ['pricing-suggestions'],
    queryFn: async () => {
      return await base44.entities.PricingSuggestion.filter(
        { status: 'pending' },
        '-saving_percent'
      )
    },
  })

  // ─── KPI BERECHNUNG ───
  const kpis = useMemo(() => {
    const totalSaving = suggestions.reduce((sum, s) => sum + (s.saving_amount || 0), 0)
    const avgSavingPercent =
      suggestions.length > 0
        ? suggestions.reduce((sum, s) => sum + (s.saving_percent || 0), 0) / suggestions.length
        : 0

    return {
      totalSaving: Math.round(totalSaving),
      count: suggestions.length,
      avgSavingPercent: Math.round(avgSavingPercent * 100) / 100,
    }
  }, [suggestions])

  // ─── KPI ANSICHT ───
  return (
    <div className="space-y-6">
      {/* KPI CARDS */}
      {suggestions.length > 0 && (
        <div className="grid grid-cols-3 gap-4">
          <Card>
            <CardContent className="pt-6">
              <p className="text-xs text-muted-foreground mb-1">Gesamteinsparpotenzial</p>
              <p className="text-2xl font-bold text-green-600">CHF {kpis.totalSaving.toLocaleString('de-CH')}</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <p className="text-xs text-muted-foreground mb-1">Anzahl Vorschläge</p>
              <p className="text-2xl font-bold text-primary">{kpis.count}</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <p className="text-xs text-muted-foreground mb-1">Durchschn. Einsparung</p>
              <p className="text-2xl font-bold text-amber-600">{kpis.avgSavingPercent}%</p>
            </CardContent>
          </Card>
        </div>
      )}

      {/* SUGGESTIONS LIST */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <TrendingDown className="w-5 h-5 text-green-600" />
            Preisoptimierungen ({suggestions.length})
          </CardTitle>
        </CardHeader>
        <CardContent>
          {suggestions.length === 0 ? (
            <p className="text-sm text-muted-foreground">Keine ausstehenden Preisoptimierungen</p>
          ) : (
            <div className="space-y-2">
              {suggestions.map(sugg => (
                <div key={sugg.id} className={`p-3 rounded-lg border-l-4 ${PRIORITY_COLORS[sugg.priority]}`}>
                  <div className="flex justify-between items-start gap-4">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <p className="font-semibold text-sm">{sugg.policy_number}</p>
                        <span className="text-xs bg-opacity-30 px-2 py-0.5 rounded font-medium">
                          {PRIORITY_BADGES[sugg.priority]}
                        </span>
                      </div>
                      <p className="text-xs text-muted-foreground">{sugg.customer_name}</p>
                      <p className="text-xs text-muted-foreground mt-1">
                        {sugg.insurer} · {sugg.product}
                      </p>
                    </div>

                    <div className="text-right flex-shrink-0">
                      <p className="text-sm font-bold text-green-700">
                        -CHF {sugg.saving_amount.toLocaleString('de-CH', { maximumFractionDigits: 0 })}
                      </p>
                      <p className="text-xs text-green-600 font-semibold">
                        {sugg.saving_percent}% Einsparung
                      </p>
                      <p className="text-xs text-muted-foreground mt-1">
                        {sugg.premium_current.toLocaleString('de-CH', {
                          maximumFractionDigits: 0,
                        })} → {sugg.premium_suggested.toLocaleString('de-CH', { maximumFractionDigits: 0 })}
                      </p>
                    </div>

                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button size="sm" variant="ghost">
                          <MoreHorizontal className="w-4 h-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem
                          onClick={() => {
                            setSelectedSuggestion(sugg)
                            setShowApprovalDialog(true)
                          }}
                        >
                          <CheckCircle2 className="w-4 h-4 mr-2" /> Genehmigen
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          onClick={() => {
                            updateSuggestion(sugg.id, { status: 'rejected' })
                          }}
                          className="text-destructive"
                        >
                          Ablehnen
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* APPROVAL DIALOG */}
      <Dialog open={showApprovalDialog} onOpenChange={setShowApprovalDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Preisoptimierung genehmigen</DialogTitle>
          </DialogHeader>

          {selectedSuggestion && (
            <div className="space-y-4">
              <div>
                <p className="text-sm font-medium">Policy: {selectedSuggestion.policy_number}</p>
                <p className="text-xs text-muted-foreground">{selectedSuggestion.customer_name}</p>
              </div>

              <div className="grid grid-cols-2 gap-4 p-3 bg-slate-50 rounded-lg">
                <div>
                  <p className="text-xs text-muted-foreground">Aktuelle Prämie</p>
                  <p className="text-lg font-bold">
                    CHF {selectedSuggestion.premium_current.toLocaleString('de-CH', {
                      maximumFractionDigits: 0,
                    })}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Neue Prämie</p>
                  <p className="text-lg font-bold text-green-600">
                    CHF {selectedSuggestion.premium_suggested.toLocaleString('de-CH', {
                      maximumFractionDigits: 0,
                    })}
                  </p>
                </div>
              </div>

              <div className="p-3 bg-green-50 border border-green-200 rounded-lg">
                <p className="text-sm font-semibold text-green-900">
                  Einsparung: CHF {selectedSuggestion.saving_amount.toLocaleString('de-CH', {
                    maximumFractionDigits: 0,
                  })} ({selectedSuggestion.saving_percent}%)
                </p>
              </div>

              {selectedSuggestion.renewal_opportunity && (
                <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg text-xs text-blue-900">
                  💡 <strong>Renewal-Chance:</strong> Diese Optimierung kann bei der nächsten
                  Verlängerung umgesetzt werden.
                </div>
              )}
            </div>
          )}

          <DialogFooter>
            <Button variant="outline" onClick={() => setShowApprovalDialog(false)}>
              Abbrechen
            </Button>
            <Button
              onClick={() => {
                updateSuggestion(selectedSuggestion.id, { status: 'approved' })
                setShowApprovalDialog(false)
              }}
            >
              Genehmigen
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )

  async function updateSuggestion(suggestionId, data) {
    await base44.entities.PricingSuggestion.update(suggestionId, data)
    queryClient.invalidateQueries({ queryKey: ['pricing-suggestions'] })
  }
}