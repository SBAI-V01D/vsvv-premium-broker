import React, { useState, useEffect, useRef, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Search, User, Building2, X } from 'lucide-react';
import { cn } from '@/lib/utils';

function useDebounce(value, delay) {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(t);
  }, [value, delay]);
  return debounced;
}

export default function GlobalSearch({ collapsed }) {
  const navigate = useNavigate();
  const [query, setQuery] = useState('');
  const [open, setOpen] = useState(false);
  const [activeIdx, setActiveIdx] = useState(0);
  const inputRef = useRef(null);
  const dropdownRef = useRef(null);
  const debouncedQuery = useDebounce(query, 300);

  const { data: customers = [] } = useQuery({
    queryKey: ['sidebar_customers_slim'],
    queryFn: () => base44.entities.Customer.filter({ archived: false }, 'last_name', 500),
    staleTime: 5 * 60 * 1000,
    refetchOnWindowFocus: false,
  });

  const results = useMemo(() => {
    if (!debouncedQuery || debouncedQuery.length < 3) return [];
    const q = debouncedQuery.toLowerCase();
    return customers
      .filter(c => {
        const fullName = `${c.first_name || ''} ${c.last_name || ''}`.toLowerCase();
        const company = (c.company_name || '').toLowerCase();
        const email = (c.email || '').toLowerCase();
        const phone = (c.phone || '') + (c.mobile || '');
        const num = (c.customer_number || '').toLowerCase();
        return (
          fullName.includes(q) ||
          company.includes(q) ||
          email.includes(q) ||
          phone.includes(q) ||
          num.includes(q)
        );
      })
      .slice(0, 12);
  }, [debouncedQuery, customers]);

  const privateCustomers = results.filter(c => c.customer_type !== 'business');
  const businessCustomers = results.filter(c => c.customer_type === 'business');
  const flatResults = [...privateCustomers, ...businessCustomers];

  useEffect(() => { setActiveIdx(0); }, [results]);

  // Close on outside click
  useEffect(() => {
    const handler = (e) => {
      if (!dropdownRef.current?.contains(e.target) && !inputRef.current?.contains(e.target)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  // Cmd+K / Ctrl+K
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

  const goTo = (customer) => {
    navigate(`/kunden/${customer.id}/360`);
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

  const showDropdown = open && debouncedQuery.length >= 2;

  return (
    <div className="px-3 py-2 relative" ref={dropdownRef}>
      <div className={cn(
        'flex items-center gap-2 rounded-xl px-3 py-2 transition-all',
        'bg-[hsl(220,30%,14%)] border border-[hsl(220,25%,24%)]',
        open && 'border-[hsl(var(--primary))/0.5] bg-[hsl(220,30%,16%)]'
      )}>
        <Search className="w-3.5 h-3.5 text-[hsl(var(--sidebar-item-icon))] flex-shrink-0" />
        <input
          ref={inputRef}
          value={query}
          onChange={e => { setQuery(e.target.value); setOpen(true); }}
          onFocus={() => setOpen(true)}
          onKeyDown={handleKeyDown}
          placeholder="Suchen… (⌘K)"
          className="flex-1 bg-transparent text-[12px] text-[hsl(var(--sidebar-item-fg-active))] placeholder:text-[hsl(var(--sidebar-item-icon))] outline-none min-w-0"
        />
        {query && (
          <button onClick={() => { setQuery(''); setOpen(false); }} className="text-[hsl(var(--sidebar-item-icon))] hover:text-white transition-colors">
            <X className="w-3 h-3" />
          </button>
        )}
      </div>

      {showDropdown && (
        <div className="absolute left-3 right-3 top-full mt-1 z-[200] rounded-xl overflow-hidden shadow-overlay"
          style={{ background: 'hsl(220,36%,17%)', border: '1px solid rgba(255,255,255,0.08)' }}>

          {flatResults.length === 0 ? (
            <div className="px-4 py-3 text-[11px] text-[hsl(var(--sidebar-item-icon))]">Keine Ergebnisse</div>
          ) : (
            <div className="py-1 max-h-72 overflow-y-auto scrollbar-none">
              {privateCustomers.length > 0 && (
                <>
                  <p className="px-3 pt-2 pb-1 text-[9px] font-bold uppercase tracking-widest text-[hsl(var(--sidebar-label))]">Privatkunden</p>
                  {privateCustomers.map(c => {
                    const idx = flatResults.indexOf(c);
                    return (
                      <button
                        key={c.id}
                        onMouseEnter={() => setActiveIdx(idx)}
                        onMouseDown={() => goTo(c)}
                        className={cn(
                          'w-full flex items-center gap-2.5 px-3 py-2 text-left transition-colors',
                          activeIdx === idx ? 'bg-[hsl(var(--primary))/0.2]' : 'hover:bg-[hsl(220,30%,22%)]'
                        )}
                      >
                        <div className="w-6 h-6 rounded-lg bg-blue-500/20 flex items-center justify-center flex-shrink-0">
                          <User className="w-3 h-3 text-blue-400" />
                        </div>
                        <div className="min-w-0">
                          <p className="text-[12px] font-medium text-white truncate">{getCustomerLabel(c)}</p>
                          {getCustomerSub(c) && <p className="text-[10px] text-[hsl(var(--sidebar-item-icon))] truncate">{getCustomerSub(c)}</p>}
                        </div>
                      </button>
                    );
                  })}
                </>
              )}

              {businessCustomers.length > 0 && (
                <>
                  <p className="px-3 pt-2 pb-1 text-[9px] font-bold uppercase tracking-widest text-[hsl(var(--sidebar-label))]">Unternehmen</p>
                  {businessCustomers.map(c => {
                    const idx = flatResults.indexOf(c);
                    return (
                      <button
                        key={c.id}
                        onMouseEnter={() => setActiveIdx(idx)}
                        onMouseDown={() => goTo(c)}
                        className={cn(
                          'w-full flex items-center gap-2.5 px-3 py-2 text-left transition-colors',
                          activeIdx === idx ? 'bg-[hsl(var(--primary))/0.2]' : 'hover:bg-[hsl(220,30%,22%)]'
                        )}
                      >
                        <div className="w-6 h-6 rounded-lg bg-violet-500/20 flex items-center justify-center flex-shrink-0">
                          <Building2 className="w-3 h-3 text-violet-400" />
                        </div>
                        <div className="min-w-0">
                          <p className="text-[12px] font-medium text-white truncate">{getCustomerLabel(c)}</p>
                          {getCustomerSub(c) && <p className="text-[10px] text-[hsl(var(--sidebar-item-icon))] truncate">{getCustomerSub(c)}</p>}
                        </div>
                      </button>
                    );
                  })}
                </>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}