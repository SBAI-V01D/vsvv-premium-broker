import React, { useMemo } from 'react'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'

export const HouseholdPrintExport = React.forwardRef(({ customer, familyMembers, contracts, advisors }, ref) => {
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

  const getStatusColor = (contract) => {
    const days = getDaysUntilExpiry(contract.end_date)
    if (days === null) return { bg: '#4CAF50', text: '#fff', label: '✓ Stabil' }
    if (days < 0) return { bg: '#F44336', text: '#fff', label: '✗ Überfällig' }
    if (days <= 30) return { bg: '#E91E63', text: '#fff', label: '⚠ Kritisch' }
    if (days <= 90) return { bg: '#FF9800', text: '#fff', label: '! Ablauf' }
    return { bg: '#4CAF50', text: '#fff', label: '✓ Stabil' }
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

  // DEBUG: Logging
  console.log('HouseholdPrintExport rendering:', {
    customer: customer?.id,
    familyMembers: familyMembers?.length,
    contracts: contracts?.length,
  })

  return (
    <div ref={ref} style={{ padding: '20px', background: '#fff', fontFamily: 'Arial, sans-serif' }}>
      {/* HEADER */}
      <div style={{ 
        background: '#2169B4', 
        color: '#fff', 
        padding: '20px', 
        marginBottom: '20px',
        borderRadius: '8px'
      }}>
        <h1 style={{ margin: '0 0 5px 0', fontSize: '28px', fontWeight: 'bold' }}>
          Haushaltsübersicht
        </h1>
        <p style={{ margin: '0', fontSize: '14px', opacity: 0.9 }}>
          {customer.first_name} {customer.last_name}
        </p>
      </div>

      {/* MAIN CONTACT */}
      <div style={{ marginBottom: '20px' }}>
        <h2 style={{ fontSize: '16px', fontWeight: 'bold', marginBottom: '10px', borderBottom: '2px solid #2169B4', paddingBottom: '5px' }}>
          Hauptkontakt
        </h2>
        <div style={{ fontSize: '14px', lineHeight: '1.6' }}>
          <p><strong>{customer.first_name} {customer.last_name}</strong></p>
          {customer.street && <p>{customer.street}</p>}
          {(customer.zip_code || customer.city) && <p>{customer.zip_code} {customer.city}</p>}
          {customer.phone && <p>Telefon: {customer.phone}</p>}
          {customer.email && <p>Email: {customer.email}</p>}
        </div>
      </div>

      {/* KPI CARDS */}
      <div style={{ 
        display: 'grid', 
        gridTemplateColumns: 'repeat(4, 1fr)', 
        gap: '15px', 
        marginBottom: '20px' 
      }}>
        <div style={{ 
          background: '#f0f5fa', 
          padding: '15px', 
          borderRadius: '6px', 
          border: '1px solid #c8dcf0',
          textAlign: 'center'
        }}>
          <p style={{ fontSize: '24px', fontWeight: 'bold', color: '#2169B4', margin: '0 0 5px 0' }}>
            {familyMembers?.length || 0}
          </p>
          <p style={{ fontSize: '12px', color: '#666', margin: '0' }}>Familienmitglieder</p>
        </div>
        <div style={{ 
          background: '#f0f5fa', 
          padding: '15px', 
          borderRadius: '6px', 
          border: '1px solid #c8dcf0',
          textAlign: 'center'
        }}>
          <p style={{ fontSize: '24px', fontWeight: 'bold', color: '#2169B4', margin: '0 0 5px 0' }}>
            {contracts?.filter(c => c.status === 'active').length || 0}
          </p>
          <p style={{ fontSize: '12px', color: '#666', margin: '0' }}>Aktive Verträge</p>
        </div>
        <div style={{ 
          background: '#f0f5fa', 
          padding: '15px', 
          borderRadius: '6px', 
          border: '1px solid #c8dcf0',
          textAlign: 'center'
        }}>
          <p style={{ fontSize: '24px', fontWeight: 'bold', color: '#2169B4', margin: '0 0 5px 0' }}>
            {formatCurrency(contracts?.reduce((sum, c) => sum + (c.premium_yearly || 0), 0))}
          </p>
          <p style={{ fontSize: '12px', color: '#666', margin: '0' }}>Jahresprämie</p>
        </div>
        <div style={{ 
          background: '#f0f5fa', 
          padding: '15px', 
          borderRadius: '6px', 
          border: '1px solid #c8dcf0',
          textAlign: 'center'
        }}>
          <p style={{ fontSize: '24px', fontWeight: 'bold', color: '#2169B4', margin: '0 0 5px 0' }}>
            {contracts?.filter(c => {
              const days = getDaysUntilExpiry(c.end_date)
              return days !== null && days >= 0 && days <= 180
            }).length || 0}
          </p>
          <p style={{ fontSize: '12px', color: '#666', margin: '0' }}>Abläufe (180d)</p>
        </div>
      </div>

      {/* FAMILY MEMBERS WITH CONTRACTS */}
      {familyMembers && familyMembers.length > 0 && (
        <div style={{ marginBottom: '20px' }}>
          <h2 style={{ fontSize: '16px', fontWeight: 'bold', marginBottom: '15px', borderBottom: '2px solid #2169B4', paddingBottom: '5px' }}>
            Haushalt & Verträge
          </h2>

          {familyMembers.map((member, idx) => {
            const memberContracts = contracts?.filter(c => c.customer_id === member.id) || []
            return (
              <div key={member.id} style={{ marginBottom: '20px' }}>
                <div style={{ 
                  background: idx % 2 === 0 ? '#2169B4' : '#3489D1', 
                  color: '#fff', 
                  padding: '12px 15px', 
                  borderRadius: '4px',
                  marginBottom: '10px'
                }}>
                  <p style={{ margin: '0', fontWeight: 'bold', fontSize: '14px' }}>
                    {member.first_name} {member.last_name} 
                    {member.id === customer.id ? ' (Hauptkontakt)' : ` (${member.family_role || 'Familienmitglied'})`}
                  </p>
                </div>

                {member.birthdate && (
                  <p style={{ fontSize: '12px', color: '#666', marginBottom: '8px' }}>
                    <strong>Geb.:</strong> {formatDate(member.birthdate)}
                  </p>
                )}

                {memberContracts.length > 0 ? (
                   <table style={{ width: '100%', fontSize: '11px', borderCollapse: 'collapse', marginBottom: '15px' }}>
                     <thead>
                       <tr style={{ background: '#f5f5f5', borderBottom: '2px solid #2169B4' }}>
                         <th style={{ padding: '8px', textAlign: 'left', fontWeight: 'bold', borderRight: '1px solid #ddd' }}>Versicherer</th>
                         <th style={{ padding: '8px', textAlign: 'left', fontWeight: 'bold', borderRight: '1px solid #ddd' }}>Sparte</th>
                         <th style={{ padding: '8px', textAlign: 'left', fontWeight: 'bold', borderRight: '1px solid #ddd' }}>Policen-Nr</th>
                         <th style={{ padding: '8px', textAlign: 'left', fontWeight: 'bold', borderRight: '1px solid #ddd' }}>Produkt</th>
                         <th style={{ padding: '8px', textAlign: 'left', fontWeight: 'bold', borderRight: '1px solid #ddd' }}>Beginn</th>
                         <th style={{ padding: '8px', textAlign: 'left', fontWeight: 'bold', borderRight: '1px solid #ddd' }}>Ende</th>
                         <th style={{ padding: '8px', textAlign: 'right', fontWeight: 'bold', borderRight: '1px solid #ddd' }}>Jahresprämie</th>
                         <th style={{ padding: '8px', textAlign: 'center', fontWeight: 'bold' }}>Status</th>
                       </tr>
                     </thead>
                     <tbody>
                       {memberContracts.map((contract) => {
                         const status = getStatusColor(contract)
                         return (
                           <tr key={contract.id} style={{ 
                             borderBottom: '1px solid #ddd',
                             height: 'auto'
                           }}>
                             <td style={{ padding: '8px', borderRight: '1px solid #ddd' }}>{contract.insurer || '–'}</td>
                             <td style={{ padding: '8px', borderRight: '1px solid #ddd' }}>{contract.sparte || contract.insurance_type || '–'}</td>
                             <td style={{ padding: '8px', borderRight: '1px solid #ddd', fontFamily: 'monospace' }}>{contract.policy_number || '–'}</td>
                             <td style={{ padding: '8px', borderRight: '1px solid #ddd' }}>{contract.product || '–'}</td>
                             <td style={{ padding: '8px', borderRight: '1px solid #ddd' }}>{contract.start_date ? formatDate(contract.start_date) : '–'}</td>
                             <td style={{ padding: '8px', borderRight: '1px solid #ddd' }}>
                               {contract.end_date ? (
                                 <>
                                   {formatDate(contract.end_date)}
                                   {(() => {
                                     const days = getDaysUntilExpiry(contract.end_date)
                                     return days !== null ? ` (${days}d)` : ''
                                   })()}
                                 </>
                               ) : '–'}
                             </td>
                             <td style={{ padding: '8px', textAlign: 'right', fontWeight: 'bold', borderRight: '1px solid #ddd' }}>
                               {formatCurrency(contract.premium_yearly)}
                             </td>
                             <td style={{ 
                               padding: '8px', 
                               textAlign: 'center',
                               background: status.bg,
                               color: status.text,
                               fontWeight: 'bold',
                               fontSize: '11px'
                             }}>
                               {status.label}
                             </td>
                           </tr>
                         )
                       })}
                     </tbody>
                   </table>
                 ) : (
                   <p style={{ fontSize: '12px', color: '#999', fontStyle: 'italic' }}>Keine Verträge</p>
                 )}
              </div>
            )
          })}
        </div>
      )}

      {/* LEGEND */}
      <div style={{ 
        marginTop: '30px', 
        paddingTop: '20px', 
        borderTop: '2px solid #2169B4',
        fontSize: '12px'
      }}>
        <p style={{ fontWeight: 'bold', marginBottom: '10px' }}>Status-Farbcodierung:</p>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
          <div>
            <span style={{ display: 'inline-block', width: '20px', height: '20px', background: '#4CAF50', marginRight: '8px', borderRadius: '3px' }}></span>
            Stabil
          </div>
          <div>
            <span style={{ display: 'inline-block', width: '20px', height: '20px', background: '#FF9800', marginRight: '8px', borderRadius: '3px' }}></span>
            Ablauf (90d)
          </div>
          <div>
            <span style={{ display: 'inline-block', width: '20px', height: '20px', background: '#E91E63', marginRight: '8px', borderRadius: '3px' }}></span>
            Kritisch (30d)
          </div>
          <div>
            <span style={{ display: 'inline-block', width: '20px', height: '20px', background: '#F44336', marginRight: '8px', borderRadius: '3px' }}></span>
            Überfällig
          </div>
        </div>
      </div>

      <p style={{ fontSize: '10px', color: '#999', marginTop: '20px', textAlign: 'center' }}>
        Erstellt: {new Date().toLocaleDateString('de-CH')} {new Date().toLocaleTimeString('de-CH')}
      </p>
    </div>
  )
})

HouseholdPrintExport.displayName = 'HouseholdPrintExport'