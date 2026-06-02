import React from 'react';
import { Badge } from '@/components/ui/badge';
import { CheckCircle2, XCircle, Star, Trophy, TrendingDown } from 'lucide-react';
import { cn } from '@/lib/utils';

function ScoreBar({ value, max = 100 }) {
  if (!value) return <span className="text-muted-foreground text-xs">—</span>;
  const pct = Math.min(100, (value / max) * 100);
  const color = pct >= 75 ? 'bg-emerald-500' : pct >= 50 ? 'bg-amber-400' : 'bg-rose-400';
  return (
    <div className="flex items-center gap-2">
      <div className="flex-1 h-1.5 bg-slate-100 rounded-full overflow-hidden">
        <div className={`h-full rounded-full ${color}`} style={{ width: pct + '%' }} />
      </div>
      <span className="text-xs font-medium w-7 text-right">{Math.round(value)}</span>
    </div>
  );
}

function Cell({ value, highlight, isLowest, isBest }) {
  return (
    <td className={cn('px-4 py-3 text-sm border-b border-slate-100', highlight && 'bg-emerald-50/60 font-medium text-emerald-800')}>
      <div className="flex items-center gap-1">
        {value}
        {isLowest && <TrendingDown className="w-3 h-3 text-emerald-600 flex-shrink-0" />}
        {isBest && <Trophy className="w-3 h-3 text-amber-500 flex-shrink-0" />}
      </div>
    </td>
  );
}

export default function VergleichsMatrix({ offerten = [] }) {
  if (offerten.length === 0) return (
    <div className="text-center py-12 text-muted-foreground">Noch keine Offerten erfasst.</div>
  );

  const minPraemie = Math.min(...offerten.filter(o => o.praemie_jaehrlich).map(o => o.praemie_jaehrlich));
  const maxScore = Math.max(...offerten.filter(o => o.ki_score).map(o => o.ki_score));

  const rows = [
    { label: 'Jahresprämie CHF', render: (o) => {
      const v = o.praemie_jaehrlich ? `CHF ${o.praemie_jaehrlich.toLocaleString('de-CH')}` : '—';
      return <Cell value={v} highlight={o.praemie_jaehrlich === minPraemie} isLowest={o.praemie_jaehrlich === minPraemie} />;
    }},
    { label: 'Monatsprämie CHF', render: (o) => <Cell value={o.praemie_monatlich ? `CHF ${Number(o.praemie_monatlich).toFixed(2)}` : '—'} /> },
    { label: 'Selbstbehalt', render: (o) => <Cell value={o.selbstbehalt || '—'} /> },
    { label: 'Laufzeit', render: (o) => <Cell value={o.laufzeit || '—'} /> },
    { label: 'Kündigungsfrist', render: (o) => <Cell value={o.kuendigungsfrist || '—'} /> },
    { label: 'Deckung', render: (o) => <td className="px-4 py-3 text-sm border-b border-slate-100 max-w-[200px]"><p className="line-clamp-2 text-xs text-slate-600">{o.deckung_beschreibung || '—'}</p></td> },
    { label: 'Zusatzleistungen', render: (o) => <td className="px-4 py-3 border-b border-slate-100"><div className="flex flex-wrap gap-1">{(o.zusatzleistungen || []).slice(0,3).map((z,i) => <Badge key={i} className="badge-success text-[10px] py-0">{z}</Badge>)}{(o.zusatzleistungen||[]).length > 3 && <Badge className="badge-neutral text-[10px] py-0">+{o.zusatzleistungen.length-3}</Badge>}</div></td> },
    { label: 'Ausschlüsse', render: (o) => <td className="px-4 py-3 border-b border-slate-100"><div className="flex flex-wrap gap-1">{(o.ausschluesse || []).slice(0,3).map((z,i) => <Badge key={i} className="badge-danger text-[10px] py-0">{z}</Badge>)}{(o.ausschluesse||[]).length > 3 && <Badge className="badge-neutral text-[10px] py-0">+{o.ausschluesse.length-3}</Badge>}</div></td> },
    { label: 'KI Gesamtscore', render: (o) => <td className="px-4 py-3 border-b border-slate-100 min-w-[120px]"><ScoreBar value={o.ki_score} /></td> },
    { label: 'Preis Score', render: (o) => <td className="px-4 py-3 border-b border-slate-100"><ScoreBar value={o.ki_preis_score} /></td> },
    { label: 'Deckungs Score', render: (o) => <td className="px-4 py-3 border-b border-slate-100"><ScoreBar value={o.ki_deckungs_score} /></td> },
    { label: 'Service Score', render: (o) => <td className="px-4 py-3 border-b border-slate-100"><ScoreBar value={o.ki_service_score} /></td> },
    { label: 'Empfehlung', render: (o) => <td className="px-4 py-3 border-b border-slate-100">
      {o.ist_empfohlen ? <Badge className="badge-success gap-1"><Star className="w-3 h-3" />Empfohlen</Badge> : <span className="text-muted-foreground text-xs">—</span>}
    </td>},
  ];

  return (
    <div className="overflow-x-auto rounded-xl border border-slate-100">
      <table className="w-full min-w-[700px]">
        <thead>
          <tr className="bg-slate-50 border-b border-slate-200">
            <th className="px-4 py-3 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wide w-36">Kriterium</th>
            {offerten.map(o => (
              <th key={o.id} className={cn('px-4 py-3 text-left text-sm font-semibold', o.ist_empfohlen && 'text-emerald-700')}>
                <div className="flex items-center gap-1.5">
                  {o.ist_empfohlen && <Star className="w-3.5 h-3.5 text-amber-500" />}
                  {o.versicherer_name}
                </div>
                {o.praemie_jaehrlich === minPraemie && <span className="text-[10px] font-normal text-emerald-600 block">Günstigste</span>}
                {o.ki_score === maxScore && o.ki_score && <span className="text-[10px] font-normal text-blue-600 block">Bester Score</span>}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, i) => (
            <tr key={i} className={i % 2 === 0 ? 'bg-white' : 'bg-slate-50/40'}>
              <td className="px-4 py-3 text-xs font-medium text-muted-foreground border-b border-slate-100 whitespace-nowrap">{row.label}</td>
              {offerten.map(o => <React.Fragment key={o.id}>{row.render(o)}</React.Fragment>)}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}