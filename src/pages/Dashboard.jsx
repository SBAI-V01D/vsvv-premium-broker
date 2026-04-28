import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Users, FileText, CheckSquare, Wallet, AlertTriangle, Clock, AlertCircle } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, LineChart, Line } from 'recharts';
import { format, differenceInDays, addDays } from 'date-fns';
import { de } from 'date-fns/locale';
import { Link } from 'react-router-dom';
import StatCard from '../components/shared/StatCard';
import PageHeader from '../components/shared/PageHeader';
import StatusBadge from '../components/shared/StatusBadge';

const COLORS = ['hsl(215, 80%, 48%)', 'hsl(160, 60%, 45%)', 'hsl(30, 80%, 55%)', 'hsl(280, 65%, 60%)', 'hsl(340, 75%, 55%)'];

export default function Dashboard() {
  const { data: customers = [] } = useQuery({
    queryKey: ['customers'],
    queryFn: () => base44.entities.Customer.list(),
  });
  const { data: contracts = [] } = useQuery({
    queryKey: ['contracts'],
    queryFn: () => base44.entities.Contract.list(),
  });
  const { data: tasks = [] } = useQuery({
    queryKey: ['tasks'],
    queryFn: () => base44.entities.Task.list(),
  });
  const { data: commissions = [] } = useQuery({
    queryKey: ['commissions'],
    queryFn: () => base44.entities.Commission.list(),
  });
  const { data: claims = [] } = useQuery({
    queryKey: ['claims'],
    queryFn: () => base44.entities.Claim.list(),
  });

  const activeContracts = contracts.filter(c => c.status === 'aktiv');
  const openTasks = tasks.filter(t => t.status !== 'erledigt');
  const urgentTasks = tasks.filter(t => t.priority === 'dringend' && t.status !== 'erledigt');
  const totalRevenue = commissions.filter(c => c.status === 'bezahlt').reduce((sum, c) => sum + (c.amount || 0), 0);

  // --- Monthly contract closings (last 6 months) ---
  const closingByMonth = {};
  contracts.forEach(c => {
    if (c.start_date) {
      const month = c.start_date.substring(0, 7);
      closingByMonth[month] = (closingByMonth[month] || 0) + 1;
    }
  });
  const closingData = Object.entries(closingByMonth)
    .sort(([a], [b]) => a.localeCompare(b))
    .slice(-6)
    .map(([month, count]) => ({
      month: format(new Date(month + '-01'), 'MMM yy', { locale: de }),
      abschlüsse: count,
    }));

  // --- Pending claims by status ---
  const claimStatusCount = {};
  claims.forEach(c => { claimStatusCount[c.status] = (claimStatusCount[c.status] || 0) + 1; });
  const claimStatusLabels = { eingereicht: 'Eingereicht', in_pruefung: 'In Prüfung', genehmigt: 'Genehmigt', abgelehnt: 'Abgelehnt', ausbezahlt: 'Ausbezahlt' };
  const claimBarData = Object.entries(claimStatusCount).map(([status, count]) => ({
    status: claimStatusLabels[status] || status,
    anzahl: count,
    fill: { eingereicht: '#94a3b8', in_pruefung: '#f59e0b', genehmigt: '#10b981', abgelehnt: '#ef4444', ausbezahlt: '#3b82f6' }[status] || '#94a3b8',
  }));

  // --- Contracts expiring in next 30 days ---
  const today = new Date();
  const in30 = addDays(today, 30);
  const expiringContracts = contracts
    .filter(c => c.end_date && c.status === 'aktiv' && new Date(c.end_date) >= today && new Date(c.end_date) <= in30)
    .map(c => ({ ...c, daysLeft: differenceInDays(new Date(c.end_date), today) }))
    .sort((a, b) => a.daysLeft - b.daysLeft);

  // --- Insurance type chart data ---
  const typeCount = {};
  contracts.forEach(c => {
    typeCount[c.insurance_type] = (typeCount[c.insurance_type] || 0) + 1;
  });
  const pieData = Object.entries(typeCount).map(([name, value]) => ({ name, value }));

  // Monthly commissions
  const monthlyData = {};
  commissions.forEach(c => {
    if (c.date) {
      const month = c.date.substring(0, 7);
      monthlyData[month] = (monthlyData[month] || 0) + (c.amount || 0);
    }
  });
  const barData = Object.entries(monthlyData)
    .sort(([a], [b]) => a.localeCompare(b))
    .slice(-6)
    .map(([month, amount]) => ({
      month: format(new Date(month + '-01'), 'MMM yy', { locale: de }),
      betrag: amount,
    }));

  return (
    <div>
      <PageHeader title="Dashboard" subtitle={`Übersicht – ${format(new Date(), 'EEEE, d. MMMM yyyy', { locale: de })}`} />

      {/* Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        <StatCard title="Kunden" value={customers.length} icon={Users} subtitle={`${customers.filter(c => c.status === 'aktiv').length} aktiv`} />
        <StatCard title="Aktive Verträge" value={activeContracts.length} icon={FileText} subtitle={`${contracts.length} total`} />
        <StatCard title="Offene Aufgaben" value={openTasks.length} icon={CheckSquare} subtitle={urgentTasks.length > 0 ? `${urgentTasks.length} dringend` : 'Keine dringenden'} />
        <StatCard title="Provisionen (CHF)" value={totalRevenue.toLocaleString('de-CH')} icon={Wallet} subtitle="Bezahlt" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
        {/* Commission Chart */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base font-semibold">Provisionen (letzte 6 Monate)</CardTitle>
          </CardHeader>
          <CardContent>
            {barData.length > 0 ? (
              <ResponsiveContainer width="100%" height={240}>
                <BarChart data={barData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(214, 15%, 91%)" />
                  <XAxis dataKey="month" tick={{ fontSize: 12 }} />
                  <YAxis tick={{ fontSize: 12 }} />
                  <Tooltip formatter={(v) => `CHF ${v.toLocaleString('de-CH')}`} />
                  <Bar dataKey="betrag" fill="hsl(215, 80%, 48%)" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-60 flex items-center justify-center text-muted-foreground text-sm">
                Noch keine Provisionsdaten vorhanden
              </div>
            )}
          </CardContent>
        </Card>

        {/* Insurance Types */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base font-semibold">Verträge nach Versicherungsart</CardTitle>
          </CardHeader>
          <CardContent>
            {pieData.length > 0 ? (
              <ResponsiveContainer width="100%" height={240}>
                <PieChart>
                  <Pie data={pieData} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={90} label={({ name, percent }) => `${name} (${(percent * 100).toFixed(0)}%)`}>
                    {pieData.map((_, i) => (
                      <Cell key={i} fill={COLORS[i % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip />
                </PieChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-60 flex items-center justify-center text-muted-foreground text-sm">
                Noch keine Vertragsdaten vorhanden
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* New charts row */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-8">

        {/* Monthly Closings */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base font-semibold flex items-center gap-2">
              <FileText className="w-4 h-4 text-primary" /> Monatliche Abschlussquote
            </CardTitle>
          </CardHeader>
          <CardContent>
            {closingData.length > 0 ? (
              <ResponsiveContainer width="100%" height={200}>
                <LineChart data={closingData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(214, 15%, 91%)" />
                  <XAxis dataKey="month" tick={{ fontSize: 11 }} />
                  <YAxis allowDecimals={false} tick={{ fontSize: 11 }} />
                  <Tooltip formatter={(v) => [`${v} Verträge`, 'Abschlüsse']} />
                  <Line type="monotone" dataKey="abschlüsse" stroke="hsl(215, 80%, 48%)" strokeWidth={2} dot={{ r: 4 }} activeDot={{ r: 6 }} />
                </LineChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-[200px] flex items-center justify-center text-muted-foreground text-sm">Keine Daten</div>
            )}
          </CardContent>
        </Card>

        {/* Claim Status Chart */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base font-semibold flex items-center gap-2">
              <AlertCircle className="w-4 h-4 text-amber-500" /> Schadensmeldungen nach Status
            </CardTitle>
          </CardHeader>
          <CardContent>
            {claimBarData.length > 0 ? (
              <ResponsiveContainer width="100%" height={200}>
                <BarChart data={claimBarData} layout="vertical">
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(214, 15%, 91%)" horizontal={false} />
                  <XAxis type="number" allowDecimals={false} tick={{ fontSize: 11 }} />
                  <YAxis dataKey="status" type="category" tick={{ fontSize: 11 }} width={80} />
                  <Tooltip formatter={(v) => [`${v}`, 'Anzahl']} />
                  <Bar dataKey="anzahl" radius={[0, 4, 4, 0]}>
                    {claimBarData.map((entry, i) => (
                      <Cell key={i} fill={entry.fill} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-[200px] flex items-center justify-center text-muted-foreground text-sm">Keine Schäden</div>
            )}
          </CardContent>
        </Card>

        {/* Expiring Contracts */}
        <Card>
          <CardHeader className="pb-2 flex flex-row items-center justify-between">
            <CardTitle className="text-base font-semibold flex items-center gap-2">
              <Clock className="w-4 h-4 text-orange-500" /> Ablaufende Verträge (30 Tage)
            </CardTitle>
            {expiringContracts.length > 0 && (
              <span className="text-xs font-semibold bg-orange-100 text-orange-700 px-2 py-0.5 rounded-full">{expiringContracts.length}</span>
            )}
          </CardHeader>
          <CardContent>
            {expiringContracts.length === 0 ? (
              <div className="h-[200px] flex flex-col items-center justify-center text-muted-foreground text-sm gap-2">
                <Clock className="w-8 h-8 opacity-30" />
                Keine ablaufenden Verträge
              </div>
            ) : (
              <div className="space-y-2 max-h-[200px] overflow-y-auto pr-1">
                {expiringContracts.map(c => (
                  <div key={c.id} className="flex items-center justify-between text-sm bg-orange-50 border border-orange-100 rounded-lg px-3 py-2">
                    <div className="min-w-0">
                      <p className="font-medium truncate">{c.customer_name}</p>
                      <p className="text-xs text-muted-foreground truncate">{c.insurance_type} · {c.provider}</p>
                    </div>
                    <span className={`ml-2 flex-shrink-0 text-xs font-bold px-2 py-0.5 rounded-full ${c.daysLeft <= 7 ? 'bg-red-100 text-red-700' : 'bg-orange-100 text-orange-700'}`}>
                      {c.daysLeft === 0 ? 'Heute' : `${c.daysLeft}T`}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Recent Tasks */}
      <Card>
        <CardHeader className="pb-2 flex flex-row items-center justify-between">
          <CardTitle className="text-base font-semibold">Aktuelle Aufgaben</CardTitle>
          <Link to="/aufgaben" className="text-sm text-primary font-medium hover:underline">Alle anzeigen</Link>
        </CardHeader>
        <CardContent>
          {openTasks.length === 0 ? (
            <p className="text-sm text-muted-foreground py-4">Keine offenen Aufgaben</p>
          ) : (
            <div className="divide-y divide-border">
              {openTasks.slice(0, 5).map(task => (
                <div key={task.id} className="flex items-center justify-between py-3">
                  <div className="flex items-center gap-3">
                    {task.priority === 'dringend' ? (
                      <AlertTriangle className="w-4 h-4 text-red-500" />
                    ) : (
                      <Clock className="w-4 h-4 text-muted-foreground" />
                    )}
                    <div>
                      <p className="text-sm font-medium">{task.title}</p>
                      {task.customer_name && <p className="text-xs text-muted-foreground">{task.customer_name}</p>}
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <StatusBadge status={task.priority} />
                    {task.due_date && (
                      <span className="text-xs text-muted-foreground">
                        {format(new Date(task.due_date), 'dd.MM.yy')}
                      </span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}