import React, { useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import { base44 } from '@/api/base44Client'
import TodayPrioritySection from '@/components/execution/TodayPrioritySection'
import ContactTodaySection from '@/components/execution/ContactTodaySection'
import RenewalExecutionSection from '@/components/execution/RenewalExecutionSection'
import OpenApplicationsSection from '@/components/execution/OpenApplicationsSection'
import NextActionSection from '@/components/execution/NextActionSection'
import DailyPlanSection from '@/components/execution/DailyPlanSection'

export default function ExecutionMode() {
  // Fetch data
  const { data: leads = [] } = useQuery({ queryKey: ['leads'], queryFn: () => base44.entities.Lead.list() })
  const { data: contracts = [] } = useQuery({ queryKey: ['contracts'], queryFn: () => base44.entities.Contract.list() })
  const { data: applications = [] } = useQuery({ queryKey: ['applications'], queryFn: () => base44.entities.Application.list() })
  const { data: tasks = [] } = useQuery({ queryKey: ['tasks'], queryFn: () => base44.entities.Task.list() })

  const metrics = useMemo(() => {
    const today = new Date()
    const renewalsDue = contracts.filter(c => {
      if (!c.end_date || c.status !== 'active') return false
      const daysLeft = Math.floor((new Date(c.end_date) - today) / (1000 * 60 * 60 * 24))
      return daysLeft > 0 && daysLeft < 90 && c.renewal_status !== 'completed'
    }).length

    return { renewals_due: renewalsDue }
  }, [contracts])

  return (
    <div className="space-y-6">
      {/* HEADER */}
      <div className="border-b pb-6">
        <h1 className="text-4xl font-bold text-red-600">🚀 EXECUTION MODE</h1>
        <p className="text-muted-foreground mt-2">Dein persönlicher Verkaufsleiter – dein System sagt dir WAS → WEN → WANN → WARUM</p>
        <p className="text-sm text-amber-600 mt-2 font-medium">
          ⚡ Max 10–15 Tasks pro Tag • Keine Zahlenflut • Nur Aktionen
        </p>
      </div>

      {/* 1. TODAY PRIORITY */}
      <TodayPrioritySection leads={leads} tasks={tasks} applications={applications} contracts={contracts} />

      {/* 2. CONTACT TODAY */}
      <ContactTodaySection leads={leads} />

      {/* 3. RENEWALS */}
      <RenewalExecutionSection contracts={contracts} />

      {/* 4. OPEN APPLICATIONS */}
      <OpenApplicationsSection applications={applications} />

      {/* 5. AI NEXT ACTIONS */}
      <NextActionSection leads={leads} metrics={metrics} />

      {/* 6. DAILY PLAN */}
      <DailyPlanSection leads={leads} contracts={contracts} tasks={tasks} />

      {/* FOOTER */}
      <div className="border-t pt-6 text-center">
        <p className="text-sm text-muted-foreground">
          💥 Das ist dein Fokus. Alles andere kann warten.
        </p>
      </div>
    </div>
  )
}