import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Shield, Users, Lock, CheckCircle2, User } from 'lucide-react';

export default function TabSecurity() {
  const { data: users = [], isLoading: loadingUsers } = useQuery({
    queryKey: ['enterprise_users_security'],
    queryFn: () => base44.entities.User.list('-created_date', 200),
    staleTime: 120_000,
  });

  const { data: auditLogs = [] } = useQuery({
    queryKey: ['enterprise_security_logs'],
    queryFn: () => base44.entities.SystemLog.filter({ source: 'audit_action' }, '-created_date', 50),
    staleTime: 30_000,
  });

  const roleGroups = users.reduce((acc, u) => {
    acc[u.role || 'user'] = (acc[u.role || 'user'] || 0) + 1;
    return acc;
  }, {});

  const ROLE_COLORS = {
    admin:      'text-red-600 bg-red-50 border-red-200',
    broker:     'text-blue-600 bg-blue-50 border-blue-200',
    supervisor: 'text-purple-600 bg-purple-50 border-purple-200',
    user:       'text-slate-600 bg-slate-50 border-slate-200',
  };

  return (
    <div className="max-w-4xl space-y-4">
      {/* Platform notice */}
      <div className="flex items-start gap-3 bg-blue-50 border border-blue-200 rounded-xl px-4 py-3">
        <Shield className="w-4 h-4 text-blue-600 shrink-0 mt-0.5" />
        <div className="text-xs text-blue-800">
          <p className="font-semibold mb-1">Plattform-Security (Base44)</p>
          <p>TLS/HTTPS, Auth-Sessions, API-Gateway, Rate-Limiting und Private-Storage-Zugriffsschutz laufen auf Infrastrukturebene und sind nicht direkt im App-Code sichtbar. Das ist normal und korrekt.</p>
        </div>
      </div>

      {/* Rollen-Übersicht */}
      <div className="border border-border rounded-xl overflow-hidden">
        <div className="px-5 py-3 bg-muted/30 border-b border-border/60 flex items-center gap-2">
          <Users className="w-4 h-4 text-muted-foreground" />
          <p className="text-sm font-semibold">Benutzer &amp; Rollen ({users.length} gesamt)</p>
        </div>
        <div className="p-4 grid grid-cols-2 md:grid-cols-4 gap-3">
          {Object.entries(roleGroups).map(([role, count]) => (
            <div key={role} className={`border rounded-lg px-4 py-3 text-center ${ROLE_COLORS[role] || ROLE_COLORS.user}`}>
              <div className="text-xl font-bold">{count}</div>
              <div className="text-xs font-semibold capitalize mt-1">{role}</div>
            </div>
          ))}
        </div>

        <div className="border-t border-border/60 divide-y divide-border/60 max-h-60 overflow-y-auto">
          {users.map(u => (
            <div key={u.id} className="px-5 py-2.5 flex items-center gap-3 text-xs">
              <div className="w-6 h-6 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                <User className="w-3 h-3 text-primary" />
              </div>
              <div className="flex-1">
                <span className="font-medium text-foreground">{u.full_name || u.email}</span>
                <span className="text-muted-foreground ml-2">{u.email}</span>
              </div>
              <span className={`text-[10px] font-bold uppercase px-2 py-0.5 rounded-full border ${ROLE_COLORS[u.role] || ROLE_COLORS.user}`}>{u.role || 'user'}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Audit Actions */}
      <div className="border border-border rounded-xl overflow-hidden">
        <div className="px-5 py-3 bg-muted/30 border-b border-border/60 flex items-center gap-2">
          <Lock className="w-4 h-4 text-muted-foreground" />
          <p className="text-sm font-semibold">Letzte Audit-Aktionen</p>
        </div>
        {auditLogs.length === 0 ? (
          <div className="px-5 py-6 text-center flex flex-col items-center gap-2">
            <CheckCircle2 className="w-5 h-5 text-emerald-500" />
            <p className="text-sm text-muted-foreground">Noch keine Audit-Aktionen geloggt.</p>
          </div>
        ) : (
          <div className="divide-y divide-border/60 max-h-48 overflow-y-auto">
            {auditLogs.map(log => (
              <div key={log.id} className="px-5 py-2.5 flex items-center gap-3 text-xs">
                <div className="flex-1">
                  <span className="font-medium text-foreground">{log.message}</span>
                  {log.user_email && <span className="text-muted-foreground ml-2">· {log.user_email}</span>}
                </div>
                <span className="text-muted-foreground shrink-0">
                  {new Date(log.created_date).toLocaleString('de-CH', { hour:'2-digit', minute:'2-digit', day:'2-digit', month:'2-digit' })}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}