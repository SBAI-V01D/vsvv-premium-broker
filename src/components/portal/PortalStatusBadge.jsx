import React from 'react';
import { cn } from '@/lib/utils';

const styles = {
  aktiv:        'bg-emerald-50 text-emerald-700 border-emerald-200',
  pendent:      'bg-amber-50 text-amber-700 border-amber-200',
  'gekündigt':  'bg-red-50 text-red-700 border-red-200',
  abgelaufen:   'bg-slate-100 text-slate-500 border-slate-200',
  eingereicht:  'bg-slate-100 text-slate-600 border-slate-200',
  in_pruefung:  'bg-amber-50 text-amber-700 border-amber-200',
  genehmigt:    'bg-emerald-50 text-emerald-700 border-emerald-200',
  abgelehnt:    'bg-red-50 text-red-700 border-red-200',
  ausbezahlt:   'bg-primary/10 text-primary border-primary/20',
};

const labels = {
  in_pruefung: 'In Prüfung',
  'gekündigt': 'Gekündigt',
  eingereicht: 'Eingereicht',
  in_bearbeitung: 'In Bearbeitung',
  ausbezahlt: 'Ausbezahlt',
};

export default function PortalStatusBadge({ status }) {
  if (!status) return null;
  const style = styles[status] || 'bg-slate-100 text-slate-500 border-slate-200';
  const label = labels[status] || status.charAt(0).toUpperCase() + status.slice(1);
  return (
    <span className={cn('inline-flex items-center px-2 py-0.5 rounded-md text-xs font-medium border', style)}>
      {label}
    </span>
  );
}