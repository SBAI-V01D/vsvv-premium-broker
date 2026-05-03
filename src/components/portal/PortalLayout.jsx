import React, { useState } from 'react'
import { useLocation, Link } from 'react-router-dom'
import { LayoutDashboard, FileText, FolderOpen, User, LogOut, Menu, X, MessageCircle, ClipboardList } from 'lucide-react'
import { usePortalCustomer } from '@/hooks/usePortalCustomer'

const LOGO_URL = 'https://media.base44.com/images/public/69f07890d7d9106eb68a2c98/10f5c3d63_VSVV.png'

const NAV = [
  { path: '/portal', label: 'Dashboard', icon: LayoutDashboard },
  { path: '/portal/vertraege', label: 'Verträge', icon: FileText },
  { path: '/portal/antraege', label: 'Anträge', icon: ClipboardList },
  { path: '/portal/dokumente', label: 'Dokumente', icon: FolderOpen },
  { path: '/portal/profil', label: 'Mein Profil', icon: User },
]

const NAVY = '#0B1C2C'
const ACCENT = '#4F7CFF'

export default function PortalLayout({ children }) {
  const location = useLocation()
  const { customer } = usePortalCustomer()
  const [mobileOpen, setMobileOpen] = useState(false)

  const handleLogout = () => {
    localStorage.removeItem('portal_customer_id')
    localStorage.removeItem('portal_email')
    window.location.href = '/portal/setup'
  }

  const SidebarContent = () => (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      {/* Logo */}
      <div style={{ padding: '28px 24px 24px', borderBottom: '1px solid rgba(255,255,255,0.08)' }}>
        <img src={LOGO_URL} alt="VSVV" style={{ height: 80, objectFit: 'contain', filter: 'brightness(1.1)' }} />
      </div>

      {/* Nav */}
      <nav style={{ flex: 1, padding: '16px 12px' }}>
        {NAV.map(({ path, label, icon: Icon }) => {
          const active = location.pathname === path
          return (
            <Link
              key={path}
              to={path}
              onClick={() => setMobileOpen(false)}
              style={{
                display: 'flex', alignItems: 'center', gap: 10,
                padding: '10px 14px', borderRadius: 8, marginBottom: 4,
                textDecoration: 'none',
                background: active ? 'rgba(79,124,255,0.18)' : 'transparent',
                borderLeft: active ? `3px solid ${ACCENT}` : '3px solid transparent',
                color: active ? '#7fa8ff' : 'rgba(255,255,255,0.55)',
                fontSize: 14, fontWeight: active ? 600 : 400,
                transition: 'all 0.15s',
              }}
              onMouseEnter={e => { if (!active) e.currentTarget.style.background = 'rgba(255,255,255,0.05)' }}
              onMouseLeave={e => { if (!active) e.currentTarget.style.background = 'transparent' }}
            >
              <Icon size={16} />
              {label}
            </Link>
          )
        })}
      </nav>

      {/* User + Logout */}
      <div style={{ padding: '16px 12px', borderTop: '1px solid rgba(255,255,255,0.08)' }}>
        {customer && (
          <div style={{ padding: '0 14px 12px', color: 'rgba(255,255,255,0.5)', fontSize: 12 }}>
            <p style={{ margin: 0, fontWeight: 600, color: 'rgba(255,255,255,0.8)', fontSize: 13 }}>
              {customer.first_name} {customer.last_name}
            </p>
            <p style={{ margin: '2px 0 0', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {customer.email}
            </p>
          </div>
        )}
        <button
          onClick={handleLogout}
          style={{
            display: 'flex', alignItems: 'center', gap: 8,
            width: '100%', padding: '9px 14px', borderRadius: 8,
            background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.2)',
            color: '#f87171', fontSize: 13, fontWeight: 500, cursor: 'pointer',
          }}
        >
          <LogOut size={14} /> Abmelden
        </button>
      </div>
    </div>
  )

  return (
    <div style={{ height: '100vh', background: '#F5F8FC', display: 'flex', flexDirection: 'column', fontFamily: 'Inter, sans-serif' }}>

      {/* Desktop sidebar + Main */}
      <div style={{ display: 'flex', flex: 1, minWidth: 0 }}>
        {/* Desktop sidebar */}
        <div style={{ width: 240, background: NAVY, flexShrink: 0, display: 'none' }} className="md-sidebar">
          <SidebarContent />
        </div>

        {/* Desktop sidebar (visible) */}
        <aside style={{ width: 240, background: NAVY, flexShrink: 0 }} className="hidden md:block">
          <SidebarContent />
        </aside>

        {/* Mobile overlay */}
        {mobileOpen && (
          <div
            style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 40 }}
            onClick={() => setMobileOpen(false)}
          />
        )}

        {/* Mobile sidebar */}
        <aside style={{
          position: 'fixed', top: 0, left: mobileOpen ? 0 : -260,
          width: 240, height: '100vh', background: NAVY,
          zIndex: 50, transition: 'left 0.25s',
        }} className="md:hidden">
          <button
            onClick={() => setMobileOpen(false)}
            style={{ position: 'absolute', top: 16, right: 16, background: 'none', border: 'none', color: 'rgba(255,255,255,0.5)', cursor: 'pointer' }}
          >
            <X size={20} />
          </button>
          <SidebarContent />
        </aside>

        {/* Main */}
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0, overflowY: 'auto' }}>


          <main style={{ flex: 1, padding: '28px 24px', maxWidth: 1100, width: '100%', margin: '0 auto', boxSizing: 'border-box' }}>
            {children}
          </main>
        </div>
      </div>


    </div>
  )
}