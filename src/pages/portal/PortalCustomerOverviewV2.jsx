import React from 'react'

export default function PortalCustomerOverviewV2() {
  return (
    <div style={{ background: '#f8f9fa' }}>
      <div style={{ maxWidth: 900, margin: '0 auto', padding: '60px 40px' }}>
        {/* BEGRÜSSUNG */}
        <section>
          <h1 style={{ fontSize: 36, fontWeight: 700, margin: '0 0 16px', lineHeight: 1.2, color: '#0f172a' }}>
            Willkommen bei VSVV
          </h1>
          <p style={{ fontSize: 16, color: '#4b5563', margin: '0 0 8px', lineHeight: 1.6 }}>
            Ihrem unabhängigen Partner für strukturierte und transparente Versicherungslösungen.
          </p>
          <p style={{ fontSize: 16, color: '#6b7280', margin: '0 0 32px', lineHeight: 1.6 }}>
            Behalten Sie jederzeit den Überblick über Ihre Versicherungen und Dokumente.
          </p>
          <a href="https://wa.me/41787170007" target="_blank" rel="noopener noreferrer">
            <button style={{
              background: '#25D366',
              color: '#fff',
              border: 'none',
              borderRadius: 8,
              padding: '12px 24px',
              cursor: 'pointer',
              fontSize: 14,
              fontWeight: 600,
              transition: 'all 0.2s',
              boxShadow: '0 2px 8px rgba(37, 211, 102, 0.2)',
            }}
            onMouseEnter={e => { e.target.style.transform = 'translateY(-2px)'; e.target.style.boxShadow = '0 4px 12px rgba(37, 211, 102, 0.3)' }}
            onMouseLeave={e => { e.target.style.transform = 'translateY(0)'; e.target.style.boxShadow = '0 2px 8px rgba(37, 211, 102, 0.2)' }}
            >
              💬 Beratung per WhatsApp
            </button>
          </a>
        </section>
      </div>
    </div>
  )
}