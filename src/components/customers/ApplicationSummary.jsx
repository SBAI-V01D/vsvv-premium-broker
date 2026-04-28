import React from 'react';
import { format } from 'date-fns';
import { FileText, AlertCircle, CheckCircle2, Clock } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import StatusBadge from '../shared/StatusBadge';

const STATUS_LABELS = {
  neu: 'Neu',
  in_bearbeitung: 'In Bearbeitung',
  bewilligung_erteilt: 'Bewilligung erteilt',
  abgelehnt: 'Abgelehnt',
};

const STATUS_ICONS = {
  neu: FileText,
  in_bearbeitung: Clock,
  bewilligung_erteilt: CheckCircle2,
  abgelehnt: AlertCircle,
};

const TYPE_EMOJI = {
  KVG: '🏥', VVG: '🏥', Leben: '❤️', Haftpflicht: '🛡️', Hausrat: '🏠',
  Rechtsschutz: '⚖️', Motorfahrzeug: '🚗', Gebäude: '🏢', Unfall: '🩺',
  Krankentaggeld: '📋', BVG: '💼', 'Säule 3a': '💰', Sonstige: '📄',
};

export default function ApplicationSummary({ applications = [] }) {
  if (applications.length === 0) return null;

  const pending = applications.filter(a => a.status !== 'abgelehnt' && a.status !== 'bewilligung_erteilt');
  const approved = applications.filter(a => a.status === 'bewilligung_erteilt');
  const rejected = applications.filter(a => a.status === 'abgelehnt');

  return (
    <div className="mb-6 space-y-4">
      {/* KPI strip */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { label: 'Anträge total', value: applications.length, icon: FileText, color: 'text-primary bg-primary/10' },
          { label: 'Genehmigt', value: approved.length, icon: CheckCircle2, color: 'text-emerald-500 bg-emerald-50' },
          { label: 'In Bearbeitung', value: pending.length, icon: Clock, color: 'text-blue-500 bg-blue-50' },
          { label: 'Abgelehnt', value: rejected.length, icon: AlertCircle, color: 'text-red-500 bg-red-50' },
        ].map(({ label, value, icon: Icon, color }) => (
          <Card key={label}>
            <CardContent className="p-3 flex items-center gap-3">
              <div className={`w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 ${color}`}>
                {React.createElement(Icon, { className: 'w-4 h-4' })}
              </div>
              <div className="min-w-0">
                <p className="text-xs text-muted-foreground leading-tight">{label}</p>
                <p className="font-bold text-sm leading-tight">{value}</p>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Applications List */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-semibold">Anträge ({applications.length})</h3>
        </div>
        <div className="flex flex-wrap gap-2">
          {applications.map(app => (
            <div
              key={app.id}
              className="flex items-center gap-2 rounded-full px-3 py-1.5 text-sm shadow-sm border bg-white border-border hover:shadow-md transition-shadow"
            >
              <span>{TYPE_EMOJI[app.insurance_type] || '📄'}</span>
              <span className="font-medium">{app.insurance_type}</span>
              <span className="text-muted-foreground text-xs">{app.provider}</span>
              {app.requested_start_date && (
                <span className="text-xs bg-primary/10 text-primary rounded-full px-2 py-0.5 font-medium">
                  {format(new Date(app.requested_start_date), 'dd.MM.yyyy')}
                </span>
              )}
              <span className={`text-xs rounded-full px-2 py-0.5 font-medium ${
                app.status === 'bewilligung_erteilt' ? 'bg-emerald-100 text-emerald-700' :
                app.status === 'abgelehnt' ? 'bg-red-100 text-red-700' :
                app.status === 'in_bearbeitung' ? 'bg-blue-100 text-blue-700' :
                'bg-slate-100 text-slate-700'
              }`}>
                {STATUS_LABELS[app.status] || app.status}
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}