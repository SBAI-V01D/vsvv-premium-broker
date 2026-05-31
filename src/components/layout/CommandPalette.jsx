import React, { useState, useEffect, useRef, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { base44 } from '@/api/base44Client'
import { Dialog, DialogContent } from '@/components/ui/dialog'
import { Search, ChevronRight } from 'lucide-react'
import { cn } from '@/lib/utils'

const PAGES = [
  { label: 'Dashboard / Cockpit', path: '/', icon: '🏠', desc: 'Operative Übersicht' },
  { label: 'Kundenübersicht', path: '/kunden', icon: '👥', desc: 'Alle Kunden' },
  { label: 'Verträge', path: '/vertraege', icon: '📋', desc: '88 Verträge' },
  { label: 'Anträge', path: '/antraege', icon: '📝', desc: 'Versicherungsanträge' },
  { label: 'Dokumente', path: '/dokumente', icon: '📁', desc: 'KI-Klassifizierung' },
  { label: 'Aufgaben', path: '/aufgaben', icon: '✓', desc: 'Alle Tasks' },
  { label: 'Verkaufschancen', path: '/verkaufschancen', icon: '🎯', desc: 'Pipeline' },
  { label: 'Leads', path: '/leads', icon: '⚡', desc: 'Interessenten' },
  { label: 'Vertragsabläufe', path: '/vertragsablaeufe', icon: '🔄', desc: 'Renewals & Abläufe' },
  { label: 'Beratungsdossiers', path: '/beratungsdossier', icon: '📊', desc: 'KK-Vergleich & Vorsorge' },
  { label: 'Provisionen & Courtagen', path: '/provisionen-courtagen', icon: '💰', desc: 'Finanzübersicht' },
  { label: 'Berater & Organisation', path: '/berater-organisation', icon: '🏢', desc: 'Team' },
  { label: 'Reporting', path: '/reporting', icon: '📈', desc: 'Berater-Performance' },
  { label: 'Dok.-Extraktor', path: '/dokument-extraktor', icon: '🤖', desc: 'KI-Dokumentenanalyse' },
  { label: 'Neukunden', path: '/neukunden', icon: '🆕', desc: 'Neue Kunden verwalten' },
]

export default function CommandPalette({ open, onClose }) {
  const navigate = useNavigate()
  const [query, setQuery] = useState('')
  const [selectedIdx, setSelectedIdx] = useState(0)
  const inputRef = useRef(null)

  const { data: customers = [] } = useQuery({
    queryKey: ['cmd_customers'],
    queryFn: () => base44.entities.Customer.filter({ archived: false }, '-updated_date', 150),
    enabled: open,
    staleTime: 2 * 60 * 1000,
  })

  useEffect(() => {
    if (open) {
      setQuery('')
      setSelectedIdx(0)
      setTimeout(() => inputRef.current?.focus(), 60)
    }
  }, [open])

  const results = useMemo(() => {
    const q = query.toLowerCase().trim()
    const items = []

    if (!q) {
      PAGES.slice(0, 7).forEach(p => items.push({ type: 'page', ...p }))
      return items
    }

    PAGES.filter(p => p.label.toLowerCase().includes(q) || (p.desc || '').toLowerCase().includes(q))
      .forEach(p => items.push({ type: 'page', ...p }))

    customers
      .filter(c => {
        const n = `${c.first_name || ''} ${c.last_name || ''} ${c.company_name || ''} ${c.customer_number || ''} ${c.email || ''}`.toLowerCase()
        return n.includes(q)
      })
      .slice(0, 6)
      .forEach(c => items.push({
        type: 'customer',
        label: c.company_name || `${c.first_name || ''} ${c.last_name || ''}`.trim(),
        desc: c.customer_number ? `#${c.customer_number} · ${c.customer_type === 'business' ? 'Unternehmen' : 'Privatkunde'}` : (c.customer_type === 'business' ? 'Unternehmen' : 'Privatkunde'),
        path: `/kunden/${c.id}/360`,
        icon: c.customer_type === 'business' ? '🏢' : '👤',
      }))

    return items
  }, [query, customers])

  useEffect(() => { setSelectedIdx(0) }, [results])

  const handleSelect = (item) => {
    navigate(item.path)
    onClose()
  }

  const handleKeyDown = (e) => {
    if (e.key === 'ArrowDown') { e.preventDefault(); setSelectedIdx(i => Math.min(i + 1, results.length - 1)) }
    if (e.key === 'ArrowUp') { e.preventDefault(); setSelectedIdx(i => Math.max(i - 1, 0)) }
    if (e.key === 'Enter' && results[selectedIdx]) handleSelect(results[selectedIdx])
    if (e.key === 'Escape') onClose()
  }

  const pageResults = results.filter(r => r.type === 'page')
  const customerResults = results.filter(r => r.type === 'customer')

  const renderItem = (item, i, offset = 0) => (
    <button
      key={`${item.type}-${i}`}
      onClick={() => handleSelect(item)}
      className={cn(
        'w-full flex items-center gap-3 px-4 py-2.5 text-left transition-colors group',
        (i + offset) === selectedIdx
          ? 'bg-primary/8 text-primary'
          : 'hover:bg-slate-50 text-foreground'
      )}
    >
      <span className="text-[18px] w-6 text-center shrink-0">{item.icon}</span>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium truncate">{item.label}</p>
        {item.desc && <p className="text-xs text-muted-foreground truncate">{item.desc}</p>}
      </div>
      <ChevronRight className="w-3.5 h-3.5 text-muted-foreground/40 group-hover:text-muted-foreground transition-colors" />
    </button>
  )

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="p-0 max-w-[560px] overflow-hidden shadow-overlay gap-0">
        {/* Search Input */}
        <div className="flex items-center gap-3 px-4 py-3.5 border-b border-border bg-background">
          <Search className="w-4 h-4 text-muted-foreground shrink-0" />
          <input
            ref={inputRef}
            value={query}
            onChange={e => setQuery(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Suche nach Kunden, Seiten, Aktionen..."
            className="flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground"
          />
          {query && (
            <button onClick={() => setQuery('')} className="text-[10px] text-muted-foreground hover:text-foreground border border-border rounded px-1.5 py-0.5 transition-colors">
              ✕
            </button>
          )}
          <kbd className="text-[10px] text-muted-foreground border border-border rounded px-1.5 py-0.5 bg-muted/50">ESC</kbd>
        </div>

        {/* Results */}
        <div className="max-h-[360px] overflow-y-auto">
          {results.length === 0 && (
            <div className="py-10 text-center text-sm text-muted-foreground">
              <p className="text-2xl mb-2">🔍</p>
              Keine Ergebnisse für «{query}»
            </div>
          )}

          {!query && pageResults.length > 0 && (
            <>
              <div className="px-4 pt-3 pb-1">
                <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">Schnellzugriff</p>
              </div>
              {pageResults.map((item, i) => renderItem(item, i))}
            </>
          )}

          {query && pageResults.length > 0 && (
            <>
              <div className="px-4 pt-3 pb-1">
                <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">Seiten</p>
              </div>
              {pageResults.map((item, i) => renderItem(item, i))}
            </>
          )}

          {query && customerResults.length > 0 && (
            <>
              <div className="px-4 pt-3 pb-1 border-t border-border/50">
                <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">Kunden</p>
              </div>
              {customerResults.map((item, i) => renderItem(item, i, pageResults.length))}
            </>
          )}
        </div>

        {/* Footer hint */}
        <div className="border-t border-border px-4 py-2 flex items-center gap-5 bg-muted/20">
          <span className="text-[10px] text-muted-foreground flex items-center gap-1.5">
            <kbd className="border border-border rounded px-1 bg-white text-[9px]">↑↓</kbd> navigieren
          </span>
          <span className="text-[10px] text-muted-foreground flex items-center gap-1.5">
            <kbd className="border border-border rounded px-1 bg-white text-[9px]">↵</kbd> öffnen
          </span>
          <span className="text-[10px] text-muted-foreground ml-auto flex items-center gap-1.5">
            <kbd className="border border-border rounded px-1 bg-white text-[9px]">⌘K</kbd> jederzeit öffnen
          </span>
        </div>
      </DialogContent>
    </Dialog>
  )
}