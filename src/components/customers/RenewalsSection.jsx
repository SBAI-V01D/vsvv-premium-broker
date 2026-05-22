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
      upcoming30to90: [],
      highPremium: [],
      noOffer: [],
      open: [],
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

      // Kritisch (<30 Tage)
      if ((endDays !== null && endDays >= 0 && endDays <= 30) || 
          (cancelDays !== null && cancelDays >= 0 && cancelDays <= 30)) {
        result.critical.push(item);
      }
      
      // 30-90 Tage
      if ((endDays !== null && endDays > 30 && endDays <= 90) || 
          (cancelDays !== null && cancelDays > 30 && cancelDays <= 90)) {
        result.upcoming30to90.push(item);
      }
      
      // Hohe Prämie (>10'000 CHF)
      if (premium >= 10000) {
        result.highPremium.push(item);
      }
      
      // Ohne Folgeangebot
      if (!vs && ((endDays !== null && endDays >= 0 && endDays <= 180) || 
                  (cancelDays !== null && cancelDays >= 0 && cancelDays <= 180))) {
        result.noOffer.push(item);
      }
      
      // Renewal offen
      if (contract.renewal_status === 'none' || contract.renewal_status === 'notified') {
        result.open.push(item);
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
      <div key={item.contract.id} className="bg-white/80 backdrop-blur-sm rounded-xl p-4 border border-[hsl(var(--border-subtle))]/40 hover:border-[hsl(var(--border-default))]/60 transition-all">
        <div className="flex items-start gap-3 mb-3">
          <div className={cn(
            "w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0",
            isUrgent ? "bg-[hsl(var(--critical-hsl))/0.1]" : "bg-[hsl(var(--primary))/0.1]"
          )}>
            <RefreshCw className={cn(
              "w-4 h-4",
              isUrgent ? "text-[hsl(var(--critical-hsl))]" : "text-[hsl(var(--primary))]"
            )} />
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2 mb-1">
              <h4 className="text-sm font-semibold text-[hsl(var(--text-heading))] truncate">
                {item.customer?.company_name || `${item.customer?.first_name || ''} ${item.customer?.last_name || ''}`}
              </h4>
              {isUrgent && (
                <span className="text-[9px] font-bold text-[hsl(var(--critical-hsl))] bg-[hsl(var(--critical-hsl))/0.1] px-2 py-0.5 rounded-full whitespace-nowrap">
                  KRITISCH
                </span>
              )}
            </div>
            <p className="text-xs text-[hsl(var(--text-muted))]">
              {item.contract.insurer} · {item.contract.product || item.contract.insurance_type}
            </p>
          </div>
          <div className="text-right flex-shrink-0">
            <p className="text-xs font-semibold text-[hsl(var(--text-heading))]">
              {item.premium.toLocaleString('de-CH')} CHF
            </p>
            <p className="text-[10px] text-[hsl(var(--text-muted))]">Jahr</p>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-2 mb-3">
          <div className="bg-[hsl(var(--surface-2))]/40 rounded-lg p-2">
            <p className="text-[9px] text-[hsl(var(--text-subtle))] uppercase tracking-wide">Enddatum</p>
            <p className="text-xs font-medium text-[hsl(var(--text-heading))]">{item.formattedEndDate}</p>
            {item.endDays !== null && item.endDays >= 0 && (
              <p className={cn(
                "text-[9px] font-medium mt-0.5",
                item.endDays <= 30 ? "text-[hsl(var(--critical-hsl))]" : 
                item.endDays <= 90 ? "text-[hsl(var(--warning-hsl))]" : "text-[hsl(var(--text-muted))]"
              )}>
                in {item.endDays} Tagen
              </p>
            )}
          </div>
          <div className="bg-[hsl(var(--surface-2))]/40 rounded-lg p-2">
            <p className="text-[9px] text-[hsl(var(--text-subtle))] uppercase tracking-wide">Kündigungsfrist</p>
            <p className="text-xs font-medium text-[hsl(var(--text-heading))]">{item.formattedCancelDate}</p>
            {item.cancelDays !== null && item.cancelDays >= 0 && (
              <p className={cn(
                "text-[9px] font-medium mt-0.5",
                item.cancelDays <= 30 ? "text-[hsl(var(--critical-hsl))]" : 
                item.cancelDays <= 90 ? "text-[hsl(var(--warning-hsl))]" : "text-[hsl(var(--text-muted))]"
              )}>
                in {item.cancelDays} Tagen
              </p>
            )}
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Link
            to={`/kunden/${item.customer?.id}`}
            className="flex-1 flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-lg bg-[hsl(var(--primary))/0.1] text-[hsl(var(--primary))] text-xs font-medium hover:bg-[hsl(var(--primary))/0.15] transition-colors"
          >
            <Phone className="w-3 h-3" />
            Kontakt
          </Link>
          {!item.verkaufschance && (
            <Link
              to={`/verkaufschancen?new=true&contract_id=${item.contract.id}`}
              className="flex-1 flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-lg bg-[hsl(var(--success-hsl))/0.1] text-[hsl(var(--success-hsl))] text-xs font-medium hover:bg-[hsl(var(--success-hsl))/0.15] transition-colors"
            >
              <Plus className="w-3 h-3" />
              Renewal
            </Link>
          )}
          {item.verkaufschance && (
            <Link
              to={`/verkaufschancen/${item.verkaufschance.id}`}
              className="flex-1 flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-lg bg-[hsl(var(--surface-2))] text-[hsl(var(--text-heading))] text-xs font-medium hover:bg-[hsl(var(--surface-2))]/70 transition-colors"
            >
              <CheckCircle className="w-3 h-3" />
              Offen
            </Link>
          )}
        </div>
      </div>
    );
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h2 className="text-lg font-bold text-[hsl(var(--text-heading))]">Vertragsabläufe</h2>
        <p className="text-xs text-[hsl(var(--text-muted))] mt-0.5">
          Operative Übersicht anstehender Vertragsverlängerungen
        </p>
      </div>

      {/* Critical (<30 Tage) */}
      <div>
        <div className="flex items-center gap-2 mb-3">
          <AlertTriangle className="w-4 h-4 text-[hsl(var(--critical-hsl))]" />
          <h3 className="text-sm font-semibold text-[hsl(var(--text-heading))]">
            Kritisch (&lt;30 Tage)
          </h3>
          <span className="text-xs font-medium text-[hsl(var(--text-muted))] bg-[hsl(var(--surface-2))] px-2 py-0.5 rounded-full">
            {renewalsData.critical.length}
          </span>
        </div>
        {renewalsData.critical.length === 0 ? (
          <p className="text-xs text-[hsl(var(--text-muted))] bg-[hsl(var(--surface-1))] rounded-lg p-4">
            Keine kritischen Vertragsabläufe
          </p>
        ) : (
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {renewalsData.critical.map(item => renderContractCard(item, true))}
          </div>
        )}
      </div>

      {/* Upcoming 30-90 Tage */}
      <div>
        <div className="flex items-center gap-2 mb-3">
          <Clock className="w-4 h-4 text-[hsl(var(--warning-hsl))]" />
          <h3 className="text-sm font-semibold text-[hsl(var(--text-heading))]">
            30–90 Tage
          </h3>
          <span className="text-xs font-medium text-[hsl(var(--text-muted))] bg-[hsl(var(--surface-2))] px-2 py-0.5 rounded-full">
            {renewalsData.upcoming30to90.length}
          </span>
        </div>
        {renewalsData.upcoming30to90.length === 0 ? (
          <p className="text-xs text-[hsl(var(--text-muted))] bg-[hsl(var(--surface-1))] rounded-lg p-4">
            Keine anstehenden Abläufe
          </p>
        ) : (
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {renewalsData.upcoming30to90.map(item => renderContractCard(item))}
          </div>
        )}
      </div>

      {/* High Premium */}
      <div>
        <div className="flex items-center gap-2 mb-3">
          <TrendingUp className="w-4 h-4 text-[hsl(var(--primary))]" />
          <h3 className="text-sm font-semibold text-[hsl(var(--text-heading))]">
            Hohe Jahresprämie (&gt;10'000 CHF)
          </h3>
          <span className="text-xs font-medium text-[hsl(var(--text-muted))] bg-[hsl(var(--surface-2))] px-2 py-0.5 rounded-full">
            {renewalsData.highPremium.length}
          </span>
        </div>
        {renewalsData.highPremium.length === 0 ? (
          <p className="text-xs text-[hsl(var(--text-muted))] bg-[hsl(var(--surface-1))] rounded-lg p-4">
            Keine High-Premium-Verträge
          </p>
        ) : (
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {renewalsData.highPremium.map(item => renderContractCard(item))}
          </div>
        )}
      </div>
    </div>
  );
}