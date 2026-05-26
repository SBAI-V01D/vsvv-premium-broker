import React, { useState } from 'react'
import { Outlet, useLocation } from 'react-router-dom'
import Sidebar from './Sidebar'
import { Menu } from 'lucide-react'
import { cn } from '@/lib/utils'

export default function AppLayout() {
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false)
  const location = useLocation()

  return (
    <div className="min-h-screen bg-[hsl(var(--app-shell))] flex">
      {/* Mobile overlay */}
      {mobileSidebarOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/40 lg:hidden"
          onClick={() => setMobileSidebarOpen(false)}
        />
      )}

      {/* Sidebar — floating on desktop, drawer on mobile */}
      <div className={cn(
        'fixed left-0 top-0 h-screen z-50 transition-transform duration-300',
        'lg:translate-x-0',
        mobileSidebarOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'
      )}>
        <Sidebar onNavigate={() => setMobileSidebarOpen(false)} />
      </div>

      {/* Main content — offset by floating sidebar */}
      <div className="flex-1 flex flex-col min-w-0 lg:ml-[260px]">

        {/* Mobile topbar */}
        <div className="lg:hidden flex items-center gap-3 px-4 h-14 border-b border-border bg-card sticky top-0 z-30">
          <button
            onClick={() => setMobileSidebarOpen(true)}
            className="p-2 rounded-lg hover:bg-muted transition-colors"
          >
            <Menu className="w-5 h-5" />
          </button>
          <span className="font-semibold text-sm">Swiss Premium Broker</span>
        </div>

        {/* Page content */}
        <main className="flex-1 overflow-auto">
          <div className="mx-auto px-5 sm:px-6 lg:px-8 py-6 lg:py-7 pb-12 w-full max-w-[1920px]">
            <Outlet />
          </div>
        </main>
      </div>
    </div>
  )
}