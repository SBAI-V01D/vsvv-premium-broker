import React from 'react';
import { getProduktName, nettoPreis } from './OfferList';

const ABZUG = 5.15;

export default function VergleichPrintView({ formData, offers, currentOffer, currentPraemie, selectedResult, printDate }) {
  const sortedOffers = [...offers].sort((a, b) => (a.monthly_premium || 0) - (b.monthly_premium || 0));
  const cheapestNet = sortedOffers.length > 0 ? nettoPreis(sortedOffers[0].monthly_premium) : null;
  const currentNet = currentPraemie ? nettoPreis(currentPraemie) : null;
  const selectedNet = selectedResult ? nettoPreis(selectedResult.monthly_premium) : null;
  const ersparnisJahr = currentNet && selectedNet ? Math.round((currentNet - selectedNet) * 12) : null;

  return (
    <div style={{ fontFamily: 'Arial, sans-serif', fontSize: '11px', color: '#1a202c', padding: '20px', maxWidth: '210mm' }}>
      {/* Header */}
      <div style={{ borderBottom: '2px solid #3b82f6', paddingBottom: '12px', marginBottom: '16px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
          <div>
            <h1 style={{ fontSize: '18px', fontWeight: 'bold', color: '#1e3a5f', margin: 0 }}>
              Krankenkassenvergleich OKP 2026
            </h1>
            <p style={{ color: '#64748b', margin: '4px 0 0', fontSize: '10px' }}>
              Quelle: BAG / priminfo.admin.ch — Nettoprämien (Bruttoprämie − CHF {ABZUG} Umweltabgabe)
            </p>
          </div>
          <div style={{ textAlign: 'right', fontSize: '10px', color: '#64748b' }}>
            <p style={{ margin: 0 }}>Erstellt: {printDate || new Date().toLocaleDateString('de-CH')}</p>
          </div>
        </div>
      </div>

      {/* Kundendaten */}
      <div style={{ backgroundColor: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '6px', padding: '12px', marginBottom: '16px' }}>
        <h2 style={{ fontSize: '12px', fontWeight: 'bold', marginBottom: '8px', color: '#1e3a5f' }}>Versicherte Person</h2>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '4px' }}>
          {[
            ['Name', `${formData.vorname} ${formData.nachname}`],
            ['Ort / PLZ', `${formData.plz} ${formData.wohnort}${formData.kanton ? ` (${formData.kanton})` : ''}`],
            ['Geburtsdatum', formData.geburtsdatum ? new Date(formData.geburtsdatum).toLocaleDateString('de-CH') : '–'],
            ['Franchise', `CHF ${formData.aktuelle_franchise}`],
            ['Aktuelle Kasse', formData.aktuelle_krankenkasse || '–'],
            ['Aktuelles Modell', formData.aktuelles_modell || '–'],
          ].map(([label, value]) => (
            <div key={label} style={{ display: 'flex', gap: '6px' }}>
              <span style={{ color: '#64748b', minWidth: '100px' }}>{label}:</span>
              <span style={{ fontWeight: '500' }}>{value}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Aktuelle vs. Empfehlung */}
      {selectedResult && (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', marginBottom: '16px' }}>
          <div style={{ backgroundColor: '#fffbeb', border: '1px solid #fcd34d', borderRadius: '6px', padding: '10px' }}>
            <p style={{ fontWeight: 'bold', color: '#92400e', margin: '0 0 6px', fontSize: '11px' }}>Aktuelle Versicherung</p>
            <p style={{ fontWeight: 'bold', margin: '0 0 2px' }}>{formData.aktuelle_krankenkasse || '–'}</p>
            <p style={{ color: '#78716c', margin: '0 0 4px', fontSize: '10px' }}>{formData.aktuelles_modell || '–'}</p>
            {currentNet && <p style={{ fontSize: '15px', fontWeight: 'bold', color: '#92400e', margin: 0 }}>CHF {currentNet.toFixed(2)}/M.</p>}
          </div>
          <div style={{ backgroundColor: '#f0fdf4', border: '1px solid #86efac', borderRadius: '6px', padding: '10px' }}>
            <p style={{ fontWeight: 'bold', color: '#166534', margin: '0 0 6px', fontSize: '11px' }}>Empfehlung / Auswahl</p>
            <p style={{ fontWeight: 'bold', margin: '0 0 2px' }}>{selectedResult.insurer}</p>
            <p style={{ color: '#6b7280', margin: '0 0 4px', fontSize: '10px' }}>{getProduktName(selectedResult.insurer, selectedResult.model)}</p>
            <p style={{ fontSize: '15px', fontWeight: 'bold', color: '#166534', margin: 0 }}>CHF {selectedNet?.toFixed(2)}/M.</p>
          </div>
        </div>
      )}

      {/* Ersparnis Banner */}
      {ersparnisJahr !== null && (
        <div style={{
          backgroundColor: ersparnisJahr >= 0 ? '#ecfdf5' : '#fef2f2',
          border: `2px solid ${ersparnisJahr >= 0 ? '#6ee7b7' : '#fca5a5'}`,
          borderRadius: '6px', padding: '10px 14px', marginBottom: '16px',
          display: 'flex', justifyContent: 'space-between', alignItems: 'center'
        }}>
          <span style={{ fontWeight: '600', color: ersparnisJahr >= 0 ? '#065f46' : '#991b1b' }}>
            {ersparnisJahr >= 0 ? '✓ Jährliche Ersparnis' : '⚠ Jährliche Mehrkosten (Kundenwunsch)'}
          </span>
          <span style={{ fontSize: '18px', fontWeight: 'bold', color: ersparnisJahr >= 0 ? '#065f46' : '#dc2626' }}>
            {ersparnisJahr >= 0 ? '+' : ''}CHF {Math.abs(ersparnisJahr).toLocaleString('de-CH')} / Jahr
          </span>
        </div>
      )}

      {/* Rangliste */}
      <h2 style={{ fontSize: '12px', fontWeight: 'bold', marginBottom: '8px', color: '#1e3a5f' }}>
        Prämienrangliste — Franchise CHF {formData.aktuelle_franchise} · {formData.unfall ? 'mit Unfall' : 'ohne Unfall'}
      </h2>
      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '10px' }}>
        <thead>
          <tr style={{ backgroundColor: '#1e3a5f', color: 'white' }}>
            <th style={{ padding: '6px 8px', textAlign: 'left', width: '30px' }}>#</th>
            <th style={{ padding: '6px 8px', textAlign: 'left' }}>Versicherer</th>
            <th style={{ padding: '6px 8px', textAlign: 'left' }}>Produkt</th>
            <th style={{ padding: '6px 8px', textAlign: 'right' }}>CHF / Monat</th>
            <th style={{ padding: '6px 8px', textAlign: 'right' }}>Diff. / Jahr</th>
            <th style={{ padding: '6px 8px', textAlign: 'center', width: '60px' }}>Status</th>
          </tr>
        </thead>
        <tbody>
          {sortedOffers.map((offer, idx) => {
            const net = nettoPreis(offer.monthly_premium);
            const isCurrent = currentOffer && offer.insurer === currentOffer.insurer && offer.model === currentOffer.model && Math.abs(offer.monthly_premium - currentOffer.monthly_premium) < 0.1;
            const isSelected = selectedResult && offer.insurer === selectedResult.insurer && offer.model === selectedResult.model && offer.monthly_premium === selectedResult.monthly_premium;
            const diff = currentNet ? Math.round((currentNet - net) * 12) : null;
            const rowBg = isCurrent ? '#fffbeb' : isSelected ? '#eff6ff' : idx % 2 === 0 ? '#ffffff' : '#f9fafb';
            return (
              <tr key={idx} style={{ backgroundColor: rowBg, borderBottom: '1px solid #e2e8f0' }}>
                <td style={{ padding: '5px 8px', fontWeight: 'bold', color: '#64748b' }}>{idx + 1}</td>
                <td style={{ padding: '5px 8px', fontWeight: isCurrent || isSelected ? 'bold' : 'normal' }}>
                  {offer.insurer}
                </td>
                <td style={{ padding: '5px 8px', color: '#64748b' }}>{getProduktName(offer.insurer, offer.model)}</td>
                <td style={{ padding: '5px 8px', textAlign: 'right', fontWeight: 'bold' }}>
                  {net.toFixed(2)}
                </td>
                <td style={{ padding: '5px 8px', textAlign: 'right', color: diff === null ? '#94a3b8' : diff > 0 ? '#16a34a' : diff < 0 ? '#dc2626' : '#64748b' }}>
                  {diff !== null ? (diff >= 0 ? `−${diff.toLocaleString('de-CH')}` : `+${Math.abs(diff).toLocaleString('de-CH')}`) : '–'}
                </td>
                <td style={{ padding: '5px 8px', textAlign: 'center' }}>
                  {isCurrent && <span style={{ backgroundColor: '#fef3c7', color: '#92400e', padding: '1px 5px', borderRadius: '3px', fontSize: '9px', fontWeight: 'bold' }}>Aktuell</span>}
                  {isSelected && !isCurrent && <span style={{ backgroundColor: '#dbeafe', color: '#1d4ed8', padding: '1px 5px', borderRadius: '3px', fontSize: '9px', fontWeight: 'bold' }}>Auswahl</span>}
                  {idx === 0 && !isCurrent && !isSelected && <span style={{ backgroundColor: '#d1fae5', color: '#065f46', padding: '1px 5px', borderRadius: '3px', fontSize: '9px', fontWeight: 'bold' }}>Günstig</span>}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>

      {/* Footer */}
      <div style={{ marginTop: '16px', paddingTop: '10px', borderTop: '1px solid #e2e8f0', fontSize: '9px', color: '#94a3b8', display: 'flex', justifyContent: 'space-between' }}>
        <span>Prämien 2026 — Quelle: Bundesamt für Gesundheit (BAG) / priminfo.admin.ch via PrimAI</span>
        <span>Nur OKP-Grundversicherung. Keine Haftung für Richtigkeit.</span>
      </div>
    </div>
  );
}