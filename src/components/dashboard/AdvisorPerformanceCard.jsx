import React from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'

export default function AdvisorPerformanceCard({ advisors }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">👥 Top Berater (nach Provision)</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-3">
          {advisors.slice(0, 5).map((advisor, idx) => (
            <div key={advisor.advisor_id} className="flex items-start justify-between gap-3 pb-3 border-b last:border-0">
              <div className="flex-1">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-bold text-muted-foreground">#{idx + 1}</span>
                  <p className="font-medium text-sm">{advisor.advisor_name}</p>
                </div>
                <div className="flex gap-2 mt-1 flex-wrap">
                  <Badge variant="outline" className="text-xs">
                    {advisor.policies} Policen
                  </Badge>
                  <Badge variant="outline" className="text-xs">
                    {advisor.customers} Kunden
                  </Badge>
                </div>
              </div>
              <div className="text-right">
                <p className="font-bold text-green-600">
                  CHF {(advisor.commission / 1000).toFixed(0)}K
                </p>
                <p className="text-xs text-muted-foreground">Provision</p>
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  )
}