import React, { useState } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { base44 } from '@/api/base44Client'
import { DragDropContext, Droppable, Draggable } from '@hello-pangea/dnd'
import { getSparteLabel } from '@/lib/insuranceSparten'
import VerkaufschanceStatusBadge from './VerkaufschanceStatusBadge'
import { cn } from '@/lib/utils'
import { Building2, TrendingUp } from 'lucide-react'

const COLUMNS = [
  { key: 'neu',              label: 'Neu',              color: 'border-t-slate-400' },
  { key: 'in_ausschreibung', label: 'In Ausschreibung', color: 'border-t-blue-500' },
  { key: 'offerten_erhalten',label: 'Offerten erhalten',color: 'border-t-violet-500' },
  { key: 'beratung_erfolgt', label: 'Beratung',         color: 'border-t-amber-500' },
  { key: 'kunde_entscheidet',label: 'Kunde entscheidet',color: 'border-t-orange-500' },
  { key: 'gewonnen',         label: 'Gewonnen',         color: 'border-t-green-500' },
  { key: 'verloren',         label: 'Verloren',         color: 'border-t-red-400' },
]

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

  return (
    <DragDropContext onDragEnd={onDragEnd}>
      <div className="flex gap-3 overflow-x-auto pb-4 min-h-[400px]">
        {COLUMNS.map(col => {
          const items = grouped[col.key] || []
          const colValue = items.reduce((s, v) => s + (v.estimated_value || 0), 0)
          return (
            <div key={col.key} className={cn('flex-shrink-0 w-60 bg-muted/40 rounded-xl border-t-4 border border-border', col.color)}>
              <div className="p-3 border-b border-border">
                <div className="flex items-center justify-between">
                  <p className="text-xs font-bold uppercase tracking-wide text-foreground">{col.label}</p>
                  <span className="text-xs px-1.5 py-0.5 bg-background rounded-full font-semibold border border-border text-muted-foreground">
                    {items.length}
                  </span>
                </div>
                {colValue > 0 && (
                  <p className="text-[10px] text-emerald-700 font-medium mt-1">
                    CHF {colValue.toLocaleString('de-CH')}
                  </p>
                )}
              </div>
              <Droppable droppableId={col.key}>
                {(provided, snapshot) => (
                  <div
                    ref={provided.innerRef}
                    {...provided.droppableProps}
                    className={cn('p-2 space-y-2 min-h-[200px] transition-colors', snapshot.isDraggingOver && 'bg-primary/5')}
                  >
                    {items.map((vs, index) => (
                      <Draggable key={vs.id} draggableId={vs.id} index={index}>
                        {(provided, snapshot) => (
                          <div
                            ref={provided.innerRef}
                            {...provided.draggableProps}
                            {...provided.dragHandleProps}
                            onClick={() => onSelect(vs.id)}
                            className={cn(
                              'bg-card rounded-lg border border-border p-2.5 cursor-pointer hover:shadow-md transition-all select-none text-left',
                              snapshot.isDragging && 'shadow-lg ring-2 ring-primary/30 rotate-1'
                            )}
                          >
                            <p className="text-xs font-bold truncate">{vs.customer_name}</p>
                            <p className="text-[10px] text-muted-foreground truncate mt-0.5">
                              {getSparteLabel(vs.sparte) || vs.sparte}
                            </p>
                            {(vs.gesellschaften || []).length > 0 && (
                              <div className="flex items-center gap-1 mt-1.5">
                                <Building2 className="w-3 h-3 text-muted-foreground flex-shrink-0" />
                                <span className="text-[10px] text-muted-foreground">
                                  {(vs.gesellschaften || []).length} Gesellschaft(en)
                                </span>
                              </div>
                            )}
                            {vs.estimated_value > 0 && (
                              <div className="flex items-center gap-1 mt-1">
                                <TrendingUp className="w-3 h-3 text-emerald-600 flex-shrink-0" />
                                <span className="text-[10px] text-emerald-700 font-semibold">
                                  CHF {vs.estimated_value.toLocaleString('de-CH')}
                                </span>
                              </div>
                            )}
                            {vs.assigned_broker && (
                              <p className="text-[10px] text-muted-foreground mt-1 truncate">👤 {vs.assigned_broker}</p>
                            )}
                          </div>
                        )}
                      </Draggable>
                    ))}
                    {provided.placeholder}
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