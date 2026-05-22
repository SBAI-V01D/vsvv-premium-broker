import React, { useMemo } from 'react';
import { Link } from 'react-router-dom';
import { AlertTriangle, Shield, TrendingDown, Calendar, Phone, Mail, FileText } from 'lucide-react';
import { cn } from '@/lib/utils';

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

export default function CancellationsSection({ contracts, customers }) {
  const cancellationsData = useMemo(() => {
    const result = {
      open: [],
      deadline: [],
      atRisk: [],
      cancelled: [],
    };

    contracts.forEach(contract => {
      if (['archived', 'expired'].includes(contract.status)) return;
      
      const customer = customers.find(c => c.id === contract.customer_id);
      const premium = contract.premium_yearly || contract.premium_monthly * 12 || 0;
      const cancelDays = getDaysUntil(contract.cancellation_deadline);
      
      const item = {
        contract,
        customer,
        premium,
        cancelDays,
        formattedCancelDate: formatDateCH(contract.cancellation_deadline),
      };

      // Offene Kündigungen (status = cancelled aber noch aktiv)
      if (contract.status === 'cancelled') {
        result.cancelled.push(item);
      }
      
      // Kündigungsfristen (<90 Tage)
      if (cancelDays !== null && cancelDays >= 0 && cancelDays <= 90 && contract.status !== 'cancelled') {
        result.deadline.push(item);
      }
      
      // Gefährdete Kunden (Storno-Risiko)
      // Kriterien: Premium > 5000, keine Renewal-Aktivität, end_date < 180 Tage
      const endDays = getDaysUntil(contract.end_date);
      const isHighValue = premium >= 5000;
      const noRenewalActivity = !contract.renewal_status || contract.renewal_status === 'none';
      const approachingEnd = endDays !== null && endDays >= 0 && endDays <= 180;
      
      if (isHighValue && noRenewalActivity && approachingEnd && contract.status !== 'cancelled') {
        result.atRisk.push(item);
      }
    });

    // Sortieren nach Dringlichkeit
    result.deadline.sort((a, b) => a.cancelDays - b.cancelDays);
    result.atRisk.sort((a, b) => b.premium - a.premium);
    result.cancelled.sort((a, b) => a.cancelDays - b.cancelDays);

    return result;
  }, [contracts, customers]);

  const renderContractCard = (item, showRiskLevel = false) => {
    const isHighRisk = item.premium >= 10000;
    const isMediumRisk = item.premium >= 5000;
    
    return (
      <div key={item.contract.id} className="bg-white/80 backdrop-blur-sm rounded-xl p-4 border border-[hsl(var(--border-subtle))]/40 hover:border-[hsl(var(--border-default))]/60 transition-all">
        <div className="flex items-start gap-3 mb-3">
          <div className={cn(
            "w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0",
            item.contract.status === 'cancelled' 
              ? "bg-[hsl(var(--critical-hsl))/0.1]" 
              : "bg-[hsl(var(--warning-hsl))/0.1]"
          )}>
            {item.contract.status === 'cancelled' ? (
              <AlertTriangle className="w-4 h-4 text-[hsl(var(--critical-hsl))]" />
            ) : (
              <Shield className="w-4 h-4 text-[hsl(var(--warning-hsl))]" />
            )}
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2 mb-1">
              <h4 className="text-xs font-semibold text-[hsl(var(--text-heading))] truncate">
                {item.customer?.company_name || `${item.customer?.first_name || ''} ${item.customer?.last_name || ''}`}
              </h4>
              {item.contract.status === 'cancelled' && (
                <span className="text-[9px] font-bold text-[hsl(var(--critical-hsl))] bg-[hsl(var(--critical-hsl))/0.1] px-2 py-0.5 rounded-full whitespace-nowrap">
                  GEKÜNDIGT
                </span>
              )}
              {isHighRisk && item.contract.status !== 'cancelled' && (
                <span className="text-[9px] font-bold text-[hsl(var(--warning-hsl))] bg-[hsl(var(--warning-hsl))/0.1] px-2 py-0.5 rounded-full whitespace-nowrap">
                  RISIKO
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

        {item.contract.cancellation_deadline && (
          <div className="bg-[hsl(var(--surface-2))]/40 rounded-lg p-2 mb-3">
            <div className="flex items-center gap-1.5 mb-1">
              <Calendar className="w-3 h-3 text-[hsl(var(--text-muted))]" />
              <p className="text-[9px] text-[hsl(var(--text-subtle))] uppercase tracking-wide">Kündigungsfrist</p>
            </div>
            <p className="text-xs font-medium text-[hsl(var(--text-heading))]">{item.formattedCancelDate}</p>
            {item.cancelDays !== null && item.cancelDays >= 0 && (
              <p className={cn(
                "text-[9px] font-medium mt-0.5",
                item.cancelDays <= 30 ? "text-[hsl(var(--critical-hsl))]" : 
                item.cancelDays <= 60 ? "text-[hsl(var(--warning-hsl))]" : "text-[hsl(var(--text-muted))]"
              )}>
                in {item.cancelDays} Tagen
              </p>
            )}
          </div>
        )}

        <div className="flex items-center gap-2">
          <Link
            to={`/kunden/${item.customer?.id}`}
            className="flex-1 flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-lg bg-[hsl(var(--primary))/0.1] text-[hsl(var(--primary))] text-xs font-medium hover:bg-[hsl(var(--primary))/0.15] transition-colors"
          >
            <Phone className="w-3 h-3" />
            Kontakt
          </Link>
          <Link
            to={`/kunden/${item.customer?.id}?tab=contracts`}
            className="flex-1 flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-lg bg-[hsl(var(--surface-2))] text-[hsl(var(--text-heading))] text-xs font-medium hover:bg-[hsl(var(--surface-2))]/70 transition-colors"
          >
            <FileText className="w-3 h-3" />
            Details
          </Link>
        </div>
      </div>
    );
  };

  return (
    <div className="space-y-4">
      {/* Header */}
      <div>
        <h2 className="text-sm font-bold text-[hsl(var(--primary))]">Kündigungen</h2>
        <p className="text-[9px] text-[hsl(var(--text-muted))] mt-0.5">
          Operative Übersicht
        </p>
      </div>

      {/* Gekündigte Policen */}
      <div>
        <div className="flex items-center gap-2 mb-2">
          <AlertTriangle className="w-3.5 h-3.5 text-[hsl(var(--critical-hsl))]" />
          <h3 className="text-[11px] font-semibold text-[hsl(var(--text-heading))]">
            Gekündigt
          </h3>
          <span className="text-[9px] font-medium text-[hsl(var(--text-muted))] bg-[hsl(var(--surface-2))] px-1.5 py-0.5 rounded-full">
            {cancellationsData.cancelled.length}
          </span>
        </div>
        {cancellationsData.cancelled.length === 0 ? (
          <p className="text-[9px] text-[hsl(var(--text-muted))] bg-[hsl(var(--surface-1))] rounded-lg p-3">
            Keine gekündigten Policen
          </p>
        ) : (
          <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
            {cancellationsData.cancelled.map(item => renderContractCard(item))}
          </div>
        )}
      </div>

      {/* Kündigungsfristen */}
      <div>
        <div className="flex items-center gap-2 mb-2">
          <Calendar className="w-3.5 h-3.5 text-[hsl(var(--warning-hsl))]" />
          <h3 className="text-[11px] font-semibold text-[hsl(var(--text-heading))]">
            Fristen
          </h3>
          <span className="text-[9px] font-medium text-[hsl(var(--text-muted))] bg-[hsl(var(--surface-2))] px-1.5 py-0.5 rounded-full">
            {cancellationsData.deadline.length}
          </span>
        </div>
        {cancellationsData.deadline.length === 0 ? (
          <p className="text-[9px] text-[hsl(var(--text-muted))] bg-[hsl(var(--surface-1))] rounded-lg p-3">
            Keine anstehenden Fristen
          </p>
        ) : (
          <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
            {cancellationsData.deadline.map(item => renderContractCard(item))}
          </div>
        )}
      </div>
    </div>
  );
}