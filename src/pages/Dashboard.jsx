import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Users, FileText, CheckSquare, Wallet, AlertTriangle, Clock } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts';
import { format } from 'date-fns';
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

  const activeContracts = contracts.filter(c => c.status === 'aktiv');
  const openTasks = tasks.filter(t => t.status !== 'erledigt');
  const urgentTasks = tasks.filter(t => t.priority === 'dringend' && t.status !== 'erledigt');
  const totalRevenue = commissions.filter(c => c.status === 'bezahlt').reduce((sum, c) => sum + (c.amount || 0), 0);

  // Insurance type chart data
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