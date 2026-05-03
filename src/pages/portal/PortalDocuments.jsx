import React, { useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { base44 } from '@/api/base44Client'
import { FolderOpen, Upload, ExternalLink, FileText, Loader2 } from 'lucide-react'
import { usePortalCustomer, fetchPortalContracts } from '@/hooks/usePortalCustomer'

const NAVY = '#0B1C2C'
const ACCENT = '#4F7CFF'

const CATEGORY_LABELS = {
  contract: 'Vertrag', application: 'Antrag', identification: 'Ausweis',
  correspondence: 'Korrespondenz', other: 'Sonstiges',
  police: 'Police', rechnung: 'Rechnung', sonstiges: 'Sonstiges',
  antrag: 'Antrag', anlage: 'Anlage', unbekannt: 'Unbekannt',
}

export default function PortalDocuments() {
  const { customer, customerId, isLoading } = usePortalCustomer()
  const queryClient = useQueryClient()
  const [uploading, setUploading] = useState(false)
  const [dragOver, setDragOver] = useState(false)
  const [selectedContractId, setSelectedContractId] = useState('')

  const { data: documents = [], isLoading: loadingDocs } = useQuery({
    queryKey: ['portal-documents', customerId],
    queryFn: async () => {
      // Load docs linked directly or via primary_customer_id (broker-uploaded)
      const [direct, viaPrimary] = await Promise.all([
        base44.entities.Document.filter({ customer_id: customerId }),
        base44.entities.Document.filter({ primary_customer_id: customerId }),
      ])
      const map = {}
      ;[...direct, ...viaPrimary].forEach(d => { map[d.id] = d })
      // Only show docs not explicitly hidden from portal
      return Object.values(map).filter(d => d.visible_in_portal !== false)
    },
    enabled: !!customerId,
    staleTime: 20_000,
  })

  const { data: contracts = [] } = useQuery({
    queryKey: ['portal-contracts', customerId],
    queryFn: () => fetchPortalContracts(customerId),
    enabled: !!customerId,
    staleTime: 60_000,
  })

  const handleUpload = async (files) => {
    if (!files || !files.length || uploading) return
    setUploading(true)
    for (const file of Array.from(files)) {
      const { file_url } = await base44.integrations.Core.UploadFile({ file })
      await base44.entities.Document.create({
        customer_id: customerId,
        customer_name: customer ? `${customer.first_name} ${customer.last_name}` : '',
        name: file.name,
        file_url,
        category: 'other',
        uploaded_by: localStorage.getItem('portal_email') || '',
        visible_in_portal: true,
        ...(selectedContractId ? { linked_contract_id: selectedContractId } : {}),
      })
    }
    queryClient.invalidateQueries({ queryKey: ['portal-documents', customerId] })
    setUploading(false)
    setSelectedContractId('')
  }

  if (isLoading || loadingDocs) {
    return <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: 200, color: '#6b7280', fontFamily: 'Inter, sans-serif' }}>Laden…</div>
  }

  const contractMap = {}
  contracts.forEach(c => { contractMap[c.id] = c })

  return (
    <div style={{ fontFamily: 'Inter, sans-serif' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 22, flexWrap: 'wrap', gap: 12 }}>
        <div>
          <h1 style={{ color: NAVY, fontSize: 24, fontWeight: 700, margin: 0 }}>Meine Dokumente</h1>
          <p style={{ color: '#6b7280', fontSize: 14, marginTop: 4 }}>{documents.length} Dokument{documents.length !== 1 ? 'e' : ''}</p>
        </div>

        <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
          {contracts.length > 0 && (
            <select
              value={selectedContractId}
              onChange={e => setSelectedContractId(e.target.value)}
              style={{ height: 38, padding: '0 10px', borderRadius: 8, border: '1px solid #d1d5db', fontSize: 13, color: NAVY, background: '#fff', cursor: 'pointer' }}
            >
              <option value="">Kein Vertrag zuordnen</option>
              {contracts.map(c => (
                <option key={c.id} value={c.id}>{c.insurer || c.provider} – {c.insurance_type}</option>
              ))}
            </select>
          )}
          <label style={{
            display: 'flex', alignItems: 'center', gap: 8,
            background: `linear-gradient(135deg, ${ACCENT}, #6AA3FF)`,
            color: '#fff', padding: '9px 18px', borderRadius: 8,
            fontWeight: 600, fontSize: 13, cursor: uploading ? 'not-allowed' : 'pointer',
            opacity: uploading ? 0.6 : 1,
            boxShadow: '0 4px 14px rgba(79,124,255,0.3)',
          }}>
            {uploading ? <Loader2 size={14} style={{ animation: 'spin 1s linear infinite' }} /> : <Upload size={14} />}
            {uploading ? 'Hochladen…' : 'Dokument hochladen'}
            <input type="file" accept=".pdf,.jpg,.jpeg,.png" multiple style={{ display: 'none' }} disabled={uploading} onChange={e => handleUpload(e.target.files)} />
          </label>
        </div>
      </div>

      {/* Debug banner */}
      {!loadingDocs && documents.length === 0 && (
        <div style={{ background: '#fffbeb', border: '1px solid #fcd34d', borderRadius: 9, padding: '10px 14px', display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16 }}>
          <span style={{ fontSize: 13, color: '#92400e' }}>
            Dokumente geladen: <strong>0</strong> — Keine Dokumente mit diesem Kunden verknüpft (ID: {customerId})
          </span>
        </div>
      )}

      {/* Drop zone */}
      <div
        onDragOver={e => { e.preventDefault(); setDragOver(true) }}
        onDragLeave={() => setDragOver(false)}
        onDrop={e => { e.preventDefault(); setDragOver(false); handleUpload(e.dataTransfer.files) }}
        style={{ border: `2px dashed ${dragOver ? ACCENT : '#e5e7eb'}`, borderRadius: 10, padding: '14px 16px', textAlign: 'center', marginBottom: 18, background: dragOver ? `${ACCENT}06` : '#fafafa', transition: 'all 0.15s' }}
      >
        <p style={{ color: '#9ca3af', fontSize: 13, margin: 0 }}>PDF, JPG oder PNG hierher ziehen oder oben auf „Hochladen" klicken</p>
      </div>

      {documents.length === 0 ? (
        <div style={{ background: '#fff', borderRadius: 12, padding: 40, textAlign: 'center', boxShadow: '0 1px 6px rgba(11,28,44,0.07)' }}>
          <FolderOpen size={36} color="#d1d5db" style={{ marginBottom: 12 }} />
          <p style={{ color: '#9ca3af', margin: 0 }}>Keine Dokumente vorhanden</p>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {documents.map(doc => {
            const linkedContract = doc.linked_contract_id ? contractMap[doc.linked_contract_id] : null
            return (
              <div key={doc.id} style={{ background: '#fff', borderRadius: 10, padding: '13px 16px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, boxShadow: '0 1px 4px rgba(11,28,44,0.06)' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 12, minWidth: 0, flex: 1 }}>
                  <div style={{ width: 34, height: 34, borderRadius: 8, background: `${ACCENT}12`, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                    <FileText size={15} color={ACCENT} />
                  </div>
                  <div style={{ minWidth: 0 }}>
                    <p style={{ color: NAVY, fontWeight: 600, fontSize: 13, margin: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{doc.name}</p>
                    <div style={{ display: 'flex', gap: 6, alignItems: 'center', marginTop: 3, flexWrap: 'wrap' }}>
                      {doc.category && (
                        <span style={{ background: '#f3f4f6', color: '#6b7280', fontSize: 10, fontWeight: 600, padding: '2px 7px', borderRadius: 20 }}>
                          {CATEGORY_LABELS[doc.category] || doc.category}
                        </span>
                      )}
                      {linkedContract && (
                        <span style={{ background: `${ACCENT}10`, color: ACCENT, fontSize: 10, fontWeight: 600, padding: '2px 7px', borderRadius: 20 }}>
                          {linkedContract.insurer || linkedContract.provider} – {linkedContract.insurance_type}
                        </span>
                      )}
                      <span style={{ color: '#9ca3af', fontSize: 11 }}>
                        {doc.created_date ? new Date(doc.created_date).toLocaleDateString('de-CH') : ''}
                      </span>
                    </div>
                  </div>
                </div>
                <a
                  href={doc.file_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  style={{ display: 'flex', alignItems: 'center', gap: 5, color: ACCENT, fontWeight: 600, fontSize: 12, textDecoration: 'none', padding: '7px 12px', background: `${ACCENT}10`, borderRadius: 7, flexShrink: 0, border: `1px solid ${ACCENT}22` }}
                >
                  <ExternalLink size={12} /> Öffnen
                </a>
              </div>
            )
          })}
        </div>
      )}

      <style>{`@keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }`}</style>
    </div>
  )
}