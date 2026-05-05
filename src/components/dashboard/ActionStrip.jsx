import React, { useMemo } from 'react'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Flame, Clock, Phone, FileText } from 'lucide-react'

export default function ActionStrip({ leads = [], contracts = [], tasks = [], applications = [] }) {
  const stripItems = useMemo(() => {
    const items = []
    const today = new Date()

    leads
      .sort((a, b) => (b.lead_score || 0) - (a.lead_score || 0))
      .slice(0, 5)
      .forEach(l => {
        items.push({
          type: 'lead',
          icon: '🔥',
          title: l.name,
          sub: `Score: ${l.lead_score || 0}`,
          priority: 1,
          color: 'border-l-red-500 bg-red-50/50',
          badge: 'bg-red-100 text-red-700',
        })
      })

    contracts
      .filter(c => c.status === 'active' && c.end_date)
      .map(c => ({
        ...c,
        daysLeft: Math.floor((new Date(c.end_date) - today) / (1000 * 60 * 60 * 24))
      }))
      .filter(c => c.daysLeft > 0 && c.daysLeft < 60)
      .sort((a, b) => a.daysLeft - b.daysLeft)
      .slice(0, 3)
      .forEach(c => {
        const isCritical = c.daysLeft < 30
        items.push({
          type: 'renewal',
          icon: '⏰',
          title: c.policy_number,
          sub: `${c.daysLeft} Tage`,
          priority: 1.5,
          color: isCritical ? 'border-l-red-500 bg-red-50/50' : 'border-l-orange-500 bg-orange-50/50',
          badge: isCritical ? 'bg-red-100 text-red-700' : 'bg-orange-100 text-orange-700',
        })
      })

    tasks
      .filter(t => t.status === 'open' && t.task_type === 'follow_up' && new Date(t.due_date || new Date()) < today)
      .slice(0, 3)
      .forEach(t => {
        items.push({
          type: 'followup',
          icon: '📞',
          title: t.title,
          sub: t.customer_name || 'Kunde',
          priority: 2,
          color: 'border-l-yellow-500 bg-yellow-50/50',
          badge: 'bg-yellow-100 text-yellow-700',
        })
      })

    applications
      .filter(a => a.status === 'submitted' || a.status === 'under_review')
      .slice(0, 3)
      .forEach(a => {
        items.push({
          type: 'application',
          icon: '📄',
          title: a.customer_name,
          sub: a.product || 'Antrag',
          priority: 2.5,
          color: 'border-l-blue-500 bg-blue-50/50',
          badge: 'bg-blue-100 text-blue-700',
        })
      })

    return items.sort((a, b) => a.priority - b.priority).slice(0, 12)
  }, [leads, contracts, tasks, applications])

  return (
    <div className="sticky top-0 z-40 bg-background/95 backdrop-blur-sm border-b border-slate-200 py-4 mb-6">
      <div className="space-y-3">
        <div className="flex items-center gap-3">
          <Flame className="w-5 h-5 text-red-600" />
          <h2 className="font-bold text-base text-slate-900">🔥 Heute Fokus</h2>
          <span className="text-xs px-2 py-1 rounded-full bg-slate-100 text-slate-600 font-medium">Max 12</span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-6 gap-3 overflow-auto pb-1">
          {stripItems.map((item, idx) => (
            <Card key={idx} className={`border-l-4 ${item.color} flex-shrink-0 min-w-fit hover:shadow-md transition-shadow`}>
              <CardContent className="p-3">
                <div className="flex items-start gap-2">
                  <span className="text-lg flex-shrink-0">{item.icon}</span>
                  <div className="min-w-0 flex-1">
                    <p className="text-xs font-bold text-slate-900 truncate">{item.title}</p>
                    <div className="flex items-center gap-1 mt-1">
                      <p className="text-xs text-slate-600 truncate flex-1">{item.sub}</p>
                      <Badge className={`${item.badge} text-xs flex-shrink-0`} variant="secondary">{item.type === 'renewal' ? '⏰' : '✓'}</Badge>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    </div>
  )
}