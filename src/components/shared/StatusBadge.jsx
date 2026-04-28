import React from 'react';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';

const statusStyles = {
  aktiv: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  pendent: 'bg-amber-50 text-amber-700 border-amber-200',
  gekündigt: 'bg-red-50 text-red-700 border-red-200',
  abgelaufen: 'bg-slate-100 text-slate-600 border-slate-200',
  inaktiv: 'bg-slate-100 text-slate-600 border-slate-200',
  interessent: 'bg-blue-50 text-blue-700 border-blue-200',
  offen: 'bg-amber-50 text-amber-700 border-amber-200',
  in_bearbeitung: 'bg-blue-50 text-blue-700 border-blue-200',
  erledigt: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  bezahlt: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  storniert: 'bg-red-50 text-red-700 border-red-200',
  niedrig: 'bg-slate-100 text-slate-600 border-slate-200',
  mittel: 'bg-amber-50 text-amber-700 border-amber-200',
  hoch: 'bg-orange-50 text-orange-700 border-orange-200',
  dringend: 'bg-red-50 text-red-700 border-red-200',
};

const labelMap = {
  in_bearbeitung: 'In Bearbeitung',
  gekündigt: 'Gekündigt',
};

export default function StatusBadge({ status }) {
  if (!status) return null;
  const style = statusStyles[status] || 'bg-slate-100 text-slate-600 border-slate-200';
  const label = labelMap[status] || status.charAt(0).toUpperCase() + status.slice(1);
  return (
    <Badge variant="outline" className={cn("text-xs font-medium border", style)}>
      {label}
    </Badge>
  );
}