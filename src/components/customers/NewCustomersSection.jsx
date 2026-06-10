/**
 * NewCustomersSection — Neukunden als operative Section innerhalb Kundenübersicht
 * Zeigt max. 3 Neukunden (neueste zuerst, created_at >= 22.05.2026)
 */

import React, { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { base44 } from '@/api/base44Client';
import { useQuery } from '@tanstack/react-query';
import { User, Building2, ChevronRight, Calendar } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';

// Neukunden-Filter: created_at >= 22.05.2026
const NEW_CUSTOMERS_SINCE = '2026-05-22';

function NewCustomerCard({ customer, onClick }) {
  const isBusiness = customer.customer_type === 'business';
  const Icon = isBusiness ? Building2 : User;

  return (
    <button
      onClick={onClick}
      className="w-full flex items-center justify-between p-2.5 rounded-md hover:bg-[hsl(var(--surface-2))]/40 transition-colors text-left group"
    >
      <div className="flex items-center gap-2.5 min-w-0 flex-1">
        <div className={cn(
          "w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0",
          isBusiness ? "bg-blue-50" : "bg-emerald-50"
        )}>
          <Icon className={cn("w-4 h-4", isBusiness ? "text-blue-600" : "text-emerald-600")} />
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-[11.5px] font-medium text-[hsl(var(--text-heading))] truncate group-hover:text-[hsl(var(--primary))] transition-colors">
            {isBusiness ? customer.company_name : `${customer.first_name} ${customer.last_name}`}
          </p>
          <div className="flex items-center gap-2 mt-0.5">
            <Badge variant="outline" className="text-[9px] h-4 px-1">
              {isBusiness ? 'Firma' : 'Privat'}
            </Badge>
            <span className="text-[9px] text-[hsl(var(--text-muted))]">
              {customer.advisor_id ? 'Berater zugewiesen' : '⚠ Kein Berater'}
            </span>
          </div>
        </div>
      </div>
      <ChevronRight className="w-3.5 h-3.5 text-[hsl(var(--text-muted))] group-hover:text-[hsl(var(--primary))] transition-colors flex-shrink-0" />
    </button>
  );
}

export default function NewCustomersSection({ searchQuery = '' }) {
  const navigate = useNavigate();
  const [showAll, setShowAll] = useState(false);

  const { data: newCustomers = [], isLoading } = useQuery({
    queryKey: ['new_customers_section', searchQuery],
    queryFn: async () => {
      const all = await base44.entities.Customer.filter({ archived: false }, '-created_date', 500);
      return all.filter(c => {
        // Datumsvergleich als String (erste 10 Zeichen = YYYY-MM-DD) → kein Timezone-Problem
        const createdDate = (c.created_date || '').slice(0, 10);
        return createdDate >= NEW_CUSTOMERS_SINCE;
      });
    },
    staleTime: 2 * 60 * 1000,
  });

  const filteredCustomers = useMemo(() => {
    if (!searchQuery.trim()) return newCustomers;
    const query = searchQuery.toLowerCase();
    return newCustomers.filter(c => {
      const name = c.customer_type === 'business' 
        ? (c.company_name || '').toLowerCase()
        : `${c.first_name || ''} ${c.last_name || ''}`.toLowerCase();
      const email = (c.email || '').toLowerCase();
      const number = (c.customer_number || '').toLowerCase();
      return name.includes(query) || email.includes(query) || number.includes(query);
    });
  }, [newCustomers, searchQuery]);

  const displayCustomers = showAll ? filteredCustomers : filteredCustomers.slice(0, 3);
  const hasMore = filteredCustomers.length > 3;

  if (isLoading) {
    return (
      <div className="bg-white/80 backdrop-blur-sm rounded-lg p-3 border border-[hsl(var(--border-subtle))]/40">
        <div className="flex items-center gap-2 mb-2">
          <Calendar className="w-3.5 h-3.5 text-[hsl(var(--primary))]" />
          <h3 className="text-sm font-bold text-[hsl(var(--text-heading))]">Neukunden</h3>
          <span className="text-[9px] text-[hsl(var(--text-muted))]">Laden...</span>
        </div>
        <div className="space-y-1">
          {[1, 2, 3].map(i => (
            <div key={i} className="h-10 bg-[hsl(var(--surface-1))] rounded animate-pulse" />
          ))}
        </div>
      </div>
    );
  }

  if (filteredCustomers.length === 0) {
    return (
      <div className="bg-[hsl(var(--surface-1))] rounded-lg p-4 text-center">
        <Calendar className="w-4 h-4 text-[hsl(var(--text-muted))] mx-auto mb-1.5" />
        <p className="text-[11px] font-medium text-[hsl(var(--text-heading))]">Keine Neukunden</p>
        <p className="text-[9px] text-[hsl(var(--text-muted))] mt-0.5">
          Keine Kunden seit dem 22.05.2026 erfasst
        </p>
      </div>
    );
  }

  return (
    <div>
      <div className="flex items-center gap-2 mb-2">
        <Calendar className="w-3.5 h-3.5 text-[hsl(var(--primary))]" />
        <h3 className="text-sm font-bold text-[hsl(var(--primary))]">Neukunden</h3>
        <span className="text-[9px] font-medium text-[hsl(var(--text-muted))] bg-[hsl(var(--surface-2))] px-1.5 py-0.5 rounded-full">
          {filteredCustomers.length} seit 22.05.
        </span>
      </div>

      <div className="bg-white/80 backdrop-blur-sm rounded-lg p-3 border border-[hsl(var(--border-subtle))]/40">
        <div className="space-y-1">
          {displayCustomers.map(customer => (
            <NewCustomerCard
              key={customer.id}
              customer={customer}
              onClick={() => navigate(`/kunden/${customer.id}/360`)}
            />
          ))}
        </div>

        {hasMore && (
          <Dialog open={showAll} onOpenChange={setShowAll}>
            <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle>Alle Neukunden ({filteredCustomers.length})</DialogTitle>
              </DialogHeader>
              <div className="space-y-1 mt-4">
                {filteredCustomers.map(customer => (
                  <NewCustomerCard
                    key={customer.id}
                    customer={customer}
                    onClick={() => { setShowAll(false); navigate(`/kunden/${customer.id}/360`); }}
                  />
                ))}
              </div>
            </DialogContent>
          </Dialog>
        )}

        {hasMore && (
          <button
            onClick={() => setShowAll(true)}
            className="mt-2 text-[10px] font-medium text-[hsl(var(--primary))] hover:text-[hsl(var(--primary))]/80 w-full text-center py-1.5"
          >
            Alle {filteredCustomers.length} anzeigen →
          </button>
        )}
      </div>
    </div>
  );
}