/**
 * TabAuditSecurity — Merged: Audit + Compliance + Security
 */
import { useState, Suspense, lazy } from 'react';
import { cn } from '@/lib/utils';

const TabAudit      = lazy(() => import('./TabAudit'));
const TabCompliance = lazy(() => import('./TabCompliance'));
const TabSecurity   = lazy(() => import('./TabSecurity'));

const SUB_TABS = [
  { id: 'audit',      label: 'Audit Trail' },
  { id: 'compliance', label: 'Compliance' },
  { id: 'security',   label: 'Security' },
];

function SubTabSkeleton() {
  return <div className="h-40 bg-slate-100 rounded-xl animate-pulse" />;
}

export default function TabAuditSecurity() {
  const [active, setActive] = useState('audit');
  return (
    <div className="space-y-4">
      <div className="flex gap-1 border-b border-[hsl(var(--border-subtle))] pb-0">
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
        {active === 'audit'      && <TabAudit />}
        {active === 'compliance' && <TabCompliance />}
        {active === 'security'   && <TabSecurity />}
      </Suspense>
    </div>
  );
}