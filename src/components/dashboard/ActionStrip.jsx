import React, { useMemo } from 'react'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Flame, Clock, Phone, FileText } from 'lucide-react'

export default function ActionStrip({ leads = [], contracts = [], tasks = [], applications = [] }) {
  const stripItems = useMemo(() => {
    const items = []
    const today = new Date()

    // Top 5 Leads by score
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
          color: 'border-l-red-500 bg-red-50',
        })
      })

    // 3 Renewals < 60 days
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
        items.push({
          type: 'renewal',
          icon: '⏰',
          title: c.policy_number,
          sub: `${c.daysLeft} days left`,
          priority: 1.5,
          color: c.daysLeft < 30 ? 'border-l-red-500 bg-red-50' : 'border-l-orange-500 bg-orange-50',
        })
      })

    // 3 Follow-ups overdue
    tasks
      .filter(t => t.status === 'open' && t.task_type === 'follow_up' && new Date(t.due_date || new Date()) < today)
      .slice(0, 3)
      .forEach(t => {
        items.push({
          type: 'followup',
          icon: '📞',
          title: t.title,
          sub: t.customer_name || 'Customer',
          priority: 2,
          color: 'border-l-yellow-500 bg-yellow-50',
        })
      })

    // 3 Open applications
    applications
      .filter(a => a.status === 'submitted' || a.status === 'under_review')
      .slice(0, 3)
      .forEach(a => {
        items.push({
          type: 'application',
          icon: '📄',
          title: a.customer_name,
          sub: a.product || 'Application',
          priority: 2.5,
          color: 'border-l-blue-500 bg-blue-50',
        })
      })

    return items.sort((a, b) => a.priority - b.priority).slice(0, 12)
  }, [leads, contracts, tasks, applications])

  return (
    <div className="sticky top-0 z-40 bg-background/95 backdrop-blur-sm border-b py-4 mb-6">
      <div className="space-y-2 max-w-full">
        <div className="flex items-center gap-2 mb-3">
          <Flame className="w-5 h-5 text-red-600" />
          <h2 className="font-bold text-sm">🔥 HEUTE FOKUS – Max 12 Aktionen</h2>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-6 gap-2 overflow-auto">
          {stripItems.map((item, idx) => (
            <Card key={idx} className={`border-l-4 ${item.color} flex-shrink-0 min-w-fit`}>
              <CardContent className="p-2">
                <div className="flex items-start gap-2">
                  <span className="text-lg flex-shrink-0">{item.icon}</span>
                  <div className="min-w-0">
                    <p className="text-xs font-bold truncate">{item.title}</p>
                    <p className="text-xs text-muted-foreground truncate">{item.sub}</p>
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