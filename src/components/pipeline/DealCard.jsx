import React from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Calendar, Mail, Phone, TrendingUp, Edit, Trash2 } from 'lucide-react';
import { format } from 'date-fns';

const sourceLabels = {
  empfehlung: 'Empfehlung', website: 'Website', kaltakquise: 'Kaltakquise',
  event: 'Event', marketing: 'Marketing', sonstiges: 'Sonstiges',
};

const insuranceColors = {
  KVG: 'bg-blue-50 text-blue-700', VVG: 'bg-indigo-50 text-indigo-700',
  Leben: 'bg-pink-50 text-pink-700', Haftpflicht: 'bg-slate-50 text-slate-700',
  Hausrat: 'bg-green-50 text-green-700', Rechtsschutz: 'bg-purple-50 text-purple-700',
  Motorfahrzeug: 'bg-orange-50 text-orange-700', default: 'bg-gray-50 text-gray-700',
};

export default function DealCard({ deal, onEdit, onDelete, dragging }) {
  const insuranceClass = insuranceColors[deal.insurance_type] || insuranceColors.default;
  const isOverdue = deal.next_action_date && new Date(deal.next_action_date) < new Date();

  return (
    <Card className={`group cursor-grab active:cursor-grabbing transition-all duration-150 ${dragging ? 'shadow-2xl scale-105 rotate-1 opacity-90' : 'hover:shadow-md'}`}>
      <CardContent className="p-3 space-y-2">
        {/* Header */}
        <div className="flex items-start justify-between gap-1">
          <p className="font-semibold text-sm leading-tight flex-1">{deal.title}</p>
          <div className="flex gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
            <button onClick={(e) => { e.stopPropagation(); onEdit(deal); }}
              className="p-1 rounded hover:bg-muted text-muted-foreground hover:text-foreground">
              <Edit className="w-3 h-3" />
            </button>
            <button onClick={(e) => { e.stopPropagation(); onDelete(deal.id); }}
              className="p-1 rounded hover:bg-red-50 text-muted-foreground hover:text-red-500">
              <Trash2 className="w-3 h-3" />
            </button>
          </div>
        </div>

        {/* Customer */}
        <p className="text-xs text-muted-foreground font-medium">{deal.customer_name}</p>

        {/* Insurance type */}
        {deal.insurance_type && (
          <span className={`inline-block text-xs px-2 py-0.5 rounded-full font-medium ${insuranceClass}`}>
            {deal.insurance_type}
          </span>
        )}

        {/* Premium + Probability */}
        {(deal.estimated_premium || deal.probability !== undefined) && (
          <div className="flex items-center justify-between text-xs">
            {deal.estimated_premium && (
              <span className="font-semibold text-foreground">
                CHF {deal.estimated_premium.toLocaleString('de-CH')}/J.
              </span>
            )}
            {deal.probability !== undefined && deal.probability !== null && (
              <div className="flex items-center gap-1 text-muted-foreground">
                <TrendingUp className="w-3 h-3" />
                <span>{deal.probability}%</span>
              </div>
            )}
          </div>
        )}

        {/* Probability bar */}
        {deal.probability !== undefined && deal.probability !== null && (
          <div className="w-full h-1 bg-slate-100 rounded-full overflow-hidden">
            <div
              className={`h-full rounded-full transition-all ${
                deal.probability >= 70 ? 'bg-emerald-500' :
                deal.probability >= 40 ? 'bg-amber-400' : 'bg-red-400'
              }`}
              style={{ width: `${deal.probability}%` }}
            />
          </div>
        )}

        {/* Next action */}
        {deal.next_action_date && (
          <div className={`flex items-center gap-1 text-xs ${isOverdue ? 'text-red-500' : 'text-muted-foreground'}`}>
            <Calendar className="w-3 h-3" />
            <span className={isOverdue ? 'font-semibold' : ''}>
              {isOverdue ? '⚠ Überfällig: ' : ''}{format(new Date(deal.next_action_date), 'dd.MM.yyyy')}
            </span>
          </div>
        )}
        {deal.next_action && (
          <p className="text-xs text-muted-foreground truncate">{deal.next_action}</p>
        )}

        {/* Source */}
        {deal.source && deal.source !== 'sonstiges' && (
          <span className="text-xs text-muted-foreground">📌 {sourceLabels[deal.source]}</span>
        )}
      </CardContent>
    </Card>
  );
}