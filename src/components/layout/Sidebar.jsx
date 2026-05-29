import React, { useState, useEffect } from 'react';
import { Link, useLocation } from 'react-router-dom';
import {
  LayoutDashboard, Users, FileText, CheckSquare, Wallet,
  ChevronLeft, ChevronRight, Shield, LogOut, ExternalLink,
  User, Briefcase, TrendingUp, Lock, BookOpen, Activity,
  Brain, BarChart2, UserPlus, FolderOpen, ChevronDown
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { base44 } from '@/api/base44Client';
import { resolveRole, ROLE_LABELS } from '@/lib/rbac';
import GlobalSearch from './GlobalSearch';

function useSidebarBadges() {
  const [badges, setBadges] = useState({});
  useEffect(() => {
    const load = async () => {
      try {
        const [tasks, contracts, docs, leads, verkaufschancen] = await Promise.all([
          base44.entities.Task.list(),
          base44.entities.Contract.list(),
          base44.entities.Document.list(),
          base44.entities.Lead.list(),
          base44.entities.Verkaufschance.list(),
        ]);
        const today = new Date();
        const openTasks = tasks.filter(t => t.status === 'open' || t.status === 'in_progress');
        const vertragsablaeufe = contracts.filter(c => {
          if (['cancelled', 'archived', 'expired'].includes(c.status)) return false;
          if (c.exclude_from_renewal_statistics) return false;
          const ed = c.end_date ? Math.ceil((new Date(c.end_date) - today) / 86400000) : null;
          const cd = c.cancellation_deadline ? Math.ceil((new Date(c.cancellation_deadline) - today) / 86400000) : null;
          return (ed !== null && ed >= 0 && ed <= 180) || (cd !== null && cd >= 0 && cd <= 180);
        });
        const pendingDocs = docs.filter(d => d.classification_status === 'ausstehend');
        const activeLeads = leads.filter(l => ['new', 'contacted', 'qualified'].includes(l.status));
        const openVs = verkaufschancen.filter(v => !['gewonnen', 'verloren'].includes(v.status));
        setBadges({
          '/aufgaben':         openTasks.length || null,
          '/vertragsablaeufe': vertragsablaeufe.length || null,
          '/dokumente':        pendingDocs.length || null,
          '/leads':            activeLeads.length || null,
          '/verkaufschancen':  openVs.length || null,
        });
      } catch {}
    };
    load();
    const t = setInterval(load, 60000);
    return () => clearInterval(t);
  }, []);
  return badges;
}

// ── Navigation Structure ────────────────────────────────────────────────────
const NAV_STRUCTURE = [
  {
    id: 'dashboard',
    label: 'Dashboard',
    icon: LayoutDashboard,
    path: '/',
  },
  {
    id: 'kunden',
    label: 'Kunden',
    icon: Users,
    children: [
      { label: 'Kundenübersicht', icon: Users,     path: '/kunden' },
      { label: 'Leads',           icon: UserPlus,  path: '/leads' },
      { label: 'Verkaufschancen', icon: TrendingUp, path: '/verkaufschancen' },
      { label: 'Beratungsdossiers', icon: BookOpen, path: '/beratungsdossier' },
    ],
  },
  {
    id: 'vertraege',
    label: 'Verträge',
    icon: FileText,
    children: [
      { label: 'Alle Verträge',    icon: FileText,    path: '/vertraege' },
      { label: 'Vertragsabläufe', icon: Activity,    path: '/vertragsablaeufe' },
      { label: 'Anträge',         icon: CheckSquare, path: '/antraege' },
    ],
  },
  {
    id: 'aufgaben',
    label: 'Aufgaben',
    icon: CheckSquare,
    path: '/aufgaben',
  },
  {
    id: 'dokumente',
    label: 'Dokumente',
    icon: FolderOpen,
    children: [
      { label: 'Alle Dokumente',     icon: FolderOpen, path: '/dokumente' },
      { label: 'Dokument-Extraktor', icon: Brain,      path: '/dokument-extraktor' },
    ],
  },
  {
    id: 'auswertungen',
    label: 'Auswertungen',
    icon: BarChart2,
    children: [
      { label: 'Broker Reporting',   icon: BarChart2, path: '/reporting' },
      { label: 'Finanzdashboard',    icon: Wallet,    path: '/finanz-dashboard' },
    ],
  },
  {
    id: 'admin',
    label: 'Administration',
    icon: Shield,
    children: [
      { label: 'Berater & Partner',     icon: Briefcase,   path: '/berater-organisation' },
      { label: 'Provisionen',           icon: Wallet,      path: '/provisionen-courtagen' },
      { label: 'Kundenportal',          icon: ExternalLink, path: '/portal', external: true },
      { label: 'Team & Zugriffsrechte', icon: Lock,        path: '/admin/team-zugriffsrechte', adminOnly: true },
      { label: 'Enterprise',            icon: Shield,      path: '/admin/enterprise-control-center', adminOnly: true },
      { label: 'KI Analyse',            icon: Brain,       path: '/ai-review', adminOnly: true },
    ],
  },
];

export default function Sidebar({ onNavigate }) {
  const [collapsed, setCollapsed] = useState(false);
  const [currentUser, setCurrentUser] = useState(null);
  const location = useLocation();
  const badges = useSidebarBadges();

  // Determine which groups are expanded — auto-open active group
  const getDefaultOpen = () => {
    const open = new Set();
    NAV_STRUCTURE.forEach(item => {
      if (item.children) {
        const hasActive = item.children.some(child =>
          child.path && (location.pathname === child.path ||
            (child.path !== '/' && location.pathname.startsWith(child.path)))
        );
        if (hasActive) open.add(item.id);
      }
    });
    return open;
  };

  const [openGroups, setOpenGroups] = useState(getDefaultOpen);

  const toggleGroup = (id) => {
    setOpenGroups(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  useEffect(() => {
    base44.auth.me().then(u => setCurrentUser(u)).catch(() => {});
  }, []);

  // Auto-open group when route changes
  useEffect(() => {
    setOpenGroups(prev => {
      const next = new Set(prev);
      NAV_STRUCTURE.forEach(item => {
        if (item.children) {
          const hasActive = item.children.some(child =>
            child.path && (location.pathname === child.path ||
              (child.path !== '/' && location.pathname.startsWith(child.path)))
          );
          if (hasActive) next.add(item.id);
        }
      });
      return next;
    });
  }, [location.pathname]);

  const isAdmin = currentUser?.role === 'admin';
  const role = resolveRole(currentUser);
  const roleLabel = ROLE_LABELS[role] || '';

  const isPathActive = (path) =>
    location.pathname === path || (path !== '/' && location.pathname.startsWith(path));

  const renderNavItem = (item, isChild = false) => {
    if (item.adminOnly && !isAdmin) return null;
    const active = isPathActive(item.path);
    const badge = badges[item.path];

    if (item.external) {
      return (
        <a
          key={item.path}
          href={item.path}
          target="_blank"
          rel="noopener noreferrer"
          title={collapsed ? item.label : undefined}
          className={cn(
            'flex items-center rounded-xl transition-all duration-200 group',
            collapsed ? 'justify-center h-9 w-9 mx-auto' : isChild ? 'gap-2 px-3 py-[7px] pl-8' : 'gap-2.5 px-3 py-[8px]',
            'text-[hsl(var(--sidebar-item-fg))] hover:bg-[hsl(var(--sidebar-item-hover))] hover:text-[hsl(var(--sidebar-item-fg-active))]'
          )}
        >
          <item.icon className={cn('flex-shrink-0', collapsed ? 'w-[17px] h-[17px]' : 'w-[13px] h-[13px]', 'text-[hsl(var(--sidebar-item-icon))] group-hover:text-[hsl(var(--sidebar-item-fg-active))]')} strokeWidth={1.8} />
          {!collapsed && <span className="text-[12px] font-medium truncate flex-1 text-[hsl(var(--sidebar-item-fg))] group-hover:text-[hsl(var(--sidebar-item-fg-active))]">{item.label}</span>}
          {!collapsed && <ExternalLink className="w-2.5 h-2.5 opacity-40 flex-shrink-0" />}
        </a>
      );
    }

    return (
      <Link
        key={item.path}
        to={item.path}
        onClick={onNavigate}
        title={collapsed ? item.label : undefined}
        className={cn(
          'relative flex items-center rounded-xl transition-all duration-200 group',
          collapsed ? 'justify-center h-9 w-9 mx-auto' : isChild ? 'gap-2 px-3 py-[7px] pl-8' : 'gap-2.5 px-3 py-[8px]',
          active
            ? 'bg-[hsl(var(--primary))] shadow-sm'
            : 'text-[hsl(var(--sidebar-item-fg))] hover:bg-[hsl(var(--sidebar-item-hover))] hover:text-[hsl(var(--sidebar-item-fg-active))]'
        )}
      >
        {active && !collapsed && !isChild && <span className="absolute left-0 w-[3px] h-5 rounded-r-full bg-white" />}
        <item.icon
          className={cn('flex-shrink-0 transition-colors', collapsed ? 'w-[17px] h-[17px]' : 'w-[13px] h-[13px]',
            active ? 'text-white' : 'text-[hsl(var(--sidebar-item-icon))] group-hover:text-[hsl(var(--sidebar-item-fg-active))]'
          )}
          strokeWidth={active ? 2.2 : 1.8}
        />
        {!collapsed && (
          <span className={cn('text-[12px] font-medium truncate flex-1 tracking-[-0.005em]',
            active ? 'text-white font-semibold' : 'text-[hsl(var(--sidebar-item-fg))] group-hover:text-[hsl(var(--sidebar-item-fg-active))]'
          )}>
            {item.label}
          </span>
        )}
        {badge && (
          <span className={cn('text-[9px] font-bold rounded-full flex items-center justify-center flex-shrink-0 leading-none',
            collapsed ? 'absolute top-0.5 right-0.5 min-w-[13px] h-[13px] px-[3px]' : 'min-w-[16px] h-[16px] px-[4px]',
            active ? 'bg-white text-[hsl(var(--primary))]' : 'bg-[hsl(var(--primary))] text-white'
          )}>
            {badge}
          </span>
        )}
      </Link>
    );
  };

  return (
    <aside
      className={cn(
        'flex flex-col z-50 transition-all duration-300',
        'my-2 ml-2 rounded-2xl overflow-hidden',
        'h-[calc(100vh-16px)]',
        collapsed ? 'w-[60px]' : 'w-[248px]'
      )}
      style={{
        background: 'linear-gradient(180deg, hsl(220,36%,17%) 0%, hsl(220,36%,20%) 100%)',
        border: '1px solid rgba(255,255,255,0.04)',
        boxShadow: '2px 0 24px 0 rgba(59,130,246,0.08), 4px 0 12px 0 rgba(0,0,0,0.06)',
      }}
    >
      {/* ── Header ─────────────────────────────── */}
      <div className={cn(
        'flex items-center h-[58px] border-b border-[hsl(var(--border-subtle))]/50 flex-shrink-0',
        collapsed ? 'justify-center' : 'gap-3 px-4'
      )}>
        <div className="w-7 h-7 rounded-[8px] bg-[hsl(var(--primary))] flex items-center justify-center flex-shrink-0 shadow-sm">
          <User className="w-3.5 h-3.5 text-white" />
        </div>
        {!collapsed && currentUser && (
          <div className="min-w-0">
            <p className="text-[13px] font-bold text-[hsl(var(--primary))] tracking-tight leading-none truncate">
              {currentUser.full_name || currentUser.email}
            </p>
            <p className="text-[8px] text-[hsl(var(--text-subtle))] font-medium tracking-[0.14em] uppercase mt-0.5">
              {roleLabel || 'Swiss Premium Broker'}
            </p>
          </div>
        )}
        {!collapsed && !currentUser && (
          <div className="min-w-0">
            <p className="text-[13px] font-bold text-[hsl(var(--primary))] tracking-tight leading-none">Swiss Premium Broker</p>
          </div>
        )}
      </div>

      {/* ── Search ── */}
      {!collapsed && (
        <div className="px-2 pb-1">
          <GlobalSearch collapsed={false} />
        </div>
      )}

      {/* ── Navigation ── */}
      <nav className="flex-1 overflow-y-auto py-1 scrollbar-none px-2" style={{ scrollbarWidth: 'none' }}>
        <div className="space-y-0.5">
          {NAV_STRUCTURE.map((item) => {
            if (item.adminOnly && !isAdmin) return null;

            // Single item (no children)
            if (!item.children) {
              const active = isPathActive(item.path);
              const badge = badges[item.path];
              return (
                <Link
                  key={item.id}
                  to={item.path}
                  onClick={onNavigate}
                  title={collapsed ? item.label : undefined}
                  className={cn(
                    'relative flex items-center rounded-xl transition-all duration-200 group',
                    collapsed ? 'justify-center h-9 w-9 mx-auto' : 'gap-2.5 px-3 py-[9px]',
                    active
                      ? 'bg-[hsl(var(--primary))] shadow-sm'
                      : 'text-[hsl(var(--sidebar-item-fg))] hover:bg-[hsl(var(--sidebar-item-hover))] hover:text-[hsl(var(--sidebar-item-fg-active))]'
                  )}
                >
                  {active && !collapsed && <span className="absolute left-0 w-[3px] h-5 rounded-r-full bg-white" />}
                  <item.icon
                    className={cn('flex-shrink-0', collapsed ? 'w-[17px] h-[17px]' : 'w-[14px] h-[14px]',
                      active ? 'text-white' : 'text-[hsl(var(--sidebar-item-icon))] group-hover:text-[hsl(var(--sidebar-item-fg-active))]'
                    )}
                    strokeWidth={active ? 2.2 : 1.8}
                  />
                  {!collapsed && (
                    <span className={cn('text-[12.5px] font-medium truncate flex-1',
                      active ? 'text-white font-semibold' : 'text-[hsl(var(--sidebar-item-fg))] group-hover:text-[hsl(var(--sidebar-item-fg-active))]'
                    )}>{item.label}</span>
                  )}
                  {badge && (
                    <span className={cn('text-[9px] font-bold rounded-full flex items-center justify-center flex-shrink-0 leading-none',
                      collapsed ? 'absolute top-0.5 right-0.5 min-w-[13px] h-[13px] px-[3px]' : 'min-w-[16px] h-[16px] px-[4px]',
                      active ? 'bg-white text-[hsl(var(--primary))]' : 'bg-[hsl(var(--primary))] text-white'
                    )}>{badge}</span>
                  )}
                </Link>
              );
            }

            // Group with children
            const visibleChildren = item.children.filter(c => !c.adminOnly || isAdmin);
            if (visibleChildren.length === 0) return null;

            const isOpen = openGroups.has(item.id);
            const hasActiveChild = visibleChildren.some(c => c.path && isPathActive(c.path));
            const groupBadge = visibleChildren.reduce((sum, c) => sum + (badges[c.path] || 0), 0);

            if (collapsed) {
              return (
                <div key={item.id}>
                  <div className="mx-auto my-1.5 h-px w-8 bg-[hsl(var(--border-subtle))]/50" />
                  <div className="space-y-0.5">
                    {visibleChildren.map(child => renderNavItem(child, false))}
                  </div>
                </div>
              );
            }

            return (
              <div key={item.id}>
                <button
                  onClick={() => toggleGroup(item.id)}
                  className={cn(
                    'w-full flex items-center gap-2.5 px-3 py-[8px] rounded-xl transition-all duration-200 group',
                    hasActiveChild && !isOpen
                      ? 'text-[hsl(var(--primary))]'
                      : 'text-[hsl(var(--sidebar-item-fg))] hover:bg-[hsl(var(--sidebar-item-hover))] hover:text-[hsl(var(--sidebar-item-fg-active))]'
                  )}
                >
                  <item.icon
                    className={cn('w-[14px] h-[14px] flex-shrink-0',
                      hasActiveChild ? 'text-[hsl(var(--primary))]' : 'text-[hsl(var(--sidebar-item-icon))] group-hover:text-[hsl(var(--sidebar-item-fg-active))]'
                    )}
                    strokeWidth={1.8}
                  />
                  <span className={cn('text-[12.5px] font-medium truncate flex-1',
                    hasActiveChild ? 'text-[hsl(var(--primary))] font-semibold' : ''
                  )}>{item.label}</span>
                  {groupBadge > 0 && !isOpen && (
                    <span className="text-[9px] font-bold rounded-full min-w-[16px] h-[16px] px-[4px] flex items-center justify-center bg-[hsl(var(--primary))] text-white">
                      {groupBadge}
                    </span>
                  )}
                  <ChevronDown className={cn('w-3 h-3 flex-shrink-0 text-[hsl(var(--sidebar-item-icon))] transition-transform duration-200',
                    isOpen && 'rotate-180'
                  )} />
                </button>
                {isOpen && (
                  <div className="mt-0.5 mb-1 space-y-0.5">
                    {visibleChildren.map(child => renderNavItem(child, true))}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </nav>

      {/* ── Footer ────────────────────────────────────────────────────── */}
      <div className={cn(
        'border-t border-[hsl(var(--border-subtle))]/50 flex items-center pb-3 pt-2',
        collapsed ? 'flex-col gap-1 px-1' : 'gap-1 px-1'
      )}>
        <button
          onClick={() => base44.auth.logout()}
          title="Abmelden"
          className={cn(
            'flex items-center gap-2 rounded-xl text-[12px] font-medium text-[hsl(var(--sidebar-item-fg))] hover:text-[hsl(var(--sidebar-item-fg-active))] hover:bg-[hsl(var(--sidebar-item-hover))] transition-all duration-200',
            collapsed ? 'justify-center h-9 w-9 mx-auto' : 'flex-1 px-3 py-2'
          )}
        >
          <LogOut className="w-[14px] h-[14px] flex-shrink-0 opacity-70" strokeWidth={1.8} />
          {!collapsed && <span>Abmelden</span>}
        </button>

        <button
          onClick={() => setCollapsed(!collapsed)}
          className="flex items-center justify-center h-9 w-9 rounded-xl text-[hsl(var(--sidebar-item-fg))] hover:text-[hsl(var(--sidebar-item-fg-active))] hover:bg-[hsl(var(--sidebar-item-hover))] transition-all duration-200 flex-shrink-0"
          title={collapsed ? 'Erweitern' : 'Einklappen'}
        >
          {collapsed
            ? <ChevronRight className="w-3.5 h-3.5" />
            : <ChevronLeft className="w-3.5 h-3.5" />
          }
        </button>
      </div>
    </aside>
  );
}