import React from 'react';
import { format, parseISO } from 'date-fns';
import { de } from 'date-fns/locale';
import {
  Phone, Mail, Users, FileText, MessageSquare,
  CheckSquare, TrendingUp, AlertCircle, StickyNote, Activity
} from 'lucide-react';

const typeConfig = {
  // Interactions
  anruf:    { icon: Phone,        color: 'bg-blue-100 text-blue-600',    label: 'Anruf' },
  meeting:  { icon: Users,        color: 'bg-purple-100 text-purple-600', label: 'Meeting' },
  email:    { icon: Mail,         color: 'bg-indigo-100 text-indigo-600', label: 'E-Mail' },
  notiz:    { icon: StickyNote,   color: 'bg-amber-100 text-amber-600',   label: 'Notiz' },
  dokument: { icon: FileText,     color: 'bg-slate-100 text-slate-600',   label: 'Dokument' },
  // Tasks
  task:     { icon: CheckSquare,  color: 'bg-emerald-100 text-emerald-600', label: 'Aufgabe' },
  // Deals
  deal:     { icon: TrendingUp,   color: 'bg-orange-100 text-orange-600',  label: 'Deal' },
  // Messages
  message:  { icon: MessageSquare, color: 'bg-teal-100 text-teal-600',    label: 'Nachricht' },
  // Claims
  claim:    { icon: AlertCircle,  color: 'bg-red-100 text-red-600',        label: 'Schadensfall' },
};

const PRIORITY_LABEL = { niedrig: 'Niedrig', mittel: 'Mittel', hoch: 'Hoch', dringend: 'Dringend' };
const STAGE_LABEL    = { erstkontakt: 'Erstkontakt', bedarfsanalyse: 'Bedarfsanalyse', angebot_versendet: 'Angebot versendet', verhandlung: 'Verhandlung', abschluss: 'Abschluss', verloren: 'Verloren' };

function getDate(item) {
  return item.date || item.created_date || null;
}

function FeedItem({ item }) {
  const cfg = typeConfig[item._type] || typeConfig.notiz;
  const Icon = cfg.icon;
  const dateStr = getDate(item);
  const formattedDate = dateStr
    ? format(new Date(dateStr), 'dd. MMM yyyy, HH:mm', { locale: de })
    : null;

  return (
    <div className="flex gap-3 group">
      {/* Icon + line */}
      <div className="flex flex-col items-center">
        <div className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 ${cfg.color}`}>
          <Icon className="w-3.5 h-3.5" />
        </div>
        <div className="flex-1 w-px bg-border mt-1 mb-1" />
      </div>

      {/* Content */}
      <div className="pb-4 flex-1 min-w-0">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{cfg.label}</span>
            <p className="text-sm font-medium text-foreground leading-snug mt-0.5">
              {item.subject || item.title || item.content?.slice(0, 80) || '–'}
            </p>
            {/* Sub-details per type */}
            {item._type === 'task' && item.priority && (
              <p className="text-xs text-muted-foreground mt-0.5">
                Priorität: {PRIORITY_LABEL[item.priority] || item.priority}
                {item.due_date && ` · Fällig: ${format(new Date(item.due_date), 'dd.MM.yyyy')}`}
                {' · '}<span className="capitalize">{item.status}</span>
              </p>
            )}
            {item._type === 'deal' && (
              <p className="text-xs text-muted-foreground mt-0.5">
                {STAGE_LABEL[item.stage] || item.stage}
                {item.insurance_type && ` · ${item.insurance_type}`}
                {item.estimated_premium && ` · CHF ${item.estimated_premium.toLocaleString('de-CH')}/Jahr`}
              </p>
            )}
            {item._type === 'claim' && (
              <p className="text-xs text-muted-foreground mt-0.5">
                {item.insurance_type && `${item.insurance_type} · `}{item.status}
              </p>
            )}
            {(item._type === 'anruf' || item._type === 'meeting' || item._type === 'email' || item._type === 'notiz') && item.content && (
              <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">{item.content}</p>
            )}
            {item._type === 'message' && item.content && (
              <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">{item.content}</p>
            )}
          </div>
          {formattedDate && (
            <span className="text-xs text-muted-foreground flex-shrink-0">{formattedDate}</span>
          )}
        </div>
      </div>
    </div>
  );
}

export default function ActivityFeed({ interactions = [], tasks = [], deals = [], messages = [], claims = [] }) {
  // Merge all into one list with _type tag
  const all = [
    ...interactions.map(i => ({ ...i, _type: i.type })),
    ...tasks.map(t => ({ ...t, _type: 'task' })),
    ...deals.map(d => ({ ...d, _type: 'deal' })),
    ...messages.map(m => ({ ...m, _type: 'message' })),
    ...claims.map(c => ({ ...c, _type: 'claim' })),
  ];

  // Sort descending by date
  all.sort((a, b) => {
    const da = new Date(getDate(a) || 0);
    const db = new Date(getDate(b) || 0);
    return db - da;
  });

  if (all.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-12 text-muted-foreground gap-2">
        <Activity className="w-8 h-8 opacity-30" />
        <p className="text-sm">Noch keine Aktivitäten vorhanden</p>
      </div>
    );
  }

  return (
    <div className="relative">
      {all.map((item, i) => (
        <FeedItem key={`${item._type}-${item.id}-${i}`} item={item} />
      ))}
    </div>
  );
}