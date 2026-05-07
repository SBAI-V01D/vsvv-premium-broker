import React from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { CheckSquare, ChevronRight } from 'lucide-react'
import { cn } from '@/lib/utils'

export default function TasksPanel({
  tasks = [],
  onTaskClick,
  onViewAll,
  emptyText = 'Keine offenen Aufgaben',
  accentClass = 'border-l-blue-500',
  badgeClass = 'bg-blue-100 text-blue-700',
  badgeLabel,
}) {
  const displayed = tasks.slice(0, 8)

  const priorityColors = {
    urgent: 'bg-red-100 text-red-700 border-red-200',
    high:   'bg-orange-100 text-orange-700 border-orange-200',
    medium: 'bg-amber-100 text-amber-700 border-amber-200',
    low:    'bg-slate-100 text-slate-600 border-slate-200',
  }
  const priorityLabels = { urgent: 'Dringend', high: 'Hoch', medium: 'Mittel', low: 'Niedrig' }

  return (
    <Card className={cn('shadow-sm border-l-4', accentClass)}>
      <CardHeader className="pb-3 border-b border-slate-100 flex flex-row items-center justify-between">
        <CardTitle className="text-sm flex items-center gap-2 text-slate-900">
          <CheckSquare className="w-4 h-4 text-slate-500" />
          {tasks.length > 0 ? `${tasks.length} offen` : 'Keine offen'}
        </CardTitle>
        {tasks.length > 0 && (
          <Button size="sm" variant="ghost" className="h-7 text-xs" onClick={onViewAll}>
            Alle <ChevronRight className="w-3 h-3 ml-1" />
          </Button>
        )}
      </CardHeader>
      <CardContent className="pt-3 space-y-2 max-h-[360px] overflow-y-auto">
        {displayed.length === 0 ? (
          <p className="text-xs text-green-600 font-medium py-2">✓ {emptyText}</p>
        ) : (
          displayed.map(task => (
            <div
              key={task.id}
              className="flex items-start justify-between gap-2 p-2.5 rounded-lg bg-slate-50 hover:bg-slate-100 transition-colors cursor-pointer"
              onClick={() => onTaskClick && onTaskClick(task)}
            >
              <div className="flex-1 min-w-0">
                <p className="text-xs font-medium text-slate-800 truncate">{task.title}</p>
                {task.due_date && (
                  <p className="text-[10px] text-slate-400 mt-0.5">
                    Fällig: {new Date(task.due_date).toLocaleDateString('de-CH')}
                  </p>
                )}
                {task.customer_name && (
                  <p className="text-[10px] text-slate-500 truncate">{task.customer_name}</p>
                )}
              </div>
              <Badge
                className={cn(
                  'flex-shrink-0 text-[10px] px-1.5 py-0.5 border',
                  task.priority === 'urgent' || task.priority === 'high'
                    ? priorityColors[task.priority]
                    : badgeClass
                )}
              >
                {badgeLabel || priorityLabels[task.priority] || 'offen'}
              </Badge>
            </div>
          ))
        )}
        {tasks.length > 8 && (
          <button
            className="w-full text-xs text-muted-foreground hover:text-primary py-1 transition-colors"
            onClick={onViewAll}
          >
            + {tasks.length - 8} weitere anzeigen
          </button>
        )}
      </CardContent>
    </Card>
  )
}