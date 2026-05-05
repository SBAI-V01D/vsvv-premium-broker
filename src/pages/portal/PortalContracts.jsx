import React, { useState } from 'react'
import { FileText, AlertCircle, Shield, Upload, Loader2, Edit2 } from 'lucide-react'
import { format } from 'date-fns'
import { base44 } from '@/api/base44Client'
import { usePortalData, yearlyPremium } from '@/hooks/usePortalData'
import { useQueryClient } from '@tanstack/react-query'
import MutationRequestDialog from '@/components/portal/MutationRequestDialog'

const NAVY = '#0B1C2C'
const ACCENT = '#4F7CFF'

const STATUS_COLORS = {
  active: '#16a34a', aktiv: '#16a34a',
  cancelled: '#dc2626', gekuendigt: '#dc2626',
  paused: '#d97706', expired: '#6b7280',
}
const STATUS_LABELS = {
  active: 'Aktiv', aktiv: 'Aktiv',
  cancelled: 'Gekündigt', gekuendigt: 'Gekündigt',
  paused: 'Pausiert', expired: 'Abgelaufen',
}

const INSURANCE_TYPE_ICONS = {
  health: '🏥', life: '❤️', property: '🏠', liability: '🛡️', motor: '🚗', other: '📋',
}

function Field({ label, value }) {
  if (!value) return null
  return (
    <div>
      <p style={{ color: '#9ca3af', fontSize: 10, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.4px', margin: '0 0 3px' }}>{label}</p>
      <p style={{ color: NAVY, fontSize: 13, fontWeight: 500, margin: 0 }}>{value}</p>
    </div>
  )
}

export default function PortalContracts() {
  const { customer, contracts, isLoading, error, customerId } = usePortalData()
  const queryClient = useQueryClient()
  const [uploading, setUploading] = useState(false)
  const [uploadSuccess, setUploadSuccess] = useState(false)
  const [selectedContract, setSelectedContract] = useState(null)
  const [showMutationDialog, setShowMutationDialog] = useState(false)

  const handleUpload = async (files, contractId) => {
    if (!files || !files.length || uploading) return
    setUploading(true)
    try {
      for (const file of Array.from(files)) {
        const { file_url } = await base44.integrations.Core.UploadFile({ file })
        await base44.entities.Document.create({
          customer_id: customerId,
          customer_name: customer ? `${customer.first_name} ${customer.last_name}` : '',
          name: file.name,
          file_url,
          category: 'contract',
          uploaded_by: localStorage.getItem('portal_email') || '',
          linked_contract_id: contractId,
        })
      }
      queryClient.invalidateQueries({ queryKey: ['portal-all-data', customerId] })
      setUploadSuccess(true)
      setTimeout(() => setUploadSuccess(false), 3000)
    } catch (err) {
      console.error('Upload fehler:', err)
    }
    setUploading(false)
  }

  if (isLoading) {
    return <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: 200, color: '#6b7280', fontFamily: 'Inter, sans-serif' }}>Laden…</div>
  }

  if (error) return (
    <div style={{ background: '#fef2f2', border: '1px solid #fca5a5', borderRadius: 10, padding: '16px 20px', display: 'flex', alignItems: 'center', gap: 10 }}>
      <AlertCircle size={16} color="#dc2626" />
      <p style={{ color: '#991b1b', fontSize: 13, margin: 0 }}>Fehler beim Laden: {error.message}</p>
    </div>
  )

  const totalMonthly = contracts.reduce((s, c) => s + (c.premium_monthly || 0), 0)
  const totalYearly = contracts.reduce((s, c) => s + yearlyPremium(c), 0)

  if (uploadSuccess) {
    setTimeout(() => setUploadSuccess(false), 3000)
  }

  return (
    <div style={{ fontFamily: 'Inter, sans-serif' }}>
      <div style={{ marginBottom: 24 }}>
        <h1 style={{ color: NAVY, fontSize: 24, fontWeight: 700, margin: 0 }}>Meine Verträge</h1>
        <p style={{ color: '#6b7280', fontSize: 14, marginTop: 4 }}>{contracts.length} Vertrag{contracts.length !== 1 ? 'e' : ''} gefunden</p>
      </div>

      {contracts.length > 0 && (
        <div style={{ display: 'flex', gap: 16, marginBottom: 22, flexWrap: 'wrap' }}>
          <div style={{ background: '#fff', borderRadius: 10, padding: '12px 18px', boxShadow: '0 1px 4px rgba(11,28,44,0.07)', borderLeft: `3px solid ${ACCENT}` }}>
            <p style={{ color: '#6b7280', fontSize: 11, fontWeight: 600, textTransform: 'uppercase', margin: '0 0 3px' }}>Total Monatsprämie</p>
            <p style={{ color: NAVY, fontSize: 18, fontWeight: 700, margin: 0 }}>CHF {totalMonthly.toLocaleString('de-CH', { minimumFractionDigits: 2 })}</p>
          </div>
          <div style={{ background: '#fff', borderRadius: 10, padding: '12px 18px', boxShadow: '0 1px 4px rgba(11,28,44,0.07)', borderLeft: '3px solid #16a34a' }}>
            <p style={{ color: '#6b7280', fontSize: 11, fontWeight: 600, textTransform: 'uppercase', margin: '0 0 3px' }}>Total Jahresprämie</p>
            <p style={{ color: NAVY, fontSize: 18, fontWeight: 700, margin: 0 }}>CHF {totalYearly.toLocaleString('de-CH', { minimumFractionDigits: 2 })}</p>
          </div>
        </div>
      )}

      {contracts.length === 0 ? (
        <div style={{ background: '#fff', borderRadius: 12, padding: 40, textAlign: 'center', boxShadow: '0 1px 6px rgba(11,28,44,0.07)' }}>
          <FileText size={36} color="#d1d5db" style={{ marginBottom: 12 }} />
          <p style={{ color: '#9ca3af', margin: 0 }}>Keine Verträge vorhanden</p>
          <p style={{ color: '#c4c9d1', fontSize: 12, marginTop: 6 }}>Ihr Broker hat noch keine Verträge für Sie erfasst.</p>
        </div>
      ) : (
        <>
          {uploadSuccess && (
            <div style={{ background: '#f0fdf4', border: '1px solid #86efac', borderRadius: 9, padding: '10px 14px', marginBottom: 14, fontSize: 13, color: '#16a34a', fontWeight: 500 }}>
              ✓ Dokument erfolgreich hochgeladen
            </div>
          )}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          {contracts.map(c => {
            const statusColor = STATUS_COLORS[c.status] || '#6b7280'
            const statusLabel = c.custom_status || STATUS_LABELS[c.status] || c.status
            const yearly = yearlyPremium(c)
            const icon = INSURANCE_TYPE_ICONS[c.insurance_type] || '📋'
            return (
              <div key={c.id} style={{ background: '#fff', borderRadius: 12, padding: '20px 22px', boxShadow: '0 1px 6px rgba(11,28,44,0.07)', borderLeft: `4px solid ${statusColor}` }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 12, marginBottom: 14 }}>
                  <div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
                      <span style={{ fontSize: 20 }}>{icon}</span>
                      <h3 style={{ color: NAVY, fontWeight: 700, fontSize: 16, margin: 0 }}>{c.insurer || '–'}</h3>
                      <span style={{ background: `${statusColor}18`, color: statusColor, fontSize: 11, fontWeight: 600, padding: '3px 10px', borderRadius: 20 }}>
                        {statusLabel}
                      </span>
                    </div>
                    <p style={{ color: '#6b7280', fontSize: 13, margin: '4px 0 0' }}>
                      {c.insurance_type}{c.product ? ` · ${c.product}` : ''}
                      {c.customer_name && c.customer_name !== `${c.first_name} ${c.last_name}` ? ` · ${c.customer_name}` : ''}
                    </p>
                  </div>

                  <div style={{ textAlign: 'right' }}>
                    {c.premium_monthly != null && (
                      <p style={{ color: NAVY, fontWeight: 700, fontSize: 18, margin: 0 }}>
                        CHF {c.premium_monthly.toLocaleString('de-CH', { minimumFractionDigits: 2 })}
                        <span style={{ fontSize: 12, fontWeight: 400, color: '#9ca3af' }}>/Mt.</span>
                      </p>
                    )}
                    {yearly > 0 && (
                      <p style={{ color: '#6b7280', fontSize: 12, margin: '2px 0 0' }}>
                        CHF {yearly.toLocaleString('de-CH', { minimumFractionDigits: 2 })} / Jahr
                      </p>
                    )}
                  </div>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))', gap: 12, paddingTop: 14, borderTop: '1px solid #f3f4f6' }}>
                  <Field label="Policen-Nr." value={c.policy_number} />
                  <Field label="Vertragsbeginn" value={c.start_date ? format(new Date(c.start_date), 'dd.MM.yyyy') : null} />
                  <Field label="Vertragsende" value={c.end_date ? format(new Date(c.end_date), 'dd.MM.yyyy') : null} />
                  <Field label="Kündigungsfrist" value={c.cancellation_deadline ? format(new Date(c.cancellation_deadline), 'dd.MM.yyyy') : null} />
                  {c.sparte_data?.franchise && <Field label="Franchise" value={`CHF ${c.sparte_data.franchise}`} />}
                  {c.sparte_data?.model && <Field label="Modell" value={c.sparte_data.model} />}
                  {c.notes && <div style={{ gridColumn: '1/-1' }}><Field label="Notizen" value={c.notes} /></div>}
                </div>

                <div style={{ marginTop: 12, display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                  {c.policy_document_url && (
                    <a href={c.policy_document_url} target="_blank" rel="noopener noreferrer"
                      style={{ display: 'inline-flex', alignItems: 'center', gap: 6, color: ACCENT, fontSize: 12, fontWeight: 600, textDecoration: 'none', padding: '6px 12px', background: `${ACCENT}10`, borderRadius: 7, border: `1px solid ${ACCENT}22` }}>
                      <Shield size={12} /> Police öffnen
                    </a>
                  )}
                  {c.status === 'active' && (
                    <button
                      onClick={() => { setSelectedContract(c); setShowMutationDialog(true); }}
                      style={{ display: 'inline-flex', alignItems: 'center', gap: 6, color: '#f97316', fontSize: 12, fontWeight: 600, cursor: 'pointer', padding: '6px 12px', background: '#fed7aa0d', borderRadius: 7, border: '1px solid #fdba7466', transition: 'all 0.2s' }}
                      onMouseEnter={e => { e.currentTarget.style.background = '#fed7aa18'; }}
                      onMouseLeave={e => { e.currentTarget.style.background = '#fed7aa0d'; }}
                    >
                      <Edit2 size={12} /> Änderung beantragen
                    </button>
                  )}
                  <label style={{ display: 'inline-flex', alignItems: 'center', gap: 6, color: uploading ? '#9ca3af' : '#16a34a', fontSize: 12, fontWeight: 600, cursor: uploading ? 'not-allowed' : 'pointer', padding: '6px 12px', background: uploading ? '#f3f4f6' : '#dcfce70d', borderRadius: 7, border: uploading ? '1px solid #d1d5db' : '1px solid #86efac66', opacity: uploading ? 0.6 : 1, transition: 'all 0.2s' }}>
                    {uploading ? <Loader2 size={12} style={{ animation: 'spin 1s linear infinite' }} /> : <Upload size={12} />}
                    {uploading ? 'Wird hochgeladen...' : 'Dokument hochladen'}
                    <input type="file" accept=".pdf,.jpg,.jpeg,.png" multiple style={{ display: 'none' }} disabled={uploading} onChange={e => handleUpload(e.target.files, c.id)} />
                  </label>
                </div>
              </div>
            )
          })}
          </div>
        </>
      )}

      {selectedContract && (
        <MutationRequestDialog
          contract={selectedContract}
          customerId={customerId}
          open={showMutationDialog}
          onOpenChange={setShowMutationDialog}
        />
      )}

      <style>{`@keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }`}</style>
    </div>
  )
}