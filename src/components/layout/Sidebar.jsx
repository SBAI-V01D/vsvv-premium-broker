import React, { useState, useEffect } from 'react';
import { Link, useLocation } from 'react-router-dom';
import {
  LayoutDashboard, Users, FileText, CheckSquare, Wallet,
  ChevronLeft, ChevronRight, Shield, LogOut, ExternalLink,
  User, Briefcase, TrendingUp, Lock, BookOpen, Activity,
  Brain, BarChart2, UserPlus, FolderOpen, RefreshCw
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

const navGroups = [
  {
    label: 'Cockpit',
    items: [
      { label: 'Dashboard',        icon: LayoutDashboard, path: '/' },
    ],
  },
  {
    label: 'Kunden',
    items: [
      { label: 'Kundenübersicht',  icon: Users,       path: '/kunden' },
      { label: 'Kundenportal',     icon: ExternalLink, path: '/portal', external: true },
      { label: 'Beratungsdossiers',icon: BookOpen,    path: '/beratungsdossier' },
      { label: 'Leads',            icon: UserPlus,    path: '/leads',           color: 'warning' },
    ],
  },
  {
    label: 'Vertrieb',
    items: [
      { label: 'Verkaufschancen',  icon: TrendingUp,  path: '/verkaufschancen', color: 'primary' },
      { label: 'Vertragsabläufe',  icon: RefreshCw,   path: '/vertragsablaeufe', color: 'warning' },
      { label: 'Anträge',          icon: CheckSquare, path: '/antraege' },
    ],
  },
  {
    label: 'Verwaltung',
    items: [
      { label: 'Verträge',         icon: FileText,    path: '/vertraege' },
      { label: 'Aufgaben',         icon: CheckSquare, path: '/aufgaben',         color: 'warning' },
      { label: 'Dokumente',        icon: FolderOpen,  path: '/dokumente',        color: 'primary' },
      { label: 'Dok.-Extraktor',   icon: Brain,       path: '/dokument-extraktor' },
    ],
  },
  {
    label: 'Finanzen & Team',
    items: [
      { label: 'Provisionen',      icon: Wallet,      path: '/provisionen-courtagen' },
      { label: 'Berater & Partner',icon: Briefcase,   path: '/berater-organisation' },
      { label: 'Reporting',        icon: BarChart2,   path: '/reporting' },
      { label: 'Finanzdashboard',  icon: BarChart2,   path: '/finanz-dashboard' },
    ],
  },
  {
    label: 'Enterprise',
    items: [
      { label: 'Team & Zugriffsrechte', icon: Lock,   path: '/admin/team-zugriffsrechte', adminOnly: true },
      { label: 'Enterprise Control',    icon: Shield, path: '/admin/enterprise-control-center', adminOnly: true },
      { label: 'KI Analyse',            icon: Brain,  path: '/ai-review', adminOnly: true },
    ],
  },
];

export default function Sidebar({ onNavigate }) {
  const [collapsed, setCollapsed] = useState(false);
  const [currentUser, setCurrentUser] = useState(null);
  const location = useLocation();
  const badges = useSidebarBadges();

  useEffect(() => {
    base44.auth.me().then(u => setCurrentUser(u)).catch(() => {});
  }, []);

  const isAdmin = currentUser?.role === 'admin';
  const role = resolveRole(currentUser);
  const roleLabel = ROLE_LABELS[role] || '';

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

      {/* ── Navigation ─────────────────────────────────────────────────── */}
      <nav className="flex-1 overflow-y-auto py-3 scrollbar-none" style={{ scrollbarWidth: 'none' }}>
        {navGroups.map((group) => (
          <div key={group.label} className="mb-0.5">
            {!collapsed ? (
              <p className="px-4 pt-5 pb-1.5 text-[10px] font-bold uppercase tracking-widest text-[hsl(var(--sidebar-label))] select-none">
                {group.label}
              </p>
            ) : (
              <div className="mx-3 my-3 h-px bg-[hsl(var(--border-subtle))]/50" />
            )}

            <div className={cn('space-y-0.5', collapsed ? 'px-2' : 'px-2')}>
              {group.items
                .filter(item => !item.adminOnly || isAdmin)
                .map((item) => {
                  const isActive =
                    location.pathname === item.path ||
                    (item.path !== '/' && location.pathname.startsWith(item.path));
                  const isKundenItem = item.path === '/kunden';

                  if (item.external) {
                    return (
                      <a
                        key={item.path}
                        href={item.path}
                        target="_blank"
                        rel="noopener noreferrer"
                        title={collapsed ? item.label : undefined}
                        className={cn(
                          'relative flex items-center rounded-xl transition-all duration-200 group',
                          collapsed ? 'justify-center h-9 w-9 mx-auto' : 'gap-2.5 px-3 py-[8px]',
                          'text-[hsl(var(--sidebar-item-fg))] hover:bg-[hsl(var(--sidebar-item-hover))] hover:text-[hsl(var(--sidebar-item-fg-active))]'
                        )}
                      >
                        <item.icon
                          className={cn(
                            'flex-shrink-0 transition-colors duration-200',
                            collapsed ? 'w-[17px] h-[17px]' : 'w-[14px] h-[14px]',
                            'text-[hsl(var(--sidebar-item-icon))] group-hover:text-[hsl(var(--sidebar-item-fg-active))]'
                          )}
                          strokeWidth={1.8}
                        />
                        {!collapsed && (
                          <span className="text-[12.5px] font-medium truncate flex-1 tracking-[-0.005em] text-[hsl(var(--sidebar-item-fg))] group-hover:text-[hsl(var(--sidebar-item-fg-active))]">
                            {item.label}
                          </span>
                        )}
                      </a>
                    );
                  }

                  return (
                    <React.Fragment key={item.path}>
                      <Link
                        to={item.path}
                        onClick={onNavigate}
                        title={collapsed ? item.label : undefined}
                        className={cn(
                          'relative flex items-center rounded-xl transition-all duration-200 group',
                          collapsed ? 'justify-center h-9 w-9 mx-auto' : 'gap-2.5 px-3 py-[8px]',
                          isActive
                            ? 'bg-[hsl(var(--primary))] shadow-sm'
                            : 'text-[hsl(var(--sidebar-item-fg))] hover:bg-[hsl(var(--sidebar-item-hover))] hover:text-[hsl(var(--sidebar-item-fg-active))]'
                        )}
                      >
                        {isActive && !collapsed && (
                          <span className="absolute left-0 w-[3px] h-5 rounded-r-full bg-white" />
                        )}
                        <item.icon
                          className={cn(
                            'flex-shrink-0 transition-colors duration-200',
                            collapsed ? 'w-[17px] h-[17px]' : 'w-[14px] h-[14px]',
                            isActive ? 'text-white' : 'text-[hsl(var(--sidebar-item-icon))] group-hover:text-[hsl(var(--sidebar-item-fg-active))]'
                          )}
                          strokeWidth={isActive ? 2.2 : 1.8}
                        />
                        {!collapsed && (
                          <span className={cn(
                            'text-[12.5px] font-medium truncate flex-1 tracking-[-0.005em]',
                            isActive ? 'text-white font-semibold' : 'text-[hsl(var(--sidebar-item-fg))] group-hover:text-[hsl(var(--sidebar-item-fg-active))]'
                          )}>
                            {item.label}
                          </span>
                        )}
                        {badges[item.path] && (
                          <span className={cn(
                            'text-[9px] font-bold rounded-full flex items-center justify-center flex-shrink-0 leading-none',
                            collapsed
                              ? 'absolute top-0.5 right-0.5 min-w-[13px] h-[13px] px-[3px]'
                              : 'min-w-[16px] h-[16px] px-[4px]',
                            isActive
                              ? 'bg-white text-[hsl(var(--primary))]'
                              : item.color === 'primary'
                                ? 'bg-[hsl(var(--primary))] text-white'
                                : 'bg-[hsl(var(--warning))] text-white'
                          )}>
                            {badges[item.path]}
                          </span>
                        )}
                      </Link>
                      {isKundenItem && <GlobalSearch collapsed={collapsed} />}
                    </React.Fragment>
                  );
                })}
            </div>
          </div>
        ))}
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