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
  return (
    <div className="space-y-4">
      <div className="flex gap-1 flex-wrap border-b border-[hsl(var(--border-subtle))] pb-0">
        {SUB_TABS.map(t => (
          <button
            key={t.id}
            onClick={() => setActive(t.id)}
            className={cn(
              'px-4 py-2 text-xs font-semibold border-b-2 -mb-px transition-colors',
              active === t.id ? 'border-primary text-primary' : 'border-transparent text-muted-foreground hover:text-foreground'
            )}
          >
            {t.label}
          </button>
        ))}
      </div>
      <Suspense fallback={<SubTabSkeleton />}>
        {active === 'performance' && <TabPerformance />}
        {active === 'exports'     && <TabExports />}
        {active === 'modules'     && <TabModules />}
        {active === 'excellence'  && <TabSystemExcellence />}
      </Suspense>
    </div>
  );
}