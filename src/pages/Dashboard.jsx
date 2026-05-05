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
import PricingOptimizationPanel from '@/components/dashboard/PricingOptimizationPanel'

export default function Dashboard() {
  const navigate = useNavigate()
  const [selectedTask, setSelectedTask] = useState(null)
  const [formData, setFormData] = useState({ status: '', notes: '', due_date: '' })
  const [filterOrg, setFilterOrg] = useState('all')
  const [filterAdvisor, setFilterAdvisor] = useState('all')
  const queryClient = useQueryClient()

  // Data fetching – all parallel
  const { data: customers = [] } = useQuery({ queryKey: ['customers'], queryFn: () => base44.entities.Customer.list() })
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

  const kpis = [
    {
      label: 'Kunden Total',
      value: customers.length,
      icon: Users,
      color: { border: 'border-l-blue-500', bg: 'bg-blue-50', icon: 'text-blue-600' },
      path: '/kunden',
    },
    {
      label: 'Aktive Policen',
      value: activeContracts.length,
      sub: `von ${filteredContracts.length} gesamt`,
      icon: FileText,
      color: { border: 'border-l-green-500', bg: 'bg-green-50', icon: 'text-green-600' },
      path: '/vertraege',
    },
    {
      label: 'Monatsprämien',
      value: `CHF ${totalMonthlyPremium.toLocaleString('de-CH', { maximumFractionDigits: 0 })}`,
      sub: 'Aktive Verträge',
      icon: TrendingUp,
      color: { border: 'border-l-primary', bg: 'bg-primary/10', icon: 'text-primary' },
      path: '/vertraege',
    },
    {
      label: 'Provisionen MTD',
      value: `CHF ${mtdCommissions.toLocaleString('de-CH', { maximumFractionDigits: 0 })}`,
      sub: new Date().toLocaleString('de-CH', { month: 'long', year: 'numeric' }),
      icon: Wallet,
      color: { border: 'border-l-amber-500', bg: 'bg-amber-50', icon: 'text-amber-600' },
      path: '/provisionen-courtagen',
    },
    {
      label: 'Berater',
      value: filteredAdvisors.length,
      sub: filterOrg !== 'all' ? organizations.find(o => o.id === filterOrg)?.name : 'Alle Organisationen',
      icon: UserCheck,
      color: { border: 'border-l-purple-500', bg: 'bg-purple-50', icon: 'text-purple-600' },
      path: '/berater-organisation',
    },
    {
      label: 'Organisationen',
      value: organizations.filter(o => o.status === 'active').length,
      sub: `${organizations.length} Total`,
      icon: Building2,
      color: { border: 'border-l-slate-500', bg: 'bg-slate-100', icon: 'text-slate-600' },
      path: '/berater-organisation',
    },
  ]

  return (
    <div className="space-y-6">
      {/* HEADER */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold">Dashboard</h1>
          <p className="text-muted-foreground mt-1 text-sm">CEO / Broker Control Panel · {new Date().toLocaleDateString('de-CH', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}</p>
        </div>
        {/* Global Filter */}
        <div className="flex gap-2 flex-wrap">
          <Select value={filterOrg} onValueChange={v => { setFilterOrg(v); setFilterAdvisor('all') }}>
            <SelectTrigger className="w-48 bg-background">
              <SelectValue placeholder="Alle Organisationen" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Alle Organisationen</SelectItem>
              {organizations.map(o => <SelectItem key={o.id} value={o.id}>{o.name}</SelectItem>)}
            </SelectContent>
          </Select>
          <Select value={filterAdvisor} onValueChange={setFilterAdvisor}>
            <SelectTrigger className="w-44 bg-background">
              <SelectValue placeholder="Alle Berater" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Alle Berater</SelectItem>
              {filteredAdvisors.map(a => <SelectItem key={a.id} value={a.email}>{a.firstname} {a.lastname}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* SCHNELLAKTIONEN */}
      <QuickActions />

      {/* KPI CARDS */}
      <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4">
        {kpis.map(k => <KpiCard key={k.label} {...k} />)}
      </div>

      {/* 3. VERTRAGSABLÄUFE (TOP PRIORITÄT) */}
      <div>
        <h2 className="text-lg font-bold mb-4">⏰ Vertragsabläufe (Bestand = Geld)</h2>
        <RenewalsSection />
      </div>

      {/* 4. GEBURTSTAGE */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base font-semibold">🎂 Geburtstage (30 Tage) – Verkaufschance</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {upcomingBirthdays.length === 0 ? (
            <p className="px-6 pb-6 text-sm text-muted-foreground">Keine Geburtstage in den nächsten 30 Tagen</p>
          ) : (
            <div className="divide-y">
              {upcomingBirthdays.map(b => (
                <div key={b.customer.id} className="px-6 py-3 flex items-center justify-between gap-2">
                  <div>
                    <p className="text-sm font-medium">{b.customer.first_name} {b.customer.last_name}</p>
                    <p className="text-xs text-muted-foreground">
                      {b.daysUntil === 0 ? '🎉 Heute!' : b.daysUntil === 1 ? 'Morgen' : `in ${b.daysUntil} Tagen`}
                    </p>
                  </div>
                  <span className="text-xl">🎂</span>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* 5. OFFENE AUFGABEN */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between pb-3">
          <CardTitle className="text-base font-semibold">📋 Offene Aufgaben</CardTitle>
          <Button size="sm" onClick={handleNewTask}>+ Neu</Button>
        </CardHeader>
        <CardContent className="p-0">
          {openTasks.length === 0 ? (
            <p className="px-6 pb-6 text-sm text-muted-foreground">Keine offenen Aufgaben</p>
          ) : (
            <div className="divide-y max-h-72 overflow-y-auto">
              {openTasks.slice(0, 10).map(t => (
                <button
                  key={t.id}
                  onClick={() => handleTaskClick(t)}
                  className="w-full flex items-center justify-between px-6 py-3 hover:bg-muted/50 transition-colors text-left gap-2"
                >
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">{t.title}</p>
                    {t.due_date && <p className="text-xs text-muted-foreground">Fällig: {formatDate(t.due_date)}</p>}
                  </div>
                  <span className={`text-xs px-2 py-0.5 rounded-full font-medium flex-shrink-0 ${t.status === 'in_progress' ? 'bg-blue-100 text-blue-700' : 'bg-amber-100 text-amber-700'}`}>
                    {t.status === 'in_progress' ? 'Aktiv' : 'Offen'}
                  </span>
                </button>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* 6. PREISOPTIMIERUNG */}
      <div>
        <h2 className="text-lg font-bold mb-4">💰 Preisoptimierung (Fokus: Einsparpotenzial + Upsell)</h2>
        <PricingOptimizationPanel />
      </div>

      {/* 7. LETZTE AKTIVITÄTEN */}
      <div>
        <h2 className="text-lg font-bold mb-4">📊 Letzte Aktivitäten</h2>
        <ActivityFeed
          customers={customers}
          contracts={filteredContracts}
          commissionEntries={filteredCommissions}
        />
      </div>

      {/* 8. FINANZ-OVERVIEW (GANZ UNTEN – ERGEBNIS) */}
      <div>
        <h2 className="text-lg font-bold mb-4">💰 Finanz-Overview (Ergebnis der Aktionen)</h2>
        <FinanceWidget />
      </div>

      {/* CHART + TOP ADVISORS (ZUSATZ) */}
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
        <div>
          <RevenueChart contracts={filteredContracts} commissionEntries={filteredCommissions} />
        </div>
        <div>
          <TopAdvisors
            advisors={filteredAdvisors}
            organizations={organizations}
            commissionEntries={filteredCommissions}
            contracts={filteredContracts}
          />
        </div>
      </div>

      {/* CONTROLLING SECTION (BONUS) */}
      <div>
        <h2 className="text-lg font-bold mb-4">🔍 Controlling</h2>
        <ControllingSection
          commissionEntries={filteredCommissions}
          organizations={organizations}
          advisors={filteredAdvisors}
          contracts={filteredContracts}
          applications={applications}
          documents={documents}
        />
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
    </div>
  )
}