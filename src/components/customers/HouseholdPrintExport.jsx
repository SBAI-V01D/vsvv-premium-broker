import React, { useMemo } from 'react'

export const HouseholdPrintExport = React.forwardRef(({ customer, familyMembers, contracts, advisors }, ref) => {
  // Group contracts by customer - must be called before early returns
  const contractsByCustomer = useMemo(() => {
    const grouped = {}
    contracts?.forEach(c => {
      if (!grouped[c.customer_id]) grouped[c.customer_id] = []
      grouped[c.customer_id].push(c)
    })
    return grouped
  }, [contracts])

  if (!customer) return null

  const formatDate = (dateStr) => {
    if (!dateStr) return '–'
    try {
      return new Date(dateStr).toLocaleDateString('de-CH', { 
        year: 'numeric', 
        month: '2-digit', 
        day: '2-digit' 
      })
    } catch {
      return '–'
    }
  }

  const getDaysUntilExpiry = (endDate) => {
    if (!endDate) return null
    const today = new Date()
    const end = new Date(endDate)
    return Math.floor((end - today) / (1000 * 60 * 60 * 24))
  }

  const getStatusBadge = (contract) => {
    const days = getDaysUntilExpiry(contract.end_date)
    if (days === null) return { bg: '#10B981', text: '#fff', label: 'Aktiv', border: 'none' }
    if (days < 0) return { bg: '#EF4444', text: '#fff', label: 'Überfällig', border: 'none' }
    if (days <= 30) return { bg: '#DC2626', text: '#fff', label: 'Kritisch', border: 'none' }
    if (days <= 90) return { bg: '#F59E0B', text: '#fff', label: 'Ablauf', border: 'none' }
    return { bg: '#10B981', text: '#fff', label: 'Aktiv', border: 'none' }
  }

  const formatCurrency = (value) => {
    if (!value && value !== 0) return '–'
    return new Intl.NumberFormat('de-CH', {
      style: 'currency',
      currency: 'CHF',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(value)
  }

  const getSparteLabel = (sparte) => {
    if (!sparte) return '–'
    
    const normalized = String(sparte).toLowerCase().trim()
    
    const spartenMap = {
      'hausrat': 'Hausrat',
      'hausratversicherung': 'Hausratversicherung',
      'haftpflicht': 'Haftpflicht',
      'motorfahrzeug': 'Motorfahrzeug',
      'krankenversicherung': 'Krankenversicherung',
      'lebensversicherung': 'Lebensversicherung',
      'sachversicherung': 'Sachversicherung',
      'bvg': 'BVG',
      'pensionskasse': 'Pensionskasse',
      'household': 'Hausrat',
      'householdinsurance': 'Hausratversicherung',
      'liability': 'Haftpflicht',
      'motor': 'Motorfahrzeug',
      'health': 'Krankenversicherung',
      'life': 'Lebensversicherung',
      'property': 'Sachversicherung',
      'pension': 'Pensionskasse',
    }
    
    return spartenMap[normalized] || sparte
  }

  const getFamilyRoleLabel = (role) => {
    const roleMap = {
      'spouse': 'Ehepartner/in',
      'child': 'Kind',
      'parent': 'Elternteil',
      'primary': 'Hauptkontakt',
      'other': 'Familienm.'
    }
    return roleMap[role] || role || 'Familienm.'
  }

  const mainCustomerContracts = contractsByCustomer[customer.id] || []
  const totalYearlyPremium = contracts?.reduce((sum, c) => sum + (c.premium_yearly || 0), 0) || 0
  const expiringCount = contracts?.filter(c => {
    const days = getDaysUntilExpiry(c.end_date)
    return days !== null && days >= 0 && days <= 180
  }).length || 0

  // Print CSS für saubere Seitenumbrüche
  const printStyles = `
    @media print {
      * {
        widows: 3;
        orphans: 3;
      }
      
      body {
        margin: 0;
        padding: 0;
        background: white;
      }
      
      html {
        margin: 0;
        padding: 0;
      }
    }
  `

  return (
    <>
      <style>{printStyles}</style>
      <div 
        ref={ref} 
        style={{ 
          padding: '40px', 
          background: '#fff', 
          fontFamily: '"Segoe UI", "Helvetica Neue", sans-serif',
          lineHeight: '1.6',
          color: '#333',
          maxWidth: '210mm',
          margin: '0 auto'
        }}
      >
      {/* ===== HEADER ===== */}
      <div style={{ marginBottom: '40px', paddingBottom: '20px', borderBottom: '2px solid #E5E7EB', pageBreakAfter: 'avoid' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '20px' }}>
          <div>
            <div style={{ 
              fontSize: '28px', 
              fontWeight: '700', 
              color: '#1F2937',
              marginBottom: '5px'
            }}>
              Familienübersicht
            </div>
            <div style={{ fontSize: '12px', color: '#6B7280' }}>
              Persönliche Versicherungsübersicht
            </div>
          </div>
          <div style={{ textAlign: 'right', fontSize: '11px', color: '#6B7280' }}>
            <div>Erstellt: {formatDate(new Date())}</div>
            {advisors && advisors.length > 0 && (
              <div style={{ marginTop: '5px' }}>
                Berater: <strong>{advisors[0].firstname} {advisors[0].lastname}</strong>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ===== ABSCHNITT 1: HAUPTKONTAKT ===== */}
      <div style={{ marginBottom: '40px', pageBreakInside: 'avoid' }}>
        <div style={{ 
          background: '#F3F4F6',
          padding: '24px',
          borderRadius: '8px',
          borderLeft: '4px solid #2169B4'
        }}>
          <div style={{ 
            fontSize: '14px',
            fontWeight: '600',
            color: '#1F2937',
            marginBottom: '16px',
            textTransform: 'uppercase',
            letterSpacing: '0.5px'
          }}>
            Hauptkontakt
          </div>
          
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px' }}>
            <div>
              <div style={{ fontSize: '20px', fontWeight: '700', color: '#1F2937', marginBottom: '12px' }}>
                {customer.first_name} {customer.last_name}
              </div>
              {customer.street && (
                <div style={{ fontSize: '13px', color: '#374151', marginBottom: '4px' }}>
                  {customer.street}
                </div>
              )}
              {(customer.zip_code || customer.city) && (
                <div style={{ fontSize: '13px', color: '#374151', marginBottom: '12px' }}>
                  {customer.zip_code} {customer.city}
                </div>
              )}
            </div>
            
            <div>
              {customer.phone && (
                <div style={{ fontSize: '13px', color: '#374151', marginBottom: '6px' }}>
                  <strong>Telefon:</strong> {customer.phone}
                </div>
              )}
              {customer.email && (
                <div style={{ fontSize: '13px', color: '#374151', marginBottom: '6px' }}>
                  <strong>E-Mail:</strong> {customer.email}
                </div>
              )}
              {customer.birthdate && (
                <div style={{ fontSize: '13px', color: '#374151', marginBottom: '6px' }}>
                  <strong>Geburtsdatum:</strong> {formatDate(customer.birthdate)}
                </div>
              )}
              {customer.id && (
                <div style={{ fontSize: '13px', color: '#6B7280' }}>
                  <strong>Kundennummer:</strong> {customer.id}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* ===== ABSCHNITT 2: FAMILIENMITGLIEDER ===== */}
      {familyMembers && familyMembers.length > 0 && (
        <div style={{ marginBottom: '40px', pageBreakInside: 'avoid' }}>
          <div style={{ 
            fontSize: '14px',
            fontWeight: '600',
            color: '#1F2937',
            marginBottom: '16px',
            textTransform: 'uppercase',
            letterSpacing: '0.5px',
            paddingBottom: '12px',
            borderBottom: '2px solid #E5E7EB'
          }}>
            Familienmitglieder
          </div>
          
          <div style={{ display: 'grid', gap: '12px' }}>
            {familyMembers.map((member) => (
              <div 
                key={member.id}
                style={{ 
                  padding: '16px',
                  background: '#F9FAFB',
                  border: '1px solid #E5E7EB',
                  borderRadius: '6px',
                  pageBreakInside: 'avoid'
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                  <div>
                    <div style={{ fontSize: '14px', fontWeight: '600', color: '#1F2937', marginBottom: '4px' }}>
                      {member.first_name} {member.last_name}
                    </div>
                    {member.birthdate && (
                      <div style={{ fontSize: '12px', color: '#6B7280' }}>
                        geb. {formatDate(member.birthdate)}
                      </div>
                    )}
                  </div>
                  <div style={{ 
                    fontSize: '11px',
                    fontWeight: '600',
                    background: '#E0E7FF',
                    color: '#4F46E5',
                    padding: '4px 10px',
                    borderRadius: '4px'
                  }}>
                    {getFamilyRoleLabel(member.family_role)}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ===== ABSCHNITT 3: VERTRAGSÜBERSICHT ===== */}
      {contracts && contracts.length > 0 && (
        <div style={{ marginBottom: '40px', pageBreakAfter: 'auto' }}>
          <div style={{ 
            fontSize: '14px',
            fontWeight: '600',
            color: '#1F2937',
            marginBottom: '20px',
            textTransform: 'uppercase',
            letterSpacing: '0.5px',
            paddingBottom: '12px',
            borderBottom: '2px solid #E5E7EB'
          }}>
            Versicherungsverträge
          </div>

          {/* Hauptkontakt Verträge */}
          {mainCustomerContracts.length > 0 && (
            <div style={{ marginBottom: '32px', pageBreakInside: 'avoid' }}>
              <div style={{ 
                fontSize: '12px',
                fontWeight: '600',
                color: '#2169B4',
                marginBottom: '12px',
                textTransform: 'uppercase',
                letterSpacing: '0.5px'
              }}>
                {customer.first_name} {customer.last_name}
              </div>
              
              <table style={{ width: '100%', borderCollapse: 'collapse', marginBottom: '20px', pageBreakInside: 'avoid' }}>
                <thead>
                  <tr style={{ borderBottom: '2px solid #D1D5DB', background: '#F9FAFB' }}>
                    <th style={{ padding: '12px 10px', textAlign: 'left', fontSize: '11px', fontWeight: '600', color: '#374151', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Versicherer</th>
                    <th style={{ padding: '12px 10px', textAlign: 'left', fontSize: '11px', fontWeight: '600', color: '#374151', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Sparte</th>
                    <th style={{ padding: '12px 10px', textAlign: 'left', fontSize: '11px', fontWeight: '600', color: '#374151', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Produkt</th>
                    <th style={{ padding: '12px 10px', textAlign: 'center', fontSize: '11px', fontWeight: '600', color: '#374151', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Ablauf</th>
                    <th style={{ padding: '12px 10px', textAlign: 'right', fontSize: '11px', fontWeight: '600', color: '#374151', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Jahresprämie</th>
                    <th style={{ padding: '12px 10px', textAlign: 'center', fontSize: '11px', fontWeight: '600', color: '#374151', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {mainCustomerContracts.map((contract, idx) => {
                    const status = getStatusBadge(contract)
                    return (
                      <tr 
                        key={contract.id}
                        style={{ 
                          borderBottom: '1px solid #E5E7EB',
                          background: idx % 2 === 0 ? '#fff' : '#F9FAFB'
                        }}
                      >
                        <td style={{ padding: '14px 10px', fontSize: '12px', color: '#1F2937' }}>
                          {contract.insurer || '–'}
                        </td>
                        <td style={{ padding: '14px 10px', fontSize: '12px', color: '#374151' }}>
                          {getSparteLabel(contract.sparte || contract.insurance_type)}
                        </td>
                        <td style={{ padding: '14px 10px', fontSize: '12px', color: '#374151' }}>
                          {contract.product || '–'}
                        </td>
                        <td style={{ padding: '14px 10px', fontSize: '12px', color: '#374151', textAlign: 'center' }}>
                          {contract.end_date ? (
                            <div>
                              {formatDate(contract.end_date)}
                              {(() => {
                                const days = getDaysUntilExpiry(contract.end_date)
                                return days !== null ? <div style={{ fontSize: '10px', color: '#6B7280' }}>({days}d)</div> : null
                              })()}
                            </div>
                          ) : '–'}
                        </td>
                        <td style={{ padding: '14px 10px', fontSize: '12px', fontWeight: '600', color: '#1F2937', textAlign: 'right' }}>
                          {formatCurrency(contract.premium_yearly)}
                        </td>
                        <td style={{ padding: '14px 10px', textAlign: 'center' }}>
                          <div style={{
                            display: 'inline-block',
                            background: status.bg,
                            color: status.text,
                            padding: '4px 8px',
                            borderRadius: '4px',
                            fontSize: '10px',
                            fontWeight: '600'
                          }}>
                            {status.label}
                          </div>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}

          {/* Familienmitglieder Verträge */}
          {familyMembers && familyMembers.map((member) => {
            const memberContracts = contractsByCustomer[member.id] || []
            if (memberContracts.length === 0) return null
            
            return (
              <div key={member.id} style={{ marginBottom: '24px', pageBreakInside: 'avoid' }}>
                <div style={{ 
                  fontSize: '12px',
                  fontWeight: '600',
                  color: '#2169B4',
                  marginBottom: '12px',
                  textTransform: 'uppercase',
                  letterSpacing: '0.5px'
                }}>
                  {member.first_name} {member.last_name}
                </div>
                
                <table style={{ width: '100%', borderCollapse: 'collapse', marginBottom: '20px', pageBreakInside: 'avoid' }}>
                  <thead>
                    <tr style={{ borderBottom: '2px solid #D1D5DB', background: '#F9FAFB' }}>
                      <th style={{ padding: '12px 10px', textAlign: 'left', fontSize: '11px', fontWeight: '600', color: '#374151', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Versicherer</th>
                      <th style={{ padding: '12px 10px', textAlign: 'left', fontSize: '11px', fontWeight: '600', color: '#374151', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Sparte</th>
                      <th style={{ padding: '12px 10px', textAlign: 'left', fontSize: '11px', fontWeight: '600', color: '#374151', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Produkt</th>
                      <th style={{ padding: '12px 10px', textAlign: 'center', fontSize: '11px', fontWeight: '600', color: '#374151', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Ablauf</th>
                      <th style={{ padding: '12px 10px', textAlign: 'right', fontSize: '11px', fontWeight: '600', color: '#374151', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Jahresprämie</th>
                      <th style={{ padding: '12px 10px', textAlign: 'center', fontSize: '11px', fontWeight: '600', color: '#374151', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {memberContracts.map((contract, idx) => {
                      const status = getStatusBadge(contract)
                      return (
                        <tr 
                          key={contract.id}
                          style={{ 
                            borderBottom: '1px solid #E5E7EB',
                            background: idx % 2 === 0 ? '#fff' : '#F9FAFB'
                          }}
                        >
                          <td style={{ padding: '14px 10px', fontSize: '12px', color: '#1F2937' }}>
                            {contract.insurer || '–'}
                          </td>
                          <td style={{ padding: '14px 10px', fontSize: '12px', color: '#374151' }}>
                            {getSparteLabel(contract.sparte || contract.insurance_type)}
                          </td>
                          <td style={{ padding: '14px 10px', fontSize: '12px', color: '#374151' }}>
                            {contract.product || '–'}
                          </td>
                          <td style={{ padding: '14px 10px', fontSize: '12px', color: '#374151', textAlign: 'center' }}>
                            {contract.end_date ? (
                              <div>
                                {formatDate(contract.end_date)}
                                {(() => {
                                  const days = getDaysUntilExpiry(contract.end_date)
                                  return days !== null ? <div style={{ fontSize: '10px', color: '#6B7280' }}>({days}d)</div> : null
                                })()}
                              </div>
                            ) : '–'}
                          </td>
                          <td style={{ padding: '14px 10px', fontSize: '12px', fontWeight: '600', color: '#1F2937', textAlign: 'right' }}>
                            {formatCurrency(contract.premium_yearly)}
                          </td>
                          <td style={{ padding: '14px 10px', textAlign: 'center' }}>
                            <div style={{
                              display: 'inline-block',
                              background: status.bg,
                              color: status.text,
                              padding: '4px 8px',
                              borderRadius: '4px',
                              fontSize: '10px',
                              fontWeight: '600'
                            }}>
                              {status.label}
                            </div>
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            )
          })}
        </div>
      )}

      {/* ===== ABSCHNITT 4: STATISTIK (AM ENDE) ===== */}
      {contracts && contracts.length > 0 && (
        <div style={{ 
          marginTop: '40px',
          paddingTop: '20px',
          borderTop: '2px solid #E5E7EB',
          pageBreakInside: 'avoid',
          pageBreakBefore: 'auto'
        }}>
          <div style={{ 
            fontSize: '12px',
            fontWeight: '600',
            color: '#1F2937',
            marginBottom: '16px',
            textTransform: 'uppercase',
            letterSpacing: '0.5px'
          }}>
            Zusammenfassung
          </div>
          
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '16px' }}>
            <div style={{ 
              padding: '16px',
              background: '#F3F4F6',
              borderRadius: '6px',
              borderLeft: '3px solid #2169B4',
              pageBreakInside: 'avoid'
            }}>
              <div style={{ fontSize: '18px', fontWeight: '700', color: '#1F2937', marginBottom: '4px' }}>
                {contracts.filter(c => c.status === 'active').length}
              </div>
              <div style={{ fontSize: '11px', color: '#6B7280', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                Aktive Verträge
              </div>
            </div>
            
            <div style={{ 
              padding: '16px',
              background: '#F3F4F6',
              borderRadius: '6px',
              borderLeft: '3px solid #2169B4',
              pageBreakInside: 'avoid'
            }}>
              <div style={{ fontSize: '18px', fontWeight: '700', color: '#1F2937', marginBottom: '4px' }}>
                {formatCurrency(totalYearlyPremium)}
              </div>
              <div style={{ fontSize: '11px', color: '#6B7280', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                Jahresprämie
              </div>
            </div>
            
            <div style={{ 
              padding: '16px',
              background: '#F3F4F6',
              borderRadius: '6px',
              borderLeft: '3px solid #2169B4',
              pageBreakInside: 'avoid'
            }}>
              <div style={{ fontSize: '18px', fontWeight: '700', color: '#1F2937', marginBottom: '4px' }}>
                {familyMembers ? familyMembers.length + 1 : 1}
              </div>
              <div style={{ fontSize: '11px', color: '#6B7280', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                Personen
              </div>
            </div>
            
            <div style={{ 
              padding: '16px',
              background: '#F3F4F6',
              borderRadius: '6px',
              borderLeft: '3px solid #F59E0B',
              pageBreakInside: 'avoid'
            }}>
              <div style={{ fontSize: '18px', fontWeight: '700', color: '#1F2937', marginBottom: '4px' }}>
                {expiringCount}
              </div>
              <div style={{ fontSize: '11px', color: '#6B7280', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                Abläufe (180d)
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ===== FOOTER ===== */}
      <div style={{
        marginTop: '40px',
        paddingTop: '20px',
        borderTop: '1px solid #E5E7EB',
        fontSize: '10px',
        color: '#9CA3AF',
        textAlign: 'center',
        pageBreakInside: 'avoid'
      }}>
        <p style={{ margin: '0' }}>
          Dieses Dokument ist eine Zusammenfassung Ihrer Versicherungsverträge und dient zu Informationszwecken.
        </p>
        <p style={{ margin: '8px 0 0 0' }}>
          © 2026 • Erstellt am {formatDate(new Date())}
        </p>
      </div>
      </div>
    </>
  )
})

HouseholdPrintExport.displayName = 'HouseholdPrintExport'