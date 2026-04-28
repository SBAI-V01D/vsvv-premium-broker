import React from 'react'
import { useQuery } from '@tanstack/react-query'
import { base44 } from '@/api/base44Client'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Users, FileText, ClipboardList, CheckCircle2 } from 'lucide-react'

export default function Dashboard() {
  const { data: customers = [] } = useQuery({
    queryKey: ['customers'],
    queryFn: () => base44.entities.Customer.list(),
  })

  const { data: contracts = [] } = useQuery({
    queryKey: ['contracts'],
    queryFn: () => base44.entities.Contract.list(),
  })

  const { data: applications = [] } = useQuery({
    queryKey: ['applications'],
    queryFn: () => base44.entities.Application.list(),
  })

  const { data: tasks = [] } = useQuery({
    queryKey: ['tasks'],
    queryFn: () => base44.entities.Task.list(),
  })

  const activeContracts = contracts.filter(c => c.status === 'active')
  const openApplications = applications.filter(a => a.status !== 'approved' && a.status !== 'rejected')
  const openTasks = tasks.filter(t => t.status !== 'completed')

  const stats = [
    { label: 'Kunden', value: customers.length, icon: Users, color: 'bg-blue-50 text-blue-600' },
    { label: 'Aktive Verträge', value: activeContracts.length, icon: FileText, color: 'bg-green-50 text-green-600' },
    { label: 'Offene Anträge', value: openApplications.length, icon: ClipboardList, color: 'bg-amber-50 text-amber-600' },
    { label: 'Offene Aufgaben', value: openTasks.length, icon: CheckCircle2, color: 'bg-purple-50 text-purple-600' },
  ]

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Dashboard</h1>
        <p className="text-muted-foreground mt-1">Willkommen in deinem CRM</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {stats.map(({ label, value, icon: Icon, color }) => (
          <Card key={label}>
            <CardContent className="p-6 flex items-center gap-4">
              <div className={`w-12 h-12 rounded-lg flex items-center justify-center ${color}`}>
                <Icon className="w-6 h-6" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">{label}</p>
                <p className="text-2xl font-bold">{value}</p>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle>Kürzlich hinzugefügte Kunden</CardTitle>
          </CardHeader>
          <CardContent>
            {customers.length === 0 ? (
              <p className="text-sm text-muted-foreground">Keine Kunden vorhanden</p>
            ) : (
              <div className="space-y-3">
                {customers.slice(0, 5).map(c => (
                  <div key={c.id} className="flex items-center justify-between p-2 bg-slate-50 rounded">
                    <div>
                      <p className="text-sm font-medium">{c.first_name} {c.last_name}</p>
                      <p className="text-xs text-muted-foreground">{c.email}</p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Ausstehende Aufgaben</CardTitle>
          </CardHeader>
          <CardContent>
            {openTasks.length === 0 ? (
              <p className="text-sm text-muted-foreground">Keine ausstehenden Aufgaben</p>
            ) : (
              <div className="space-y-3">
                {openTasks.slice(0, 5).map(t => (
                  <div key={t.id} className="flex items-center justify-between p-2 bg-slate-50 rounded">
                    <div className="flex-1">
                      <p className="text-sm font-medium">{t.title}</p>
                      {t.due_date && <p className="text-xs text-muted-foreground">Fällig: {t.due_date}</p>}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}