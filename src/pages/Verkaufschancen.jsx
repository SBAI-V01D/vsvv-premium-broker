import React, { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { base44 } from '@/api/base44Client'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Plus, Search, TrendingUp, Trophy, Target, BarChart3, Trash2, LayoutGrid, List } from 'lucide-react'
import VerkaufschanceStatusBadge, { ALLE_STATUS } from '@/components/verkaufschance/VerkaufschanceStatusBadge'
import VerkaufschanceDetail from '@/components/verkaufschance/VerkaufschanceDetail'
import VerkaufschanceForm from '@/components/verkaufschance/VerkaufschanceForm'
import VerkaufschancenKanban from '@/components/verkaufschance/VerkaufschancenKanban'
import { getSparteLabel } from '@/lib/insuranceSparten'
import { cn } from '@/lib/utils'

const PRIORITY_COLORS = {
  high: 'text-red-600 bg-red-50 border-red-200',
  medium: 'text-amber-600 bg-amber-50 border-amber-200',
  low: 'text-slate-500 bg-slate-50 border-slate-200',
}

export default function Verkaufschancen() {
  const queryClient = useQueryClient()
  const [search, setSearch] = useState('')
  const [filterStatus, setFilterStatus] = useState('all')
  const [selectedId, setSelectedId] = useState(null)
  const [showNewForm, setShowNewForm] = useState(false)
  const [newFormCustomer, setNewFormCustomer] = useState(null)
  const [view, setView] = useState('kanban') // 'kanban' | 'list'

  const { data: verkaufschancen = [] } = useQuery({
    queryKey: ['verkaufschancen'],
    queryFn: () => base44.entities.Verkaufschance.list('-created_date'),
  })

  const { data: customers = [] } = useQuery({
    queryKey: ['customers'],
    queryFn: () => base44.entities.Customer.list(),
  })

  const deleteMutation = useMutation({
    mutationFn: (id) => base44.entities.Verkaufschance.delete(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['verkaufschancen'] }),
  })

  const createMutation = useMutation({
    mutationFn: (data) => base44.entities.Verkaufschance.create(data),
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: ['verkaufschancen'] })
      setShowNewForm(false)
      setSelectedId(result.id)
    },
  })

  const filtered = verkaufschancen.filter(v => {
    const s = `${v.customer_name} ${v.title} ${v.sparte}`.toLowerCase()
    const matchSearch = !search.trim() || s.includes(search.toLowerCase())
    const matchStatus = filterStatus === 'all' || v.status === filterStatus
    return matchSearch && matchStatus
  })

  // KPIs
  const total = verkaufschancen.length
  const offen = verkaufschancen.filter(v => !['gewonnen', 'verloren'].includes(v.status)).length
  const gewonnen = verkaufschancen.filter(v => v.status === 'gewonnen').length
  const winRate = total > 0 ? ((gewonnen / total) * 100).toFixed(0) : 0
  const pipeline = verkaufschancen
    .filter(v => !['gewonnen', 'verloren'].includes(v.status) && v.estimated_value)
    .reduce((s, v) => s + v.estimated_value, 0)

  const selectedVs = selectedId ? verkaufschancen.find(v => v.id === selectedId) : null
  const selectedCustomer = selectedVs ? customers.find(c => c.id === selectedVs.customer_id) : null

  // Pipeline-Kanban Spalten
  const PIPELINE_COLS = ['neu', 'in_ausschreibung', 'offerten_erhalten', 'beratung_erfolgt', 'kunde_entscheidet']

  return (
    <div className="space-y-5">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold">Verkaufschancen</h1>
          <p className="text-muted-foreground mt-1">Ausschreibungen · Offertanfragen · Pipeline</p>
        </div>
        <Button onClick={() => setShowNewForm(true)} className="gap-2">
          <Plus className="w-4 h-4" /> Neue Verkaufschance
        </Button>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {[
          { label: 'Total', value: total, icon: Target, color: 'text-blue-600 bg-blue-50' },
          { label: 'Offen', value: offen, icon: TrendingUp, color: 'text-amber-600 bg-amber-50' },
          { label: 'Gewonnen', value: gewonnen, icon: Trophy, color: 'text-green-600 bg-green-50' },
          { label: 'Win Rate', value: `${winRate}%`, icon: BarChart3, color: 'text-violet-600 bg-violet-50' },
        ].map(k => (
          <Card key={k.label}>
            <CardContent className="p-4 flex items-center gap-3">
              <div className={cn('w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0', k.color)}>
                <k.icon className="w-4 h-4" />
              </div>
              <div>
                <p className="text-2xl font-bold">{k.value}</p>
                <p className="text-xs text-muted-foreground">{k.label}</p>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* View Toggle */}
      <div className="flex items-center gap-2">
        <div className="flex rounded-lg border border-border overflow-hidden">
          <button
            onClick={() => setView('kanban')}
            className={cn('flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium transition-colors',
              view === 'kanban' ? 'bg-primary text-primary-foreground' : 'hover:bg-muted text-muted-foreground'
            )}
          >
            <LayoutGrid className="w-3.5 h-3.5" /> Kanban
          </button>
          <button
            onClick={() => setView('list')}
            className={cn('flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium transition-colors',
              view === 'list' ? 'bg-primary text-primary-foreground' : 'hover:bg-muted text-muted-foreground'
            )}
          >
            <List className="w-3.5 h-3.5" /> Liste
          </button>
        </div>
      </div>

      {/* Pipeline-Wert Banner */}
      {pipeline > 0 && (
        <div className="flex items-center gap-3 px-4 py-3 bg-emerald-50 border border-emerald-200 rounded-xl">
          <TrendingUp className="w-5 h-5 text-emerald-600 flex-shrink-0" />
          <div>
            <p className="text-sm font-bold text-emerald-900">Pipeline-Wert (offene Chancen)</p>
            <p className="text-xs text-emerald-700">CHF {pipeline.toLocaleString('de-CH')}/Jahr potenzielle Prämien</p>
          </div>
        </div>
      )}

      {/* Filters */}
      <div className="flex gap-3 flex-wrap">
        <div className="relative flex-1 min-w-52">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input placeholder="Suche (Kunde, Sparte...)" value={search} onChange={e => setSearch(e.target.value)} className="pl-9" />
        </div>
        {view === 'list' && (
          <Select value={filterStatus} onValueChange={setFilterStatus}>
            <SelectTrigger className="w-48"><SelectValue placeholder="Alle Status" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Alle Status</SelectItem>
              {ALLE_STATUS.map(s => <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>)}
            </SelectContent>
          </Select>
        )}
      </div>

      {/* Kanban View */}
      {view === 'kanban' && (
        <VerkaufschancenKanban
          verkaufschancen={verkaufschancen.filter(v => {
            const s = `${v.customer_name} ${v.title} ${v.sparte}`.toLowerCase()
            return !search.trim() || s.includes(search.toLowerCase())
          })}
          onSelect={setSelectedId}
        />
      )}

      {/* Liste */}
      {view === 'list' && <Card>
        <CardContent className="p-0">
          <div className="hidden md:grid grid-cols-[2fr_1.5fr_1.5fr_1fr_1fr_auto] gap-3 px-4 py-2 border-b bg-muted/40 text-xs font-semibold text-muted-foreground uppercase tracking-wide">
            <div>Kunde / Bezeichnung</div>
            <div>Sparte</div>
            <div>Gesellschaften</div>
            <div>Wert/J.</div>
            <div>Status</div>
            <div className="w-16"></div>
          </div>

          {filtered.length === 0 ? (
            <div className="py-12 text-center text-muted-foreground">
              <Target className="w-8 h-8 mx-auto mb-2 opacity-30" />
              <p>Keine Verkaufschancen gefunden</p>
            </div>
          ) : (
            filtered.map((v, idx) => {
              const gesellschaften = v.gesellschaften || []
              const selected = gesellschaften.find(g => g.status === 'ausgewaehlt')
              return (
                <div
                  key={v.id}
                  className={cn('grid grid-cols-1 md:grid-cols-[2fr_1.5fr_1.5fr_1fr_1fr_auto] gap-3 px-4 py-3 items-center cursor-pointer hover:bg-muted/30 transition-colors group',
                    idx > 0 && 'border-t border-border'
                  )}
                  onClick={() => setSelectedId(v.id)}
                >
                  <div className="min-w-0">
                    <p className="font-semibold text-sm truncate">{v.customer_name}</p>
                    <p className="text-xs text-muted-foreground truncate">{v.title || '–'}</p>
                  </div>
                  <div>
                    <p className="text-sm">{getSparteLabel(v.sparte) || v.sparte}</p>
                  </div>
                  <div>
                    {gesellschaften.length === 0 ? (
                      <span className="text-xs text-muted-foreground italic">Noch keine</span>
                    ) : (
                      <div className="flex flex-wrap gap-1">
                        {gesellschaften.slice(0, 3).map(g => (
                          <span key={g.id} className={cn(
                            'text-[10px] px-1.5 py-0.5 rounded border font-medium',
                            g.status === 'ausgewaehlt' ? 'bg-green-100 text-green-700 border-green-200' :
                            g.status === 'offerte_erhalten' ? 'bg-violet-100 text-violet-700 border-violet-200' :
                            'bg-slate-100 text-slate-600 border-slate-200'
                          )}>
                            {g.gesellschaft}
                          </span>
                        ))}
                        {gesellschaften.length > 3 && <span className="text-[10px] text-muted-foreground">+{gesellschaften.length - 3}</span>}
                      </div>
                    )}
                  </div>
                  <div>
                    {v.estimated_value
                      ? <span className="text-sm font-semibold text-emerald-700">CHF {v.estimated_value.toLocaleString('de-CH')}</span>
                      : <span className="text-sm text-muted-foreground">–</span>
                    }
                  </div>
                  <div>
                    <VerkaufschanceStatusBadge status={v.status} />
                  </div>
                  <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                    <Button
                      variant="ghost" size="icon" className="h-7 w-7 text-muted-foreground hover:text-destructive"
                      onClick={e => { e.stopPropagation(); if (confirm('Löschen?')) deleteMutation.mutate(v.id) }}
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </Button>
                  </div>
                </div>
              )
            })
          )}
        </CardContent>
      </Card>}

      {/* Detail-Dialog */}
      <Dialog open={!!selectedVs} onOpenChange={(o) => { if (!o) setSelectedId(null) }}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="sr-only">Verkaufschance Detail</DialogTitle>
          </DialogHeader>
          {selectedVs && selectedCustomer && (
            <VerkaufschanceDetail
              verkaufschance={selectedVs}
              customer={selectedCustomer}
              onClose={() => setSelectedId(null)}
              onUpdated={() => queryClient.invalidateQueries({ queryKey: ['verkaufschancen'] })}
            />
          )}
        </DialogContent>
      </Dialog>

      {/* Neue Verkaufschance Dialog (ohne Kunden-Kontext) */}
      <Dialog open={showNewForm} onOpenChange={setShowNewForm}>
        <DialogContent className="max-w-xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Neue Verkaufschance</DialogTitle>
          </DialogHeader>
          {/* Kunden-Auswahl */}
          <div className="space-y-4">
            <div className="space-y-1.5">
              <label className="text-sm font-medium">Kunde auswählen *</label>
              <Select
                value={newFormCustomer?.id || ''}
                onValueChange={v => setNewFormCustomer(customers.find(c => c.id === v) || null)}
              >
                <SelectTrigger><SelectValue placeholder="Kunde wählen..." /></SelectTrigger>
                <SelectContent>
                  {customers.filter(c => !c.is_family_member).map(c => (
                    <SelectItem key={c.id} value={c.id}>{c.first_name} {c.last_name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            {newFormCustomer && (
              <VerkaufschanceForm
                customer={newFormCustomer}
                onSave={(data) => createMutation.mutate(data)}
                onCancel={() => setShowNewForm(false)}
                saving={createMutation.isPending}
              />
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}