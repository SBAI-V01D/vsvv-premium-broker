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

import TabExecutive  from '@/components/dashboard/tabs/TabExecutive'
import TabSales      from '@/components/dashboard/tabs/TabSales'
import TabCustomers  from '@/components/dashboard/tabs/TabCustomers'
import TabCoverage   from '@/components/dashboard/tabs/TabCoverage'
import TabOperations from '@/components/dashboard/tabs/TabOperations'
import TabAnalytics  from '@/components/dashboard/tabs/TabAnalytics'
import TabCEO        from '@/components/dashboard/tabs/TabCEO'

const TABS = [
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
  const [activeTab, setActiveTab] = useState('ceo')
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
      return end >= today && end <= in90
    }),
    [activeContracts]
  )

  // Premium volumes
  const totalMonthlyPremium = activeContracts.reduce((s, c) => s + (c.premium_monthly || 0), 0)
  const totalYearlyPremium  = activeContracts.reduce((s, c) => s + (c.premium_yearly || (c.premium_monthly || 0) * 12), 0)

  // MTD commissions
  const nowStr = new Date().toISOString().slice(0, 7)
  const mtdCommissions = filteredCommissions
    .filter(ce => (ce.entry_date || ce.settlement_date || '').slice(0, 7) === nowStr)
    .reduce((s, ce) => s + (ce.commission_amount || ce.gross_commission || 0), 0)

  const yearlyCommissionForecast = activeContracts
    .reduce((s, c) => s + ((c.premium_yearly || (c.premium_monthly || 0) * 12) * (c.commission_rate || 0) / 100), 0)

  // Tasks
  const openTasks = tasks.filter(t => t.status === 'open' || t.status === 'in_progress')
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
  }

  return (
    <div className="space-y-0">

      {/* ── ENTERPRISE HEADER ─────────────────────────────────────────────── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-5 border-b border-border">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">BrokerOS Dashboard</h1>
          <p className="text-xs text-muted-foreground mt-0.5">
            {new Date().toLocaleDateString('de-CH', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
            {' · '}
            <span className="text-emerald-600 font-medium">{activeCustomers.length} aktive Kunden</span>
            {' · '}
            <span className="text-blue-600 font-medium">{activeLeads.length} Leads</span>
            {expiringContracts.length > 0 && (
              <><span className="mx-1">·</span><span className="text-red-500 font-medium">{expiringContracts.length} Abläufe</span></>
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