import React, { useState, useEffect } from 'react';
import { Link, useLocation } from 'react-router-dom';
import {
  LayoutDashboard, Users, FileText, CheckSquare, Wallet,
  ChevronLeft, ChevronRight, Shield, LogOut, ExternalLink,
  Target, User, Briefcase, TrendingUp, RefreshCw, Lock, Menu, BookOpen
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { base44 } from '@/api/base44Client';
import { resolveRole, ROLE_LABELS } from '@/lib/rbac';

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
      { label: 'Dashboard', icon: LayoutDashboard, path: '/' },
    ],
  },
  {
    label: 'Vertrieb',
    items: [
      { label: 'Leads',           icon: Target,      path: '/leads' },
      { label: 'Verkaufschancen', icon: TrendingUp,  path: '/verkaufschancen' },
      { label: 'Vertragsabläufe', icon: RefreshCw,   path: '/vertragsablaeufe' },
      { label: 'Aufgaben',        icon: CheckSquare, path: '/aufgaben' },
    ],
  },
  {
    label: 'Kunden & Verträge',
    items: [
      { label: 'Kunden',    icon: Users,    path: '/kunden' },
      { label: 'Verträge',  icon: Shield,   path: '/vertraege' },
      { label: 'Anträge',   icon: FileText, path: '/antraege' },
      { label: 'Dokumente', icon: FileText, path: '/dokumente' },
    ],
  },
  {
    label: 'Administration',
    items: [
      { label: 'Provisionen',           icon: Wallet,    path: '/provisionen-courtagen' },
      { label: 'Berater & Partner',     icon: Briefcase, path: '/berater-organisation' },
      { label: 'Team & Zugriffsrechte', icon: Lock,      path: '/admin/team-zugriffsrechte', adminOnly: true },
      { label: 'System',                icon: Menu,      path: '/admin-logs' },
    ],
  },
  {
    label: 'Enterprise',
    items: [
      { label: 'Beratungsdossiers',      icon: BookOpen, path: '/beratungsdossier',               adminOnly: true },
      { label: 'Enterprise Control Center', icon: Shield,   path: '/admin/enterprise-control-center', adminOnly: true },
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
        'fixed left-0 top-0 h-screen flex flex-col z-50 transition-all duration-300',
        // Enterprise stone/graphite — warm neutral surface (architectural material, not SaaS)
        'bg-[#f7f7f6]',
        'border-r border-[hsl(var(--border-subtle))]',
        collapsed ? 'w-[60px]' : 'w-[224px]'
      )}
      style={{ boxShadow: '4px 0 32px 0 rgba(0,0,0,0.08)' }}
    >
      {/* ── Logo ─────────────────────────────────────────────────────── */}
      <div className={cn(
        'flex items-center h-[60px] border-b border-[hsl(var(--border-default))] flex-shrink-0',
        collapsed ? 'justify-center' : 'gap-3 px-4'
      )}>
        <div className="w-7 h-7 rounded-[8px] bg-[hsl(var(--primary))] flex items-center justify-center flex-shrink-0 shadow-sm">
          <Shield className="w-3.5 h-3.5 text-white" />
        </div>
        {!collapsed && (
          <div className="min-w-0">
            <p className="text-[13px] font-bold text-[hsl(var(--text-heading))] tracking-tight leading-none">Swiss Premium Broker</p>
            <p className="text-[9px] text-[hsl(var(--text-subtle))] font-medium tracking-[0.14em] uppercase mt-0.5">Insurance Platform</p>
          </div>
        )}
      </div>

      {/* ── Navigation ───────────────────────────────────────────────── */}
      <nav className="flex-1 overflow-y-auto py-3 scrollbar-none" style={{ scrollbarWidth: 'none' }}>
        {navGroups.map((group) => (
          <div key={group.label} className="mb-0.5">
            {!collapsed ? (
              <p className="px-4 pt-6 pb-2 text-[9px] font-semibold uppercase tracking-[0.13em] text-[hsl(var(--text-subtle))] select-none">
                {group.label}
              </p>
            ) : (
              <div className="mx-3 my-3 h-px bg-[hsl(var(--border-subtle))]" />
            )}

            <div className={cn('space-y-1', collapsed ? 'px-2' : 'px-2')}>
              {group.items
                .filter(item => !item.adminOnly || isAdmin)
                .map((item) => {
                  const isActive =
                    location.pathname === item.path ||
                    (item.path !== '/' && location.pathname.startsWith(item.path));

                  return (
                    <Link
                      key={item.path}
                      to={item.path}
                      onClick={onNavigate}
                      title={collapsed ? item.label : undefined}
                      className={cn(
                        'relative flex items-center rounded-md transition-all duration-200 group',
                        collapsed ? 'justify-center h-9 w-9 mx-auto' : 'gap-2.5 px-3 py-[9px]',
                        isActive
                          ? 'bg-[hsl(var(--surface-2))] border border-[hsl(var(--border-subtle))]'
                          : 'text-[hsl(var(--text-muted))] hover:text-[hsl(var(--text-heading))] hover:bg-[hsl(var(--surface-2))]/60 border border-transparent'
                      )}
                    >
                      {/* Active left indicator */}
                      {isActive && !collapsed && (
                        <span className="absolute left-0 w-[3px] h-5 rounded-r-full bg-[hsl(var(--primary))]" />
                      )}

                      <item.icon
                        className={cn(
                          'flex-shrink-0 transition-opacity duration-200',
                          collapsed ? 'w-[17px] h-[17px]' : 'w-[14px] h-[14px]',
                          isActive ? 'text-[hsl(var(--primary))]' : 'text-[hsl(var(--text-muted))] opacity-70 group-hover:opacity-100'
                        )}
                        strokeWidth={isActive ? 2.2 : 1.8}
                      />

                      {!collapsed && (
                        <span className={cn(
                          'text-[12.5px] font-medium truncate flex-1 tracking-[-0.005em]',
                          isActive ? 'text-[hsl(var(--text-heading))]' : 'text-[hsl(var(--text-muted))] group-hover:text-[hsl(var(--text-heading))]'
                        )}>
                          {item.label}
                        </span>
                      )}

                      {/* Badge */}
                      {badges[item.path] && (
                        <span className={cn(
                          'text-[9px] font-bold rounded-full flex items-center justify-center flex-shrink-0 leading-none',
                          collapsed
                            ? 'absolute top-0.5 right-0.5 min-w-[13px] h-[13px] px-[3px]'
                            : 'min-w-[16px] h-[16px] px-[4px]',
                          'bg-[hsl(var(--warning))] text-white'
                        )}>
                          {badges[item.path]}
                        </span>
                      )}
                    </Link>
                  );
              })}
            </div>
          </div>
        ))}
      </nav>

      {/* ── Portal Link ───────────────────────────────────────────────── */}
      <div className={cn('px-2 pb-3', collapsed && 'flex justify-center')}>
        <a
          href="/portal"
          target="_blank"
          rel="noopener noreferrer"
          title={collapsed ? 'Kundenportal' : undefined}
          className={cn(
            'flex items-center gap-2 rounded-md text-[11.5px] font-medium text-[hsl(var(--text-muted))] hover:text-[hsl(var(--text-heading))] hover:bg-[hsl(var(--surface-2))] border border-transparent hover:border-[hsl(var(--border-subtle))] transition-all duration-200',
            collapsed ? 'justify-center h-9 w-9 mx-auto' : 'px-3 py-2'
          )}
        >
          <ExternalLink className="w-[12px] h-[12px] flex-shrink-0 opacity-70" />
          {!collapsed && <span>Kundenportal</span>}
        </a>
      </div>

      {/* ── User card — embedded surface with subtle date ───────────────── */}
      {!collapsed && currentUser && (
        <div className="mx-2 mb-2 px-3 py-2.5 rounded-md bg-[hsl(var(--surface-2))] border border-[hsl(var(--border-subtle))]">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="w-6 h-6 rounded-full bg-[hsl(var(--primary))/0.1] flex items-center justify-center flex-shrink-0">
              <User className="w-3.5 h-3.5 text-[hsl(var(--primary))]" />
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-[11.5px] font-semibold text-[hsl(var(--text-heading))] truncate leading-tight">
                {currentUser.full_name || currentUser.email}
              </p>
              <p className="text-[9px] text-[hsl(var(--text-subtle))] font-medium truncate">
                {roleLabel} · {new Date().toLocaleDateString('de-CH', { day: '2-digit', month: '2-digit' })}
              </p>
            </div>
          </div>
        </div>
      )}

      {/* ── Footer ────────────────────────────────────────────────────── */}
      <div className={cn(
        'border-t border-[hsl(var(--border-default))] flex items-center pb-3 pt-2',
        collapsed ? 'flex-col gap-1 px-1' : 'gap-1 px-1'
      )}>
        <button
          onClick={() => base44.auth.logout()}
          title="Abmelden"
          className={cn(
            'flex items-center gap-2 rounded-md text-[12px] font-medium text-[hsl(var(--text-muted))] hover:text-[hsl(var(--text-heading))] hover:bg-[hsl(var(--surface-2))] border border-transparent hover:border-[hsl(var(--border-subtle))] transition-all duration-200',
            collapsed ? 'justify-center h-9 w-9 mx-auto' : 'flex-1 px-3 py-2'
          )}
        >
          <LogOut className="w-[14px] h-[14px] flex-shrink-0 opacity-70" strokeWidth={1.8} />
          {!collapsed && <span>Abmelden</span>}
        </button>

        <button
          onClick={() => setCollapsed(!collapsed)}
          className="flex items-center justify-center h-9 w-9 rounded-md text-[hsl(var(--text-subtle))] hover:text-[hsl(var(--text-heading))] hover:bg-[hsl(var(--surface-2))] border border-transparent hover:border-[hsl(var(--border-subtle))] transition-all duration-200 flex-shrink-0"
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