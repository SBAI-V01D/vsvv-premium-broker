import React, { useState, useEffect, useRef, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Search, User, Building2, X, FileText, ClipboardList } from 'lucide-react';
import { cn } from '@/lib/utils';

export default function GlobalSearch({ collapsed, light = false }) {
  const navigate = useNavigate();
  const [query, setQuery] = useState('');
  const [open, setOpen] = useState(false);
  const [activeIdx, setActiveIdx] = useState(0);
  const inputRef = useRef(null);
  const dropdownRef = useRef(null);

  const { data: customers = [] } = useQuery({
    queryKey: ['sidebar_customers_slim'],
    queryFn: () => base44.entities.Customer.filter({ archived: false }, 'last_name', 2000),
    staleTime: 5 * 60 * 1000,
    refetchOnWindowFocus: false,
  });

  const { data: contracts = [] } = useQuery({
    queryKey: ['sidebar_contracts_slim'],
    queryFn: () => base44.entities.Contract.filter({ archived: false }, '-created_date', 500),
    staleTime: 5 * 60 * 1000,
    refetchOnWindowFocus: false,
  });

  const { data: applications = [] } = useQuery({
    queryKey: ['sidebar_applications_slim'],
    queryFn: () => base44.entities.Application.filter({ archived: false }, '-created_date', 300),
    staleTime: 5 * 60 * 1000,
    refetchOnWindowFocus: false,
  });

  const { customerResults, contractResults, applicationResults } = useMemo(() => {
    if (!query || query.length < 3) return { customerResults: [], contractResults: [], applicationResults: [] };
    const q = query.toLowerCase();

    const customerResults = customers.filter(c => {
      const fullName = `${c.first_name || ''} ${c.last_name || ''}`.toLowerCase();
      return (
        fullName.includes(q) ||
        (c.company_name || '').toLowerCase().includes(q) ||
        (c.email || '').toLowerCase().startsWith(q) ||
        ((c.phone || '') + (c.mobile || '')).replace(/\s/g, '').includes(q) ||
        (c.customer_number || '').toLowerCase().startsWith(q)
      );
    }).sort((a, b) => {
      const aFullName = `${a.first_name || ''} ${a.last_name || ''}`.toLowerCase();
      const bFullName = `${b.first_name || ''} ${b.last_name || ''}`.toLowerCase();
      const aCompanyName = (a.company_name || '').toLowerCase();
      const bCompanyName = (b.company_name || '').toLowerCase();
      const aStartsWith = aFullName.startsWith(q) || aCompanyName.startsWith(q) || (a.first_name || '').toLowerCase().startsWith(q);
      const bStartsWith = bFullName.startsWith(q) || bCompanyName.startsWith(q) || (b.first_name || '').toLowerCase().startsWith(q);
      if (aStartsWith && !bStartsWith) return -1;
      if (!aStartsWith && bStartsWith) return 1;
      return aFullName.indexOf(q) - bFullName.indexOf(q);
    });

    const contractResults = contracts.filter(c =>
      (c.customer_name || '').toLowerCase().includes(q) ||
      (c.insurer || '').toLowerCase().includes(q) ||
      (c.policy_number || '').toLowerCase().includes(q) ||
      (c.product || '').toLowerCase().includes(q)
    ).sort((a, b) => {
      const aName = (a.customer_name || '').toLowerCase();
      const bName = (b.customer_name || '').toLowerCase();
      return aName.indexOf(q) - bName.indexOf(q);
    });

    const applicationResults = applications.filter(a =>
      (a.customer_name || '').toLowerCase().includes(q) ||
      (a.insurer || '').toLowerCase().includes(q) ||
      (a.product || '').toLowerCase().includes(q)
    ).sort((a, b) => {
      const aName = (a.customer_name || '').toLowerCase();
      const bName = (b.customer_name || '').toLowerCase();
      return aName.indexOf(q) - bName.indexOf(q);
    });

    return { customerResults, contractResults, applicationResults };
  }, [query, customers, contracts, applications]);

  const privateCustomers = customerResults.filter(c => c.customer_type !== 'business');
  const businessCustomers = customerResults.filter(c => c.customer_type === 'business');
  const flatResults = [...privateCustomers, ...businessCustomers, ...contractResults, ...applicationResults];
  const hasResults = privateCustomers.length > 0 || businessCustomers.length > 0 || contractResults.length > 0 || applicationResults.length > 0;

  useEffect(() => { setActiveIdx(0); }, [flatResults]);

  useEffect(() => {
    const handler = (e) => {
      if (!dropdownRef.current?.contains(e.target) && !inputRef.current?.contains(e.target)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  useEffect(() => {
    const handler = (e) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        inputRef.current?.focus();
        setOpen(true);
      }
    };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, []);

  const goTo = (item, type = 'customer') => {
    if (type === 'contract') navigate(`/kunden/${item.customer_id}`);
    else if (type === 'application') navigate(`/antraege`);
    else navigate(`/kunden/${item.id}`);
    setQuery('');
    setOpen(false);
    inputRef.current?.blur();
  };

  const handleKeyDown = (e) => {
    if (!open || flatResults.length === 0) return;
    if (e.key === 'ArrowDown') { e.preventDefault(); setActiveIdx(i => Math.min(i + 1, flatResults.length - 1)); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); setActiveIdx(i => Math.max(i - 1, 0)); }
    else if (e.key === 'Enter') { e.preventDefault(); if (flatResults[activeIdx]) goTo(flatResults[activeIdx]); }
    else if (e.key === 'Escape') { setOpen(false); setQuery(''); inputRef.current?.blur(); }
  };

  if (collapsed) return null;

  const getCustomerLabel = (c) => {
    if (c.customer_type === 'business') return c.company_name || `${c.first_name} ${c.last_name}`;
    return `${c.first_name || ''} ${c.last_name || ''}`.trim();
  };

  const getCustomerSub = (c) => {
    if (c.customer_type === 'business') {
      const contact = [c.contact_person_firstname, c.contact_person_lastname].filter(Boolean).join(' ');
      return contact || c.email || '';
    }
    return c.email || c.phone || '';
  };

  const showDropdown = open && query.length >= 3 && hasResults !== undefined;

  return (
    <div className={cn('relative', light ? '' : 'px-3 py-2')} ref={dropdownRef}>
      <div className={cn(
        'flex items-center gap-2 rounded-xl px-3 py-2 transition-all',
        light
          ? cn('bg-white border border-border shadow-xs', open ? 'border-primary/50 ring-2 ring-primary/10' : '')
          : cn('bg-[hsl(220,30%,14%)] border border-[hsl(220,25%,24%)]', open ? 'border-[hsl(var(--primary))/0.5] bg-[hsl(220,30%,16%)]' : '')
      )}>
        <Search className={cn('w-3.5 h-3.5 flex-shrink-0', light ? 'text-muted-foreground' : 'text-[hsl(var(--sidebar-item-icon))]')} />
        <input
          ref={inputRef}
          value={query}
          onChange={e => { setQuery(e.target.value); setOpen(true); }}
          onFocus={() => { setOpen(true); inputRef.current?.select(); }}
          onKeyDown={handleKeyDown}
          placeholder="Kunde suchen… (z.B. 'Adam')"
          className={cn(
            'flex-1 bg-transparent text-[12px] outline-none min-w-0',
            light
              ? 'text-foreground placeholder:text-muted-foreground'
              : 'text-[hsl(var(--sidebar-item-fg-active))] placeholder:text-[hsl(var(--sidebar-item-icon))]'
          )}
        />
        {query && (
          <button
            onClick={() => { setQuery(''); setOpen(false); }}
            className={cn('transition-colors', light ? 'text-muted-foreground hover:text-foreground' : 'text-[hsl(var(--sidebar-item-icon))] hover:text-white')}
          >
            <X className="w-3 h-3" />
          </button>
        )}
      </div>

      {showDropdown && (
        <div
          className="absolute top-full mt-1 z-[200] rounded-xl overflow-hidden"
          style={{
            left: 0,
            right: 0,
            background: light ? 'white' : 'hsl(220,36%,17%)',
            border: light ? '1px solid hsl(var(--border))' : '1px solid rgba(255,255,255,0.08)',
            boxShadow: light
              ? '0 8px 24px -4px rgba(59,130,246,0.14), 0 2px 8px -2px rgba(0,0,0,0.06)'
              : '0 8px 32px -4px rgba(0,0,0,0.4)',
          }}
        >
          {!hasResults ? (
            <div className={cn('px-4 py-3 text-[11px]', light ? 'text-muted-foreground' : 'text-[hsl(var(--sidebar-item-icon))]')}>
              Keine Ergebnisse
            </div>
          ) : (
            <div className="py-1 max-h-80 overflow-y-auto scrollbar-none">
              {privateCustomers.length > 0 && (
                <>
                  <p className={cn('px-3 pt-2 pb-1 text-[9px] font-bold uppercase tracking-widest', light ? 'text-muted-foreground' : 'text-[hsl(var(--sidebar-label))]')}>Privatkunden</p>
                  {privateCustomers.map(c => (
                    <button key={c.id} onMouseEnter={() => setActiveIdx(flatResults.indexOf(c))} onMouseDown={() => goTo(c, 'customer')}
                      className={cn('w-full flex items-center gap-2.5 px-3 py-2 text-left transition-colors', activeIdx === flatResults.indexOf(c) ? (light ? 'bg-blue-50' : 'bg-[hsl(220,30%,22%)]') : (light ? 'hover:bg-blue-50/60' : 'hover:bg-[hsl(220,30%,22%)]'))}>
                      <div className={cn('w-6 h-6 rounded-lg flex items-center justify-center flex-shrink-0', light ? 'bg-blue-50' : 'bg-blue-500/20')}>
                        <User className={cn('w-3 h-3', light ? 'text-blue-500' : 'text-blue-400')} />
                      </div>
                      <div className="min-w-0">
                        <p className={cn('text-[12px] font-medium truncate', light ? 'text-foreground' : 'text-white')}>{getCustomerLabel(c)}</p>
                        {getCustomerSub(c) && <p className={cn('text-[10px] truncate', light ? 'text-muted-foreground' : 'text-[hsl(var(--sidebar-item-icon))]')}>{getCustomerSub(c)}</p>}
                      </div>
                    </button>
                  ))}
                </>
              )}
              {businessCustomers.length > 0 && (
                <>
                  <p className={cn('px-3 pt-2 pb-1 text-[9px] font-bold uppercase tracking-widest', light ? 'text-muted-foreground' : 'text-[hsl(var(--sidebar-label))]')}>Unternehmen</p>
                  {businessCustomers.map(c => (
                    <button key={c.id} onMouseEnter={() => setActiveIdx(flatResults.indexOf(c))} onMouseDown={() => goTo(c, 'customer')}
                      className={cn('w-full flex items-center gap-2.5 px-3 py-2 text-left transition-colors', activeIdx === flatResults.indexOf(c) ? (light ? 'bg-violet-50' : 'bg-[hsl(220,30%,22%)]') : (light ? 'hover:bg-violet-50/60' : 'hover:bg-[hsl(220,30%,22%)]'))}>
                      <div className={cn('w-6 h-6 rounded-lg flex items-center justify-center flex-shrink-0', light ? 'bg-violet-50' : 'bg-violet-500/20')}>
                        <Building2 className={cn('w-3 h-3', light ? 'text-violet-500' : 'text-violet-400')} />
                      </div>
                      <div className="min-w-0">
                        <p className={cn('text-[12px] font-medium truncate', light ? 'text-foreground' : 'text-white')}>{getCustomerLabel(c)}</p>
                        {getCustomerSub(c) && <p className={cn('text-[10px] truncate', light ? 'text-muted-foreground' : 'text-[hsl(var(--sidebar-item-icon))]')}>{getCustomerSub(c)}</p>}
                      </div>
                    </button>
                  ))}
                </>
              )}
              {contractResults.length > 0 && (
                <>
                  <p className={cn('px-3 pt-2 pb-1 text-[9px] font-bold uppercase tracking-widest border-t mt-1', light ? 'text-muted-foreground border-border' : 'text-[hsl(var(--sidebar-label))] border-white/10')}>Verträge</p>
                  {contractResults.map(c => (
                    <button key={c.id} onMouseDown={() => goTo(c, 'contract')}
                      className={cn('w-full flex items-center gap-2.5 px-3 py-2 text-left transition-colors', light ? 'hover:bg-emerald-50/60' : 'hover:bg-[hsl(220,30%,22%)]')}>
                      <div className={cn('w-6 h-6 rounded-lg flex items-center justify-center flex-shrink-0', light ? 'bg-emerald-50' : 'bg-emerald-500/20')}>
                        <FileText className={cn('w-3 h-3', light ? 'text-emerald-600' : 'text-emerald-400')} />
                      </div>
                      <div className="min-w-0">
                        <p className={cn('text-[12px] font-medium truncate', light ? 'text-foreground' : 'text-white')}>{c.customer_name} · {c.insurer}</p>
                        <p className={cn('text-[10px] truncate', light ? 'text-muted-foreground' : 'text-[hsl(var(--sidebar-item-icon))]')}>{c.policy_number || c.product || 'Vertrag'}</p>
                      </div>
                    </button>
                  ))}
                </>
              )}
              {applicationResults.length > 0 && (
                <>
                  <p className={cn('px-3 pt-2 pb-1 text-[9px] font-bold uppercase tracking-widest border-t mt-1', light ? 'text-muted-foreground border-border' : 'text-[hsl(var(--sidebar-label))] border-white/10')}>Anträge</p>
                  {applicationResults.map(a => (
                    <button key={a.id} onMouseDown={() => goTo(a, 'application')}
                      className={cn('w-full flex items-center gap-2.5 px-3 py-2 text-left transition-colors', light ? 'hover:bg-amber-50/60' : 'hover:bg-[hsl(220,30%,22%)]')}>
                      <div className={cn('w-6 h-6 rounded-lg flex items-center justify-center flex-shrink-0', light ? 'bg-amber-50' : 'bg-amber-500/20')}>
                        <ClipboardList className={cn('w-3 h-3', light ? 'text-amber-600' : 'text-amber-400')} />
                      </div>
                      <div className="min-w-0">
                        <p className={cn('text-[12px] font-medium truncate', light ? 'text-foreground' : 'text-white')}>{a.customer_name} · {a.insurer}</p>
                        <p className={cn('text-[10px] truncate', light ? 'text-muted-foreground' : 'text-[hsl(var(--sidebar-item-icon))]')}>{a.product || 'Antrag'}</p>
                      </div>
                    </button>
                  ))}
                </>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}