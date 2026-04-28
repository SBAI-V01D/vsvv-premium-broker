import React, { useState } from 'react';
import { Outlet, Link, useLocation } from 'react-router-dom';
import { Shield, FileText, AlertCircle, FolderOpen, MessageSquare, LogOut, Menu, X, User } from 'lucide-react';
import { cn } from '@/lib/utils';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';

const navItems = [
  { label: 'Übersicht', icon: Shield, path: '/portal' },
  { label: 'Mein Profil', icon: User, path: '/portal/profil' },
  { label: 'Meine Verträge', icon: FileText, path: '/portal/vertraege' },
  { label: 'Schadensmeldungen', icon: AlertCircle, path: '/portal/schaden' },
  { label: 'Dokumente', icon: FolderOpen, path: '/portal/dokumente' },
  { label: 'Nachrichten', icon: MessageSquare, path: '/portal/nachrichten' },
];

export default function PortalLayout({ user }) {
  const location = useLocation();
  const [mobileOpen, setMobileOpen] = useState(false);

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col">
      {/* Top Nav */}
      <header className="bg-white border-b border-slate-200 sticky top-0 z-40">
        <div className="max-w-6xl mx-auto px-4 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-primary flex items-center justify-center">
              <Shield className="w-4 h-4 text-white" />
            </div>
            <span className="font-bold text-foreground text-base hidden sm:block">Mein Versicherungsportal</span>
            <span className="font-bold text-foreground text-base sm:hidden">Portal</span>
          </div>

          {/* Desktop Nav */}
          <nav className="hidden md:flex items-center gap-1">
            {navItems.map(item => {
              const isActive = location.pathname === item.path;
              return (
                <Link key={item.path} to={item.path}
                  className={cn(
                    "flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium transition-colors",
                    isActive ? "bg-primary/10 text-primary" : "text-slate-600 hover:bg-slate-100"
                  )}>
                  <item.icon className="w-4 h-4" />
                  {item.label}
                </Link>
              );
            })}
          </nav>

          <div className="flex items-center gap-2">
            {user && (
              <span className="hidden sm:block text-sm text-slate-500">
                {user.full_name || user.email}
              </span>
            )}
            <Button variant="ghost" size="sm" onClick={() => base44.auth.logout()} className="text-slate-600 hover:text-destructive">
              <LogOut className="w-4 h-4" />
              <span className="hidden sm:inline ml-1">Abmelden</span>
            </Button>
            <Button variant="ghost" size="icon" className="md:hidden" onClick={() => setMobileOpen(!mobileOpen)}>
              {mobileOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
            </Button>
          </div>
        </div>

        {/* Mobile Nav */}
        {mobileOpen && (
          <div className="md:hidden border-t border-slate-200 bg-white px-4 py-3 space-y-1">
            {navItems.map(item => {
              const isActive = location.pathname === item.path;
              return (
                <Link key={item.path} to={item.path}
                  onClick={() => setMobileOpen(false)}
                  className={cn(
                    "flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors",
                    isActive ? "bg-primary/10 text-primary" : "text-slate-600 hover:bg-slate-100"
                  )}>
                  <item.icon className="w-4 h-4" />
                  {item.label}
                </Link>
              );
            })}
          </div>
        )}
      </header>

      {/* Content */}
      <main className="flex-1 max-w-6xl mx-auto w-full px-4 py-8">
        <Outlet context={{ user }} />
      </main>

      <footer className="border-t border-slate-200 bg-white py-4 text-center text-xs text-slate-400">
        © {new Date().getFullYear()} BrokerCRM – Sicher & verschlüsselt
      </footer>
    </div>
  );
}