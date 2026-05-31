import React, { useState, useEffect } from 'react'
import { Outlet, useLocation } from 'react-router-dom'
import Sidebar from './Sidebar'
import BreadcrumbBar from './BreadcrumbBar'
import CommandPalette from './CommandPalette'
import { Menu } from 'lucide-react'
import { cn } from '@/lib/utils'

export default function AppLayout() {
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false)
  const [cmdOpen, setCmdOpen] = useState(false)

  useEffect(() => {
    const handler = (e) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault()
        setCmdOpen(v => !v)
      }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [])
  const location = useLocation()

  return (
    <>
    <CommandPalette open={cmdOpen} onClose={() => setCmdOpen(false)} />
    <div className="min-h-screen flex" style={{ background: 'linear-gradient(180deg, #F8FBFF 0%, #EFF6FF 45%, #F5F9FF 100%)' }}>
      {/* Mobile overlay */}
      {mobileSidebarOpen && (
        <div
          className="fixed inset-0 z-40 bg-slate-900/40 backdrop-blur-sm lg:hidden"
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
        <div className="lg:hidden flex items-center gap-3 px-4 h-14 border-b border-blue-100/60 bg-white/80 backdrop-blur-sm sticky top-0 z-30">
          <button
            onClick={() => setMobileSidebarOpen(true)}
            className="p-2 rounded-lg hover:bg-muted transition-colors"
          >
            <Menu className="w-5 h-5" />
          </button>
          <span className="font-semibold text-sm">Swiss Premium Broker</span>
        </div>

        {/* Page content */}
        <main className="flex-1 overflow-auto flex flex-col">
          <BreadcrumbBar />
          <div className="mx-auto px-5 sm:px-6 lg:px-8 py-6 lg:py-8 pb-14 w-full max-w-[1600px]">
            <Outlet />
          </div>
        </main>
      </div>
    </div>
    </>
  )
}