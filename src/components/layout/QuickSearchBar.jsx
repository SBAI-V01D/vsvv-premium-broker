import React, { useState, useEffect, useRef } from 'react'
import { Search, Users, FileText, Target, X } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { base44 } from '@/api/base44Client'
import { cn } from '@/lib/utils'

/**
 * Global quick search bar — searches customers, contracts, leads.
 * Appears in the desktop topbar area.
 */
export default function QuickSearchBar() {
  const [query, setQuery] = useState('')
  const [results, setResults] = useState([])
  const [open, setOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const navigate = useNavigate()
  const inputRef = useRef(null)
  const containerRef = useRef(null)

  useEffect(() => {
    const handleClickOutside = (e) => {
      if (containerRef.current && !containerRef.current.contains(e.target)) {
        setOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  useEffect(() => {
    if (!query.trim() || query.length < 2) {
      setResults([])
      setOpen(false)
      return
    }
    const timer = setTimeout(async () => {
      setLoading(true)
      try {
        const q = query.toLowerCase()
        const [customers, contracts, leads] = await Promise.all([
          base44.entities.Customer.list(),
          base44.entities.Contract.list(),
          base44.entities.Lead.list(),
        ])

        const customerResults = customers
          .filter(c => `${c.first_name} ${c.last_name} ${c.email} ${c.company_name || ''}`.toLowerCase().includes(q))
          .slice(0, 4)
          .map(c => ({
            id: c.id,
            label: c.company_name || `${c.first_name} ${c.last_name}`,
            sub: c.email,
            icon: Users,
            path: `/kunden/${c.id}`,
            type: 'Kunde',
            color: 'text-blue-600 bg-blue-50',
          }))

        const contractResults = contracts
          .filter(c => `${c.customer_name} ${c.insurer} ${c.policy_number}`.toLowerCase().includes(q))
          .slice(0, 3)
          .map(c => ({
            id: c.id,
            label: `${c.insurer} – ${c.customer_name}`,
            sub: c.policy_number || c.insurance_type,
            icon: FileText,
            path: `/vertraege`,
            type: 'Vertrag',
            color: 'text-emerald-600 bg-emerald-50',
          }))

        const leadResults = leads
          .filter(l => `${l.first_name} ${l.last_name} ${l.email}`.toLowerCase().includes(q))
          .slice(0, 3)
          .map(l => ({
            id: l.id,
            label: `${l.first_name} ${l.last_name}`,
            sub: l.email,
            icon: Target,
            path: `/leads`,
            type: 'Lead',
            color: 'text-violet-600 bg-violet-50',
          }))

        setResults([...customerResults, ...contractResults, ...leadResults])
        setOpen(true)
      } catch {}
      setLoading(false)
    }, 300)
    return () => clearTimeout(timer)
  }, [query])

  const handleSelect = (item) => {
    navigate(item.path)
    setQuery('')
    setOpen(false)
  }

  return (
    <div ref={containerRef} className="relative w-full max-w-sm">
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
        <input
          ref={inputRef}
          value={query}
          onChange={e => setQuery(e.target.value)}
          onFocus={() => query.length >= 2 && setOpen(true)}
          placeholder="Kunden, Verträge, Leads suchen..."
          className="w-full h-8 pl-8 pr-8 rounded-lg bg-muted/60 border border-border text-xs placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary/40 focus:bg-background transition-colors"
        />
        {query && (
          <button onClick={() => { setQuery(''); setOpen(false) }} className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground">
            <X className="w-3 h-3" />
          </button>
        )}
      </div>

      {open && results.length > 0 && (
        <div className="absolute top-full mt-1 left-0 right-0 bg-card border border-border rounded-xl shadow-lg z-50 overflow-hidden">
          {loading && (
            <div className="px-4 py-2 text-xs text-muted-foreground">Suche...</div>
          )}
          {results.map(item => {
            const Icon = item.icon
            return (
              <button
                key={item.id + item.type}
                onClick={() => handleSelect(item)}
                className="w-full flex items-center gap-3 px-4 py-2.5 hover:bg-muted/50 transition-colors text-left"
              >
                <div className={cn('w-6 h-6 rounded-md flex items-center justify-center flex-shrink-0', item.color)}>
                  <Icon className="w-3 h-3" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-semibold truncate">{item.label}</p>
                  {item.sub && <p className="text-[10px] text-muted-foreground truncate">{item.sub}</p>}
                </div>
                <span className={cn('text-[9px] px-1.5 py-0.5 rounded font-semibold flex-shrink-0', item.color)}>{item.type}</span>
              </button>
            )
          })}
        </div>
      )}
      {open && !loading && results.length === 0 && query.length >= 2 && (
        <div className="absolute top-full mt-1 left-0 right-0 bg-card border border-border rounded-xl shadow-lg z-50 px-4 py-3">
          <p className="text-xs text-muted-foreground">Keine Ergebnisse für „{query}"</p>
        </div>
      )}
    </div>
  )
}