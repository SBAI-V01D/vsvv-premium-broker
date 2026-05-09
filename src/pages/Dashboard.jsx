import React, { useState, useMemo } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useNavigate } from 'react-router-dom'
import { base44 } from '@/api/base44Client'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { LayoutDashboard, Target, Users, ShieldCheck, Settings, BarChart3, Crown } from 'lucide-react'
import { cn } from '@/lib/utils'
import { buildLifecycleMap, filterTruePipelineLeads, LIFECYCLE_STATES } from '@/lib/lifecycle'
import { recalculateDashboardCommissions, syncApplicationCommission, validateCommissionEntry } from '@/lib/commissionSync'

import TabExecutive  from '@/components/dashboard/tabs/TabExecutive.jsx'
import TabSales      from '@/components/dashboard/tabs/TabSales'
import TabCustomers  from '@/components/dashboard/tabs/TabCustomers'
import TabCoverage   from '@/components/dashboard/tabs/TabCoverage'
import TabOperations from '@/components/dashboard/tabs/TabOperations'
import TabAnalytics  from '@/components/dashboard/tabs/TabAnalytics'
import TabCEO        from '@/components/dashboard/tabs/TabCEO'
import MasterControlDashboard from '@/components/dashboard/MasterControlDashboard'
import RawDataDiagnostic from '@/components/admin/RawDataDiagnostic'
import VisibilityAnalyzer from '@/components/admin/VisibilityAnalyzer'
import CommissionDataValidator from '@/components/dashboard/CommissionDataValidator'
import { Layers } from 'lucide-react'

const TABS = [
  { id: 'diagnostic', label: '⚙️ Diagnose', icon: Layers },
  { id: 'master',     label: 'Command Center', icon: Layers },
  { id: 'ceo',        label: 'CEO',          icon: Crown },
  { id: 'executive',  label: 'BrokerOS',     icon: LayoutDashboard },
  { id: 'sales',      label: 'Sales',        icon: Target },
  { id: 'customers',  label: 'Kunden',       icon: Users },
  { id: 'coverage',   label: 'Coverage',     icon: ShieldCheck },
  { id: 'operations', label: 'Operations',   icon: Settings },
  { id: 'analytics',  label: 'Analytics',    icon: BarChart3 },
]

export default function Dashboard() {
  const navigate = useNavigate()
  const [activeTab, setActiveTab] = useState('master')
  const [selectedTask, setSelectedTask] = useState(null)
  const [formData, setFormData] = useState({ title: '', status: '', notes: '', due_date: '' })
  const [filterOrg, setFilterOrg] = useState('all')
  const [filterAdvisor, setFilterAdvisor] = useState('all')
  const queryClient = useQueryClient()

  // ── All data fetched in parallel ──────────────────────────────────────────
  const { data: customers = [] }        = useQuery({ queryKey: ['customers'],        queryFn: () => base44.entities.Customer.list() })
  const { data: leads = [] }            = useQuery({ queryKey: ['leads'],            queryFn: () => base44.entities.Lead.list() })
  const { data: contracts = [] }        = useQuery({ queryKey: ['contracts'],        queryFn: () => base44.entities.Contract.list() })
  const { data: applications = [] }     = useQuery({ queryKey: ['applications'],     queryFn: () => base44.entities.Application.list() })
  const { data: tasks = [] }            = useQuery({ queryKey: ['tasks'],            queryFn: () => base44.entities.Task.list() })
  const { data: advisors = [] }         = useQuery({ queryKey: ['advisors'],         queryFn: () => base44.entities.Advisor.list() })
  const { data: organizations = [] }    = useQuery({ queryKey: ['organizations'],    queryFn: () => base44.entities.Organization.list() })
  const { data: commissionEntries = []} = useQuery({ queryKey: ['commissionEntries'],queryFn: () => base44.entities.CommissionEntry.list() })
  const { data: documents = [] }        = useQuery({ queryKey: ['documents'],        queryFn: () => base44.entities.Document.list() })

  // ── Org/Advisor filter ────────────────────────────────────────────────────
  const filteredAdvisors = useMemo(() =>
    filterOrg === 'all' ? advisors : advisors.filter(a => a.organization_id === filterOrg),
    [advisors, filterOrg]
  )
  const filteredAdvisorEmails = useMemo(() => new Set(filteredAdvisors.map(a => a.email)), [filteredAdvisors])
  const activeAdvisorEmail = filterAdvisor === 'all' ? null : filterAdvisor

  const filteredContracts = useMemo(() => {
    let c = contracts
    if (filterOrg !== 'all') c = c.filter(x => filteredAdvisorEmails.has(x.assigned_broker))
    if (activeAdvisorEmail) c = c.filter(x => x.assigned_broker === activeAdvisorEmail)
    return c
  }, [contracts, filterOrg, filteredAdvisorEmails, activeAdvisorEmail])

  const filteredCommissions = useMemo(() => {
    let c = commissionEntries
    if (filterOrg !== 'all') c = c.filter(x => filteredAdvisorEmails.has(x.broker_email))
    if (activeAdvisorEmail) c = c.filter(x => x.broker_email === activeAdvisorEmail)
    return c
  }, [commissionEntries, filterOrg, filteredAdvisorEmails, activeAdvisorEmail])

  // ── Lifecycle Engine ──────────────────────────────────────────────────────
  const lifecycleMap = useMemo(() => buildLifecycleMap(customers, contracts, leads), [customers, contracts, leads])

  // ── Derived Data (lifecycle-driven) ──────────────────────────────────────
  const activeContracts  = useMemo(() => filteredContracts.filter(c => c.status === 'active'), [filteredContracts])

  const activeContractCustomerIds = useMemo(() =>
    new Set(activeContracts.map(c => c.customer_id).filter(Boolean)),
    [activeContracts]
  )

  const activeCustomers = useMemo(() =>
    customers.filter(c => !c.is_family_member && (
      lifecycleMap[c.id] === LIFECYCLE_STATES.ACTIVE_CUSTOMER ||
      lifecycleMap[c.id] === LIFECYCLE_STATES.VIP_CUSTOMER ||
      lifecycleMap[c.id] === LIFECYCLE_STATES.RENEWAL
    )),
    [customers, lifecycleMap]
  )

  const vipCustomers = useMemo(() =>
    customers.filter(c => lifecycleMap[c.id] === LIFECYCLE_STATES.VIP_CUSTOMER),
    [customers, lifecycleMap]
  )

  // True pipeline leads (lifecycle engine enforces strict separation)
  const trueLeads = useMemo(() => filterTruePipelineLeads(leads, contracts), [leads, contracts])
  const activeLeads = trueLeads.filter(l => ['new', 'contacted', 'qualified'].includes(l.status))
  const convertedLeads = leads.filter(l => l.status === 'converted')
  const conversionRate = leads.length > 0 ? ((convertedLeads.length / leads.length) * 100).toFixed(1) : '0.0'

  // Coverage gaps
  const REQUIRED_SPARTEN = ['kvg', 'haftpflicht_privat']
  const customersWithCriticalGaps = useMemo(() =>
    activeCustomers.filter(customer => {
      const covered = new Set(
        contracts.filter(c => c.status === 'active' && (c.customer_id === customer.id || c.primary_customer_id === customer.id))
          .map(c => c.sparte || c.insurance_type).filter(Boolean)
      )
      return REQUIRED_SPARTEN.some(s => !covered.has(s))
    }),
    [activeCustomers, contracts]
  )

  // Expiring contracts (90 days)
  const today = new Date()
  const in90 = new Date(today); in90.setDate(today.getDate() + 90)
  const expiringContracts = useMemo(() =>
    activeContracts.filter(c => {
      if (!c.end_date) return false
      const end = new Date(c.end_date)
      // Include overdue contracts (end_date in past) AND contracts expiring in next 90 days
      return end <= in90
    }),
    [activeContracts]
  )

  // Premium volumes
  const totalMonthlyPremium = activeContracts.reduce((s, c) => s + (c.premium_monthly || 0), 0)
  const totalYearlyPremium  = activeContracts.reduce((s, c) => s + (c.premium_yearly || (c.premium_monthly || 0) * 12), 0)

  // ── Commission Synchronization & Metrics ─────────────────────────────────
  const commissionMetrics = useMemo(() => 
    recalculateDashboardCommissions(filteredCommissions, activeContracts),
    [filteredCommissions, activeContracts]
  )
  
  const mtdCommissions = commissionMetrics.mtd
  const yearlyCommissionForecast = commissionMetrics.forecast
  const totalCommissionEarned = commissionMetrics.total
  const pendingCommissions = commissionMetrics.pending
  
  // Validate commission data integrity
  const commissionValidation = useMemo(() => {
    const invalid = commissionEntries.filter(ce => !validateCommissionEntry(ce).isValid)
    return {
      totalRecords: commissionEntries.length,
      invalidRecords: invalid.length,
      hasIssues: invalid.length > 0,
      sampleIssues: invalid.slice(0, 3),
    }
  }, [commissionEntries])

  // Tasks — visible statuses: open, in_progress, waiting
  const openTasks = tasks.filter(t => ['open', 'in_progress', 'waiting'].includes(t.status))
  const pendingApplications = applications.filter(a => ['draft', 'submitted', 'under_review'].includes(a.status))
  const contractsWithoutDoc = activeContracts.filter(c => !c.policy_document_url).length

  // ── Shared data object passed to all tabs ─────────────────────────────────
  const sharedData = {
    customers, leads, contracts, applications, tasks, advisors, organizations,
    commissionEntries, documents, filteredContracts, filteredCommissions,
    filteredAdvisors, activeContracts, activeCustomers, vipCustomers,
    activeContractCustomerIds, trueLeads, activeLeads, convertedLeads,
    conversionRate, customersWithCriticalGaps, expiringContracts,
    totalMonthlyPremium, totalYearlyPremium, mtdCommissions, yearlyCommissionForecast,
    openTasks, pendingApplications, contractsWithoutDoc, lifecycleMap,
    documents, tasks,
    // Commission sync metrics
    commissionMetrics, totalCommissionEarned, pendingCommissions, commissionValidation,
  }

  // ── Task mutations ────────────────────────────────────────────────────────
  const updateMutation = useMutation({
    mutationFn: (data) => base44.entities.Task.update(selectedTask.id, {
      status: data.status ?? selectedTask.status,
      notes: data.notes ?? selectedTask.notes,
      due_date: data.due_date ?? selectedTask.due_date,
    }),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['tasks'] }); setSelectedTask(null) },
  })
  const deleteMutation = useMutation({
    mutationFn: (id) => base44.entities.Task.delete(id),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['tasks'] }); setSelectedTask(null) },
  })
  const createMutation = useMutation({
    mutationFn: (data) => base44.entities.Task.create(data),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['tasks'] }); setSelectedTask(null) },
  })

  const handleTaskClick = (task) => {
    setSelectedTask(task)
    setFormData({ title: task.title || '', status: task.status, notes: task.notes || '', due_date: task.due_date || '' })
  }

  const handleSave = () => {
    if (selectedTask?.id) updateMutation.mutate(formData)
    else createMutation.mutate({ title: formData.title || 'Neue Aufgabe', status: formData.status || 'open', notes: formData.notes, due_date: formData.due_date })
    // Auto-refresh KPIs after any task change
    setTimeout(() => {
      queryClient.invalidateQueries({ queryKey: ['tasks'] })
      queryClient.invalidateQueries({ queryKey: ['applications'] })
    }, 300)
  }

  return (
    <div className="space-y-0">

      {/* ── ENTERPRISE HEADER ─────────────────────────────────────────────── */}
      <div className="space-y-4 pb-5 border-b border-border">
        {/* Top row: greeting + filters */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h1 className="text-2xl font-bold tracking-tight">
              {(() => {
                const h = new Date().getHours()
                return h < 12 ? 'Guten Morgen' : h < 18 ? 'Guten Tag' : 'Guten Abend'
              })()} 👋
            </h1>
            <p className="text-xs text-muted-foreground mt-0.5 flex flex-wrap items-center gap-1">
              {new Date().toLocaleDateString('de-CH', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
              {' · '}
              <button onClick={() => navigate('/kunden')} className="text-emerald-600 font-medium hover:underline cursor-pointer">{activeCustomers.length} aktive Kunden</button>
              {' · '}
              <button onClick={() => navigate('/leads')} className="text-blue-600 font-medium hover:underline cursor-pointer">{activeLeads.length} Leads</button>
              {expiringContracts.length > 0 && (
                <><span className="mx-1">·</span><button onClick={() => navigate('/vertraege')} className="text-red-500 font-medium hover:underline cursor-pointer">{expiringContracts.length} Abläufe</button></>
              )}
            </p>
          </div>
          <div className="flex gap-2">
            <Select value={filterOrg} onValueChange={v => { setFilterOrg(v); setFilterAdvisor('all') }}>
              <SelectTrigger className="w-40 h-8 text-xs bg-background">
                <SelectValue placeholder="Organisation" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Alle Org.</SelectItem>
                {organizations.map(o => <SelectItem key={o.id} value={o.id}>{o.name}</SelectItem>)}
              </SelectContent>
            </Select>
            <Select value={filterAdvisor} onValueChange={setFilterAdvisor}>
              <SelectTrigger className="w-36 h-8 text-xs bg-background">
                <SelectValue placeholder="Berater" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Alle Berater</SelectItem>
                {filteredAdvisors.map(a => <SelectItem key={a.id} value={a.email}>{a.firstname}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
        </div>

        {/* Quick-action shortcuts */}
        <div className="flex gap-2 flex-wrap">
          {[
            { label: '+ Neuer Kunde', path: '/kunden', color: 'bg-blue-50 text-blue-700 border-blue-200 hover:bg-blue-100' },
            { label: '+ Neuer Lead', path: '/leads', color: 'bg-violet-50 text-violet-700 border-violet-200 hover:bg-violet-100' },
            { label: '+ Neuer Vertrag', path: '/vertraege', color: 'bg-emerald-50 text-emerald-700 border-emerald-200 hover:bg-emerald-100' },
            { label: '📄 Dokument hochladen', path: '/dokumente', color: 'bg-orange-50 text-orange-700 border-orange-200 hover:bg-orange-100' },
            { label: '📋 Aufgaben', path: '/aufgaben', color: openTasks.length > 0 ? 'bg-red-50 text-red-700 border-red-200 hover:bg-red-100' : 'bg-muted text-muted-foreground border-border hover:bg-muted/70' },
          ].map(a => (
            <button
              key={a.label}
              onClick={() => navigate(a.path)}
              className={`px-3 py-1.5 rounded-lg border text-xs font-semibold transition-colors ${a.color}`}
            >
              {a.label}
              {a.label.includes('Aufgaben') && openTasks.length > 0 && (
                <span className="ml-1.5 bg-red-500 text-white text-[9px] px-1.5 py-0.5 rounded-full font-bold">{openTasks.length}</span>
              )}
            </button>
          ))}
        </div>
      </div>

      {/* ── TAB NAVIGATION ───────────────────────────────────────────────── */}
      <div className="flex gap-1 pt-4 pb-6 overflow-x-auto border-b border-border">
        {TABS.map(tab => {
          const Icon = tab.icon
          const isActive = activeTab === tab.id
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={cn(
                'flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all whitespace-nowrap',
                isActive
                  ? 'bg-primary text-primary-foreground shadow-sm'
                  : 'text-muted-foreground hover:bg-muted hover:text-foreground'
              )}
            >
              <Icon className="w-4 h-4" />
              {tab.label}
              {/* Live badges */}
              {tab.id === 'master' && (openTasks.length + expiringContracts.filter(c => { const d = Math.ceil((new Date(c.end_date) - new Date()) / 86400000); return d <= 14 }).length) > 0 && (
                <span className={cn('text-xs px-1.5 py-0.5 rounded-full font-semibold', isActive ? 'bg-white/20 text-white' : 'bg-red-100 text-red-700')}>
                  !
                </span>
              )}
              {tab.id === 'sales' && activeLeads.length > 0 && (
                <span className={cn('text-xs px-1.5 py-0.5 rounded-full font-semibold', isActive ? 'bg-white/20 text-white' : 'bg-blue-100 text-blue-700')}>
                  {activeLeads.length}
                </span>
              )}
              {tab.id === 'coverage' && customersWithCriticalGaps.length > 0 && (
                <span className={cn('text-xs px-1.5 py-0.5 rounded-full font-semibold', isActive ? 'bg-white/20 text-white' : 'bg-red-100 text-red-700')}>
                  {customersWithCriticalGaps.length}
                </span>
              )}
              {tab.id === 'operations' && openTasks.length > 0 && (
                <span className={cn('text-xs px-1.5 py-0.5 rounded-full font-semibold', isActive ? 'bg-white/20 text-white' : 'bg-amber-100 text-amber-700')}>
                  {openTasks.length}
                </span>
              )}
            </button>
          )
        })}
      </div>

      {/* ── TAB CONTENT ──────────────────────────────────────────────────── */}
      <div className="pt-6">
        {activeTab === 'diagnostic' && (
          <div className="space-y-6">
            <RawDataDiagnostic />
            <VisibilityAnalyzer />
            <CommissionDataValidator 
              applications={applications}
              commissionEntries={commissionEntries}
              contracts={contracts}
            />
          </div>
        )}
        {activeTab === 'master'     && <MasterControlDashboard data={sharedData} onTaskClick={handleTaskClick} />}
        {activeTab === 'ceo'        && <TabCEO />}
        {activeTab === 'executive'  && <TabExecutive  data={sharedData} />}
        {activeTab === 'sales'      && <TabSales      data={sharedData} />}
        {activeTab === 'customers'  && <TabCustomers  data={sharedData} />}
        {activeTab === 'coverage'   && <TabCoverage   data={sharedData} />}
        {activeTab === 'operations' && <TabOperations data={sharedData} onTaskClick={handleTaskClick} />}
        {activeTab === 'analytics'  && <TabAnalytics  data={sharedData} />}
      </div>

      {/* ── TASK DIALOG ──────────────────────────────────────────────────── */}
      <Dialog open={!!selectedTask} onOpenChange={(open) => { if (!open) setSelectedTask(null) }}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{selectedTask?.id ? (selectedTask?.title || 'Aufgabe') : 'Neue Aufgabe'}</DialogTitle>
          </DialogHeader>
          {selectedTask && (
            <div className="space-y-4">
              {!selectedTask.id && (
                <div>
                  <Label>Titel *</Label>
                  <Input value={formData.title} onChange={e => setFormData(p => ({ ...p, title: e.target.value }))} className="mt-1" />
                </div>
              )}
              <div>
                <Label>Status</Label>
                <Select value={formData.status} onValueChange={v => setFormData(p => ({ ...p, status: v }))}>
                  <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="open">Pendent</SelectItem>
                    <SelectItem value="in_progress">In Bearbeitung</SelectItem>
                    <SelectItem value="completed">Erledigt</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Fälligkeitsdatum</Label>
                <Input type="date" value={formData.due_date || ''} onChange={e => setFormData(p => ({ ...p, due_date: e.target.value }))} className="mt-1" />
              </div>
              <div>
                <Label>Notizen</Label>
                <Textarea value={formData.notes} onChange={e => setFormData(p => ({ ...p, notes: e.target.value }))} className="mt-1" rows={3} />
              </div>
            </div>
          )}
          <DialogFooter className="flex justify-between">
            {selectedTask?.id && (
              <Button variant="destructive" size="sm" onClick={() => { if (confirm('Aufgabe löschen?')) deleteMutation.mutate(selectedTask.id) }}>
                Löschen
              </Button>
            )}
            <div className="flex gap-2 ml-auto">
              <Button variant="outline" onClick={() => setSelectedTask(null)}>Abbrechen</Button>
              <Button onClick={handleSave} disabled={updateMutation.isPending || createMutation.isPending}>Speichern</Button>
            </div>
          </DialogFooter>
        </DialogContent>
      </Dialog>

    </div>
  )
}