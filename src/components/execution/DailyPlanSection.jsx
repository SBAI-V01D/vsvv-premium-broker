import React, { useMemo } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Zap } from 'lucide-react'

export default function DailyPlanSection({ leads, contracts, tasks }) {
  const dailyPlan = useMemo(() => {
    const today = new Date()
    const plan = {
      calls: [],
      renewals: [],
      applications: [],
      count: 0,
    }

    // Top 5 hot leads for calls
    plan.calls = leads
      .filter(l => (l.lead_score || 0) > 60)
      .sort((a, b) => (b.lead_score || 0) - (a.lead_score || 0))
      .slice(0, 5)

    // Top 3 renewals
    plan.renewals = contracts
      .filter(c => c.status === 'active' && c.end_date)
      .map(c => {
        const daysLeft = Math.floor((new Date(c.end_date) - today) / (1000 * 60 * 60 * 24))
        return { ...c, daysLeft }
      })
      .filter(c => c.daysLeft > 0 && c.daysLeft < 90)
      .sort((a, b) => a.daysLeft - b.daysLeft)
      .slice(0, 3)

    plan.count = plan.calls.length + plan.renewals.length + 3

    return plan
  }, [leads, contracts, tasks])

  return (
    <Card className="border-2 border-primary">
      <CardHeader className="bg-primary/10 border-b">
        <CardTitle className="flex items-center gap-2 text-base">
          <Zap className="w-4 h-4" /> 📋 AUTO-TAGESPLAN
        </CardTitle>
      </CardHeader>
      <CardContent className="pt-4 space-y-4">
        {/* CALLS */}
        <div>
          <p className="font-bold text-sm mb-2">☎️ Calls ({dailyPlan.calls.length})</p>
          <div className="space-y-1 ml-2">
            {dailyPlan.calls.map(lead => (
              <p key={lead.id} className="text-xs">✓ {lead.name}</p>
            ))}
          </div>
        </div>

        {/* RENEWALS */}
        <div>
          <p className="font-bold text-sm mb-2">📧 Renewals ({dailyPlan.renewals.length})</p>
          <div className="space-y-1 ml-2">
            {dailyPlan.renewals.map(r => (
              <p key={r.id} className="text-xs">✓ {r.policy_number} ({r.daysLeft}d)</p>
            ))}
          </div>
        </div>

        {/* SUMMARY */}
        <div className="pt-3 border-t">
          <Badge className="bg-green-100 text-green-700">
            {dailyPlan.count} Tasks today - Fokus statt Chaos
          </Badge>
        </div>
      </CardContent>
    </Card>
  )
}