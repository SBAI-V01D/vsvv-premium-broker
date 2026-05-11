import React from 'react'
import { Card, CardContent } from '@/components/ui/card'
import { Users, FileText, Building2, TrendingUp, AlertCircle, Clock } from 'lucide-react'
import { Badge } from '@/components/ui/badge'

export default function HouseholdSummaryStats({ familyMembers, contracts, opportunities, tasks }) {
  const stats = [
    {
      icon: Users,
      label: 'Personen',
      value: (familyMembers.length + 1).toString(),
      color: 'text-blue-600',
      bg: 'bg-blue-50'
    },
    {
      icon: FileText,
      label: 'Verträge',
      value: contracts.length.toString(),
      color: 'text-green-600',
      bg: 'bg-green-50'
    },
    {
      icon: Building2,
      label: 'Gesellschaften',
      value: new Set(contracts.map(c => c.insurer)).size.toString(),
      color: 'text-amber-600',
      bg: 'bg-amber-50'
    },
    {
      icon: TrendingUp,
      label: 'Chancen',
      value: opportunities.filter(o => !['gewonnen', 'verloren'].includes(o.status)).length.toString(),
      color: 'text-purple-600',
      bg: 'bg-purple-50'
    },
    {
      icon: AlertCircle,
      label: 'Aufgaben',
      value: tasks.filter(t => t.status !== 'completed').length.toString(),
      color: 'text-red-600',
      bg: 'bg-red-50'
    },
    {
      icon: Clock,
      label: 'Nächster Ablauf',
      value: (() => {
        const upcoming = contracts
          .filter(c => c.end_date)
          .sort((a, b) => new Date(a.end_date) - new Date(b.end_date))[0]
        if (!upcoming) return '–'
        const days = Math.ceil((new Date(upcoming.end_date) - new Date()) / (1000 * 60 * 60 * 24))
        return days < 0 ? 'Überfällig' : `${days}d`
      })(),
      color: 'text-slate-600',
      bg: 'bg-slate-50'
    }
  ]

  return (
    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
      {stats.map((stat, i) => {
        const Icon = stat.icon
        return (
          <Card key={i} className={`${stat.bg} border-0`}>
            <CardContent className="p-3 text-center">
              <Icon className={`w-5 h-5 ${stat.color} mx-auto mb-2`} />
              <p className="text-xs text-muted-foreground font-medium">{stat.label}</p>
              <p className={`text-lg font-bold ${stat.color}`}>{stat.value}</p>
            </CardContent>
          </Card>
        )
      })}
    </div>
  )
}