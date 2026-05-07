import React from 'react'
import { Outlet, useLocation } from 'react-router-dom'
import RecoverySidebar from './RecoverySidebar'
import { Menu, AlertCircle } from 'lucide-react'
import { cn } from '@/lib/utils'

/**
 * RECOVERY APP SHELL
 * Fallback UI when AuthContext or normal app initialization fails.
 * Provides minimal functional sidebar and navigation without enterprise filters.
 */
export default function RecoveryAppShell() {
  const [mobileSidebarOpen, setMobileSidebarOpen] = React.useState(false)
  const location = useLocation()

  return (
    <div className="min-h-screen bg-[#f0f2f5] flex">
      {/* Recovery mode indicator */}
      <div className="fixed top-0 left-0 right-0 z-[60] bg-amber-50 border-b-2 border-amber-300 px-4 py-2 flex items-center gap-2">
        <AlertCircle className="w-4 h-4 text-amber-600" />
        <span className="text-xs font-medium text-amber-700">
          Recovery Mode — Limited functionality. Enterprise filters disabled.
        </span>
      </div>

      {/* Mobile overlay */}
      {mobileSidebarOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/50 lg:hidden"
          onClick={() => setMobileSidebarOpen(false)}
        />
      )}

      {/* Sidebar */}
      <div
        className={cn(
          'fixed left-0 top-[41px] h-[calc(100vh-41px)] z-50 transition-transform duration-300',
          'lg:translate-x-0',
          mobileSidebarOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'
        )}
      >
        <RecoverySidebar onNavigate={() => setMobileSidebarOpen(false)} />
      </div>

      {/* Main content */}
      <div className="flex-1 flex flex-col min-w-0 lg:ml-[232px]">
        {/* Mobile topbar */}
        <div className="lg:hidden flex items-center gap-3 px-4 h-14 border-b border-border bg-card sticky top-[41px] z-30">
          <button
            onClick={() => setMobileSidebarOpen(true)}
            className="p-2 rounded-lg hover:bg-muted transition-colors"
          >
            <Menu className="w-5 h-5" />
          </button>
          <span className="font-semibold text-sm">BrokerOS</span>
        </div>

        {/* Page content */}
        <main className="flex-1 overflow-auto pt-[41px] lg:pt-0">
          <div className="max-w-[1600px] mx-auto px-4 sm:px-6 lg:px-8 py-6 lg:py-8">
            <Outlet />
          </div>
        </main>
      </div>
    </div>
  )
}