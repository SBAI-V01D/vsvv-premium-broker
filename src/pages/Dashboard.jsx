import React, { useState, useMemo } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useNavigate } from 'react-router-dom'
import { base44 } from '@/api/base44Client'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Users, FileText, ClipboardList, CheckCircle2, Building2, UserCheck, Wallet, TrendingUp } from 'lucide-react'
import KpiCard from '@/components/dashboard/KpiCard'
import RevenueChart from '@/components/dashboard/RevenueChart'
import TopAdvisors from '@/components/dashboard/TopAdvisors'
import ActivityFeed from '@/components/dashboard/ActivityFeed'
import QuickActions from '@/components/dashboard/QuickActions'
import FinanceWidget from '@/components/dashboard/FinanceWidget'
import ControllingSection from '@/components/dashboard/ControllingSection'
import RenewalWidget from '@/components/dashboard/RenewalWidget'
import RenewalsSection from '@/components/dashboard/RenewalsSection'
import RenewalPipelineKanbanV2 from '@/components/dashboard/RenewalPipelineKanbanV2'
import UpsellPipelineKanban from '@/components/dashboard/UpsellPipelineKanban'
import FlowPipeline from '@/components/dashboard/FlowPipeline'
import SupportSection from '@/components/dashboard/SupportSection'

export default function Dashboard() {
  const navigate = useNavigate()
  const [selectedTask, setSelectedTask] = useState(null)
  const [formData, setFormData] = useState({ status: '', notes: '', due_date: '' })
  const [filterOrg, setFilterOrg] = useState('all')
  const [filterAdvisor, setFilterAdvisor] = useState('all')
  const [kpiDetail, setKpiDetail] = useState(null)
  const queryClient = useQueryClient()

  // Data fetching – all parallel
  const { data: customers = [] } = useQuery({ queryKey: ['customers'], queryFn: () => base44.entities.Customer.list() })
  const { data: leads = [] } = useQuery({ queryKey: ['leads'], queryFn: () => base44.entities.Lead.list() })
  const { data: contracts = [] } = useQuery({ queryKey: ['contracts'], queryFn: () => base44.entities.Contract.list() })
  const { data: applications = [] } = useQuery({ queryKey: ['applications'], queryFn: () => base44.entities.Application.list() })
  const { data: tasks = [] } = useQuery({ queryKey: ['tasks'], queryFn: () => base44.entities.Task.list() })
  const { data: advisors = [] } = useQuery({ queryKey: ['advisors'], queryFn: () => base44.entities.Advisor.list() })
  const { data: organizations = [] } = useQuery({ queryKey: ['organizations'], queryFn: () => base44.entities.Organization.list() })
  const { data: commissionEntries = [] } = useQuery({ queryKey: ['commissionEntries'], queryFn: () => base44.entities.CommissionEntry.list() })
  const { data: documents = [] } = useQuery({ queryKey: ['documents'], queryFn: () => base44.entities.Document.list() })

  // Global filter: filter advisors by org
  const filteredAdvisors = useMemo(() => {
    if (filterOrg === 'all') return advisors
    return advisors.filter(a => a.organization_id === filterOrg)
  }, [advisors, filterOrg])

  const filteredAdvisorEmails = useMemo(() => new Set(filteredAdvisors.map(a => a.email)), [filteredAdvisors])

  // Apply advisor filter to data
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

  // KPI calculations
  const activeContracts = filteredContracts.filter(c => c.status === 'active')
  const totalMonthlyPremium = activeContracts.reduce((sum, c) => sum + (c.premium_monthly || 0), 0)

  // MTD commissions (current month)
  const nowStr = new Date().toISOString().slice(0, 7)
  const mtdCommissions = filteredCommissions
    .filter(ce => ce.settlement_date && ce.settlement_date.slice(0, 7) === nowStr)
    .reduce((sum, ce) => sum + (ce.gross_commission || 0), 0)

  const openTasks = tasks.filter(t => t.status === 'open' || t.status === 'in_progress')

  // Geburtstage
  const today = new Date()
  const upcomingBirthdays = customers
    .filter(c => c.birthdate)
    .map(c => {
      const birthDate = new Date(c.birthdate)
      const thisYear = new Date(today.getFullYear(), birthDate.getMonth(), birthDate.getDate())
      const nextYear = new Date(today.getFullYear() + 1, birthDate.getMonth(), birthDate.getDate())
      const nextBirthday = thisYear >= today ? thisYear : nextYear
      const daysUntil = Math.floor((nextBirthday - today) / (1000 * 60 * 60 * 24))
      return { customer: c, daysUntil, date: nextBirthday }
    })
    .filter(b => b.daysUntil <= 30)
    .sort((a, b) => a.daysUntil - b.daysUntil)
    .slice(0, 5)

  // Task mutations
  const updateMutation = useMutation({
    mutationFn: async (data) => {
      const updateData = {
        status: data.status !== undefined ? data.status : selectedTask.status,
        notes: data.notes !== undefined ? data.notes : selectedTask.notes,
        due_date: data.due_date !== undefined ? data.due_date : selectedTask.due_date,
        completion_date: data.completion_date !== undefined ? data.completion_date : selectedTask.completion_date,
      }
      return base44.entities.Task.update(selectedTask.id, updateData)
    },
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

  const formatDate = (dateStr) => {
    if (!dateStr) return '–'
    const date = new Date(dateStr + 'T00:00:00Z')
    return `${String(date.getUTCDate()).padStart(2, '0')}.${String(date.getUTCMonth() + 1).padStart(2, '0')}.${date.getUTCFullYear()}`
  }

  const handleTaskClick = (task) => {
    setSelectedTask(task)
    setFormData({ status: task.status, notes: task.notes || '', due_date: task.due_date || '', completion_date: task.completion_date || '' })
  }

  const handleNewTask = () => {
    setSelectedTask({ id: null, title: '', status: 'open' })
    setFormData({ title: '', status: 'open', notes: '', due_date: '', completion_date: '' })
  }

  const handleSave = () => {
    if (selectedTask?.id) {
      updateMutation.mutate(formData)
    } else {
      createMutation.mutate({
        title: formData.title || 'Neue Aufgabe',
        status: formData.status || 'open',
        notes: formData.notes,
        due_date: formData.due_date,
        completion_date: formData.completion_date,
      })
    }
  }

  // KPI detail data builders
  const kpiDetailData = {
    customers: { items: customers, label: 'Kunde', columns: ['first_name', 'last_name', 'email', 'city'] },
    activeContracts: { items: activeContracts.sort((a, b) => new Date(a.end_date || 0) - new Date(b.end_date || 0)), label: 'Policy', columns: ['policy_number', 'customer_name', 'insurer', 'end_date'] },
    advisors: { items: filteredAdvisors, label: 'Berater', columns: ['firstname', 'lastname', 'email'] },
    organizations: { items: organizations.filter(o => o.status === 'active'), label: 'Organisation', columns: ['name', 'type'] },
  }

  const kpis = [
    {
      label: 'Kunden Total',
      value: customers.length,
      icon: Users,
      color: { border: 'border-l-blue-500', bg: 'bg-blue-50', icon: 'text-blue-600' },
      onDetail: () => setKpiDetail({ type: 'customers', data: kpiDetailData.customers }),
    },
    {
      label: 'Aktive Policen',
      value: activeContracts.length,
      sub: `von ${filteredContracts.length} gesamt`,
      icon: FileText,
      color: { border: 'border-l-green-500', bg: 'bg-green-50', icon: 'text-green-600' },
      onDetail: () => setKpiDetail({ type: 'activeContracts', data: kpiDetailData.activeContracts }),
    },
    {
      label: 'Monatsprämien',
      value: `CHF ${totalMonthlyPremium.toLocaleString('de-CH', { maximumFractionDigits: 0 })}`,
      sub: 'Aktive Verträge',
      icon: TrendingUp,
      color: { border: 'border-l-primary', bg: 'bg-primary/10', icon: 'text-primary' },
      onDetail: () => setKpiDetail({ type: 'activeContracts', data: kpiDetailData.activeContracts }),
    },
    {
      label: 'Provisionen MTD',
      value: `CHF ${mtdCommissions.toLocaleString('de-CH', { maximumFractionDigits: 0 })}`,
      sub: new Date().toLocaleString('de-CH', { month: 'long', year: 'numeric' }),
      icon: Wallet,
      color: { border: 'border-l-amber-500', bg: 'bg-amber-50', icon: 'text-amber-600' },
      onDetail: () => navigate('/provisionen-courtagen'),
    },
    {
      label: 'Berater',
      value: filteredAdvisors.length,
      sub: filterOrg !== 'all' ? organizations.find(o => o.id === filterOrg)?.name : 'Alle Organisationen',
      icon: UserCheck,
      color: { border: 'border-l-purple-500', bg: 'bg-purple-50', icon: 'text-purple-600' },
      onDetail: () => setKpiDetail({ type: 'advisors', data: kpiDetailData.advisors }),
    },
    {
      label: 'Organisationen',
      value: organizations.filter(o => o.status === 'active').length,
      sub: `${organizations.length} Total`,
      icon: Building2,
      color: { border: 'border-l-slate-500', bg: 'bg-slate-100', icon: 'text-slate-600' },
      onDetail: () => setKpiDetail({ type: 'organizations', data: kpiDetailData.organizations }),
    },
  ]

  return (
    <div className="space-y-6">
      {/* HEADER + FILTER */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold">Dashboard 4.0</h1>
          <p className="text-muted-foreground mt-1 text-sm">Operative Zone (Umsatz) + Management Zone (Steuerung)</p>
        </div>
        <div className="flex gap-2 flex-wrap">
          <Select value={filterOrg} onValueChange={v => { setFilterOrg(v); setFilterAdvisor('all') }}>
            <SelectTrigger className="w-44 bg-background text-xs">
              <SelectValue placeholder="Org" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Alle Org.</SelectItem>
              {organizations.map(o => <SelectItem key={o.id} value={o.id}>{o.name}</SelectItem>)}
            </SelectContent>
          </Select>
          <Select value={filterAdvisor} onValueChange={setFilterAdvisor}>
            <SelectTrigger className="w-40 bg-background text-xs">
              <SelectValue placeholder="Advisor" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Alle Advisors</SelectItem>
              {filteredAdvisors.map(a => <SelectItem key={a.id} value={a.email}>{a.firstname}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* 1. KPI CARDS */}
      <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-3">
        {kpis.map(k => (
          <div key={k.label} onClick={k.onDetail} className="cursor-pointer">
            <KpiCard {...k} />
          </div>
        ))}
      </div>

      {/* 2. OPERATIVE ZONE HEADER */}
      <div className="border-b-2 border-slate-300 pb-4">
        <h2 className="text-2xl font-bold text-slate-900">🔴 OPERATIVE ZONE – Dein Geld</h2>
        <p className="text-sm text-muted-foreground mt-1">Was du heute tun musst, um Umsatz zu machen</p>
      </div>

      {/* 3. VERTRAGSABLÄUFE */}
      <div className="mt-4 bg-gradient-to-br from-slate-50 to-blue-50 p-6 rounded-lg border border-slate-200">
        <h3 className="text-lg font-bold mb-4 text-slate-900 cursor-pointer hover:text-primary transition-colors inline-flex items-center gap-2" onClick={() => navigate('/vertraege')}>🔥 Vertragsabläufe →</h3>
        <RenewalPipelineKanbanV2 contracts={filteredContracts} />
      </div>

      {/* 4. OFFENE AUFGABEN + LETZTE AKTIVITÄTEN */}
      <div className="mt-6">
        <h3 className="text-lg font-bold mb-4 text-slate-900 cursor-pointer hover:text-primary transition-colors" onClick={() => navigate('/aufgaben')}>✓ Offene Aufgaben (Top 10) →</h3>
        <SupportSection 
          tasks={openTasks.slice(0, 10)}
          customers={customers}
          activities={[]}
          onTaskClick={handleTaskClick}
        />
      </div>

      <div className="mt-6">
        <h3 className="text-lg font-bold mb-4 text-slate-900">🔄 Letzte Aktivitäten</h3>
        <ActivityFeed 
          customers={customers}
          contracts={filteredContracts}
          commissions={filteredCommissions}
        />
      </div>

      {/* MANAGEMENT ZONE */}
      <div className="border-t-4 border-slate-400 pt-8 mt-12">
        <h2 className="text-2xl font-bold mb-6 text-slate-800">⚫ MANAGEMENT ZONE – Steuerung & Kontrolle</h2>

        {/* A. UMSATZ & PROVISION */}
        <div className="mb-8">
          <h3 className="text-lg font-bold mb-4 text-slate-800 cursor-pointer hover:text-primary transition-colors inline-flex items-center gap-2" onClick={() => navigate('/provisionen-courtagen')}>💰 Umsatz & Provision →</h3>
          <FinanceWidget />
        </div>

        {/* B. UMSATZPOTENZIAL / CONVERSION BOOSTER */}
        <div className="mb-8 bg-gradient-to-br from-amber-50 to-orange-50 p-6 rounded-lg border border-amber-200">
          <h3 className="text-lg font-bold mb-4 text-slate-800 cursor-pointer hover:text-primary transition-colors inline-flex items-center gap-2" onClick={() => navigate('/vertraege')}>💰 Umsatzpotenzial – Mehr Deckung / Upgrade / Beratung →</h3>
          <UpsellPipelineKanban contracts={filteredContracts} />
        </div>

        {/* C. BERATER & ORGANISATION + PERFORMANCE */}
        <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
          <div>
            <h3 className="text-lg font-bold mb-4 text-slate-800">📈 Umsatz-Trend</h3>
            <RevenueChart contracts={filteredContracts} commissionEntries={filteredCommissions} />
          </div>
          <div>
            <h3 className="text-lg font-bold mb-4 text-slate-800 cursor-pointer hover:text-primary transition-colors inline-flex items-center gap-2" onClick={() => navigate('/berater-organisation')}>👥 Berater Performance & Organisation →</h3>
            <TopAdvisors
              advisors={filteredAdvisors}
              organizations={organizations}
              commissionEntries={filteredCommissions}
              contracts={filteredContracts}
            />
          </div>
        </div>
      </div>

      {/* TASK DIALOG */}
      <Dialog open={!!selectedTask} onOpenChange={(open) => { if (!open) setSelectedTask(null) }}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{selectedTask?.id ? selectedTask?.title : 'Neue Aufgabe erstellen'}</DialogTitle>
          </DialogHeader>
          {selectedTask && (
            <div className="space-y-4">
              {!selectedTask.id && (
                <div>
                  <Label>Aufgabentitel *</Label>
                  <Input value={formData.title || ''} onChange={(e) => setFormData(p => ({ ...p, title: e.target.value }))} placeholder="Aufgabentitel" className="mt-1" />
                </div>
              )}
              <div>
                <Label>Status</Label>
                <Select value={formData.status} onValueChange={(v) => setFormData(p => ({ ...p, status: v }))}>
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
                <Input type="date" value={formData.due_date || ''} onChange={(e) => setFormData(p => ({ ...p, due_date: e.target.value }))} className="mt-1" />
              </div>
              <div>
                <Label>Notizen</Label>
                <Textarea value={formData.notes} onChange={(e) => setFormData(p => ({ ...p, notes: e.target.value }))} placeholder="Prozessnotizen..." className="mt-1" rows={3} />
              </div>
            </div>
          )}
          <DialogFooter className="flex justify-between">
            {selectedTask?.id && (
              <Button variant="destructive" onClick={() => { if (confirm('Aufgabe wirklich löschen?')) deleteMutation.mutate(selectedTask.id) }} disabled={deleteMutation.isPending}>
                Löschen
              </Button>
            )}
            <div className="flex gap-2 ml-auto">
              <Button variant="outline" onClick={() => setSelectedTask(null)}>Schliessen</Button>
              <Button onClick={handleSave} disabled={updateMutation.isPending || createMutation.isPending}>
                {updateMutation.isPending || createMutation.isPending ? 'Speichern...' : 'Speichern'}
              </Button>
            </div>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* KPI DETAIL DIALOG */}
      <Dialog open={!!kpiDetail} onOpenChange={(open) => { if (!open) setKpiDetail(null) }}>
        <DialogContent className="max-w-2xl max-h-96 overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{kpiDetail?.data?.items?.length || 0} {kpiDetail?.data?.label}(n)</DialogTitle>
          </DialogHeader>
          {kpiDetail?.data?.items?.length === 0 ? (
            <p className="text-muted-foreground">Keine Einträge vorhanden</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <tbody className="divide-y">
                  {kpiDetail?.data?.items?.map((item, idx) => (
                    <tr key={idx} className="hover:bg-muted/50">
                      {kpiDetail?.data?.columns?.map((col, cIdx) => (
                        <td key={cIdx} className="px-4 py-2 text-muted-foreground">
                          {col === 'end_date' ? formatDate(item[col]) : String(item[col] || '–').substring(0, 40)}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setKpiDetail(null)}>Schliessen</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}