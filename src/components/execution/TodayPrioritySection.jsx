import React, { useMemo } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Flame, AlertTriangle } from 'lucide-react'

export default function TodayPrioritySection({ leads, tasks, applications, contracts }) {
  const priorityItems = useMemo(() => {
    const items = []
    const today = new Date()

    // 1. High-Priority Leads (score > 70)
    leads
      .filter(l => (l.lead_score || 0) > 70)
      .sort((a, b) => (b.lead_score || 0) - (a.lead_score || 0))
      .slice(0, 5)
      .forEach(l => {
        items.push({
          type: 'lead',
          priority: 1,
          icon: '🔥',
          title: `Hot Lead: ${l.name}`,
          sub: `Score: ${l.lead_score || 0}`,
          action: 'Call now',
          color: 'border-l-red-500 bg-red-50',
        })
      })

    // 2. Overdue Follow-ups
    tasks
      .filter(t => t.task_type === 'follow_up' && t.status === 'open' && new Date(t.due_date) < today)
      .slice(0, 3)
      .forEach(t => {
        items.push({
          type: 'task',
          priority: 1.5,
          icon: '⚠️',
          title: `Follow-up: ${t.title}`,
          sub: t.customer_name || 'Kunde',
          action: 'Do now',
          color: 'border-l-yellow-500 bg-yellow-50',
        })
      })

    // 3. Renewals < 60 days
    contracts
      .filter(c => c.status === 'active' && c.end_date)
      .map(c => {
        const daysLeft = Math.floor((new Date(c.end_date) - today) / (1000 * 60 * 60 * 24))
        return { ...c, daysLeft }
      })
      .filter(c => c.daysLeft > 0 && c.daysLeft < 60 && c.renewal_status !== 'completed')
      .sort((a, b) => a.daysLeft - b.daysLeft)
      .slice(0, 3)
      .forEach(c => {
        items.push({
          type: 'renewal',
          priority: 2,
          icon: '⏰',
          title: `Renewal: ${c.customer_name || c.policy_number}`,
          sub: `${c.customer_name ? `Police ${c.policy_number} · ` : ''}${c.daysLeft} Tage verbleibend`,
          action: 'Prepare offer',
          color: 'border-l-orange-500 bg-orange-50',
        })
      })

    // 4. Open Applications
    applications
      .filter(a => a.status === 'submitted' || a.status === 'under_review')
      .slice(0, 2)
      .forEach(a => {
        items.push({
          type: 'application',
          priority: 2.5,
          icon: '📄',
          title: `Application: ${a.customer_name}`,
          sub: a.product || 'Product',
          action: 'Follow up',
          color: 'border-l-blue-500 bg-blue-50',
        })
      })

    return items.sort((a, b) => a.priority - b.priority).slice(0, 15)
  }, [leads, tasks, applications, contracts])

  return (
    <Card className="border-2 border-red-500">
      <CardHeader className="bg-red-50 border-b">
        <CardTitle className="flex items-center gap-2 text-red-700">
          <Flame className="w-5 h-5" /> 🔥 HEUTE PRIORITÄT
        </CardTitle>
      </CardHeader>
      <CardContent className="pt-6 space-y-2">
        {priorityItems.length === 0 ? (
          <p className="text-sm text-green-600">✓ Keine Prioritäten heute</p>
        ) : (
          priorityItems.map((item, idx) => (
            <div key={idx} className={`rounded-lg border-l-4 p-3 ${item.color} flex justify-between items-start`}>
              <div className="flex-1">
                <p className="font-bold text-sm">{item.icon} {item.title}</p>
                <p className="text-xs text-muted-foreground">{item.sub}</p>
              </div>
              <Badge className="ml-2 flex-shrink-0">{item.action}</Badge>
            </div>
          ))
        )}
      </CardContent>
    </Card>
  )
}