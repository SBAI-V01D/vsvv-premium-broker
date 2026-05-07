import React, { useState, useEffect } from 'react';
import { Link, useLocation } from 'react-router-dom';
import {
  LayoutDashboard, Users, FileText, CheckSquare, Wallet,
  ChevronLeft, ChevronRight, Shield, LogOut, ExternalLink, AlertCircle,
  Megaphone, Mail, Zap, Target, ShieldCheck, BarChart3, User
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { base44 } from '@/api/base44Client';
import { resolveRole, ROLE_LABELS } from '@/lib/rbac';

const navGroups = [
  {
    label: 'Übersicht',
    items: [
      { label: 'Dashboard', icon: LayoutDashboard, path: '/' },
    ],
  },
  {
    label: 'Akquisition',
    items: [
      { label: 'Lead Pipeline',       icon: Target,    path: '/leads' },
      { label: 'Coverage & Upselling',icon: ShieldCheck,path: '/coverage-intelligence' },
    ],
  },
  {
    label: 'Kundenverwaltung',
    items: [
      { label: 'Kunden',   icon: Users,    path: '/kunden' },
      { label: 'Verträge', icon: FileText, path: '/vertraege' },
      { label: 'Anträge',  icon: FileText, path: '/antraege' },
    ],
  },
  {
    label: 'Operations',
    items: [
      { label: 'Aufgaben',    icon: CheckSquare, path: '/aufgaben' },
      { label: 'Dokumente',   icon: FileText,    path: '/dokumente' },
      { label: 'Nachrichten', icon: Mail,        path: '/nachrichten' },
    ],
  },
  {
    label: 'Finanzen',
    items: [
      { label: 'Provisionen & Courtagen', icon: Wallet,   path: '/provisionen-courtagen' },
      { label: 'Finanz-Dashboard',        icon: BarChart3, path: '/finanz-dashboard' },
    ],
  },
  {
    label: 'Management',
    items: [
      { label: 'Berater & Organisation', icon: Users,        path: '/berater-organisation' },
      { label: 'Sales Autopilot',        icon: Zap,          path: '/sales-autopilot' },
      { label: 'E-Mail-Kampagnen',       icon: Megaphone,    path: '/email-kampagnen' },
      { label: 'Status-Verwaltung',      icon: CheckSquare,  path: '/status-verwaltung' },
      { label: 'System-Logs',            icon: AlertCircle,  path: '/system-logs' },
    ],
  },
];

export default function Sidebar({ onNavigate }) {
  const [collapsed, setCollapsed] = useState(false);
  const [currentUser, setCurrentUser] = useState(null);
  const location = useLocation();

  useEffect(() => {
    base44.auth.me().then(u => setCurrentUser(u)).catch(() => {});
  }, []);

  const role = resolveRole(currentUser);
  const roleLabel = ROLE_LABELS[role] || '';

  return (
    <aside
      className={cn(
        'fixed left-0 top-0 h-screen flex flex-col z-50 transition-all duration-300',
        'border-r border-white/[0.06]',
        // Premium deep navy — matches enterprise financial SaaS
        'bg-[#0f1623]',
        collapsed ? 'w-[64px]' : 'w-[232px]'
      )}
      style={{ boxShadow: '4px 0 24px 0 rgba(0,0,0,0.18)' }}
    >

      {/* ── Logo / Brand ─────────────────────────────────────────────── */}
      <div className={cn(
        'flex items-center h-[60px] border-b border-white/[0.06] flex-shrink-0',
        collapsed ? 'justify-center px-0' : 'gap-3 px-5'
      )}>
        <div className="w-8 h-8 rounded-[10px] bg-blue-500 flex items-center justify-center flex-shrink-0 shadow-lg shadow-blue-500/30">
          <Shield className="w-4 h-4 text-white" />
        </div>
        {!collapsed && (
          <div>
            <span className="text-[15px] font-bold text-white tracking-tight leading-none">BrokerOS</span>
            <p className="text-[10px] text-white/35 font-medium tracking-widest uppercase mt-0.5">Insurance Platform</p>
          </div>
        )}
      </div>

      {/* ── Navigation ───────────────────────────────────────────────── */}
      <nav className="flex-1 overflow-y-auto py-4 scrollbar-none" style={{ scrollbarWidth: 'none' }}>
        {navGroups.map((group) => (
          <div key={group.label} className="mb-1">
            {/* Section label */}
            {!collapsed ? (
              <p className="px-5 pt-3 pb-1.5 text-[9.5px] font-semibold uppercase tracking-[0.12em] text-white/25 select-none">
                {group.label}
              </p>
            ) : (
              <div className="mx-3 my-2 border-t border-white/[0.07]" />
            )}

            {/* Nav items */}
            <div className={cn('space-y-0.5', collapsed ? 'px-2' : 'px-3')}>
              {group.items.map((item) => {
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
                      'flex items-center rounded-[8px] transition-all duration-150 group',
                      collapsed ? 'justify-center h-9 w-9 mx-auto' : 'gap-2.5 px-3 py-2',
                      isActive
                        ? 'bg-blue-500/[0.15] text-blue-400'
                        : 'text-white/50 hover:text-white/90 hover:bg-white/[0.05]'
                    )}
                  >
                    {/* Active indicator bar */}
                    {isActive && !collapsed && (
                      <span className="absolute left-0 w-[3px] h-5 rounded-r-full bg-blue-400 -ml-3" />
                    )}
                    <item.icon
                      className={cn(
                        'flex-shrink-0 transition-colors',
                        collapsed ? 'w-[18px] h-[18px]' : 'w-[15px] h-[15px]',
                        isActive ? 'text-blue-400' : 'text-white/40 group-hover:text-white/70'
                      )}
                    />
                    {!collapsed && (
                      <span className={cn(
                        'text-[13px] font-medium truncate tracking-[-0.01em]',
                        isActive ? 'text-blue-300' : 'text-white/55 group-hover:text-white/90'
                      )}>
                        {item.label}
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
      <div className={cn('px-3 pb-2', collapsed && 'flex justify-center')}>
        <a
          href="/portal"
          target="_blank"
          rel="noopener noreferrer"
          title={collapsed ? 'Kundenportal' : undefined}
          className={cn(
            'flex items-center gap-2.5 rounded-[8px] text-[12px] font-medium text-white/35 hover:text-white/70 hover:bg-white/[0.05] transition-all border border-white/[0.07]',
            collapsed ? 'justify-center h-9 w-9 mx-auto' : 'px-3 py-2'
          )}
        >
          <ExternalLink className="w-[14px] h-[14px] flex-shrink-0" />
          {!collapsed && <span>Kundenportal</span>}
        </a>
      </div>

      {/* ── User Card ────────────────────────────────────────────────── */}
      {!collapsed && currentUser && (
        <div className="mx-3 mb-2 px-3 py-2.5 rounded-[10px] bg-white/[0.05] border border-white/[0.06]">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="w-7 h-7 rounded-full bg-blue-500/20 flex items-center justify-center flex-shrink-0">
              <User className="w-3.5 h-3.5 text-blue-400" />
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-[12px] font-semibold text-white/80 truncate leading-tight">
                {currentUser.full_name || currentUser.email}
              </p>
              <p className="text-[10px] text-white/30 font-medium mt-0.5">{roleLabel}</p>
            </div>
          </div>
        </div>
      )}

      {/* ── Bottom Actions ───────────────────────────────────────────── */}
      <div className={cn(
        'border-t border-white/[0.06] flex items-center pb-2 pt-1',
        collapsed ? 'flex-col gap-1 px-2' : 'gap-1 px-2'
      )}>
        <button
          onClick={() => base44.auth.logout()}
          title="Abmelden"
          className={cn(
            'flex items-center gap-2.5 rounded-[8px] text-[13px] font-medium text-white/35 hover:text-white/70 hover:bg-white/[0.05] transition-all',
            collapsed ? 'justify-center h-9 w-9 mx-auto' : 'flex-1 px-3 py-2'
          )}
        >
          <LogOut className="w-[15px] h-[15px] flex-shrink-0" />
          {!collapsed && <span>Abmelden</span>}
        </button>

        <button
          onClick={() => setCollapsed(!collapsed)}
          className="flex items-center justify-center h-8 w-8 rounded-[8px] text-white/25 hover:text-white/60 hover:bg-white/[0.05] transition-all flex-shrink-0"
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