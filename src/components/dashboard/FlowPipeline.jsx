import React, { useMemo } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Users, FileText, CheckCircle2, Clock, TrendingUp } from 'lucide-react'

export default function FlowPipeline({ leads = [], applications = [], contracts = [], pricing = [] }) {
  const stats = useMemo(() => {
    const today = new Date()
    return {
      leads: {
        new: leads.filter(l => l.status === 'new').length,
        contacted: leads.filter(l => l.status === 'contacted').length,
        qualified: leads.filter(l => l.status === 'qualified').length,
      },
      applications: {
        open: applications.filter(a => a.status === 'submitted' || a.status === 'under_review').length,
        approved: applications.filter(a => a.status === 'approved').length,
      },
      contracts: {
        active: contracts.filter(c => c.status === 'active').length,
        renewed: contracts.filter(c => c.status === 'renewed').length,
      },
      renewals: {
        critical: contracts.filter(c => {
          if (!c.end_date) return false
          const days = Math.floor((new Date(c.end_date) - today) / (1000 * 60 * 60 * 24))
          return days > 0 && days < 60 && c.status === 'active'
        }).length,
      },
      pricing: {
        high: pricing.filter(p => p.pricing_status === 'high').length,
      },
    }
  }, [leads, applications, contracts, pricing])

  const stages = [
    { icon: Users, title: 'Leads', color: 'bg-blue-50 border-l-blue-500', items: [
      { label: 'Neu', value: stats.leads.new },
      { label: 'Kontakt', value: stats.leads.contacted },
      { label: 'Qualif.', value: stats.leads.qualified },
    ]},
    { icon: FileText, title: 'Anträge', color: 'bg-cyan-50 border-l-cyan-500', items: [
      { label: 'Offen', value: stats.applications.open, badge: 'bg-orange-100 text-orange-700' },
      { label: 'Genehmigt', value: stats.applications.approved, badge: 'bg-green-100 text-green-700' },
    ]},
    { icon: CheckCircle2, title: 'Verträge', color: 'bg-green-50 border-l-green-500', items: [
      { label: 'Aktiv', value: stats.contracts.active },
      { label: 'Verlängert', value: stats.contracts.renewed },
    ]},
    { icon: Clock, title: 'Renewals', color: 'bg-red-50 border-l-red-500', items: [
      { label: 'Kritisch', value: stats.renewals.critical, badge: 'bg-red-100 text-red-700' },
    ]},
    { icon: TrendingUp, title: 'Preise', color: 'bg-amber-50 border-l-amber-500', items: [
      { label: 'Zu Hoch', value: stats.pricing.high, badge: 'bg-amber-100 text-amber-700' },
    ]},
  ]

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-4">
      {stages.map(stage => {
        const Icon = stage.icon
        return (
          <Card key={stage.title} className={`border-l-4 ${stage.color}`}>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm flex items-center gap-2">
                <Icon className="w-4 h-4" /> {stage.title}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {stage.items.map(item => (
                <div key={item.label} className="flex justify-between items-center">
                  <span className="text-xs text-muted-foreground">{item.label}</span>
                  <Badge className={item.badge || 'bg-slate-100 text-slate-700'}>
                    {item.value}
                  </Badge>
                </div>
              ))}
            </CardContent>
          </Card>
        )
      })}
    </div>
  )
}