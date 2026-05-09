import React, { useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { CheckSquare } from 'lucide-react'
import { cn } from '@/lib/utils'

const daysUntil = (dateStr) => {
  if (!dateStr) return null
  return Math.ceil((new Date(dateStr) - new Date()) / 86400000)
}

const priorityColor = (p) => {
  if (p === 'urgent') return 'bg-red-100 text-red-700'
  if (p === 'high') return 'bg-orange-100 text-orange-700'
  if (p === 'medium') return 'bg-blue-100 text-blue-700'
  return 'bg-gray-100 text-gray-700'
}

const dueColor = (days) => {
  if (days === null) return 'text-gray-500'
  if (days <= 0) return 'text-red-700 font-bold'
  if (days <= 3) return 'text-red-600'
  if (days <= 7) return 'text-orange-600'
  return 'text-green-600'
}

export default function OperativeTasksPanel({ tasks = [], limit = 10 }) {
  const navigate = useNavigate()

  // Filter & sort open tasks (LIMIT 10, sorted by due_date + priority)
  const openList = useMemo(() => {
    return tasks
      .filter(t => ['open', 'in_progress', 'waiting'].includes(t.status))
      .sort((a, b) => {
        // Overdue first
        const aDays = daysUntil(a.due_date)
        const bDays = daysUntil(b.due_date)
        if ((aDays === null || aDays > 0) !== (bDays === null || bDays > 0)) {
          return (aDays === null || aDays > 0) ? 1 : -1
        }
        // Then by due date
        if (aDays !== bDays) return (aDays || 999) - (bDays || 999)
        // Then by priority
        const priorityMap = { urgent: 0, high: 1, medium: 2, low: 3 }
        return (priorityMap[a.priority] || 3) - (priorityMap[b.priority] || 3)
      })
      .slice(0, limit)
  }, [tasks, limit])

  if (openList.length === 0) {
    return (
      <Card>
        <CardContent className="p-6 text-center text-muted-foreground">
          ✓ Keine offenen Aufgaben
        </CardContent>
      </Card>
    )
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <CheckSquare className="w-5 h-5 text-blue-500" />
          Offene Aufgaben ({openList.length})
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-2 p-0 px-6 pb-6">
        {openList.map((task) => {
          const days = daysUntil(task.due_date)
          
          return (
            <div
              key={task.id}
              className="p-3 rounded-lg border bg-white hover:bg-muted/30 cursor-pointer transition-colors flex items-center justify-between gap-3"
              onClick={() => navigate('/aufgaben')}
            >
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold truncate">{task.title}</p>
                <p className="text-xs text-muted-foreground">{task.customer_name || '(kein Kunde)'}</p>
              </div>
              <div className="flex items-center gap-2 flex-shrink-0">
                <span className={cn('text-xs px-2 py-0.5 rounded font-medium', priorityColor(task.priority))}>
                  {task.priority || 'normal'}
                </span>
                {task.due_date && (
                  <span className={cn('text-xs font-bold', dueColor(days))}>
                    {days === null ? '' : days <= 0 ? 'ÜBERFÄLLIG' : days === 0 ? 'HEUTE' : `${days}T`}
                  </span>
                )}
              </div>
            </div>
          )
        })}
      </CardContent>
    </Card>
  )
}