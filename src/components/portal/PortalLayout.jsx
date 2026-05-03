import React from 'react'
import { useLocation, Link } from 'react-router-dom'
import { LayoutDashboard, FileText, CheckCircle2, FileCheck, User, LogOut } from 'lucide-react'
import { base44 } from '@/api/base44Client'
import { Button } from '@/components/ui/button'

export default function PortalLayout({ children }) {
  const location = useLocation()

  const navItems = [
    { path: '/portal', label: 'Dashboard', icon: LayoutDashboard },
    { path: '/portal/vertraege', label: 'Verträge', icon: FileText },
    { path: '/portal/antraege', label: 'Anträge', icon: CheckCircle2 },
    { path: '/portal/dokumente', label: 'Dokumente', icon: FileCheck },
    { path: '/portal/profil', label: 'Profil', icon: User },
  ]

  const handleLogout = () => {
    localStorage.removeItem('portal_customer_id')
    localStorage.removeItem('portal_email')
    window.location.href = '/portal/setup'
  }

  return (
    <div className="min-h-screen bg-background flex">
      {/* Sidebar */}
      <div className="w-64 bg-card border-r border-border p-4">
        <div className="mb-8">
          <h2 className="text-xl font-bold">CRM Portal</h2>
          <p className="text-xs text-muted-foreground">Kundenbereich</p>
        </div>

        <nav className="space-y-2">
          {navItems.map(item => {
            const Icon = item.icon
            const isActive = location.pathname === item.path
            return (
              <Link
                key={item.path}
                to={item.path}
                className={`flex items-center gap-3 px-3 py-2 rounded-lg transition-colors ${
                  isActive
                    ? 'bg-primary text-primary-foreground'
                    : 'text-muted-foreground hover:bg-muted'
                }`}
              >
                <Icon className="w-4 h-4" />
                <span className="text-sm font-medium">{item.label}</span>
              </Link>
            )
          })}
        </nav>

        <div className="mt-auto pt-4 border-t border-border">
          <Button variant="outline" className="w-full justify-start gap-2 text-destructive" onClick={handleLogout}>
            <LogOut className="w-4 h-4" />
            Abmelden
          </Button>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 p-6 md:p-8">
        {children}
      </div>
    </div>
  )
}