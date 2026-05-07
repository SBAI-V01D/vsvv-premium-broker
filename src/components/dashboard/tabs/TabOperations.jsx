import React from 'react'
import { useNavigate } from 'react-router-dom'
import { CheckCircle2, Clock, AlertTriangle, RefreshCw, FileWarning, ListTodo } from 'lucide-react'
import DashboardKpiTile from '../DashboardKpiTile'
import SupportSection from '../SupportSection'
import RenewalPipelineKanbanV2 from '../RenewalPipelineKanbanV2'
import TasksPanel from '../TasksPanel'

export default function TabOperations({ data, onTaskClick }) {
  const navigate = useNavigate()
  const {
    openTasks, tasks, documents, expiringContracts, filteredContracts,
    customers, pendingApplications, contractsWithoutDoc,
  } = data

  const todayStr = new Date().toISOString().slice(0, 10)
  const dueTodayCount = tasks.filter(t => t.due_date === todayStr && t.status !== 'completed').length

  // Trennung: Vertragsablauf-Aufgaben vs. allgemeine Aufgaben
  const contractExpiryTasks = openTasks.filter(t => t.task_type === 'renewal')
  const generalTasks = openTasks.filter(t => t.task_type !== 'renewal')

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

      {/* Zwei separate Aufgaben-Panels */}
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
        <div>
          <h3 className="text-xs font-semibold uppercase tracking-widest text-muted-foreground mb-3 flex items-center gap-2">
            <ListTodo className="w-3.5 h-3.5" /> Allgemeine Aufgaben
          </h3>
          <TasksPanel
            tasks={generalTasks}
            onTaskClick={onTaskClick}
            onViewAll={() => navigate('/aufgaben')}
            emptyText="Keine allgemeinen Aufgaben offen"
            accentClass="border-l-blue-500"
            badgeClass="bg-blue-100 text-blue-700"
          />
        </div>
        <div>
          <h3 className="text-xs font-semibold uppercase tracking-widest text-muted-foreground mb-3 flex items-center gap-2">
            <FileWarning className="w-3.5 h-3.5 text-orange-500" />
            <span className="text-orange-600">Vertragsabläufe</span>
            {contractExpiryTasks.length > 0 && (
              <span className="ml-1 px-1.5 py-0.5 text-xs rounded-full bg-orange-100 text-orange-700 font-semibold">
                {contractExpiryTasks.length}
              </span>
            )}
          </h3>
          <TasksPanel
            tasks={contractExpiryTasks}
            onTaskClick={onTaskClick}
            onViewAll={() => navigate('/aufgaben')}
            emptyText="Keine abgelaufenen Verträge mit offenen Aufgaben"
            accentClass="border-l-orange-500"
            badgeClass="bg-orange-100 text-orange-700"
            badgeLabel="Abgelaufen"
          />
        </div>
      </div>

    </div>
  )
}