import React, { useMemo } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Zap } from 'lucide-react'

export default function NextActionSection({ leads, metrics }) {
  const aiActions = useMemo(() => {
    const actions = []

    // Suggestion 1: Top hot lead
    const hotLead = leads.find(l => (l.lead_score || 0) > 70)
    if (hotLead) {
      actions.push({
        id: 'hotlead',
        priority: 1,
        title: 'Call now',
        detail: `${hotLead.name} (Score: ${hotLead.lead_score})`,
        icon: '☎️',
      })
    }

    // Suggestion 2: Renewal offer
    if (metrics.renewals_due > 0) {
      actions.push({
        id: 'renewal',
        priority: 2,
        title: 'Prepare renewal offer',
        detail: `${metrics.renewals_due} policies need attention`,
        icon: '📧',
      })
    }

    // Suggestion 3: Follow-up email
    actions.push({
      id: 'followup',
      priority: 3,
      title: 'Send follow-up email',
      detail: 'Reach out to contacted leads',
      icon: '✉️',
    })

    return actions
  }, [leads, metrics])

  return (
    <Card className="bg-gradient-to-br from-blue-50 to-cyan-50">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <Zap className="w-4 h-4 text-amber-500" /> 🧠 NÄCHSTE BESTE AKTION
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-2">
        {aiActions.map(action => (
          <div key={action.id} className="p-3 rounded-lg bg-white border border-blue-200">
            <div className="flex items-start gap-3">
              <span className="text-xl">{action.icon}</span>
              <div className="flex-1">
                <p className="font-bold text-sm text-blue-900">{action.title}</p>
                <p className="text-xs text-muted-foreground">{action.detail}</p>
              </div>
              <Badge className="bg-blue-100 text-blue-700 flex-shrink-0">→</Badge>
            </div>
          </div>
        ))}
      </CardContent>
    </Card>
  )
}