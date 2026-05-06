import React, { useState, useMemo } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { base44 } from '@/api/base44Client'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Plus, TrendingUp, Users, CheckCircle2 } from 'lucide-react'
import LeadForm from '@/components/leads/LeadForm'
import LeadImportExport from '@/components/leads/LeadImportExport'

const STATUS_LABELS = {
  'new': 'Neu',
  'contacted': 'Kontaktiert',
  'qualified': 'Qualifiziert',
  'converted': 'Konvertiert',
  'lost': 'Verloren',
}

const STATUS_COLORS = {
  'new': 'bg-gray-100 text-gray-700 border-gray-300',
  'contacted': 'bg-blue-100 text-blue-700 border-blue-300',
  'qualified': 'bg-purple-100 text-purple-700 border-purple-300',
  'converted': 'bg-green-100 text-green-700 border-green-300',
  'lost': 'bg-red-100 text-red-700 border-red-300',
}

const SOURCE_LABELS = {
  'website': 'Website',
  'referral': 'Empfehlung',
  'campaign': 'Kampagne',
  'manual': 'Manuell',
  'import': 'Import',
}

export default function Leads() {
  const [filterStatus, setFilterStatus] = useState('all')
  const [filterAdvisor, setFilterAdvisor] = useState('all')
  const [showForm, setShowForm] = useState(false)
  const [editingLead, setEditingLead] = useState(null)
  const queryClient = useQueryClient()



  const { data: leads = [] } = useQuery({
    queryKey: ['leads'],
    queryFn: () => base44.entities.Lead.list('-created_date'),
  })

  const { data: advisors = [] } = useQuery({
    queryKey: ['advisors'],
    queryFn: () => base44.entities.Advisor.list(),
  })

  const createMutation = useMutation({
    mutationFn: (data) => base44.entities.Lead.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['leads'] })
      setShowForm(false)
      setEditingLead(null)
    },
  })

  const updateMutation = useMutation({
    mutationFn: ({ id, data }) => base44.entities.Lead.update(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['leads'] })
      setShowForm(false)
      setEditingLead(null)
    },
  })

  const handleFormSubmit = (formData) => {
    const payload = { ...formData, advisor_id: formData.advisor_id === 'none' ? '' : formData.advisor_id }
    if (editingLead) {
      updateMutation.mutate({ id: editingLead.id, data: payload })
    } else {
      createMutation.mutate(payload)
    }
  }

  // ─── Filtering ───
  const filteredLeads = useMemo(() => {
    return leads.filter(l => {
      if (filterStatus !== 'all' && l.status !== filterStatus) return false
      if (filterAdvisor !== 'all' && l.advisor_id !== filterAdvisor) return false
      return true
    })
  }, [leads, filterStatus, filterAdvisor])

  // ─── Funnel Metrics ───
  const funnel = useMemo(() => {
    return {
      new: leads.filter(l => l.status === 'new').length,
      contacted: leads.filter(l => l.status === 'contacted').length,
      qualified: leads.filter(l => l.status === 'qualified').length,
      converted: leads.filter(l => l.status === 'converted').length,
      lost: leads.filter(l => l.status === 'lost').length,
    }
  }, [leads])

  const conversionRate = leads.length > 0
    ? ((funnel.converted / leads.length) * 100).toFixed(1)
    : 0

  return (
    <div className="min-h-screen bg-background p-8">
      <div className="max-w-[1400px] mx-auto space-y-8">

        {/* HEADER */}
        <div className="flex justify-between items-start">
          <div>
            <h1 className="text-3xl font-bold">🚀 Lead Management</h1>
            <p className="text-muted-foreground mt-1">Verwalte deinen Sales-Funnel von Lead bis Kunde</p>
          </div>
          <div className="flex gap-2 flex-wrap">
            <LeadImportExport leads={leads} onImport={async (records) => {
              for (const r of records) {
                await createMutation.mutateAsync(r).catch(() => {})
              }
              queryClient.invalidateQueries({ queryKey: ['leads'] })
            }} />
            <Button onClick={() => { setEditingLead(null); setShowForm(true); }} className="gap-2">
              <Plus className="w-4 h-4" /> Neuer Lead
            </Button>
          </div>
        </div>

        {/* ═══════════════════════════════════════════════════════════════ */}
        {/* 1. FUNNEL OVERVIEW */}
        {/* ═══════════════════════════════════════════════════════════════ */}
        <div>
          <h2 className="text-xl font-bold mb-4">📊 Sales Funnel</h2>
          <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
            {[
              { key: 'new', label: 'Neu', value: funnel.new, color: 'bg-gray-100 border-gray-300' },
              { key: 'contacted', label: 'Kontaktiert', value: funnel.contacted, color: 'bg-blue-100 border-blue-300' },
              { key: 'qualified', label: 'Qualifiziert', value: funnel.qualified, color: 'bg-purple-100 border-purple-300' },
              { key: 'converted', label: 'Konvertiert', value: funnel.converted, color: 'bg-green-100 border-green-300' },
              { key: 'lost', label: 'Verloren', value: funnel.lost, color: 'bg-red-100 border-red-300' },
            ].map(stage => (
              <Card key={stage.key} className={`border-2 ${stage.color} cursor-pointer hover:shadow-lg transition-shadow`}
                onClick={() => { setFilterStatus(filterStatus === stage.key ? 'all' : stage.key) }}>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm">{stage.label}</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-3xl font-bold">{stage.value}</p>
                  {stage.key === 'converted' && (
                    <p className="text-xs text-muted-foreground mt-1">({conversionRate}% Rate)</p>
                  )}
                </CardContent>
              </Card>
            ))}
          </div>
        </div>

        {/* ═══════════════════════════════════════════════════════════════ */}
        {/* 2. KPI CARDS */}
        {/* ═══════════════════════════════════════════════════════════════ */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                <Users className="w-4 h-4" /> Total Leads
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-3xl font-bold">{leads.length}</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                <TrendingUp className="w-4 h-4" /> Conversion Rate
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-3xl font-bold text-green-600">{conversionRate}%</p>
              <p className="text-xs text-muted-foreground mt-1">{funnel.converted} von {leads.length}</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4" /> Aktive Leads
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-3xl font-bold text-blue-600">{leads.filter(l => ['new', 'contacted', 'qualified'].includes(l.status)).length}</p>
              <p className="text-xs text-muted-foreground mt-1">in Bearbeitung</p>
            </CardContent>
          </Card>
        </div>

        {/* ═══════════════════════════════════════════════════════════════ */}
        {/* 3. FILTER & LIST */}
        {/* ═══════════════════════════════════════════════════════════════ */}
        <div>
          <h2 className="text-xl font-bold mb-4">📋 Lead-Liste</h2>

          <div className="flex gap-4 mb-4 flex-wrap">
            <div className="flex-1 min-w-[200px]">
              <label className="text-xs font-semibold text-muted-foreground mb-1 block">Status</label>
              <Select value={filterStatus} onValueChange={setFilterStatus}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Alle Status</SelectItem>
                  {Object.entries(STATUS_LABELS).map(([k, v]) => (
                    <SelectItem key={k} value={k}>{v}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex-1 min-w-[200px]">
              <label className="text-xs font-semibold text-muted-foreground mb-1 block">Berater</label>
              <Select value={filterAdvisor} onValueChange={setFilterAdvisor}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Alle Berater</SelectItem>
                  {advisors.map(a => (
                    <SelectItem key={a.id} value={a.id}>
                      {a.firstname} {a.lastname}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <Card>
            <CardContent className="p-0">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="border-b bg-muted/50">
                    <tr>
                      <th className="text-left p-3 font-semibold">Name</th>
                      <th className="text-left p-3 font-semibold">E-Mail</th>
                      <th className="text-left p-3 font-semibold">Quelle</th>
                      <th className="text-left p-3 font-semibold">Berater</th>
                      <th className="text-center p-3 font-semibold">Status</th>
                      <th className="text-center p-3 font-semibold">Aktion</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredLeads.map(lead => (
                      <tr key={lead.id} className="border-b hover:bg-muted/30">
                        <td className="p-3 font-medium">{lead.first_name ? `${lead.first_name} ${lead.last_name}` : lead.name}</td>
                        <td className="p-3 text-muted-foreground">{lead.email}</td>
                        <td className="p-3 text-xs">
                          <span className="px-2 py-1 rounded-full bg-muted">
                            {SOURCE_LABELS[lead.source] || lead.source}
                          </span>
                        </td>
                        <td className="p-3 text-muted-foreground">{lead.advisor_name || '—'}</td>
                        <td className="p-3 text-center">
                          <span className={`px-2 py-1 rounded-full text-xs font-semibold border ${STATUS_COLORS[lead.status]}`}>
                            {STATUS_LABELS[lead.status]}
                          </span>
                        </td>
                        <td className="p-3 text-center">
                          <Button
                           size="sm"
                           variant="outline"
                           onClick={() => { setEditingLead(lead); setShowForm(true) }}
                          >
                           Bearbeiten
                          </Button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        </div>

      </div>

      <LeadForm
        open={showForm}
        onClose={() => { setShowForm(false); setEditingLead(null) }}
        onSubmit={handleFormSubmit}
        lead={editingLead}
        advisors={advisors}
        isPending={createMutation.isPending || updateMutation.isPending}
      />
    </div>
  )
}