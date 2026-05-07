import React from 'react'
import { useNavigate } from 'react-router-dom'
import { CheckCircle2, Clock, FileText, AlertTriangle, RefreshCw } from 'lucide-react'
import DashboardKpiTile from '../DashboardKpiTile'
import SupportSection from '../SupportSection'
import RenewalPipelineKanbanV2 from '../RenewalPipelineKanbanV2'

export default function TabOperations({ data, onTaskClick }) {
  const navigate = useNavigate()
  const {
    openTasks, tasks, documents, expiringContracts, filteredContracts,
    customers, pendingApplications, contractsWithoutDoc,
  } = data

  const todayStr = new Date().toISOString().slice(0, 10)
  const dueTodayCount = tasks.filter(t => t.due_date === todayStr && t.status !== 'completed').length

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

      <div>
        <h3 className="text-xs font-semibold uppercase tracking-widest text-muted-foreground mb-3">Offene Aufgaben</h3>
        <SupportSection
          tasks={openTasks.slice(0, 8)}
          customers={customers}
          activities={[]}
          onTaskClick={onTaskClick}
        />
      </div>

    </div>
  )
}