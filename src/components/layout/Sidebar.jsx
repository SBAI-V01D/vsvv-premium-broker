import React, { useState, useEffect } from 'react';
import { Link, useLocation } from 'react-router-dom';
import {
  LayoutDashboard, Users, FileText, CheckSquare, Wallet,
  ChevronLeft, ChevronRight, Shield, LogOut, ExternalLink,
  User, Briefcase, TrendingUp, Lock, BookOpen, Activity,
  Brain, BarChart2, UserPlus, FolderOpen, RefreshCw, Building2,
  Database
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { base44 } from '@/api/base44Client';
import { resolveRole, ROLE_LABELS } from '@/lib/rbac';
import GlobalSearch from './GlobalSearch';

/* ── Design Tokens (alle Hex, ein Ort) ─────────────────────────── */
const T = {
  bg:          '#F0F2F5',   // App-Grau — identisch mit Hauptfläche
  border:      '#E2E6EC',   // subtile Trennlinie
  navy:        '#1B2B4A',   // Primärfarbe
  navyMid:     '#2E4270',   // etwas heller
  gold:        '#C9A84C',   // Gold-Akzent
  goldLight:   '#FBF3E0',   // Gold-Hintergrund aktives Item
  itemFg:      '#3D5070',   // Nav-Label normal
  itemFgMuted: '#7A90B0',   // Gruppen-Label
  itemHover:   '#E8EDF5',   // Hover-Hintergrund
  activeStripe:'#C9A84C',   // Gold-Stripe links aktives Item
  activeBg:    '#FFFFFF',   // weiss — aktives Item
  activeFg:    '#1B2B4A',   // Navy-Text aktives Item
  badgeWarn:   '#D97706',   // amber
  badgePrim:   '#1B2B4A',   // navy
  footerFg:    '#5A7090',
};

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
      { label: 'Vertragsabläufe',  icon: RefreshCw,   path: '/vertragsablaeufe', color: 'warning' },
      { label: 'Aufgaben',         icon: CheckSquare, path: '/aufgaben',         color: 'warning' },
    ],
  },
  {
    label: 'Kunden',
    items: [
      { label: 'Kundenübersicht',  icon: Users,       path: '/kunden' },
      { label: 'Verkaufschancen',  icon: TrendingUp,  path: '/verkaufschancen', color: 'primary' },
      { label: 'Leads',            icon: UserPlus,    path: '/leads',           color: 'warning' },
      { label: 'Krankenkassenvergleich', icon: Shield, path: '/krankenkassen-vergleich' },
      { label: 'Beratungsdossiers',icon: BookOpen,    path: '/beratungsdossier' },
      { label: 'Kundenportal',     icon: ExternalLink, path: '/portal', external: true },
    ],
  },
  {
    label: 'Ausschreibungen',
    items: [
      { label: 'Ausschreibungen',  icon: BarChart2,   path: '/ausschreibungen' },
      { label: 'Versicherer DB',   icon: Building2,   path: '/ausschreibungen/versicherer' },
    ],
  },
  {
    label: 'Verwaltung',
    items: [
      { label: 'Verträge',         icon: FileText,    path: '/vertraege' },
      { label: 'Anträge',          icon: CheckSquare, path: '/antraege' },
      { label: 'Dokumente',        icon: FolderOpen,  path: '/dokumente',        color: 'primary' },
      { label: 'Dok.-Extraktor',   icon: Brain,       path: '/dokument-extraktor' },
    ],
  },
  {
    label: 'Finanzen & Team',
    items: [
      { label: 'Reporting',        icon: BarChart2,   path: '/reporting' },
      { label: 'Provisionen',      icon: Wallet,      path: '/provisionen-courtagen' },
      { label: 'Finanzdashboard',  icon: BarChart2,   path: '/finanz-dashboard' },
    ],
  },
  {
    label: 'Enterprise',
    items: [
      { label: 'Berater & Partner',     icon: Briefcase, path: '/berater-organisation' },
      { label: 'Team & Zugriffsrechte', icon: Lock,      path: '/admin/team-zugriffsrechte', adminOnly: true },
      { label: 'Admin Dashboard',       icon: Shield,    path: '/admin/enterprise-control-center', adminOnly: true },
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
        background: T.bg,
        border: `1px solid ${T.border}`,
        boxShadow: '0 2px 16px 0 rgba(27,43,74,0.07), 0 1px 4px 0 rgba(27,43,74,0.04)',
      }}
    >
      {/* ── Header ─────────────────────────────── */}
      <div
        className={cn(
          'flex items-center h-[58px] flex-shrink-0',
          collapsed ? 'justify-center' : 'gap-3 px-4'
        )}
        style={{ borderBottom: `1px solid ${T.border}` }}
      >
        <div
          className="w-7 h-7 rounded-[8px] flex items-center justify-center flex-shrink-0 shadow-sm"
          style={{ background: T.navy }}
        >
          <User className="w-3.5 h-3.5 text-white" />
        </div>
        {!collapsed && currentUser && (
          <div className="min-w-0">
            <p className="text-[13px] font-bold tracking-tight leading-none truncate" style={{ color: T.navy }}>
              {currentUser.full_name || currentUser.email}
            </p>
            <p className="text-[10px] font-medium tracking-[0.10em] uppercase mt-0.5" style={{ color: T.itemFgMuted }}>
              {roleLabel || 'Swiss Premium Broker'}
            </p>
          </div>
        )}
        {!collapsed && !currentUser && (
          <div className="min-w-0">
            <p className="text-[13px] font-bold tracking-tight leading-none" style={{ color: T.navy }}>
              Swiss Premium Broker
            </p>
          </div>
        )}
      </div>

      {/* ── Navigation ─────────────────────────────────────────────────── */}
      <nav className="flex-1 overflow-y-auto py-3 scrollbar-none" style={{ scrollbarWidth: 'none' }}>
        {navGroups.map((group) => (
          <div key={group.label} className="mb-0.5">
            {!collapsed ? (
              <p
                className="px-4 pt-5 pb-1.5 text-[10px] font-bold uppercase tracking-widest select-none"
                style={{ color: T.itemFgMuted }}
              >
                {group.label}
              </p>
            ) : (
              <div className="mx-3 my-3 h-px" style={{ background: T.border }} />
            )}

            <div className={cn('space-y-0.5', 'px-2')}>
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
                        )}
                        style={{ color: T.itemFg }}
                        onMouseEnter={e => e.currentTarget.style.background = T.itemHover}
                        onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                      >
                        <item.icon
                          className={cn(
                            'flex-shrink-0 transition-colors duration-200',
                            collapsed ? 'w-[17px] h-[17px]' : 'w-[14px] h-[14px]',
                          )}
                          strokeWidth={1.8}
                          style={{ color: T.itemFgMuted }}
                        />
                        {!collapsed && (
                          <span className="text-[12.5px] font-medium truncate flex-1 tracking-[-0.005em]" style={{ color: T.itemFg }}>
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
                        )}
                        style={isActive
                          ? { background: T.activeBg, boxShadow: '0 1px 4px 0 rgba(27,43,74,0.08)' }
                          : { color: T.itemFg }
                        }
                        onMouseEnter={e => { if (!isActive) e.currentTarget.style.background = T.itemHover; }}
                        onMouseLeave={e => { if (!isActive) e.currentTarget.style.background = 'transparent'; }}
                      >
                        {/* Gold-Stripe links für aktives Item */}
                        {isActive && !collapsed && (
                          <span
                            className="absolute left-0 w-[3px] h-5 rounded-r-full"
                            style={{ background: T.gold }}
                          />
                        )}
                        <item.icon
                          className={cn(
                            'flex-shrink-0 transition-colors duration-200',
                            collapsed ? 'w-[17px] h-[17px]' : 'w-[14px] h-[14px]',
                          )}
                          strokeWidth={isActive ? 2.2 : 1.8}
                          style={{ color: isActive ? T.navy : T.itemFgMuted }}
                        />
                        {!collapsed && (
                          <span
                            className="text-[12.5px] truncate flex-1 tracking-[-0.005em]"
                            style={{
                              color: isActive ? T.activeFg : T.itemFg,
                              fontWeight: isActive ? 600 : 500,
                            }}
                          >
                            {item.label}
                          </span>
                        )}
                        {badges[item.path] && (
                          <span
                            className={cn(
                              'text-[9px] font-bold rounded-full flex items-center justify-center flex-shrink-0 leading-none',
                              collapsed
                                ? 'absolute top-0.5 right-0.5 min-w-[13px] h-[13px] px-[3px]'
                                : 'min-w-[16px] h-[16px] px-[4px]',
                            )}
                            style={{
                              background: isActive
                                ? T.gold
                                : item.color === 'primary'
                                  ? T.badgePrim
                                  : T.badgeWarn,
                              color: '#fff',
                            }}
                          >
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
      <div
        className={cn(
          'flex items-center pb-3 pt-2',
          collapsed ? 'flex-col gap-1 px-1' : 'gap-1 px-1'
        )}
        style={{ borderTop: `1px solid ${T.border}` }}
      >
        <button
          onClick={() => base44.auth.logout()}
          title="Abmelden"
          className={cn(
            'flex items-center gap-2 rounded-xl text-[12px] font-medium transition-all duration-200',
            collapsed ? 'justify-center h-9 w-9 mx-auto' : 'flex-1 px-3 py-2'
          )}
          style={{ color: T.footerFg }}
          onMouseEnter={e => e.currentTarget.style.background = T.itemHover}
          onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
        >
          <LogOut className="w-[14px] h-[14px] flex-shrink-0 opacity-70" strokeWidth={1.8} />
          {!collapsed && <span>Abmelden</span>}
        </button>

        <button
          onClick={() => setCollapsed(!collapsed)}
          className="flex items-center justify-center h-9 w-9 rounded-xl transition-all duration-200 flex-shrink-0"
          style={{ color: T.footerFg }}
          title={collapsed ? 'Erweitern' : 'Einklappen'}
          onMouseEnter={e => e.currentTarget.style.background = T.itemHover}
          onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
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