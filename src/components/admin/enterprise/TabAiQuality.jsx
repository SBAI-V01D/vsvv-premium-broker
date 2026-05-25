/**
 * TabAiQuality — Merged: AI Explainability + Reviews
 */
import { useState, Suspense, lazy } from 'react';
import { cn } from '@/lib/utils';

const TabAiExplainability = lazy(() => import('./TabAiExplainability'));
const TabReviews          = lazy(() => import('./TabReviews'));

const SUB_TABS = [
  { id: 'explainability', label: '🧠 AI Explainability' },
  { id: 'reviews',        label: 'Reviews' },
];

function SubTabSkeleton() {
  return <div className="h-40 bg-slate-100 rounded-xl animate-pulse" />;
}

export default function TabAiQuality() {
  const [active, setActive] = useState('explainability');
  const [mounted, setMounted] = useState({ explainability: true });

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
      {mounted.explainability && (
        <div className={active === 'explainability' ? '' : 'hidden'}>
          <Suspense fallback={<SubTabSkeleton />}><TabAiExplainability /></Suspense>
        </div>
      )}
      {mounted.reviews && (
        <div className={active === 'reviews' ? '' : 'hidden'}>
          <Suspense fallback={<SubTabSkeleton />}><TabReviews /></Suspense>
        </div>
      )}
    </div>
  );
}