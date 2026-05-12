import React, { useState } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { base44 } from '@/api/base44Client'
import { DragDropContext, Droppable, Draggable } from '@hello-pangea/dnd'
import { getSparteLabel } from '@/lib/insuranceSparten'
import VerkaufschanceStatusBadge from './VerkaufschanceStatusBadge'
import { cn } from '@/lib/utils'
import { Building2, TrendingUp, CalendarClock, Star, AlertTriangle } from 'lucide-react'
import { format, parseISO, isBefore, isToday } from 'date-fns'

const COLUMNS = [
  { key: 'neu',              label: 'Neu',              color: 'border-t-slate-400',  headerColor: 'bg-slate-50' },
  { key: 'in_ausschreibung', label: 'In Ausschreibung', color: 'border-t-blue-500',   headerColor: 'bg-blue-50' },
  { key: 'offerten_erhalten',label: 'Offerten erhalten',color: 'border-t-violet-500', headerColor: 'bg-violet-50' },
  { key: 'beratung_erfolgt', label: 'Beratung',         color: 'border-t-amber-500',  headerColor: 'bg-amber-50' },
  { key: 'kunde_entscheidet',label: 'Kunde entscheidet',color: 'border-t-orange-500', headerColor: 'bg-orange-50' },
  { key: 'gewonnen',         label: 'Gewonnen ✓',       color: 'border-t-green-500',  headerColor: 'bg-green-50' },
  { key: 'verloren',         label: 'Verloren',         color: 'border-t-red-400',    headerColor: 'bg-red-50' },
]

function PriorityDot({ priority }) {
  if (!priority) return null
  const colors = { high: 'bg-red-500', medium: 'bg-amber-400', low: 'bg-slate-300' }
  return <span className={cn('inline-block w-2 h-2 rounded-full flex-shrink-0', colors[priority] || 'bg-slate-300')} title={priority} />
}

function KanbanCard({ vs, provided, snapshot, onClick }) {
  const gesellschaften = vs.gesellschaften || []
  const offerten = gesellschaften.filter(g => g.praemie_yearly).length
  const bestPraemie = offerten > 0
    ? Math.min(...gesellschaften.filter(g => g.praemie_yearly).map(g => g.praemie_yearly))
    : null
  const isWiedervorlage = vs.status === 'wiedervorlage' && vs.wiedervorlage_date
  const today = new Date()
  const isOverdue = isWiedervorlage && (isToday(parseISO(vs.wiedervorlage_date)) || isBefore(parseISO(vs.wiedervorlage_date), today))

  return (
    <div
      ref={provided.innerRef}
      {...provided.draggableProps}
      {...provided.dragHandleProps}
      onClick={() => onClick(vs.id)}
      className={cn(
        'bg-card rounded-xl border border-border p-3 cursor-pointer hover:shadow-md transition-all select-none',
        snapshot.isDragging && 'shadow-xl ring-2 ring-primary/40 rotate-1 z-50',
        vs.status === 'gewonnen' && 'border-green-200 bg-green-50/40',
        vs.status === 'verloren' && 'border-red-100 bg-red-50/30 opacity-75',
        isOverdue && 'border-orange-300 bg-orange-50/40',
      )}
    >
      {/* Header */}
      <div className="flex items-start justify-between gap-1.5 mb-2">
        <p className="text-xs font-bold break-words flex-1 leading-tight">{vs.customer_name}</p>
        <PriorityDot priority={vs.priority} />
      </div>

      {/* Sparte */}
      <p className="text-[10px] text-muted-foreground truncate mb-1.5">
        {getSparteLabel(vs.sparte) || vs.sparte}
        {vs.title && vs.title !== getSparteLabel(vs.sparte) && ` · ${vs.title}`}
      </p>

      {/* Gesellschaften */}
      {gesellschaften.length > 0 && (
        <div className="flex items-center gap-1 mb-1.5">
          <Building2 className="w-3 h-3 text-muted-foreground flex-shrink-0" />
          <span className="text-[10px] text-muted-foreground">
            {gesellschaften.length} angefragt{offerten > 0 && `, ${offerten} Offerte(n)`}
          </span>
        </div>
      )}

      {/* Beste Prämie */}
      {bestPraemie && (
        <div className="flex items-center gap-1 mb-1.5">
          <TrendingUp className="w-3 h-3 text-emerald-600 flex-shrink-0" />
          <span className="text-[10px] text-emerald-700 font-semibold">
            ab CHF {bestPraemie.toLocaleString('de-CH')}/J.
          </span>
        </div>
      )}

      {/* Geschätzter Wert wenn keine Offerten */}
      {!bestPraemie && vs.estimated_value > 0 && (
        <div className="flex items-center gap-1 mb-1.5">
          <TrendingUp className="w-3 h-3 text-slate-400 flex-shrink-0" />
          <span className="text-[10px] text-slate-500 font-medium">
            ~CHF {vs.estimated_value.toLocaleString('de-CH')}/J.
          </span>
        </div>
      )}

      {/* Wiedervorlage */}
      {isWiedervorlage && (
        <div className={cn('flex items-center gap-1 mt-1', isOverdue ? 'text-orange-600' : 'text-muted-foreground')}>
          <CalendarClock className="w-3 h-3 flex-shrink-0" />
          <span className="text-[10px] font-medium">
            {format(parseISO(vs.wiedervorlage_date), 'd.M.yyyy')}
            {isOverdue && ' ⚠'}
          </span>
        </div>
      )}

      {/* Abschlussdatum */}
      {vs.expected_close_date && vs.status !== 'wiedervorlage' && (
        <div className="flex items-center gap-1 mt-1 text-muted-foreground">
          <CalendarClock className="w-3 h-3 flex-shrink-0" />
          <span className="text-[10px]">{format(parseISO(vs.expected_close_date), 'd.M.yyyy')}</span>
        </div>
      )}

      {/* Broker */}
      {vs.assigned_broker && (
        <p className="text-[10px] text-muted-foreground mt-1.5 truncate">👤 {vs.assigned_broker}</p>
      )}
    </div>
  )
}

export default function VerkaufschancenKanban({ verkaufschancen, onSelect }) {
  const queryClient = useQueryClient()

  const updateMutation = useMutation({
    mutationFn: ({ id, status }) => base44.entities.Verkaufschance.update(id, { status }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['verkaufschancen'] }),
  })

  const grouped = COLUMNS.reduce((acc, col) => {
    acc[col.key] = verkaufschancen.filter(v => v.status === col.key)
    return acc
  }, {})

  const onDragEnd = (result) => {
    const { draggableId, destination } = result
    if (!destination) return
    const newStatus = destination.droppableId
    const vs = verkaufschancen.find(v => v.id === draggableId)
    if (vs && vs.status !== newStatus) {
      updateMutation.mutate({ id: draggableId, status: newStatus })
    }
  }

  if (verkaufschancen.length === 0) {
    return (
      <div className="py-16 text-center text-muted-foreground border-2 border-dashed border-border rounded-xl">
        <TrendingUp className="w-10 h-10 mx-auto mb-2 opacity-20" />
        <p className="text-sm">Keine Verkaufschancen gefunden</p>
      </div>
    )
  }

  return (
    <DragDropContext onDragEnd={onDragEnd}>
      <div className="flex gap-3 overflow-x-auto pb-4 min-h-[500px] -mx-1 px-1">
        {COLUMNS.map(col => {
          const items = grouped[col.key] || []
          const colValue = items.reduce((s, v) => s + (v.estimated_value || 0), 0)
          const colOfferten = items.reduce((s, v) => s + (v.gesellschaften || []).filter(g => g.praemie_yearly).length, 0)
          return (
            <div key={col.key} className={cn('flex-shrink-0 w-[220px] rounded-xl border border-border overflow-hidden border-t-4', col.color)}>
              {/* Column Header */}
              <div className={cn('px-3 py-2.5 border-b border-border', col.headerColor)}>
                <div className="flex items-center justify-between">
                  <p className="text-[11px] font-bold text-foreground truncate">{col.label}</p>
                  <span className="text-[10px] px-1.5 py-0.5 bg-white/70 rounded-full font-bold border border-border/50 text-muted-foreground flex-shrink-0">
                    {items.length}
                  </span>
                </div>
                {colValue > 0 && (
                  <p className="text-[10px] text-emerald-700 font-semibold mt-0.5">
                    CHF {colValue.toLocaleString('de-CH')}
                  </p>
                )}
                {colOfferten > 0 && (
                  <p className="text-[9px] text-violet-600 mt-0.5">{colOfferten} Offerte(n)</p>
                )}
              </div>

              {/* Droppable Zone */}
              <Droppable droppableId={col.key}>
                {(provided, snapshot) => (
                  <div
                    ref={provided.innerRef}
                    {...provided.droppableProps}
                    className={cn(
                      'p-2 space-y-2 min-h-[400px] transition-colors',
                      snapshot.isDraggingOver && 'bg-primary/5 ring-1 ring-inset ring-primary/20'
                    )}
                  >
                    {items.map((vs, index) => (
                      <Draggable key={vs.id} draggableId={vs.id} index={index}>
                        {(provided, snapshot) => (
                          <KanbanCard
                            vs={vs}
                            provided={provided}
                            snapshot={snapshot}
                            onClick={onSelect}
                          />
                        )}
                      </Draggable>
                    ))}
                    {provided.placeholder}
                    {items.length === 0 && (
                      <div className="flex items-center justify-center h-16 text-[10px] text-muted-foreground/50 border border-dashed border-border rounded-lg">
                        Hierher ziehen
                      </div>
                    )}
                  </div>
                )}
              </Droppable>
            </div>
          )
        })}
      </div>
    </DragDropContext>
  )
}