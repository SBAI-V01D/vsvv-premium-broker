import React from 'react'
import { Search, X } from 'lucide-react'
import { Input } from '@/components/ui/input'
import { cn } from '@/lib/utils'

/**
 * Standardisierte Filter-Leiste mit Suchfeld + optionalen Tab-Filtern.
 *
 * Props:
 *  - search: string
 *  - onSearchChange: (val: string) => void
 *  - placeholder: string
 *  - filters: Array<{ key: string, label: string, count?: number }>
 *  - activeFilter: string
 *  - onFilterChange: (key: string) => void
 *  - extra: ReactNode (zusätzliche Filter-Elemente rechts, optional)
 */
export default function FilterBar({
  search,
  onSearchChange,
  placeholder = 'Suchen...',
  filters = [],
  activeFilter,
  onFilterChange,
  extra,
}) {
  return (
    <div className="flex flex-col sm:flex-row gap-3 mb-5">
      {/* Suche */}
      <div className="relative flex-1 min-w-0">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground pointer-events-none" />
        <Input
          placeholder={placeholder}
          value={search}
          onChange={e => onSearchChange(e.target.value)}
          className="pl-9 pr-8"
        />
        {search && (
          <button
            onClick={() => onSearchChange('')}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
            aria-label="Suche löschen"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        )}
      </div>

      {/* Tab-Filter */}
      {filters.length > 0 && (
        <div className="flex items-center gap-1.5 flex-wrap">
          {filters.map(f => (
            <button
              key={f.key}
              onClick={() => onFilterChange(f.key)}
              className={cn(
                'px-3 py-1.5 rounded-full text-xs font-medium border transition-colors whitespace-nowrap',
                activeFilter === f.key
                  ? 'bg-primary text-primary-foreground border-primary'
                  : 'bg-background text-muted-foreground border-border hover:bg-muted'
              )}
            >
              {f.label}
              {f.count !== undefined && (
                <span className={cn(
                  'ml-1.5 px-1.5 py-0.5 rounded-full text-[10px]',
                  activeFilter === f.key
                    ? 'bg-primary-foreground/20 text-primary-foreground'
                    : 'bg-muted text-muted-foreground'
                )}>
                  {f.count}
                </span>
              )}
            </button>
          ))}
        </div>
      )}

      {/* Extra Slots */}
      {extra && <div className="flex items-center gap-2">{extra}</div>}
    </div>
  )
}