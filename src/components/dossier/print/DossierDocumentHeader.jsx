/**
 * DossierDocumentHeader — Professioneller Dokumentkopf mit dynamischen Berater- und Organisationsdaten
 * 
 * Links: Organisationsdaten
 * Rechts: Beraterdaten inkl. FINMA/VBV (nur wenn vorhanden)
 */
import React from 'react';
import { Phone, Mail, Globe, MapPin, User, BadgeCheck } from 'lucide-react';

export default function DossierDocumentHeader({ organization, advisor, snapshot, dossier }) {
  // Organisation-Daten
  const orgName = organization?.name || '';
  const orgStreet = organization?.street || '';
  const orgZip = organization?.zip_code || '';
  const orgCity = organization?.city || '';
  const orgPhone = organization?.phone || '';
  const orgEmail = organization?.email || '';
  const orgWebsite = organization?.website || '';

  // Berater-Daten
  const advisorName = advisor 
    ? `${advisor.firstname || ''} ${advisor.lastname || ''}`.trim() 
    : (snapshot?.created_by_name || '');
  const advisorPhone = advisor?.phone || '';
  const advisorEmail = advisor?.email || '';
  const finmaNumber = advisor?.finma_number || '';
  const vbvNumber = advisor?.vbv_number || '';

  // Icon-Konfiguration
  const iconStyle = { width: '10px', height: '10px', color: '#64748b', flexShrink: 0 };
  const textStyle = { fontSize: '8.5px', color: '#334155' };

  // Hilfsfunktion für Info-Zeilen (nur anzeigen wenn Wert existiert)
  const InfoLine = ({ icon: Icon, value }) => {
    if (!value) return null;
    return (
      <div style={textStyle}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
          <Icon style={iconStyle} />
          <span>{value}</span>
        </div>
      </div>
    );
  };

  // Fallback wenn keine Daten vorhanden
  const hasData = orgName || advisorName;

  return (
    <div style={{
      display: 'flex',
      justifyContent: 'space-between',
      alignItems: 'flex-start',
      borderBottom: '3px solid #1e3a5f',
      paddingBottom: '12px',
      marginBottom: '18px',
      minHeight: hasData ? 'auto' : '60px', // Mindesthöhe wenn keine Daten
    }}>
      {/* Linke Spalte: Organisationsdaten */}
      <div style={{ flex: 1, paddingRight: '20px' }}>
        <div style={{
          fontSize: '13px',
          fontWeight: 800,
          color: '#1e3a5f',
          marginBottom: '8px',
          letterSpacing: '-0.02em',
        }}>
          {orgName || '—'}
        </div>
        
        <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
          <InfoLine icon={MapPin} value={[orgStreet, [orgZip, orgCity].filter(Boolean).join(' ')].filter(Boolean).join(', ')} />
          <InfoLine icon={Phone} value={orgPhone} />
          <InfoLine icon={Mail} value={orgEmail} />
          <InfoLine icon={Globe} value={orgWebsite} />
        </div>
      </div>

      {/* Rechte Spalte: Beraterdaten */}
      <div style={{ flex: 1, paddingLeft: '20px', borderLeft: '1px solid #e2e8f0' }}>
        <div style={{
          fontSize: '13px',
          fontWeight: 800,
          color: '#1e3a5f',
          marginBottom: '8px',
          letterSpacing: '-0.02em',
          display: 'flex',
          alignItems: 'center',
          gap: '5px',
        }}>
          {advisorName || '—'}
        </div>
        
        <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
          <InfoLine icon={Phone} value={advisorPhone} />
          <InfoLine icon={Mail} value={advisorEmail} />
          <InfoLine icon={BadgeCheck} value={finmaNumber ? `FINMA: ${finmaNumber}` : null} />
          <InfoLine icon={BadgeCheck} value={vbvNumber ? `VBV: ${vbvNumber}` : null} />
        </div>
      </div>

      {/* Rechts oben: Dossier-Info */}
      <div style={{ textAlign: 'right', minWidth: '180px' }}>
        <div style={{ fontSize: '9px', color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: '2px' }}>
          Beratungsdossier
        </div>
        <div style={{ fontSize: '8.5px', color: '#64748b' }}>
          {fmtDate(snapshot?.snapshot_created_at)}
        </div>
        <div style={{ fontSize: '8.5px', color: '#94a3b8', marginTop: '3px' }}>
          v{dossier?.version ?? 1}
        </div>
      </div>
    </div>
  );
}

// Hilfsfunktion für Datumsformatierung (falls nicht importiert)
function fmtDate(dateStr) {
  if (!dateStr) return '';
  const date = new Date(dateStr);
  return date.toLocaleDateString('de-CH', { day: 'numeric', month: 'numeric', year: 'numeric' });
}