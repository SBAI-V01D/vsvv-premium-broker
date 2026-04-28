import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Calendar, AlertTriangle } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { format, addMonths, differenceInDays, isWithinInterval } from 'date-fns';
import { de } from 'date-fns/locale';

export default function RenewalWidget() {
  const { data: contracts = [] } = useQuery({
    queryKey: ['contracts'],
    queryFn: () => base44.entities.Contract.list(),
  });

  const today = new Date();
  const in90Days = addMonths(today, 3);

  // Contracts expiring in next 90 days, grouped by month
  const renewals = contracts
    .filter(c => c.status === 'aktiv' && c.end_date && isWithinInterval(new Date(c.end_date), { start: today, end: in90Days }))
    .map(c => ({ ...c, daysLeft: differenceInDays(new Date(c.end_date), today) }))
    .sort((a, b) => a.daysLeft - b.daysLeft);

  const renewalsByMonth = {};
  renewals.forEach(c => {
    const month = format(new Date(c.end_date), 'MMMM yyyy', { locale: de });
    if (!renewalsByMonth[month]) renewalsByMonth[month] = [];
    renewalsByMonth[month].push(c);
  });

  return (
    <Card>
      <CardHeader className="pb-2 flex flex-row items-center justify-between">
        <CardTitle className="text-base font-semibold flex items-center gap-2">
          <Calendar className="w-4 h-4 text-blue-500" /> Anstehende Vertragsverlängerungen (90 Tage)
        </CardTitle>
        {renewals.length > 0 && (
          <span className="text-xs font-semibold bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full">{renewals.length}</span>
        )}
      </CardHeader>
      <CardContent>
        {renewals.length === 0 ? (
          <div className="h-[240px] flex flex-col items-center justify-center text-muted-foreground text-sm gap-2">
            <Calendar className="w-8 h-8 opacity-30" />
            Keine Verlängerungen anstehend
          </div>
        ) : (
          <div className="space-y-4 max-h-[400px] overflow-y-auto pr-1">
            {Object.entries(renewalsByMonth).map(([month, items]) => (
              <div key={month}>
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">{month}</p>
                <div className="space-y-1.5">
                  {items.map(c => (
                    <div key={c.id} className="flex items-center justify-between text-sm bg-blue-50 border border-blue-100 rounded-lg px-3 py-2">
                      <div className="min-w-0 flex-1">
                        <p className="font-medium truncate">{c.customer_name}</p>
                        <p className="text-xs text-muted-foreground truncate">{c.insurance_type} · {c.provider}</p>
                      </div>
                      <div className="flex items-center gap-2 ml-2 flex-shrink-0">
                        <span className="text-xs font-semibold text-blue-700">
                          {c.daysLeft === 0 ? 'Heute' : `${c.daysLeft}T`}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}