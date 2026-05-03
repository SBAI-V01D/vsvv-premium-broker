import React, { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { base44 } from '@/api/base44Client'
import { FolderOpen, Upload, ExternalLink, FileText, Loader2 } from 'lucide-react'
import { usePortalCustomer } from '@/hooks/usePortalCustomer'

const NAVY = '#0B1C2C'
const ACCENT = '#4F7CFF'

const CATEGORY_LABELS = {
  contract: 'Vertrag', application: 'Antrag', identification: 'Ausweis',
  correspondence: 'Korrespondenz', other: 'Sonstiges',
  police: 'Police', rechnung: 'Rechnung', sonstiges: 'Sonstiges',
}

export default function PortalDocuments() {
  const { customer, customerId, isLoading } = usePortalCustomer()
  const queryClient = useQueryClient()
  const [uploading, setUploading] = useState(false)
  const [dragOver, setDragOver] = useState(false)

  const { data: documents = [], isLoading: loadingDocs } = useQuery({
    queryKey: ['portal-documents', customerId],
    queryFn: () => base44.entities.Document.filter({ customer_id: customerId })
      .then(docs => docs.filter(d => d.visible_in_portal !== false)),
    enabled: !!customerId,
  })

  const handleUpload = async (files) => {
    if (!files || !files.length) return
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
      })
    }
    queryClient.invalidateQueries({ queryKey: ['portal-documents', customerId] })
    setUploading(false)
  }

  if (isLoading || loadingDocs) {
    return <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: 200, color: '#6b7280' }}>Laden...</div>
  }

  return (
    <div style={{ fontFamily: 'Inter, sans-serif' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24, flexWrap: 'wrap', gap: 12 }}>
        <div>
          <h1 style={{ color: NAVY, fontSize: 24, fontWeight: 700, margin: 0 }}>Meine Dokumente</h1>
          <p style={{ color: '#6b7280', fontSize: 14, marginTop: 4 }}>{documents.length} Dokument{documents.length !== 1 ? 'e' : ''}</p>
        </div>

        <label style={{
          display: 'flex', alignItems: 'center', gap: 8,
          background: `linear-gradient(135deg, ${ACCENT}, #6AA3FF)`,
          color: '#fff', padding: '10px 18px', borderRadius: 8,
          fontWeight: 600, fontSize: 13, cursor: uploading ? 'not-allowed' : 'pointer',
          opacity: uploading ? 0.6 : 1,
          boxShadow: '0 4px 14px rgba(79,124,255,0.35)',
        }}>
          {uploading ? <Loader2 size={15} style={{ animation: 'spin 1s linear infinite' }} /> : <Upload size={15} />}
          {uploading ? 'Wird hochgeladen…' : 'Dokument hochladen'}
          <input
            type="file"
            accept=".pdf,.jpg,.jpeg,.png"
            multiple
            style={{ display: 'none' }}
            disabled={uploading}
            onChange={e => handleUpload(e.target.files)}
          />
        </label>
      </div>

      {/* Drop zone */}
      <div
        onDragOver={e => { e.preventDefault(); setDragOver(true) }}
        onDragLeave={() => setDragOver(false)}
        onDrop={e => { e.preventDefault(); setDragOver(false); handleUpload(e.dataTransfer.files) }}
        style={{
          border: `2px dashed ${dragOver ? ACCENT : '#d1d5db'}`,
          borderRadius: 10, padding: '18px', textAlign: 'center',
          marginBottom: 20, background: dragOver ? `${ACCENT}08` : '#fafafa',
          transition: 'all 0.15s',
        }}
      >
        <p style={{ color: '#9ca3af', fontSize: 13, margin: 0 }}>
          PDF, JPG oder PNG hierher ziehen – oder oben auf „Hochladen" klicken
        </p>
      </div>

      {documents.length === 0 ? (
        <div style={{ background: '#fff', borderRadius: 12, padding: 40, textAlign: 'center', boxShadow: '0 1px 6px rgba(11,28,44,0.07)' }}>
          <FolderOpen size={36} color="#d1d5db" style={{ marginBottom: 12 }} />
          <p style={{ color: '#9ca3af', margin: 0 }}>Keine Dokumente vorhanden</p>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {documents.map(doc => (
            <div key={doc.id} style={{
              background: '#fff', borderRadius: 10, padding: '14px 18px',
              display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12,
              boxShadow: '0 1px 4px rgba(11,28,44,0.06)',
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12, minWidth: 0, flex: 1 }}>
                <div style={{ width: 36, height: 36, borderRadius: 8, background: `${ACCENT}12`, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                  <FileText size={16} color={ACCENT} />
                </div>
                <div style={{ minWidth: 0 }}>
                  <p style={{ color: NAVY, fontWeight: 600, fontSize: 13, margin: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{doc.name}</p>
                  <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginTop: 3, flexWrap: 'wrap' }}>
                    {doc.category && (
                      <span style={{ background: '#f3f4f6', color: '#6b7280', fontSize: 11, fontWeight: 600, padding: '2px 8px', borderRadius: 20 }}>
                        {CATEGORY_LABELS[doc.category] || doc.category}
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
                style={{
                  display: 'flex', alignItems: 'center', gap: 6,
                  color: ACCENT, fontWeight: 600, fontSize: 12,
                  textDecoration: 'none', padding: '7px 12px',
                  background: `${ACCENT}10`, borderRadius: 7,
                  flexShrink: 0,
                  border: `1px solid ${ACCENT}25`,
                }}
              >
                <ExternalLink size={13} /> Öffnen
              </a>
            </div>
          ))}
        </div>
      )}

      <style>{`@keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }`}</style>
    </div>
  )
}