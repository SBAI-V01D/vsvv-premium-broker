import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { CheckCircle2, Clock, AlertTriangle, RefreshCw, FileWarning, ListTodo, CalendarX2 } from 'lucide-react'
import DashboardKpiTile from '../DashboardKpiTile'
import RenewalPipelineKanbanV2 from '../RenewalPipelineKanbanV2'
import TasksPanel from '../TasksPanel'
import { cn } from '@/lib/utils'
import { format, differenceInDays, parseISO } from 'date-fns'
import { de } from 'date-fns/locale'

export default function TabOperations({ data, onTaskClick }) {
  const navigate = useNavigate()
  const [taskTab, setTaskTab] = useState('general')
  const {
    openTasks, tasks, expiringContracts, filteredContracts,
    pendingApplications, contractsWithoutDoc,
  } = data

  const todayStr = new Date().toISOString().slice(0, 10)
  const today = new Date()
  const dueTodayCount = tasks.filter(t => t.due_date === todayStr && ['open', 'in_progress', 'waiting'].includes(t.status)).length

  const contractExpiryTasks = openTasks.filter(t => t.task_type === 'renewal')
  const generalTasks = openTasks.filter(t => t.task_type !== 'renewal')

  // Kündigungstermine: Verträge mit cancellation_deadline in den nächsten 180 Tagen
  const kuendigungsTermine = (filteredContracts || [])
    .filter(c => c.cancellation_deadline && c.status === 'active')
    .map(c => ({ ...c, _days: differenceInDays(parseISO(c.cancellation_deadline), today) }))
    .filter(c => c._days >= -7 && c._days <= 180)
    .sort((a, b) => a._days - b._days)

  return (
    <div className="space-y-8">

      <div>
        <h3 className="text-xs font-semibold uppercase tracking-widest text-muted-foreground mb-3">Operations KPIs</h3>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          <DashboardKpiTile label="Offene Aufgaben" value={openTasks.length} sub="pendent / in Bearb." icon={CheckCircle2} accent="border-l-blue-500" onClick={() => navigate('/aufgaben')} />
          <DashboardKpiTile label="Heute fällig" value={dueTodayCount} sub="sofort bearbeiten" icon={Clock} accent="border-l-red-500" onClick={() => navigate('/aufgaben')} />
          <DashboardKpiTile label="Fehlende Dokumente" value={contractsWithoutDoc} sub="Policen ohne Datei" icon={AlertTriangle} accent="border-l-amber-500" onClick={() => navigate('/dokumente')} />
          <DashboardKpiTile label="Ablaufende Verträge" value={expiringContracts.length} sub="nächste 90 Tage" icon={RefreshCw} accent="border-l-orange-500" onClick={() => navigate('/vertraege')} />
        </div>
      </div>

      <div>
        <h3 className="text-xs font-semibold uppercase tracking-widest text-muted-foreground mb-3">Renewal Pipeline</h3>
        <div className="bg-gradient-to-br from-slate-50 to-blue-50 p-5 rounded-xl border border-slate-200">
          <RenewalPipelineKanbanV2 contracts={filteredContracts} />
        </div>
      </div>

      {/* Aufgaben mit Tabs */}
      <div>
        <div className="flex items-center gap-1 mb-4 border-b border-border">
          <button
            onClick={() => setTaskTab('general')}
            className={cn(
              'flex items-center gap-1.5 px-4 py-2 text-sm font-medium border-b-2 -mb-px transition-colors',
              taskTab === 'general'
                ? 'border-primary text-primary'
                : 'border-transparent text-muted-foreground hover:text-foreground'
            )}
          >
            <ListTodo className="w-3.5 h-3.5" />
            Allgemeine Aufgaben
            {generalTasks.length > 0 && (
              <span className={cn('ml-1 px-1.5 py-0.5 text-[10px] rounded-full font-semibold',
                taskTab === 'general' ? 'bg-primary/10 text-primary' : 'bg-muted text-muted-foreground'
              )}>
                {generalTasks.length}
              </span>
            )}
          </button>
          <button
            onClick={() => setTaskTab('renewal')}
            className={cn(
              'flex items-center gap-1.5 px-4 py-2 text-sm font-medium border-b-2 -mb-px transition-colors',
              taskTab === 'renewal'
                ? 'border-orange-500 text-orange-600'
                : 'border-transparent text-muted-foreground hover:text-foreground'
            )}
          >
            <FileWarning className="w-3.5 h-3.5" />
            Vertragsabläufe
            {contractExpiryTasks.length > 0 && (
              <span className={cn('ml-1 px-1.5 py-0.5 text-[10px] rounded-full font-semibold',
                taskTab === 'renewal' ? 'bg-orange-100 text-orange-700' : 'bg-muted text-muted-foreground'
              )}>
                {contractExpiryTasks.length}
              </span>
            )}
          </button>
          <button
            onClick={() => setTaskTab('kuendigung')}
            className={cn(
              'flex items-center gap-1.5 px-4 py-2 text-sm font-medium border-b-2 -mb-px transition-colors',
              taskTab === 'kuendigung'
                ? 'border-red-500 text-red-600'
                : 'border-transparent text-muted-foreground hover:text-foreground'
            )}
          >
            <CalendarX2 className="w-3.5 h-3.5" />
            Kündigungstermine
            {kuendigungsTermine.length > 0 && (
              <span className={cn('ml-1 px-1.5 py-0.5 text-[10px] rounded-full font-semibold',
                taskTab === 'kuendigung' ? 'bg-red-100 text-red-700' : 'bg-muted text-muted-foreground'
              )}>
                {kuendigungsTermine.length}
              </span>
            )}
          </button>
        </div>

        {taskTab === 'general' && (
          <TasksPanel
            tasks={generalTasks}
            onTaskClick={onTaskClick}
            onViewAll={() => navigate('/aufgaben')}
            emptyText="Keine allgemeinen Aufgaben offen"
            accentClass="border-l-blue-500"
            badgeClass="bg-blue-100 text-blue-700"
          />
        )}
        {taskTab === 'renewal' && (
          <TasksPanel
            tasks={contractExpiryTasks}
            onTaskClick={onTaskClick}
            onViewAll={() => navigate('/aufgaben')}
            emptyText="Keine abgelaufenen Verträge mit offenen Aufgaben"
            accentClass="border-l-orange-500"
            badgeClass="bg-orange-100 text-orange-700"
            badgeLabel="Abgelaufen"
          />
        )}
        {taskTab === 'kuendigung' && (
          <div className="space-y-2">
            {kuendigungsTermine.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-8">Keine Kündigungstermine in den nächsten 180 Tagen</p>
            ) : (
              kuendigungsTermine.map(c => {
                const isOverdue = c._days < 0
                const isUrgent = c._days <= 14
                const isSoon = c._days <= 30
                return (
                  <div
                    key={c.id}
                    className={cn(
                      'flex items-center justify-between gap-3 p-3 rounded-lg border-l-4 bg-white border cursor-pointer hover:shadow-sm transition-shadow',
                      isOverdue ? 'border-l-red-600' : isUrgent ? 'border-l-red-400' : isSoon ? 'border-l-orange-400' : 'border-l-amber-300'
                    )}
                    onClick={() => navigate('/vertraege')}
                  >
                    <div className="min-w-0">
                      <p className="font-medium text-sm truncate">{c.customer_name}</p>
                      <p className="text-xs text-muted-foreground truncate">{c.insurer}{c.product ? ` · ${c.product}` : ''}{c.policy_number ? ` · ${c.policy_number}` : ''}</p>
                    </div>
                    <div className="flex-shrink-0 text-right">
                      <p className={cn('text-xs font-semibold',
                        isOverdue ? 'text-red-600' : isUrgent ? 'text-red-500' : isSoon ? 'text-orange-500' : 'text-amber-600'
                      )}>
                        {isOverdue ? `Überfällig (${Math.abs(c._days)}d)` : c._days === 0 ? 'Heute!' : `in ${c._days} Tagen`}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {format(parseISO(c.cancellation_deadline), 'd. MMM yyyy', { locale: de })}
                      </p>
                    </div>
                  </div>
                )
              })
            )}
          </div>
        )}
      </div>

    </div>
  )
}