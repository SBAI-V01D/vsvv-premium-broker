/**
 * BrokerWorkflowBar — One-Click Broker Operations
 * Context-aware quick action strip. No navigation required.
 */
import React, { useState } from 'react'
import { base44 } from '@/api/base44Client'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { cn } from '@/lib/utils'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import {
  CheckSquare, Zap, TrendingUp, RotateCcw, AlertTriangle,
  Clock, ChevronDown, ChevronUp, X, Loader2
} from 'lucide-react'
import { format, addDays } from 'date-fns'

export default function BrokerWorkflowBar({
  customer,
  customerId,
  nextStep,
  metrics,
  onNewChance,
  onRenewalStart,
}) {
  const queryClient = useQueryClient()
  const [showQuickTask, setShowQuickTask] = useState(false)
  const [taskTitle, setTaskTitle] = useState('')
  const [taskDue, setTaskDue] = useState(format(addDays(new Date(), 3), 'yyyy-MM-dd'))

  const createTask = useMutation({
    mutationFn: (data) => base44.entities.Task.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tasks', customerId] })
      setTaskTitle('')
      setShowQuickTask(false)
    },
  })

  const handleFollowUp = async () => {
    await createTask.mutateAsync({
      title: `Follow-up: ${customer.first_name} ${customer.last_name}`,
      customer_id: customerId,
      customer_name: `${customer.first_name} ${customer.last_name}`,
      task_type: 'follow_up',
      priority: 'medium',
      status: 'open',
      due_date: format(addDays(new Date(), 1), 'yyyy-MM-dd'),
    })
  }

  const handleCreateTask = () => {
    if (!taskTitle.trim()) return
    createTask.mutate({
      title: taskTitle.trim(),
      customer_id: customerId,
      customer_name: `${customer.first_name} ${customer.last_name}`,
      task_type: 'general',
      priority: 'medium',
      status: 'open',
      due_date: taskDue || null,
    })
  }

  return (
    <div className="rounded-xl border border-border bg-white shadow-sm overflow-hidden">
      {/* Context Alert — only shown if urgent */}
      {nextStep?.urgent && (
        <div className={cn(
          'flex items-center gap-2 px-3 py-2 border-b border-border text-xs font-semibold',
          'bg-red-50 text-red-700 border-red-100'
        )}>
          <AlertTriangle className="w-3.5 h-3.5 flex-shrink-0" />
          <span className="flex-1 truncate">⚡ {nextStep.text}</span>
        </div>
      )}
      {nextStep && !nextStep.urgent && (
        <div className="flex items-center gap-2 px-3 py-2 border-b border-border text-xs font-medium bg-amber-50/60 text-amber-700 border-amber-100">
          <Clock className="w-3.5 h-3.5 flex-shrink-0" />
          <span className="flex-1 truncate">{nextStep.text}</span>
        </div>
      )}

      {/* Action Buttons */}
      <div className="flex items-center gap-1 px-2 py-2 overflow-x-auto scrollbar-none">
        {/* Quick Task */}
        <button
          onClick={() => setShowQuickTask(v => !v)}
          className={cn(
            'flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all whitespace-nowrap',
            showQuickTask
              ? 'bg-primary text-white'
              : 'bg-primary/8 text-primary hover:bg-primary/15'
          )}
        >
          <CheckSquare className="w-3.5 h-3.5" />
          Aufgabe
          {showQuickTask ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
        </button>

        {/* Follow-up */}
        <button
          onClick={handleFollowUp}
          disabled={createTask.isPending}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-blue-50 text-blue-700 hover:bg-blue-100 transition-colors whitespace-nowrap disabled:opacity-50"
        >
          {createTask.isPending
            ? <Loader2 className="w-3.5 h-3.5 animate-spin" />
            : <Zap className="w-3.5 h-3.5" />
          }
          Follow-up
        </button>

        {/* Neue Verkaufschance */}
        <button
          onClick={onNewChance}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-emerald-50 text-emerald-700 hover:bg-emerald-100 transition-colors whitespace-nowrap"
        >
          <TrendingUp className="w-3.5 h-3.5" />
          Verkaufschance
        </button>

        {/* Renewal — context-aware: only shown if expiring contracts */}
        {metrics?.expiringSoon?.length > 0 && (
          <button
            onClick={onRenewalStart}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-orange-50 text-orange-700 hover:bg-orange-100 transition-colors whitespace-nowrap border border-orange-200"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            Renewal · {metrics.expiringSoon.length}
          </button>
        )}

        {/* Open Tasks KPI */}
        {metrics?.openTasks?.length > 0 && (
          <span className={cn(
            'ml-auto flex-shrink-0 flex items-center gap-1 px-2 py-1 rounded-lg text-[11px] font-bold',
            metrics.overdueTasks?.length > 0
              ? 'bg-red-50 text-red-600 border border-red-200'
              : 'bg-amber-50 text-amber-700 border border-amber-200'
          )}>
            <Clock className="w-3 h-3" />
            {metrics.openTasks.length} offen
            {metrics.overdueTasks?.length > 0 && ` · ${metrics.overdueTasks.length} überfällig`}
          </span>
        )}
      </div>

      {/* Inline Quick Task Form */}
      {showQuickTask && (
        <div className="px-3 pb-3 pt-1 border-t border-border bg-primary/3 flex items-end gap-2">
          <div className="flex-1 space-y-1.5">
            <Input
              autoFocus
              placeholder="Aufgabentitel..."
              value={taskTitle}
              onChange={e => setTaskTitle(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleCreateTask()}
              className="h-8 text-sm"
            />
            <div className="flex items-center gap-2">
              <span className="text-[11px] text-muted-foreground">Fällig:</span>
              <input
                type="date"
                value={taskDue}
                onChange={e => setTaskDue(e.target.value)}
                className="text-xs border border-border rounded px-2 py-0.5 bg-white"
              />
            </div>
          </div>
          <Button
            size="sm"
            onClick={handleCreateTask}
            disabled={!taskTitle.trim() || createTask.isPending}
            className="h-8 px-3 text-xs"
          >
            {createTask.isPending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : 'Erstellen'}
          </Button>
          <button
            onClick={() => setShowQuickTask(false)}
            className="p-1.5 rounded hover:bg-muted transition-colors text-muted-foreground"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}
    </div>
  )
}