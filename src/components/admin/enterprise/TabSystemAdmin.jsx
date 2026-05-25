/**
 * TabSystemAdmin — Merged: Performance + Exports + All Modules + Excellence Report
 * Nur für Admin/DevOps relevant.
 */
import { useState, Suspense, lazy } from 'react';
import { cn } from '@/lib/utils';

const TabPerformance    = lazy(() => import('./TabPerformance'));
const TabExports        = lazy(() => import('./TabExports'));
const TabModules        = lazy(() => import('./TabModules'));
const TabSystemExcellence = lazy(() => import('./TabSystemExcellence'));

const SUB_TABS = [
  { id: 'performance', label: 'Performance' },
  { id: 'exports',     label: 'Exports' },
  { id: 'modules',     label: 'Alle Module' },
  { id: 'excellence',  label: '★ Excellence Report' },
];

function SubTabSkeleton() {
  return <div className="h-40 bg-slate-100 rounded-xl animate-pulse" />;
}

export default function TabSystemAdmin() {
  const [active, setActive] = useState('performance');
  const [mounted, setMounted] = useState({ performance: true });

  function switchTab(id) {
    setActive(id);
    setMounted(prev => ({ ...prev, [id]: true }));
  }

  return (
    <div className="space-y-4">
      <div className="flex gap-1 flex-wrap border-b border-[hsl(var(--border-subtle))] pb-0">
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
      {mounted.performance && (
        <div className={active === 'performance' ? '' : 'hidden'}>
          <Suspense fallback={<SubTabSkeleton />}><TabPerformance /></Suspense>
        </div>
      )}
      {mounted.exports && (
        <div className={active === 'exports' ? '' : 'hidden'}>
          <Suspense fallback={<SubTabSkeleton />}><TabExports /></Suspense>
        </div>
      )}
      {mounted.modules && (
        <div className={active === 'modules' ? '' : 'hidden'}>
          <Suspense fallback={<SubTabSkeleton />}><TabModules /></Suspense>
        </div>
      )}
      {mounted.excellence && (
        <div className={active === 'excellence' ? '' : 'hidden'}>
          <Suspense fallback={<SubTabSkeleton />}><TabSystemExcellence /></Suspense>
        </div>
      )}
    </div>
  );
}