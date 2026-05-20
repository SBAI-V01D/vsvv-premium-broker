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
  const labelStyle = { fontSize: '7px', color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.05em' };

  return (
    <div style={{
      display: 'flex',
      justifyContent: 'space-between',
      alignItems: 'flex-start',
      borderBottom: '3px solid #1e3a5f',
      paddingBottom: '12px',
      marginBottom: '18px',
    }}>
      {/* Linke Spalte: Organisationsdaten */}
      <div style={{ flex: 1, paddingRight: '20px' }}>
        {orgName && (
          <div style={{
            fontSize: '13px',
            fontWeight: 800,
            color: '#1e3a5f',
            marginBottom: '8px',
            letterSpacing: '-0.02em',
          }}>
            {orgName}
          </div>
        )}
        
        <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
          {/* Adresse */}
          {(orgStreet || orgZip || orgCity) && (
            <div style={textStyle}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
                <MapPin style={iconStyle} />
                <span>
                  {[orgStreet, [orgZip, orgCity].filter(Boolean).join(' ')].filter(Boolean).join(', ')}
                </span>
              </div>
            </div>
          )}

          {/* Telefon */}
          {orgPhone && (
            <div style={textStyle}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
                <Phone style={iconStyle} />
                <span>{orgPhone}</span>
              </div>
            </div>
          )}

          {/* E-Mail */}
          {orgEmail && (
            <div style={textStyle}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
                <Mail style={iconStyle} />
                <span>{orgEmail}</span>
              </div>
            </div>
          )}

          {/* Website */}
          {orgWebsite && (
            <div style={textStyle}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
                <Globe style={iconStyle} />
                <span>{orgWebsite}</span>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Rechte Spalte: Beraterdaten */}
      <div style={{ flex: 1, paddingLeft: '20px', borderLeft: '1px solid #e2e8f0' }}>
        {advisorName && (
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
            <User style={iconStyle} style={iconStyle} />
            {advisorName}
          </div>
        )}
        
        <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
          {/* Telefon Berater */}
          {advisorPhone && (
            <div style={textStyle}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
                <Phone style={iconStyle} />
                <span>{advisorPhone}</span>
              </div>
            </div>
          )}

          {/* E-Mail Berater */}
          {advisorEmail && (
            <div style={textStyle}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
                <Mail style={iconStyle} />
                <span>{advisorEmail}</span>
              </div>
            </div>
          )}

          {/* FINMA-Nummer */}
          {finmaNumber && (
            <div style={textStyle}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
                <BadgeCheck style={{ ...iconStyle, color: '#1d4ed8' }} />
                <span>FINMA: {finmaNumber}</span>
              </div>
            </div>
          )}

          {/* VBV-Nummer */}
          {vbvNumber && (
            <div style={textStyle}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
                <BadgeCheck style={{ ...iconStyle, color: '#1d4ed8' }} />
                <span>VBV: {vbvNumber}</span>
              </div>
            </div>
          )}
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