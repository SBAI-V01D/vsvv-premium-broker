import React, { useState } from 'react'
import { base44 } from '@/api/base44Client'
import { usePortalData } from '@/hooks/usePortalData'
import { usePortalCustomer } from '@/hooks/usePortalCustomer'
import { Download, Upload, Phone, Calendar, FileText, LogOut, ChevronRight } from 'lucide-react'
import { useNavigate } from 'react-router-dom'

const LOGO_URL = 'https://media.base44.com/images/public/69f07890d7d9106eb68a2c98/0cde67ef2_LogoVSVV2.png'

export default function PortalCustomerDashboard() {
  const navigate = useNavigate()
  const { customer } = usePortalCustomer()
  const { contracts = [], documents = [], applications = [] } = usePortalData()
  const [uploadingFile, setUploadingFile] = useState(false)

  const handleLogout = () => {
    localStorage.removeItem('portal_customer_id')
    localStorage.removeItem('portal_email')
    window.location.href = '/portal/setup'
  }

  const activeContracts = contracts.filter(c => c.status === 'active').length
  const totalPremium = contracts.reduce((sum, c) => sum + (c.premium_yearly || 0), 0)
  const openIssues = applications.filter(a => a.status !== 'approved' && a.status !== 'rejected').length
  const nextTerms = contracts.filter(c => c.cancellation_deadline).length

  const formatDate = (dateStr) => {
    if (!dateStr) return '–'
    return new Date(dateStr).toLocaleDateString('de-CH')
  }

  const KPICard = ({ icon: Icon, title, value, unit }) => (
    <div style={{
      background: 'rgba(255,255,255,0.02)',
      border: '1px solid rgba(255,255,255,0.06)',
      borderRadius: 10,
      padding: '16px',
      display: 'flex',
      alignItems: 'flex-start',
      gap: 12,
    }}>
      <div style={{
        width: 40,
        height: 40,
        borderRadius: 8,
        background: 'rgba(91,163,232,0.1)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        flexShrink: 0,
      }}>
        <Icon size={18} color='rgba(91,163,232,0.7)' />
      </div>
      <div>
        <p style={{
          color: '#8A9BB0',
          fontSize: 11,
          fontWeight: 500,
          margin: 0,
          textTransform: 'uppercase',
          letterSpacing: 0.5,
        }}>
          {title}
        </p>
        <p style={{
          color: '#EAF1F7',
          fontSize: 20,
          fontWeight: 700,
          margin: '4px 0 0',
        }}>
          {value}
          <span style={{ fontSize: 12, fontWeight: 400, marginLeft: 4 }}>
            {unit}
          </span>
        </p>
      </div>
    </div>
  )

  return (
    <div style={{
      minHeight: '100vh',
      background: 'linear-gradient(to bottom, #0B1F3A, #0D2238)',
      color: '#EAF1F7',
      fontFamily: 'Inter, Helvetica, sans-serif',
    }}>
      <style>{`
        @media (max-width: 768px) {
          .kpi-grid { grid-template-columns: 1fr !important; }
          .contracts-table { overflow-x: auto; }
        }
      `}</style>

      {/* HEADER */}
      <header style={{
        background: 'rgba(0,0,0,0.2)',
        borderBottom: '1px solid rgba(255,255,255,0.06)',
        padding: '16px 0',
        position: 'sticky',
        top: 0,
        zIndex: 100,
      }}>
        <div style={{
          maxWidth: 1200,
          margin: '0 auto',
          padding: '0 24px',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
        }}>
          <img src={LOGO_URL} alt="VSVV" style={{ height: 40 }} />
          <div style={{ display: 'flex', alignItems: 'center', gap: 20 }}>
            <div style={{ textAlign: 'right' }}>
              <p style={{ fontSize: 13, fontWeight: 500, margin: 0, color: '#EAF1F7' }}>
                {customer?.first_name} {customer?.last_name}
              </p>
              <p style={{ fontSize: 11, margin: '2px 0 0', color: '#8A9BB0' }}>
                {customer?.email}
              </p>
            </div>
            <button
              onClick={handleLogout}
              style={{
                background: 'rgba(239,68,68,0.1)',
                border: '1px solid rgba(239,68,68,0.2)',
                borderRadius: 8,
                padding: '8px 14px',
                color: '#f87171',
                fontSize: 13,
                fontWeight: 500,
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: 8,
              }}
            >
              <LogOut size={14} /> Abmelden
            </button>
          </div>
        </div>
      </header>

      {/* MAIN CONTENT */}
      <main style={{
        maxWidth: 1100,
        margin: '0 auto',
        padding: '40px 24px',
      }}>

        {/* SEKTION 1: KUNDENDATEN */}
        {customer && (
          <section style={{
            marginBottom: 60,
            paddingBottom: 40,
            borderBottom: '1px solid rgba(255,255,255,0.08)',
          }}>
            <div>
              <div style={{ marginBottom: 24 }}>
                <p style={{ color: '#7A8A9E', fontSize: 11, fontWeight: 600, margin: 0, textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 8 }}>
                  Name
                </p>
                <p style={{ color: '#EAF1F7', fontSize: 16, fontWeight: 500, margin: 0 }}>
                  {customer.first_name} {customer.last_name}
                </p>
              </div>
              <div style={{ marginBottom: 24 }}>
                <p style={{ color: '#7A8A9E', fontSize: 11, fontWeight: 600, margin: 0, textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 8 }}>
                  E-Mail
                </p>
                <p style={{ color: '#EAF1F7', fontSize: 16, fontWeight: 500, margin: 0 }}>
                  {customer.email}
                </p>
              </div>
              {customer.street && (
                <div style={{ marginBottom: 24 }}>
                  <p style={{ color: '#7A8A9E', fontSize: 11, fontWeight: 600, margin: 0, textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 8 }}>
                    Adresse
                  </p>
                  <p style={{ color: '#EAF1F7', fontSize: 16, fontWeight: 500, margin: 0 }}>
                    {customer.street}, {customer.zip_code} {customer.city}
                  </p>
                </div>
              )}
              {customer.phone && (
                <div>
                  <p style={{ color: '#7A8A9E', fontSize: 11, fontWeight: 600, margin: 0, textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 8 }}>
                    Telefon
                  </p>
                  <p style={{ color: '#EAF1F7', fontSize: 16, fontWeight: 500, margin: 0 }}>
                    {customer.phone}
                  </p>
                </div>
              )}
            </div>
          </section>
        )}

        {/* SEKTION 2: KENNZAHLEN */}
        <section style={{
          marginBottom: 60,
          paddingBottom: 40,
          borderBottom: '1px solid rgba(255,255,255,0.08)',
        }}>
          <h2 style={{
            fontSize: 24,
            fontWeight: 600,
            margin: '0 0 48px',
            color: '#EAF1F7',
            letterSpacing: '-0.5px',
          }}>
            Ihre Versicherungsübersicht
          </h2>

          <div style={{ marginBottom: 48 }}>
            <p style={{
              color: '#7A8A9E',
              fontSize: 11,
              fontWeight: 600,
              margin: '0 0 12px',
              textTransform: 'uppercase',
              letterSpacing: 1,
            }}>
              Monatsprämie
            </p>
            <p style={{
              color: '#5B9FE6',
              fontSize: 56,
              fontWeight: 800,
              margin: 0,
              lineHeight: 1,
            }}>
              CHF {(totalPremium / 12).toLocaleString('de-CH', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
            </p>
          </div>

          <div style={{ marginBottom: 48 }}>
            <p style={{
              color: '#7A8A9E',
              fontSize: 11,
              fontWeight: 600,
              margin: '0 0 12px',
              textTransform: 'uppercase',
              letterSpacing: 1,
            }}>
              Jahresprämie
            </p>
            <p style={{
              color: '#4ac66e',
              fontSize: 56,
              fontWeight: 800,
              margin: 0,
              lineHeight: 1,
            }}>
              CHF {totalPremium.toLocaleString('de-CH', { maximumFractionDigits: 0 })}
            </p>
          </div>

          <div style={{ marginBottom: 48 }}>
            <p style={{
              color: '#7A8A9E',
              fontSize: 11,
              fontWeight: 600,
              margin: '0 0 12px',
              textTransform: 'uppercase',
              letterSpacing: 1,
            }}>
              Aktive Verträge
            </p>
            <p style={{
              color: '#8A9BB0',
              fontSize: 56,
              fontWeight: 800,
              margin: 0,
              lineHeight: 1,
            }}>
              {activeContracts}
            </p>
          </div>

          <p style={{
            color: '#5B9FE6',
            fontSize: 12,
            fontWeight: 500,
            margin: 0,
            paddingTop: 24,
            borderTop: '1px solid rgba(91,163,232,0.15)',
          }}>
            Gesamte Versicherungsprämien
          </p>
        </section>

        {/* SEKTION 3: VERTRÄGE */}
        <section style={{
          marginBottom: 60,
          paddingBottom: 40,
          borderBottom: '1px solid rgba(255,255,255,0.08)',
        }}>
          <h2 style={{
            fontSize: 24,
            fontWeight: 600,
            margin: '0 0 32px',
            color: '#EAF1F7',
            letterSpacing: '-0.5px',
          }}>
            Ihre Verträge
          </h2>
          <div className="contracts-table" style={{
            background: 'rgba(255,255,255,0.02)',
            border: '1px solid rgba(255,255,255,0.08)',
            borderRadius: 12,
            overflow: 'hidden',
          }}>
            {contracts.length === 0 ? (
              <div style={{
                padding: 40,
                textAlign: 'center',
                color: '#8A9BB0',
              }}>
                Keine Verträge vorhanden
              </div>
            ) : (
              <table style={{
                width: '100%',
                borderCollapse: 'collapse',
              }}>
                <thead>
                  <tr style={{
                    borderBottom: '1px solid rgba(255,255,255,0.06)',
                    background: 'rgba(255,255,255,0.02)',
                  }}>
                    <th style={{
                      padding: '14px 20px',
                      textAlign: 'left',
                      fontSize: 12,
                      fontWeight: 600,
                      color: '#8A9BB0',
                      textTransform: 'uppercase',
                      letterSpacing: 0.5,
                    }}>Versicherung</th>
                    <th style={{
                      padding: '14px 20px',
                      textAlign: 'left',
                      fontSize: 12,
                      fontWeight: 600,
                      color: '#8A9BB0',
                      textTransform: 'uppercase',
                      letterSpacing: 0.5,
                    }}>Anbieter</th>
                    <th style={{
                      padding: '14px 20px',
                      textAlign: 'left',
                      fontSize: 12,
                      fontWeight: 600,
                      color: '#8A9BB0',
                      textTransform: 'uppercase',
                      letterSpacing: 0.5,
                    }}>Status</th>
                    <th style={{
                      padding: '14px 20px',
                      textAlign: 'left',
                      fontSize: 12,
                      fontWeight: 600,
                      color: '#8A9BB0',
                      textTransform: 'uppercase',
                      letterSpacing: 0.5,
                    }}>Jahresprämie</th>
                    <th style={{
                      padding: '14px 20px',
                      textAlign: 'center',
                      fontSize: 12,
                      fontWeight: 600,
                      color: '#8A9BB0',
                      textTransform: 'uppercase',
                      letterSpacing: 0.5,
                    }}>Aktion</th>
                  </tr>
                </thead>
                <tbody>
                  {contracts.map((contract, idx) => (
                    <tr
                      key={contract.id}
                      style={{
                        borderBottom: idx < contracts.length - 1 ? '1px solid rgba(255,255,255,0.04)' : 'none',
                        background: 'transparent',
                        transition: 'background 0.2s',
                      }}
                      onMouseEnter={(e) => e.currentTarget.style.background = 'rgba(255,255,255,0.02)'}
                      onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
                    >
                      <td style={{ padding: '16px 20px', fontSize: 13, color: '#EAF1F7' }}>
                        {contract.insurance_type}
                      </td>
                      <td style={{ padding: '16px 20px', fontSize: 13, color: '#C8D4E3' }}>
                        {contract.insurer}
                      </td>
                      <td style={{ padding: '16px 20px', fontSize: 13 }}>
                        <span style={{
                          display: 'inline-block',
                          padding: '4px 10px',
                          borderRadius: 6,
                          background: 'rgba(74,198,110,0.15)',
                          color: '#4ac66e',
                          fontSize: 12,
                          fontWeight: 500,
                        }}>
                          {contract.status === 'active' ? 'Aktiv' : contract.status}
                        </span>
                      </td>
                      <td style={{ padding: '16px 20px', fontSize: 13, fontWeight: 600, color: '#5B9FE6' }}>
                        CHF {(contract.premium_yearly || 0).toLocaleString('de-CH', { maximumFractionDigits: 0 })}
                      </td>
                      <td style={{ padding: '16px 20px', textAlign: 'center' }}>
                        <button style={{
                          background: 'rgba(91,163,232,0.1)',
                          border: '1px solid rgba(91,163,232,0.2)',
                          borderRadius: 6,
                          padding: '6px 12px',
                          color: '#5B9FE6',
                          fontSize: 12,
                          fontWeight: 500,
                          cursor: 'pointer',
                          transition: 'all 0.2s',
                        }}
                          onMouseEnter={(e) => {
                            e.currentTarget.style.background = 'rgba(91,163,232,0.15)'
                            e.currentTarget.style.borderColor = 'rgba(91,163,232,0.4)'
                          }}
                          onMouseLeave={(e) => {
                            e.currentTarget.style.background = 'rgba(91,163,232,0.1)'
                            e.currentTarget.style.borderColor = 'rgba(91,163,232,0.2)'
                          }}
                        >
                          Details
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </section>



        {/* SEKTION 4: DOKUMENTE */}
        <section style={{ marginBottom: 80 }}>
          <h2 style={{
            fontSize: 24,
            fontWeight: 600,
            margin: '0 0 32px',
            color: '#EAF1F7',
            letterSpacing: '-0.5px',
          }}>
            Ihre Dokumente
          </h2>
          <div style={{
            background: 'rgba(255,255,255,0.02)',
            border: '1px solid rgba(255,255,255,0.08)',
            borderRadius: 12,
            padding: 24,
          }}>
            {documents.length === 0 ? (
              <div style={{
                padding: 40,
                textAlign: 'center',
                color: '#8A9BB0',
              }}>
                Keine Dokumente vorhanden
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                {documents.slice(0, 5).map(doc => (
                  <div
                    key={doc.id}
                    style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      padding: 12,
                      background: 'rgba(255,255,255,0.01)',
                      borderRadius: 8,
                      border: '1px solid rgba(255,255,255,0.04)',
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                      <FileText size={20} color='#5B9FE6' />
                      <div>
                        <p style={{ margin: 0, fontSize: 13, fontWeight: 500, color: '#EAF1F7' }}>
                          {doc.name}
                        </p>
                        <p style={{ margin: '2px 0 0', fontSize: 11, color: '#8A9BB0' }}>
                          {formatDate(doc.created_date)}
                        </p>
                      </div>
                    </div>
                    <a href={doc.file_url} target="_blank" rel="noopener noreferrer">
                      <button style={{
                        background: 'rgba(91,163,232,0.1)',
                        border: '1px solid rgba(91,163,232,0.2)',
                        borderRadius: 6,
                        padding: '6px 12px',
                        color: '#5B9FE6',
                        fontSize: 12,
                        fontWeight: 500,
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        gap: 6,
                      }}>
                        <Download size={14} /> Herunterladen
                      </button>
                    </a>
                  </div>
                ))}
              </div>
            )}
          </div>
        </section>


      </main>

      {/* FOOTER */}
      <footer style={{
        borderTop: '1px solid rgba(255,255,255,0.06)',
        padding: '32px 24px',
        marginTop: 80,
        textAlign: 'center',
        fontSize: 11,
        color: 'rgba(255,255,255,0.5)',
      }}>
        © 2025 VSVV – Ihre Versicherungsplattform
      </footer>
    </div>
  )
}