import React, { useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import {
  LayoutDashboard, Users, FileText, CheckSquare, Wallet,
  ChevronLeft, ChevronRight, Shield, LogOut, ExternalLink, AlertCircle,
  Megaphone, TrendingUp, Mail, Zap, Target, ShieldCheck, BarChart3
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { base44 } from '@/api/base44Client';

// Grouped navigation with section separators
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
      { label: 'Lead Pipeline', icon: Target, path: '/leads' },
      { label: 'Coverage & Upselling', icon: ShieldCheck, path: '/coverage-intelligence' },
    ],
  },
  {
    label: 'Kundenverwaltung',
    items: [
      { label: 'Kunden', icon: Users, path: '/kunden' },
      { label: 'Verträge', icon: FileText, path: '/vertraege' },
      { label: 'Anträge', icon: FileText, path: '/antraege' },
    ],
  },
  {
    label: 'Operations',
    items: [
      { label: 'Aufgaben', icon: CheckSquare, path: '/aufgaben' },
      { label: 'Dokumente', icon: FileText, path: '/dokumente' },
      { label: 'Nachrichten', icon: Mail, path: '/nachrichten' },
    ],
  },
  {
    label: 'Finanzen',
    items: [
      { label: 'Provisionen & Courtagen', icon: Wallet, path: '/provisionen-courtagen' },
      { label: 'Finanz-Dashboard', icon: BarChart3, path: '/finanz-dashboard' },
    ],
  },
  {
    label: 'Management',
    items: [
      { label: 'Berater & Organisation', icon: Users, path: '/berater-organisation' },
      { label: 'Sales Autopilot', icon: Zap, path: '/sales-autopilot' },
      { label: 'E-Mail-Kampagnen', icon: Megaphone, path: '/email-kampagnen' },
      { label: 'Status-Verwaltung', icon: CheckSquare, path: '/status-verwaltung' },
      { label: 'System-Logs', icon: AlertCircle, path: '/system-logs' },
    ],
  },
];

export default function Sidebar({ onNavigate }) {
  const [collapsed, setCollapsed] = useState(false);
  const location = useLocation();

  return (
    <aside className={cn(
      "fixed left-0 top-0 h-screen bg-sidebar text-sidebar-foreground flex flex-col z-50 transition-all duration-300 border-r border-sidebar-border",
      collapsed ? "w-16" : "w-60"
    )}>
      {/* Logo */}
      <div className="flex items-center gap-3 px-4 h-16 border-b border-sidebar-border">
        <div className="w-8 h-8 rounded-lg bg-sidebar-primary flex items-center justify-center flex-shrink-0">
          <Shield className="w-4 h-4 text-sidebar-primary-foreground" />
        </div>
        {!collapsed && (
          <span className="text-base font-bold text-sidebar-primary-foreground tracking-tight">
            BrokerCRM
          </span>
        )}
      </div>

      {/* Nav */}
      <nav className="flex-1 py-3 px-2 overflow-y-auto space-y-1">
        {navGroups.map((group) => (
          <div key={group.label}>
            {!collapsed && (
              <p className="px-3 pt-3 pb-1 text-[10px] font-semibold uppercase tracking-widest text-sidebar-foreground/40 select-none">
                {group.label}
              </p>
            )}
            {collapsed && <div className="my-1 mx-2 border-t border-sidebar-border opacity-30" />}
            {group.items.map((item) => {
              const isActive = location.pathname === item.path ||
                (item.path !== '/' && location.pathname.startsWith(item.path));
              return (
                <Link
                  key={item.path}
                  to={item.path}
                  onClick={onNavigate}
                  className={cn(
                    "flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-all duration-200",
                    isActive
                      ? "bg-sidebar-primary text-sidebar-primary-foreground shadow-sm"
                      : "text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
                  )}
                >
                  <item.icon className="w-4 h-4 flex-shrink-0" />
                  {!collapsed && <span className="truncate">{item.label}</span>}
                </Link>
              );
            })}
          </div>
        ))}
      </nav>

      {/* Portal Link */}
      <div className="px-2 pb-2">
        <a
          href="/portal"
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground transition-all border border-sidebar-border"
        >
          <ExternalLink className="w-4 h-4 flex-shrink-0" />
          {!collapsed && <span>Kundenportal</span>}
        </a>
      </div>

      {/* Bottom */}
      <div className="p-2 border-t border-sidebar-border space-y-1">
        <button
          onClick={() => base44.auth.logout()}
          className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground transition-all w-full"
        >
          <LogOut className="w-5 h-5 flex-shrink-0" />
          {!collapsed && <span>Abmelden</span>}
        </button>
        <button
          onClick={() => setCollapsed(!collapsed)}
          className="flex items-center justify-center w-full py-2 rounded-lg text-sidebar-foreground hover:bg-sidebar-accent transition-all"
        >
          {collapsed ? <ChevronRight className="w-4 h-4" /> : <ChevronLeft className="w-4 h-4" />}
        </button>
      </div>
    </aside>
  );
}