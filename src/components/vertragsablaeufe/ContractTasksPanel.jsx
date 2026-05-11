/**
 * ContractTasksPanel — zeigt verknüpfte Aufgaben zu einem Vertrag
 * und erlaubt das Erstellen neuer Aufgaben direkt aus dem Prozess.
 */
import React, { useState } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { base44 } from '@/api/base44Client'
import { cn } from '@/lib/utils'
import { CheckCircle2, Circle, Plus, Clock, ArrowUpCircle, ExternalLink } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'

const STATUS_ICONS = {
  open:        <Circle className="w-3.5 h-3.5 text-muted-foreground" />,
  in_progress: <ArrowUpCircle className="w-3.5 h-3.5 text-blue-500" />,
  completed:   <CheckCircle2 className="w-3.5 h-3.5 text-green-500" />,
}

const STATUS_LABELS = { open: 'Pendent', in_progress: 'In Bearbeitung', completed: 'Erledigt' }

export default function ContractTasksPanel({ contract, tasks = [], onNavigateCustomer }) {
  const queryClient = useQueryClient()
  const [showForm, setShowForm] = useState(false)
  const [newTask, setNewTask] = useState({ title: '', due_date: '', priority: 'medium' })

  const contractTasks = tasks.filter(t =>
    t.contract_id === contract.id ||
    (t.customer_id === contract.customer_id && t.task_type === 'renewal')
  )

  const createMutation = useMutation({
    mutationFn: (data) => base44.entities.Task.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tasks'] })
      setShowForm(false)
      setNewTask({ title: '', due_date: '', priority: 'medium' })
    },
  })

  const updateStatusMutation = useMutation({
    mutationFn: ({ id, status }) => base44.entities.Task.update(id, { status }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['tasks'] }),
  })

  const handleCreate = () => {
    if (!newTask.title.trim()) return
    createMutation.mutate({
      title: newTask.title,
      due_date: newTask.due_date || undefined,
      priority: newTask.priority,
      status: 'open',
      task_type: 'renewal',
      customer_id: contract.customer_id,
      customer_name: contract.customer_name,
      contract_id: contract.id,
    })
  }

  const openCount = contractTasks.filter(t => t.status !== 'completed').length

  return (
    <div className="mt-3 border-t border-border/50 pt-3">
      {/* Header */}
      <div className="flex items-center justify-between mb-2">
        <span className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground flex items-center gap-1.5">
          <Clock className="w-3 h-3" />
          Aufgaben ({contractTasks.length})
          {openCount > 0 && (
            <span className="bg-orange-100 text-orange-700 px-1.5 py-0.5 rounded-full text-[9px] font-bold">{openCount} offen</span>
          )}
        </span>
        <button
          onClick={() => setShowForm(!showForm)}
          className="text-[10px] text-primary font-semibold flex items-center gap-1 hover:underline"
        >
          <Plus className="w-3 h-3" /> Aufgabe
        </button>
      </div>

      {/* Existing Tasks */}
      {contractTasks.length > 0 && (
        <div className="space-y-1 mb-2">
          {contractTasks.map(t => (
            <div key={t.id} className={cn(
              'flex items-center gap-2 px-2 py-1.5 rounded-lg border text-xs',
              t.status === 'completed' ? 'bg-green-50 border-green-100 opacity-60' :
              t.status === 'in_progress' ? 'bg-blue-50 border-blue-100' :
              'bg-white border-border'
            )}>
              <button
                onClick={() => {
                  const next = t.status === 'open' ? 'in_progress' : t.status === 'in_progress' ? 'completed' : 'open'
                  updateStatusMutation.mutate({ id: t.id, status: next })
                }}
                className="flex-shrink-0 hover:scale-110 transition-transform"
                title={`Status: ${STATUS_LABELS[t.status]}`}
              >
                {STATUS_ICONS[t.status] || STATUS_ICONS.open}
              </button>
              <span className={cn('flex-1 truncate', t.status === 'completed' && 'line-through')}>{t.title}</span>
              {t.due_date && (
                <span className={cn('text-[10px] flex-shrink-0',
                  new Date(t.due_date) < new Date() && t.status !== 'completed' ? 'text-red-600 font-bold' : 'text-muted-foreground'
                )}>
                  {new Date(t.due_date).toLocaleDateString('de-CH', { day: '2-digit', month: '2-digit' })}
                </span>
              )}
            </div>
          ))}
        </div>
      )}

      {/* New Task Form */}
      {showForm && (
        <div className="flex flex-col gap-1.5 p-2.5 bg-primary/5 rounded-lg border border-primary/20">
          <Input
            placeholder="Aufgabe beschreiben..."
            value={newTask.title}
            onChange={e => setNewTask(p => ({ ...p, title: e.target.value }))}
            className="h-7 text-xs"
            autoFocus
            onKeyDown={e => e.key === 'Enter' && handleCreate()}
          />
          <div className="flex gap-1.5">
            <Input
              type="date"
              value={newTask.due_date}
              onChange={e => setNewTask(p => ({ ...p, due_date: e.target.value }))}
              className="h-7 text-xs flex-1"
            />
            <Select value={newTask.priority} onValueChange={v => setNewTask(p => ({ ...p, priority: v }))}>
              <SelectTrigger className="h-7 text-xs w-28"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="low">Tief</SelectItem>
                <SelectItem value="medium">Mittel</SelectItem>
                <SelectItem value="high">Hoch</SelectItem>
                <SelectItem value="urgent">Dringend</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="flex gap-1.5">
            <Button size="sm" className="h-6 text-xs flex-1" onClick={handleCreate} disabled={!newTask.title.trim() || createMutation.isPending}>
              Erstellen
            </Button>
            <Button size="sm" variant="ghost" className="h-6 text-xs" onClick={() => setShowForm(false)}>Abbrechen</Button>
          </div>
        </div>
      )}

      {contractTasks.length === 0 && !showForm && (
        <p className="text-[10px] text-muted-foreground italic">Noch keine Aufgaben — direkt hier erstellen.</p>
      )}
    </div>
  )
}