import React, { useMemo } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Flame, Phone, FileText, Zap } from 'lucide-react'

export default function DailyActionsPanel({ metrics }) {
  // ─── AGGREGIERE TÄGLICHE AKTIONEN ───
  const todayActions = useMemo(() => {
    const actions = []

    // 1. HOT LEADS (höchste Priorität)
    const hotLeads = metrics.leads
      .filter(l => l.status === 'qualified' || l.status === 'contacted')
      .slice(0, 3)
    if (hotLeads.length > 0) {
      actions.push({
        type: 'hot-lead',
        icon: Flame,
        label: `🔥 ${hotLeads.length} Hot Leads`,
        items: hotLeads.map(l => ({
          id: l.id,
          title: l.name,
          sub: l.company || l.email,
          priority: 'high',
        })),
      })
    }

    // 2. OVERDUE FOLLOW-UPS
    const overdueFollowUps = metrics.tasks
      .filter(t => t.status === 'open' && t.task_type === 'follow_up')
      .slice(0, 3)
    if (overdueFollowUps.length > 0) {
      actions.push({
        type: 'follow-up',
        icon: Phone,
        label: `📞 ${overdueFollowUps.length} Überfällige Follow-ups`,
        items: overdueFollowUps.map(t => ({
          id: t.id,
          title: t.title,
          sub: t.customer_name || 'Kunde',
          priority: 'medium',
        })),
      })
    }

    // 3. OPEN APPLICATIONS
    const openApps = metrics.applications.new + metrics.applications.inProgress
    if (openApps > 0) {
      actions.push({
        type: 'application',
        icon: FileText,
        label: `📄 ${openApps} Offene Anträge`,
        items: [
          { id: 'apps', title: `${metrics.applications.new} neu`, sub: `${metrics.applications.inProgress} in Bearbeitung` }
        ],
        priority: 'high',
      })
    }

    // 4. AI NEXT ACTIONS (placeholder)
    actions.push({
      type: 'ai-action',
      icon: Zap,
      label: '🧠 AI Empfehlung',
      items: [
        { id: 'ai', title: 'Pricing-Optimierungen prüfen', sub: 'Potential: CHF 50K+' }
      ],
      priority: 'info',
    })

    return actions
  }, [metrics])

  const priorityColors = {
    high: 'border-l-red-500 bg-red-50',
    medium: 'border-l-yellow-500 bg-yellow-50',
    info: 'border-l-blue-500 bg-blue-50',
  }

  return (
    <Card className="border-2 border-red-500">
      <CardHeader className="bg-red-50 border-b">
        <CardTitle className="flex items-center gap-2 text-red-700">
          <Flame className="w-5 h-5" /> 🔥 HEUTE ZU TUN (Oberste Priorität)
        </CardTitle>
      </CardHeader>
      <CardContent className="pt-6 space-y-4">
        {todayActions.length === 0 ? (
          <p className="text-sm text-green-600 font-medium">✓ Alles erledigt!</p>
        ) : (
          todayActions.map(action => {
            const Icon = action.icon
            const bgColor = priorityColors[action.priority || 'info']
            return (
              <div key={action.type} className={`rounded-lg border-l-4 p-4 ${bgColor}`}>
                <div className="flex items-center gap-2 mb-2">
                  <Icon className="w-4 h-4" />
                  <p className="font-bold text-sm">{action.label}</p>
                </div>
                <div className="space-y-1 ml-6">
                  {action.items.map(item => (
                    <div key={item.id} className="text-sm">
                      <p className="font-medium text-foreground">{item.title}</p>
                      {item.sub && <p className="text-xs text-muted-foreground">{item.sub}</p>}
                    </div>
                  ))}
                </div>
              </div>
            )
          })
        )}
      </CardContent>
    </Card>
  )
}