import React, { useState, useEffect } from 'react';
import { Link, useLocation } from 'react-router-dom';
import {
  LayoutDashboard, Users, FileText, CheckSquare, Wallet,
  ChevronLeft, ChevronRight, Shield, LogOut, ExternalLink,
  Target, User, Briefcase, TrendingUp, RefreshCw, Lock, Menu
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
        // Trust blue — harmonized with dashboard KPI tiles (blue-50/blue-800 palette)
        'bg-[#1e3a5f]',
        'border-r border-white/[0.08]',
        collapsed ? 'w-[60px]' : 'w-[224px]'
      )}
      style={{ boxShadow: '2px 0 20px 0 rgba(0,0,0,0.14)' }}
    >
      {/* ── Logo ─────────────────────────────────────────────────────── */}
      <div className={cn(
        'flex items-center h-[56px] border-b border-white/[0.07] flex-shrink-0',
        collapsed ? 'justify-center' : 'gap-3 px-4'
      )}>
        <div className="w-7 h-7 rounded-[8px] bg-blue-500/90 flex items-center justify-center flex-shrink-0">
          <Shield className="w-3.5 h-3.5 text-white" />
        </div>
        {!collapsed && (
          <div className="min-w-0">
            <p className="text-[13px] font-bold text-white/90 tracking-tight leading-none">Swiss Premium Broker</p>
            <p className="text-[9px] text-white/40 font-medium tracking-[0.14em] uppercase mt-0.5">Insurance Platform</p>
          </div>
        )}
      </div>

      {/* ── Navigation ───────────────────────────────────────────────── */}
      <nav className="flex-1 overflow-y-auto py-3 scrollbar-none" style={{ scrollbarWidth: 'none' }}>
        {navGroups.map((group) => (
          <div key={group.label} className="mb-0.5">
            {!collapsed ? (
              <p className="px-4 pt-4 pb-1.5 text-[9px] font-semibold uppercase tracking-[0.13em] text-white/35 select-none">
                {group.label}
              </p>
            ) : (
              <div className="mx-3 my-2.5 h-px bg-white/[0.07]" />
            )}

            <div className={cn('space-y-px', collapsed ? 'px-2' : 'px-2')}>
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
                        'relative flex items-center rounded-[7px] transition-all duration-150 group',
                        collapsed ? 'justify-center h-9 w-9 mx-auto' : 'gap-2.5 px-3 py-[7px]',
                        isActive
                          ? 'bg-blue-500/[0.18] text-white'
                          : 'text-white/55 hover:text-white/85 hover:bg-white/[0.09]'
                      )}
                    >
                      {/* Active left bar */}
                      {isActive && !collapsed && (
                        <span className="absolute left-0 w-[3px] h-4 rounded-r-full bg-blue-400/90" />
                      )}

                      <item.icon
                        className={cn(
                          'flex-shrink-0 transition-colors',
                          collapsed ? 'w-[17px] h-[17px]' : 'w-[14px] h-[14px]',
                          isActive ? 'text-blue-200' : 'text-white/45 group-hover:text-white/70'
                        )}
                        strokeWidth={isActive ? 2.2 : 1.8}
                      />

                      {!collapsed && (
                        <span className={cn(
                          'text-[12.5px] font-medium truncate flex-1 tracking-[-0.005em]',
                          isActive ? 'text-white/95' : 'text-white/60 group-hover:text-white/85'
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
                          'bg-amber-500/90 text-white'
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
      <div className={cn('px-2 pb-2', collapsed && 'flex justify-center')}>
        <a
          href="/portal"
          target="_blank"
          rel="noopener noreferrer"
          title={collapsed ? 'Kundenportal' : undefined}
          className={cn(
            'flex items-center gap-2 rounded-[7px] text-[11.5px] font-medium text-white/28 hover:text-white/58 hover:bg-white/[0.06] transition-all border border-white/[0.08]',
            collapsed ? 'justify-center h-8 w-8 mx-auto' : 'px-3 py-1.5'
          )}
        >
          <ExternalLink className="w-[12px] h-[12px] flex-shrink-0" />
          {!collapsed && <span>Kundenportal</span>}
        </a>
      </div>

      {/* ── User card ─────────────────────────────────────────────────── */}
      {!collapsed && currentUser && (
        <div className="mx-2 mb-2 px-3 py-2 rounded-[8px] bg-white/[0.05] border border-white/[0.07]">
          <div className="flex items-center gap-2 min-w-0">
            <div className="w-6 h-6 rounded-full bg-blue-400/20 flex items-center justify-center flex-shrink-0">
              <User className="w-3 h-3 text-blue-300/80" />
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-[11.5px] font-semibold text-white/80 truncate leading-tight">
                {currentUser.full_name || currentUser.email}
              </p>
              <p className="text-[9.5px] text-white/45 font-medium">{roleLabel}</p>
            </div>
          </div>
        </div>
      )}

      {/* ── Footer ────────────────────────────────────────────────────── */}
      <div className={cn(
        'border-t border-white/[0.07] flex items-center pb-2 pt-1',
        collapsed ? 'flex-col gap-1 px-1' : 'gap-1 px-1'
      )}>
        <button
          onClick={() => base44.auth.logout()}
          title="Abmelden"
          className={cn(
            'flex items-center gap-2 rounded-[7px] text-[12px] font-medium text-white/30 hover:text-white/65 hover:bg-white/[0.06] transition-all',
            collapsed ? 'justify-center h-8 w-8 mx-auto' : 'flex-1 px-3 py-1.5'
          )}
        >
          <LogOut className="w-[14px] h-[14px] flex-shrink-0" strokeWidth={1.8} />
          {!collapsed && <span>Abmelden</span>}
        </button>

        <button
          onClick={() => setCollapsed(!collapsed)}
          className="flex items-center justify-center h-8 w-8 rounded-[7px] text-white/22 hover:text-white/55 hover:bg-white/[0.06] transition-all flex-shrink-0"
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