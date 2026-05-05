import React from 'react'
import { Outlet, Link, useLocation } from 'react-router-dom'
import { LayoutDashboard, Users, FileText, CheckCircle2, ClipboardList, FileCheck, Mail, Send, LogOut, Settings2, Wallet, Building2, Terminal } from 'lucide-react'
import { base44 } from '@/api/base44Client'
import { Button } from '@/components/ui/button'

export default function AppLayout() {
  const location = useLocation()

  const navItems = [
    { path: '/', label: 'Dashboard', icon: LayoutDashboard },
    { path: '/kunden', label: 'Kunden', icon: Users },
    { path: '/vertraege', label: 'Verträge', icon: FileText },
    { path: '/antraege', label: 'Anträge', icon: CheckCircle2 },
    { path: '/aufgaben', label: 'Aufgaben', icon: ClipboardList },
    { path: '/provisionen-courtagen', label: 'Provisionen & Courtagen', icon: Wallet },
    { path: '/dokumente', label: 'Dokumente', icon: FileCheck },
    { path: '/email-templates', label: 'E-Mail Vorlagen', icon: Mail },
    { path: '/email-kampagnen', label: 'Kampagnen', icon: Send },
    { path: '/status-verwaltung', label: 'Statusverwaltung', icon: Settings2 },
    { path: '/berater-organisation', label: 'Berater & Organisation', icon: Building2 },
    { path: '/system-logs', label: 'System-Logs', icon: Terminal },
  ]

  const handleLogout = async () => {
    await base44.auth.logout('/')
  }

  return (
    <div className="min-h-screen bg-background flex">
      {/* Sidebar */}
      <div className="w-64 bg-card border-r border-border p-4 flex flex-col">
        <div className="mb-8">
          <h2 className="text-xl font-bold">CRM Broker</h2>
          <p className="text-xs text-muted-foreground">Verwaltungspanel</p>
        </div>

        <nav className="space-y-2 flex-1">
          {navItems.map(item => {
            const Icon = item.icon
            const isActive = location.pathname === item.path || (item.path !== '/' && location.pathname.startsWith(item.path))
            return (
              <Link
                key={item.path}
                to={item.path}
                className={`flex items-center gap-3 px-3 py-2 rounded-lg transition-colors text-sm ${
                  isActive
                    ? 'bg-primary text-primary-foreground'
                    : 'text-muted-foreground hover:bg-muted'
                }`}
              >
                <Icon className="w-4 h-4" />
                <span className="font-medium">{item.label}</span>
              </Link>
            )
          })}
        </nav>

        <div className="border-t border-border pt-4 space-y-2">
          <Button variant="outline" className="w-full justify-start gap-2" asChild>
            <a href="/portal" target="_blank" rel="noopener noreferrer">
              Kundenportal
            </a>
          </Button>
          <Button variant="outline" className="w-full justify-start gap-2 text-destructive" onClick={handleLogout}>
            <LogOut className="w-4 h-4" />
            Abmelden
          </Button>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 overflow-auto">
        <div className="p-8">
          <Outlet />
        </div>
      </div>
    </div>
  )
}