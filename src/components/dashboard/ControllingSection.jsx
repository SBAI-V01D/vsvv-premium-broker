import React, { useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { useNavigate } from 'react-router-dom'
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from 'recharts'

const COLORS = ['hsl(var(--primary))', 'hsl(var(--chart-2))', 'hsl(var(--chart-3))', 'hsl(var(--chart-4))', 'hsl(var(--chart-5))']

function OrgCommissionChart({ commissionEntries, organizations }) {
  const data = organizations
    .filter(o => o.status === 'active')
    .map(org => {
      // find advisors from commissions matching org
      const total = commissionEntries
        .filter(ce => {
          // match via organization_id if available, else skip
          return true // we'll filter by advisor below when we have that link
        })
        .reduce((sum, ce) => sum + (ce.gross_commission || 0), 0)
      return { name: org.name.length > 12 ? org.name.slice(0, 12) + '…' : org.name, value: 0, orgId: org.id }
    })

  return data
}

export default function ControllingSection({ commissionEntries, organizations, advisors, contracts, applications, documents }) {
  const navigate = useNavigate()
  const [activeOrg, setActiveOrg] = useState(null)

  // Provision pro Organisation (via advisors)
  const provisionByOrg = organizations
    .filter(o => o.status === 'active')
    .map(org => {
      const orgAdvisorEmails = new Set(advisors.filter(a => a.organization_id === org.id).map(a => a.email))
      const total = commissionEntries
        .filter(ce => orgAdvisorEmails.has(ce.broker_email))
        .reduce((sum, ce) => sum + (ce.gross_commission || 0), 0)
      return { name: org.name.length > 14 ? org.name.slice(0, 14) + '…' : org.name, value: Math.round(total), orgId: org.id }
    })
    .filter(d => d.value > 0)
    .sort((a, b) => b.value - a.value)
    .slice(0, 8)

  // Provision pro Berater
  const provisionByAdvisor = advisors
    .map(a => {
      const total = commissionEntries
        .filter(ce => ce.broker_email === a.email)
        .reduce((sum, ce) => sum + (ce.gross_commission || 0), 0)
      const org = organizations.find(o => o.id === a.organization_id)
      return {
        name: `${a.firstname} ${a.lastname}`.slice(0, 14),
        value: Math.round(total),
        org: org?.name || '–',
        email: a.email,
      }
    })
    .filter(d => d.value > 0)
    .sort((a, b) => b.value - a.value)
    .slice(0, 8)

  // Conversion Rate: Dokumente → Anträge → Verträge
  const totalDocs = documents.length
  const totalApps = applications.length
  const totalContracts = contracts.filter(c => c.status === 'active').length
  const convDocToApp = totalDocs > 0 ? Math.round((totalApps / totalDocs) * 100) : 0
  const convAppToContract = totalApps > 0 ? Math.round((totalContracts / totalApps) * 100) : 0

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Provision pro Organisation */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base font-semibold">Provision pro Organisation</CardTitle>
          </CardHeader>
          <CardContent>
            {provisionByOrg.length === 0 ? (
              <p className="text-sm text-muted-foreground">Keine Daten</p>
            ) : (
              <ResponsiveContainer width="100%" height={200}>
                <BarChart data={provisionByOrg} layout="vertical" margin={{ left: 8, right: 16 }}>
                  <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="hsl(var(--border))" />
                  <XAxis type="number" tick={{ fontSize: 11 }} tickFormatter={v => `${(v / 1000).toFixed(0)}k`} />
                  <YAxis type="category" dataKey="name" tick={{ fontSize: 11 }} width={90} />
                  <Tooltip formatter={v => [`CHF ${v.toLocaleString('de-CH')}`, 'Provision']} contentStyle={{ fontSize: 12 }} />
                  <Bar dataKey="value" radius={[0, 4, 4, 0]}>
                    {provisionByOrg.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>

        {/* Provision pro Berater */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base font-semibold">Provision pro Berater</CardTitle>
          </CardHeader>
          <CardContent>
            {provisionByAdvisor.length === 0 ? (
              <p className="text-sm text-muted-foreground">Keine Daten</p>
            ) : (
              <ResponsiveContainer width="100%" height={200}>
                <BarChart data={provisionByAdvisor} layout="vertical" margin={{ left: 8, right: 16 }}>
                  <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="hsl(var(--border))" />
                  <XAxis type="number" tick={{ fontSize: 11 }} tickFormatter={v => `${(v / 1000).toFixed(0)}k`} />
                  <YAxis type="category" dataKey="name" tick={{ fontSize: 11 }} width={90} />
                  <Tooltip
                    formatter={v => [`CHF ${v.toLocaleString('de-CH')}`, 'Provision']}
                    labelFormatter={(_, payload) => payload?.[0]?.payload?.org || ''}
                    contentStyle={{ fontSize: 12 }}
                  />
                  <Bar dataKey="value" fill="hsl(var(--chart-2))" radius={[0, 4, 4, 0]}>
                    {provisionByAdvisor.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Conversion Rate */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base font-semibold">Conversion Rate: Dokument → Antrag → Vertrag</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-4 flex-wrap">
            {[
              { label: 'Dokumente', value: totalDocs, color: 'bg-slate-100 text-slate-700' },
              { label: '→', value: null },
              { label: 'Anträge', value: totalApps, color: 'bg-blue-100 text-blue-700', rate: convDocToApp, rateLabel: 'Dok→Ant' },
              { label: '→', value: null },
              { label: 'Aktive Verträge', value: totalContracts, color: 'bg-green-100 text-green-700', rate: convAppToContract, rateLabel: 'Ant→Pol' },
            ].map((step, idx) => step.value === null ? (
              <div key={idx} className="text-2xl text-muted-foreground font-light">→</div>
            ) : (
              <div key={idx} className={`flex-1 min-w-24 rounded-xl px-4 py-3 text-center ${step.color}`}>
                <p className="text-2xl font-extrabold">{step.value}</p>
                <p className="text-xs font-medium mt-1">{step.label}</p>
                {step.rate !== undefined && (
                  <p className="text-xs font-semibold mt-1 opacity-70">{step.rate}% {step.rateLabel}</p>
                )}
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  )
}