import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { TrendingUp } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from 'recharts';
import { Link } from 'react-router-dom';

const STAGES = [
  { id: 'erstkontakt', label: 'Erstkontakt', color: '#94a3b8' },
  { id: 'bedarfsanalyse', label: 'Bedarfsanalyse', color: '#3b82f6' },
  { id: 'angebot_versendet', label: 'Angebot', color: '#f59e0b' },
  { id: 'verhandlung', label: 'Verhandlung', color: '#a855f7' },
  { id: 'abschluss', label: 'Abschluss', color: '#10b981' },
];

export default function PipelineWidget() {
  const { data: deals = [] } = useQuery({
    queryKey: ['deals'],
    queryFn: () => base44.entities.Deal.list(),
  });

  // Pipeline data by stage (exclude 'verloren')
  const pipelineData = STAGES.map(stage => {
    const stageDeals = deals.filter(d => d.stage === stage.id);
    const value = stageDeals.reduce((s, d) => s + (d.estimated_premium || 0), 0);
    return {
      stage: stage.label,
      count: stageDeals.length,
      value: Math.round(value / 1000), // in thousands
      color: stage.color,
    };
  });

  const totalPipeline = pipelineData.reduce((s, p) => s + p.value, 0);
  const totalDeals = pipelineData.reduce((s, p) => s + p.count, 0);

  return (
    <Link to="/pipeline" className="block">
      <Card className="hover:border-primary/50 transition-colors cursor-pointer">
        <CardHeader className="pb-2">
          <CardTitle className="text-base font-semibold flex items-center gap-2">
            <TrendingUp className="w-4 h-4 text-primary" /> Verkaufs-Pipeline
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {/* Pipeline Stats */}
          <div className="grid grid-cols-2 gap-3">
            <div className="bg-primary/10 rounded-lg p-3 border border-primary/20">
              <p className="text-xs text-muted-foreground">Deals in Pipeline</p>
              <p className="font-bold text-lg text-primary">{totalDeals}</p>
            </div>
            <div className="bg-emerald-50 rounded-lg p-3 border border-emerald-200">
              <p className="text-xs text-muted-foreground">Pipeline-Wert</p>
              <p className="font-bold text-lg text-emerald-700">CHF {totalPipeline}k</p>
            </div>
          </div>

          {/* Pipeline Chart */}
          {pipelineData.some(p => p.count > 0) ? (
            <ResponsiveContainer width="100%" height={180}>
              <BarChart data={pipelineData}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(214, 15%, 91%)" />
                <XAxis dataKey="stage" tick={{ fontSize: 11 }} />
                <YAxis allowDecimals={false} tick={{ fontSize: 11 }} />
                <Tooltip formatter={(v) => `${v}k CHF`} labelFormatter={(s) => `${s}`} />
                <Bar dataKey="value" radius={[4, 4, 0, 0]}>
                  {pipelineData.map((entry, i) => (
                    <Cell key={i} fill={entry.color} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <div className="h-[180px] flex items-center justify-center text-muted-foreground text-sm">
              Keine Deals in der Pipeline
            </div>
          )}

          <p className="text-xs text-muted-foreground text-center">Klicken zum vollständigen Pipeline-Board</p>
        </CardContent>
      </Card>
    </Link>
  );
}