/**
 * TabSystemHealth — Merged: Integrity + Live-Validation + System Check
 * Sub-Tab Navigation innerhalb des konsolidierten Bereichs
 */
import { useState, Suspense, lazy } from 'react';
import { cn } from '@/lib/utils';

const TabIntegrity   = lazy(() => import('./TabIntegrity'));
const TabValidation  = lazy(() => import('./TabValidation'));
const TabSystemCheck = lazy(() => import('./TabSystemCheck'));

const SUB_TABS = [
  { id: 'integrity',   label: 'Data Integrity' },
  { id: 'validation',  label: '▶ Live-Validation' },
  { id: 'systemcheck', label: '✓ System Check' },
];

function SubTabSkeleton() {
  return (
    <div className="space-y-4 animate-pulse">
      <div className="h-8 bg-slate-100 rounded-lg w-48" />
      <div className="h-40 bg-slate-100 rounded-xl" />
    </div>
  );
}

export default function TabSystemHealth() {
  const [active, setActive] = useState('integrity');
  const [mounted, setMounted] = useState({ integrity: true });

  function switchTab(id) {
    setActive(id);
    setMounted(prev => ({ ...prev, [id]: true }));
  }

  return (
    <div className="space-y-4">
      <div className="flex gap-1 border-b border-[hsl(var(--border-subtle))] pb-0">
        {SUB_TABS.map(t => (
          <button
            key={t.id}
            onClick={() => switchTab(t.id)}
            className={cn(
              'px-4 py-2 text-xs font-semibold border-b-2 -mb-px transition-colors',
              active === t.id ? 'border-primary text-primary' : 'border-transparent text-muted-foreground hover:text-foreground'
            )}
          >
            {t.label}
          </button>
        ))}
      </div>
      {mounted.integrity && (
        <div className={active === 'integrity' ? '' : 'hidden'}>
          <Suspense fallback={<SubTabSkeleton />}><TabIntegrity /></Suspense>
        </div>
      )}
      {mounted.validation && (
        <div className={active === 'validation' ? '' : 'hidden'}>
          <Suspense fallback={<SubTabSkeleton />}><TabValidation /></Suspense>
        </div>
      )}
      {mounted.systemcheck && (
        <div className={active === 'systemcheck' ? '' : 'hidden'}>
          <Suspense fallback={<SubTabSkeleton />}><TabSystemCheck /></Suspense>
        </div>
      )}
    </div>
  );
}