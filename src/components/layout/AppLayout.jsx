import React, { useState } from 'react'
import { Outlet, useLocation } from 'react-router-dom'
import Sidebar from './Sidebar'
import QuickSearchBar from './QuickSearchBar'
import { Menu } from 'lucide-react'
import { cn } from '@/lib/utils'

export default function AppLayout() {
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false)
  const location = useLocation()

  return (
    <div className="min-h-screen bg-background flex">
      {/* Mobile overlay */}
      {mobileSidebarOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/50 lg:hidden"
          onClick={() => setMobileSidebarOpen(false)}
        />
      )}

      {/* Sidebar — always visible on desktop, drawer on mobile */}
      <div className={cn(
        'fixed left-0 top-0 h-screen z-50 transition-transform duration-300',
        'lg:translate-x-0',
        mobileSidebarOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'
      )}>
        <Sidebar onNavigate={() => setMobileSidebarOpen(false)} />
      </div>

      {/* Main content — offset by sidebar width */}
      <div className="flex-1 flex flex-col min-w-0 lg:ml-[224px]">
        {/* Desktop topbar with search */}
        <div className="hidden lg:flex items-center gap-4 px-6 h-[50px] border-b border-border/70 bg-card/95 backdrop-blur-sm sticky top-0 z-30">
          <QuickSearchBar />
          <div className="ml-auto flex items-center gap-2">
            <span className="text-[11px] text-muted-foreground/60 font-medium tabular-nums">
              {new Date().toLocaleDateString('de-CH', { weekday: 'long', day: '2-digit', month: 'long', year: 'numeric' })}
            </span>
          </div>
        </div>

        {/* Mobile topbar */}
        <div className="lg:hidden flex items-center gap-3 px-4 h-14 border-b border-border bg-card sticky top-0 z-30">
          <button
            onClick={() => setMobileSidebarOpen(true)}
            className="p-2 rounded-lg hover:bg-muted transition-colors"
          >
            <Menu className="w-5 h-5" />
          </button>
          <span className="font-semibold text-sm">BrokerOS</span>
          <div className="flex-1">
            <QuickSearchBar />
          </div>
        </div>

        {/* Page content */}
        <main className="flex-1 overflow-auto">
          <div className="max-w-[1600px] mx-auto px-4 sm:px-6 lg:px-8 py-6 lg:py-8 pb-12">
            <Outlet />
          </div>
        </main>
      </div>
    </div>
  )
}