import React, { useMemo } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { CheckSquare, Cake, Activity } from 'lucide-react'

export default function SupportSection({ tasks = [], customers = [], activities = [] }) {
  const openTasks = useMemo(() => tasks.filter(t => t.status === 'open').slice(0, 5), [tasks])

  const birthdays = useMemo(() => {
    const today = new Date()
    return customers
      .filter(c => c.birthdate)
      .map(c => {
        const bd = new Date(c.birthdate)
        const this_year = new Date(today.getFullYear(), bd.getMonth(), bd.getDate())
        const next = this_year >= today ? this_year : new Date(today.getFullYear() + 1, bd.getMonth(), bd.getDate())
        const days = Math.floor((next - today) / (1000 * 60 * 60 * 24))
        return { customer: c, days }
      })
      .filter(b => b.days <= 30)
      .sort((a, b) => a.days - b.days)
      .slice(0, 5)
  }, [customers])

  const recentActivities = useMemo(() => activities.slice(0, 5), [activities])

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
      {/* TASKS */}
      <Card className="hover:shadow-md transition-shadow">
        <CardHeader className="pb-3 border-b border-slate-100">
          <CardTitle className="text-sm flex items-center gap-2 text-slate-900">
            <CheckSquare className="w-4 h-4 text-blue-600" /> Aufgaben
          </CardTitle>
        </CardHeader>
        <CardContent className="pt-3 space-y-2">
          {openTasks.length === 0 ? (
            <p className="text-xs text-green-600 font-medium">✓ Alle erledigt</p>
          ) : (
            openTasks.map(t => (
              <div key={t.id} className="flex justify-between items-start p-2 rounded-lg bg-slate-50 hover:bg-slate-100 transition-colors">
                <span className="text-xs font-medium text-slate-700 flex-1 truncate">{t.title}</span>
                <Badge variant="secondary" className="flex-shrink-0 ml-1 text-xs bg-blue-100 text-blue-700">offen</Badge>
              </div>
            ))
          )}
        </CardContent>
      </Card>

      {/* BIRTHDAYS */}
      <Card className="hover:shadow-md transition-shadow">
        <CardHeader className="pb-3 border-b border-slate-100">
          <CardTitle className="text-sm flex items-center gap-2 text-slate-900">
            <Cake className="w-4 h-4 text-amber-600" /> Geburtstage
          </CardTitle>
        </CardHeader>
        <CardContent className="pt-3 space-y-2">
          {birthdays.length === 0 ? (
            <p className="text-xs text-slate-600">Keine bald</p>
          ) : (
            birthdays.map(b => (
              <div key={b.customer.id} className="flex justify-between items-center p-2 rounded-lg bg-amber-50">
                <span className="text-xs font-medium text-slate-700">{b.customer.first_name}</span>
                <Badge variant="secondary" className="text-xs bg-amber-100 text-amber-700">{b.days}d</Badge>
              </div>
            ))
          )}
        </CardContent>
      </Card>

      {/* ACTIVITIES */}
      <Card className="hover:shadow-md transition-shadow">
        <CardHeader className="pb-3 border-b border-slate-100">
          <CardTitle className="text-sm flex items-center gap-2 text-slate-900">
            <Activity className="w-4 h-4 text-slate-600" /> Aktivitäten
          </CardTitle>
        </CardHeader>
        <CardContent className="pt-3 space-y-2">
          {recentActivities.length === 0 ? (
            <p className="text-xs text-slate-600">Keine</p>
          ) : (
            recentActivities.map((a, i) => (
              <div key={i} className="text-xs text-slate-600 truncate p-2 rounded-lg bg-slate-50">📌 {a}</div>
            ))
          )}
        </CardContent>
      </Card>
    </div>
  )
}