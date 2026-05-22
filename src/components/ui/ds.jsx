/**
 * Enterprise Design System Primitives
 *
 * Canonical building blocks for all premium pages.
 * Use these instead of raw Tailwind to ensure consistency.
 */

import React from 'react'
import { cn } from '@/lib/utils'

// ─────────────────────────────────────────────────────────────────────────────
// EnterpriseCard — The standard surface container
// ─────────────────────────────────────────────────────────────────────────────
export function EnterpriseCard({ children, className, onClick, noPad = false, flat = false }) {
  return (
    <div
      onClick={onClick}
      className={cn(
        'bg-[hsl(var(--card))] rounded-xl border border-[hsl(var(--border-subtle))] transition-all duration-150',
        flat
          ? 'shadow-none'
          : 'shadow-[var(--shadow-card)] hover:shadow-[var(--shadow-raised)] hover:border-[hsl(var(--border-default))]',
        !noPad && 'p-5',
        onClick && 'cursor-pointer',
        className
      )}
    >
      {children}
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// SectionHeader — Page section title + optional action
// ─────────────────────────────────────────────────────────────────────────────
export function SectionHeader({ title, subtitle, action, className }) {
  return (
    <div className={cn('flex items-start justify-between gap-4 mb-6', className)}>
      <div className="space-y-0.5">
        <h2 className="text-heading font-bold text-[hsl(var(--text-heading))] tracking-tight">{title}</h2>
        {subtitle && <p className="text-body-sm text-[hsl(var(--text-muted))]">{subtitle}</p>}
      </div>
      {action && <div className="shrink-0">{action}</div>}
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// StatTile — KPI / metric display
// ─────────────────────────────────────────────────────────────────────────────
export function StatTile({ label, value, sub, icon: Icon, accent, className }) {
  return (
    <div className={cn('flex flex-col gap-1', className)}>
      <p className="text-label">{label}</p>
      <div className="flex items-baseline gap-1.5">
        {Icon && <Icon className={cn('w-4 h-4 shrink-0 -mb-0.5', accent ? 'text-primary' : 'text-muted-foreground')} />}
        <span className={cn('text-2xl font-bold tracking-tight', accent ? 'text-primary' : 'text-heading')}
          style={{ letterSpacing: '-0.022em' }}>
          {value}
        </span>
        {sub && <span className="text-caption">{sub}</span>}
      </div>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// HealthScore — circular score badge
// ─────────────────────────────────────────────────────────────────────────────
export function HealthScore({ score, size = 'md' }) {
  const pct = Math.max(0, Math.min(100, score ?? 0))
  const color = pct >= 80 ? '#10b981' : pct >= 60 ? '#f59e0b' : '#ef4444'
  const r = size === 'lg' ? 22 : 16
  const c = size === 'lg' ? 28 : 20
  const strokeW = size === 'lg' ? 3.5 : 3
  const circ = 2 * Math.PI * r
  const dash = (pct / 100) * circ

  return (
    <div className="relative inline-flex items-center justify-center">
      <svg width={c * 2} height={c * 2} style={{ transform: 'rotate(-90deg)' }}>
        <circle cx={c} cy={c} r={r} fill="none" stroke="#e2e8f0" strokeWidth={strokeW} />
        <circle cx={c} cy={c} r={r} fill="none" stroke={color} strokeWidth={strokeW}
          strokeDasharray={`${dash} ${circ}`} strokeLinecap="round" />
      </svg>
      <span className={cn(
        'absolute font-bold tabular-nums',
        size === 'lg' ? 'text-sm' : 'text-[10px]'
      )} style={{ color }}>
        {pct}
      </span>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// SemanticBadge — unified status / semantic label
// ─────────────────────────────────────────────────────────────────────────────
const SEMANTIC = {
  success: 'bg-emerald-50 text-emerald-700 border-emerald-200/70',
  warning: 'bg-amber-50 text-amber-700 border-amber-200/70',
  critical: 'bg-rose-50 text-rose-600 border-rose-200/70',
  info:    'bg-blue-50 text-blue-700 border-blue-200/70',
  neutral: 'bg-slate-100 text-slate-600 border-slate-200/70',
  purple:  'bg-violet-50 text-violet-700 border-violet-200/70',
}
export function SemanticBadge({ variant = 'neutral', children, icon: Icon, className }) {
  return (
    <span className={cn(
      'inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold border',
      SEMANTIC[variant] ?? SEMANTIC.neutral,
      className
    )}>
      {Icon && <Icon className="w-3 h-3 shrink-0" />}
      {children}
    </span>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// StickyNav — scrollable anchor navigation
// ─────────────────────────────────────────────────────────────────────────────
export function StickyNav({ items, active, onChange }) {
  return (
    <nav className="sticky top-0 z-20 bg-white/98 backdrop-blur-sm border-b border-[hsl(var(--border-subtle))] px-6 shadow-[0_1px_0_0_hsl(var(--border-subtle))]">
      <div className="flex gap-0 overflow-x-auto scrollbar-none">
        {items.map(item => (
          <button
            key={item.id}
            onClick={() => onChange(item.id)}
            className={cn(
              'flex items-center gap-1.5 px-4 py-3.5 text-[13px] font-medium whitespace-nowrap border-b-2 transition-all duration-150',
              active === item.id
                ? 'border-[hsl(var(--primary))] text-[hsl(var(--primary))]'
                : 'border-transparent text-[hsl(var(--text-muted))] hover:text-[hsl(var(--text-heading))] hover:border-[hsl(var(--border-default))]'
            )}
          >
            {item.icon && <item.icon className="w-3.5 h-3.5 shrink-0 opacity-80" />}
            {item.label}
            {item.count != null && item.count > 0 && (
              <span className={cn(
                'text-[10px] font-bold px-1.5 py-0.5 rounded-full transition-colors',
                active === item.id ? 'bg-[hsl(var(--primary))/0.12] text-[hsl(var(--primary))]' : 'bg-[hsl(var(--surface-2))] text-[hsl(var(--text-muted))]'
              )}>
                {item.count}
              </span>
            )}
          </button>
        ))}
      </div>
    </nav>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// EmptySection — empty state for sections
// ─────────────────────────────────────────────────────────────────────────────
export function EmptySection({ icon: Icon, title, subtitle, action }) {
  return (
    <div className="flex flex-col items-center justify-center py-14 text-center">
      {Icon && (
        <div className="w-12 h-12 rounded-2xl bg-slate-100 flex items-center justify-center mb-4">
          <Icon className="w-6 h-6 text-slate-400" />
        </div>
      )}
      {title && <p className="text-subheading text-slate-600 mb-1">{title}</p>}
      {subtitle && <p className="text-caption max-w-xs">{subtitle}</p>}
      {action && <div className="mt-4">{action}</div>}
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// PageShell — standard page wrapper with consistent padding
// ─────────────────────────────────────────────────────────────────────────────
export function PageShell({ children, className }) {
  return (
    <div className={cn('min-h-screen bg-background', className)}>
      {children}
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// Divider — horizontal rule with optional label
// ─────────────────────────────────────────────────────────────────────────────
export function Divider({ label, className }) {
  if (!label) return <hr className={cn('border-[hsl(var(--border-subtle))]', className)} />
  return (
    <div className={cn('flex items-center gap-3', className)}>
      <hr className="flex-1 border-[hsl(var(--border-subtle))]" />
      <span className="text-label">{label}</span>
      <hr className="flex-1 border-[hsl(var(--border-subtle))]" />
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// QuickAction — icon button with label tooltip pattern
// ─────────────────────────────────────────────────────────────────────────────
export function QuickAction({ icon: Icon, label, onClick, variant = 'default', disabled }) {
  const styles = {
    default: 'bg-slate-100 text-slate-600 hover:bg-slate-200',
    primary: 'bg-primary text-white hover:bg-primary/90',
    success: 'bg-emerald-50 text-emerald-700 hover:bg-emerald-100',
    warning: 'bg-amber-50 text-amber-700 hover:bg-amber-100',
    danger:  'bg-rose-50 text-rose-600 hover:bg-rose-100',
  }
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      title={label}
      className={cn(
        'flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors disabled:opacity-40',
        styles[variant] ?? styles.default
      )}
    >
      <Icon className="w-3.5 h-3.5 shrink-0" />
      <span className="hidden sm:inline">{label}</span>
    </button>
  )
}