import React, { useMemo } from 'react';
import { Link } from 'react-router-dom';
import { RefreshCw, AlertTriangle, TrendingUp, Clock, CheckCircle, Phone, Mail, Plus } from 'lucide-react';
import { cn } from '@/lib/utils';

const MONTHS_DE = [
  'Januar', 'Februar', 'März', 'April', 'Mai', 'Juni',
  'Juli', 'August', 'September', 'Oktober', 'November', 'Dezember'
];

function formatDateCH(dateString) {
  if (!dateString) return '-';
  const date = new Date(dateString);
  const day = String(date.getDate()).padStart(2, '0');
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const year = date.getFullYear();
  return `${day}.${month}.${year}`;
}

function getDaysUntil(dateString) {
  if (!dateString) return null;
  const today = new Date();
  const targetDate = new Date(dateString);
  const diffTime = targetDate - today;
  return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
}

export default function RenewalsSection({ contracts, customers, verkaufschancen }) {
  const renewalsData = useMemo(() => {
    const today = new Date();
    
    const result = {
      critical: [],
      upcoming90to365: [],
    };

    contracts.forEach(contract => {
      if (['cancelled', 'archived', 'expired'].includes(contract.status)) return;
      
      const customer = customers.find(c => c.id === contract.customer_id);
      const vs = verkaufschancen.find(v => v.linked_contract_id === contract.id);
      
      const endDays = getDaysUntil(contract.end_date);
      const cancelDays = getDaysUntil(contract.cancellation_deadline);
      const premium = contract.premium_yearly || contract.premium_monthly * 12 || 0;
      
      const item = {
        contract,
        customer,
        verkaufschance: vs,
        endDays,
        cancelDays,
        premium,
        formattedEndDate: formatDateCH(contract.end_date),
        formattedCancelDate: formatDateCH(contract.cancellation_deadline),
      };

      // Kritisch (<90 Tage)
      if ((endDays !== null && endDays >= 0 && endDays <= 90) || 
          (cancelDays !== null && cancelDays >= 0 && cancelDays <= 90)) {
        result.critical.push(item);
      }
      
      // 90-365 Tage
      if ((endDays !== null && endDays > 90 && endDays <= 365) || 
          (cancelDays !== null && cancelDays > 90 && cancelDays <= 365)) {
        result.upcoming90to365.push(item);
      }
    });

    // Sortieren
    Object.keys(result).forEach(key => {
      result[key].sort((a, b) => {
        const daysA = Math.min(a.endDays || 9999, a.cancelDays || 9999);
        const daysB = Math.min(b.endDays || 9999, b.cancelDays || 9999);
        return daysA - daysB;
      });
    });

    return result;
  }, [contracts, customers, verkaufschancen]);

  const renderContractCard = (item, showUrgency = false) => {
    const urgency = Math.min(item.endDays || 9999, item.cancelDays || 9999);
    const isUrgent = urgency !== null && urgency <= 30;
    
    return (
      <div key={item.contract.id} className="bg-white/80 backdrop-blur-sm rounded-lg p-3 border border-[hsl(var(--border-subtle))]/40 hover:border-[hsl(var(--border-default))]/60 transition-all">
        <div className="flex items-start gap-2 mb-2">
          <div className={cn(
            "w-8 h-8 rounded-md flex items-center justify-center flex-shrink-0",
            isUrgent ? "bg-[hsl(var(--critical-hsl))/0.1]" : "bg-[hsl(var(--primary))/0.1]"
          )}>
            <RefreshCw className={cn(
              "w-3 h-3",
              isUrgent ? "text-[hsl(var(--critical-hsl))]" : "text-[hsl(var(--primary))]"
            )} />
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-1.5 mb-0.5">
              <h4 className="text-[11px] font-semibold text-[hsl(var(--text-heading))] truncate">
                {item.customer?.company_name || `${item.customer?.first_name || ''} ${item.customer?.last_name || ''}`}
              </h4>
              {isUrgent && (
                <span className="text-[8px] font-bold text-[hsl(var(--critical-hsl))] bg-[hsl(var(--critical-hsl))/0.1] px-1.5 py-0.5 rounded-full whitespace-nowrap">
                  KRITISCH
                </span>
              )}
            </div>
            <p className="text-[9px] text-[hsl(var(--text-muted))]">
              {item.contract.insurer} · {item.contract.product || item.contract.insurance_type}
            </p>
          </div>
          <div className="text-right flex-shrink-0">
            <p className="text-[10px] font-semibold text-[hsl(var(--text-heading))]">
              {(item.premium || 0).toLocaleString('de-CH')} CHF
            </p>
            <p className="text-[8px] text-[hsl(var(--text-muted))]">Jahr</p>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-1.5 mb-2">
          <div className="bg-[hsl(var(--surface-2))]/40 rounded-md p-1.5">
            <p className="text-[8px] text-[hsl(var(--text-subtle))] uppercase tracking-wide">Enddatum</p>
            <p className="text-[10px] font-medium text-[hsl(var(--text-heading))]">{item.formattedEndDate}</p>
            {item.endDays !== null && item.endDays >= 0 && (
              <p className={cn(
                "text-[8px] font-medium mt-0.5",
                item.endDays <= 30 ? "text-[hsl(var(--critical-hsl))]" : 
                item.endDays <= 90 ? "text-[hsl(var(--warning-hsl))]" : "text-[hsl(var(--text-muted))]"
              )}>
                in {item.endDays} T.
              </p>
            )}
          </div>
          <div className="bg-[hsl(var(--surface-2))]/40 rounded-md p-1.5">
            <p className="text-[8px] text-[hsl(var(--text-subtle))] uppercase tracking-wide">Kündigungsfrist</p>
            <p className="text-[10px] font-medium text-[hsl(var(--text-heading))]">{item.formattedCancelDate}</p>
            {item.cancelDays !== null && item.cancelDays >= 0 && (
              <p className={cn(
                "text-[8px] font-medium mt-0.5",
                item.cancelDays <= 30 ? "text-[hsl(var(--critical-hsl))]" : 
                item.cancelDays <= 90 ? "text-[hsl(var(--warning-hsl))]" : "text-[hsl(var(--text-muted))]"
              )}>
                in {item.cancelDays} T.
              </p>
            )}
          </div>
        </div>

        <div className="flex items-center gap-1.5">
          <Link
            to={`/kunden/${item.customer?.id}`}
            className="flex-1 flex items-center justify-center gap-1 px-2 py-1.5 rounded-md bg-[hsl(var(--primary))/0.1] text-[hsl(var(--primary))] text-[10px] font-medium hover:bg-[hsl(var(--primary))/0.15] transition-colors"
          >
            <Phone className="w-2.5 h-2.5" />
            Kontakt
          </Link>
          {!item.verkaufschance && (
            <Link
              to={`/verkaufschancen?new=true&contract_id=${item.contract.id}`}
              className="flex-1 flex items-center justify-center gap-1 px-2 py-1.5 rounded-md bg-[hsl(var(--success-hsl))/0.1] text-[hsl(var(--success-hsl))] text-[10px] font-medium hover:bg-[hsl(var(--success-hsl))/0.15] transition-colors"
            >
              <Plus className="w-2.5 h-2.5" />
              Renewal
            </Link>
          )}
          {item.verkaufschance && (
            <Link
              to={`/verkaufschancen/${item.verkaufschance.id}`}
              className="flex-1 flex items-center justify-center gap-1 px-2 py-1.5 rounded-md bg-[hsl(var(--surface-2))] text-[hsl(var(--text-heading))] text-[10px] font-medium hover:bg-[hsl(var(--surface-2))]/70 transition-colors"
            >
              <CheckCircle className="w-2.5 h-2.5" />
              Offen
            </Link>
          )}
        </div>
      </div>
    );
  };

  return (
    <div className="space-y-4">
      {/* Header */}
      <div>
        <h2 className="text-sm font-bold text-[hsl(var(--primary))]">Vertragsabläufe</h2>
        <p className="text-[9px] text-[hsl(var(--text-muted))] mt-0.5">
          Fristen bis 365 Tage
        </p>
      </div>

      {/* Critical (<90 Tage) */}
      <div>
        <div className="flex items-center gap-2 mb-2">
          <AlertTriangle className="w-3.5 h-3.5 text-[hsl(var(--critical-hsl))]" />
          <h3 className="text-[11px] font-semibold text-[hsl(var(--text-heading))]">
            Kritisch (&lt;90 Tage)
          </h3>
          <span className="text-[9px] font-medium text-[hsl(var(--text-muted))] bg-[hsl(var(--surface-2))] px-1.5 py-0.5 rounded-full">
            {renewalsData.critical.length}
          </span>
        </div>
        {renewalsData.critical.length === 0 ? (
          <p className="text-[9px] text-[hsl(var(--text-muted))] bg-[hsl(var(--surface-1))] rounded-lg p-3">
            Keine kritischen Vertragsabläufe
          </p>
        ) : (
          <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
            {renewalsData.critical.map(item => renderContractCard(item, true))}
          </div>
        )}
      </div>

      {/* Upcoming 90-365 Tage */}
      <div>
        <div className="flex items-center gap-2 mb-2">
          <Clock className="w-3.5 h-3.5 text-[hsl(var(--warning-hsl))]" />
          <h3 className="text-[11px] font-semibold text-[hsl(var(--text-heading))]">
            90–365 Tage
          </h3>
          <span className="text-[9px] font-medium text-[hsl(var(--text-muted))] bg-[hsl(var(--surface-2))] px-1.5 py-0.5 rounded-full">
            {renewalsData.upcoming90to365.length}
          </span>
        </div>
        {renewalsData.upcoming90to365.length === 0 ? (
          <p className="text-[9px] text-[hsl(var(--text-muted))] bg-[hsl(var(--surface-1))] rounded-lg p-3">
            Keine anstehenden Abläufe
          </p>
        ) : (
          <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
            {renewalsData.upcoming90to365.map(item => renderContractCard(item))}
          </div>
        )}
      </div>
    </div>
  );
}