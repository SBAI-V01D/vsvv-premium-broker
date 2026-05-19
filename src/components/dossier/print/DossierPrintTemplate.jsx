/**
 * DossierPrintTemplate — Phase 4
 * Isoliertes HTML-Print-Template für window.print() / PDF-Export.
 * Druckfreundliches Layout, keine UI-Bibliotheks-Abhängigkeiten im Print-Bereich.
 * Identische Struktur für Bildschirm-Vorschau und Druckausgabe.
 *
 * Verwendung:
 *   - Im Browser: als Vorschau rendern (className="print-preview")
 *   - Druck: window.print() — @media print CSS greift automatisch
 */
import React from 'react';
import { fmtCHF, calcDossierSummary, scoreClass, SCORE_COLORS } from '@/lib/dossierCalc';

// ── Styles (inline für Print-Isolation) ─────────────────────────────────────
const PRINT_STYLES = `
  @media print {
    body * { visibility: hidden !important; }
    #dossier-print-root, #dossier-print-root * { visibility: visible !important; }
    #dossier-print-root { position: fixed; left: 0; top: 0; width: 100%; }
    @page { margin: 15mm 18mm; size: A4; }
  }
`;

// ── Typ-Labels ────────────────────────────────────────────────────────────────
const TYPE_LABELS = {
  kk_vergleich:    'Krankenversicherungsvergleich',
  vorsorge:        'Vorsorgedossier',
  sachversicherung:'Sachversicherungsdossier',
  gesamtdossier:   'Gesamtdossier',
};

const SECTION_LABELS = {
  grundversicherung: 'Grundversicherung (KVG)',
  zusatzversicherung: 'Zusatzversicherung (VVG)',
};

const CIVIL_STATUS_LABELS = {
  single: 'Ledig', married: 'Verheiratet', divorced: 'Geschieden',
  widowed: 'Verwitwet', registered_partnership: 'Eingetragene Partnerschaft',
};

// ── Helper Components ─────────────────────────────────────────────────────────
function PrintSection({ title, children }) {
  return (
    <div style={{ marginBottom: '20px', pageBreakInside: 'avoid' }}>
      <div style={{
        borderBottom: '2px solid #1e3a5f',
        paddingBottom: '4px',
        marginBottom: '12px',
        display: 'flex',
        alignItems: 'center',
        gap: '8px',
      }}>
        <span style={{ fontSize: '12px', fontWeight: 700, color: '#1e3a5f', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
          {title}
        </span>
      </div>
      {children}
    </div>
  );
}

function PrintGrid({ cols = 2, children }) {
  return (
    <div style={{
      display: 'grid',
      gridTemplateColumns: `repeat(${cols}, 1fr)`,
      gap: '8px 16px',
    }}>
      {children}
    </div>
  );
}

function PrintField({ label, value }) {
  if (!value) return null;
  return (
    <div style={{ marginBottom: '4px' }}>
      <div style={{ fontSize: '9px', color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '1px' }}>
        {label}
      </div>
      <div style={{ fontSize: '11px', color: '#1e293b', fontWeight: 500 }}>{value}</div>
    </div>
  );
}

function ScoreBar({ score }) {
  if (score == null) return <span style={{ fontSize: '10px', color: '#94a3b8' }}>—</span>;
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
      <span style={{ fontSize: '10px', fontWeight: 700, color: score >= 5 ? '#059669' : score >= 4 ? '#2563eb' : score >= 3 ? '#d97706' : '#dc2626' }}>
        {score}/6
      </span>
      <div style={{ display: 'flex', gap: '2px' }}>
        {[1,2,3,4,5,6].map(i => (
          <div key={i} style={{
            width: '10px', height: '10px', borderRadius: '2px',
            background: i <= score ? '#f59e0b' : '#e2e8f0',
          }} />
        ))}
      </div>
    </div>
  );
}

// ── Haupt-Template ────────────────────────────────────────────────────────────
export default function DossierPrintTemplate({ snapshot, forPrint = false }) {
  if (!snapshot) return null;

  const { dossier, customer, family_members, contracts, comparison_entries, verkaufschance } = snapshot;
  const summary = calcDossierSummary(comparison_entries ?? []);
  const entries = comparison_entries ?? [];

  const sections = ['grundversicherung', 'zusatzversicherung'];

  const containerStyle = {
    fontFamily: "'Helvetica Neue', Arial, sans-serif",
    color: '#1e293b',
    background: '#ffffff',
    maxWidth: forPrint ? '100%' : '780px',
    margin: forPrint ? '0' : '0 auto',
    padding: forPrint ? '0' : '32px',
    fontSize: '11px',
    lineHeight: '1.5',
  };

  return (
    <>
      <style dangerouslySetInnerHTML={{ __html: PRINT_STYLES }} />
      <div id="dossier-print-root" style={containerStyle}>

        {/* ── Header ── */}
        <div style={{
          display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start',
          borderBottom: '3px solid #1e3a5f', paddingBottom: '16px', marginBottom: '20px',
        }}>
          <div>
            <div style={{ fontSize: '20px', fontWeight: 800, color: '#1e3a5f', letterSpacing: '-0.02em', marginBottom: '4px' }}>
              {TYPE_LABELS[dossier.dossier_type] || dossier.dossier_type}
            </div>
            <div style={{ fontSize: '13px', fontWeight: 600, color: '#334155' }}>
              {dossier.title}
            </div>
            {(dossier.valid_from || dossier.valid_until) && (
              <div style={{ fontSize: '10px', color: '#64748b', marginTop: '4px' }}>
                Gültig: {dossier.valid_from ? new Date(dossier.valid_from).toLocaleDateString('de-CH') : '—'}
                {dossier.valid_until ? ` bis ${new Date(dossier.valid_until).toLocaleDateString('de-CH')}` : ''}
              </div>
            )}
          </div>
          <div style={{ textAlign: 'right' }}>
            <div style={{
              fontSize: '9px', color: '#94a3b8', textTransform: 'uppercase',
              letterSpacing: '0.08em', marginBottom: '2px',
            }}>
              Swiss Premium Broker
            </div>
            <div style={{ fontSize: '10px', color: '#64748b' }}>
              Erstellt: {new Date(snapshot.snapshot_created_at).toLocaleDateString('de-CH')}
            </div>
            {snapshot.created_by_name && (
              <div style={{ fontSize: '10px', color: '#64748b' }}>durch {snapshot.created_by_name}</div>
            )}
            <div style={{
              fontSize: '9px', color: '#94a3b8', marginTop: '4px',
              background: '#f1f5f9', padding: '2px 6px', borderRadius: '4px',
            }}>
              v{dossier.version ?? 1} · Schema {snapshot.schema_version}
            </div>
          </div>
        </div>

        {/* ── Einsparungsübersicht ── */}
        {(summary.hasCurrent || summary.hasRecommendation) && (
          <PrintSection title="Prämienübersicht">
            <div style={{
              display: 'grid', gridTemplateColumns: '1fr 1fr 1fr',
              gap: '12px', marginBottom: '8px',
            }}>
              {[
                { label: 'Aktuelle Prämie/Monat', value: fmtCHF(summary.currentMonthly), sub: `${fmtCHF(summary.currentYearly)} / Jahr`, color: '#334155' },
                {
                  label: summary.savingsMonthly > 0 ? 'Einsparung/Monat' : 'Differenz/Monat',
                  value: summary.savingsMonthly != null ? `${summary.savingsMonthly > 0 ? '− ' : '+ '}${fmtCHF(Math.abs(summary.savingsMonthly))}` : '—',
                  sub: summary.savingsYearly != null ? `${summary.savingsMonthly > 0 ? '− ' : '+ '}${fmtCHF(Math.abs(summary.savingsYearly))} / Jahr` : '',
                  color: summary.savingsMonthly > 0.005 ? '#059669' : summary.savingsMonthly < -0.005 ? '#dc2626' : '#64748b',
                  percent: summary.savingsPercent != null ? `${Math.abs(summary.savingsPercent).toFixed(1)}%` : null,
                },
                { label: 'Empfohlene Prämie/Monat', value: fmtCHF(summary.proposedMonthly), sub: `${fmtCHF(summary.proposedYearly)} / Jahr`, color: '#334155' },
              ].map((col, i) => (
                <div key={i} style={{
                  border: '1px solid #e2e8f0', borderRadius: '8px', padding: '12px',
                  background: i === 1 && summary.savingsMonthly > 0.005 ? '#f0fdf4' : i === 1 && summary.savingsMonthly < -0.005 ? '#fef2f2' : '#f8fafc',
                  textAlign: 'center',
                }}>
                  <div style={{ fontSize: '9px', color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '4px' }}>
                    {col.label}
                  </div>
                  <div style={{ fontSize: '16px', fontWeight: 800, color: col.color }}>{col.value}</div>
                  {col.sub && <div style={{ fontSize: '9px', color: '#94a3b8', marginTop: '2px' }}>{col.sub}</div>}
                  {col.percent && (
                    <div style={{ fontSize: '11px', fontWeight: 700, color: col.color, marginTop: '2px' }}>
                      ({summary.savingsMonthly > 0 ? '−' : '+'}{col.percent})
                    </div>
                  )}
                </div>
              ))}
            </div>
          </PrintSection>
        )}

        {/* ── Kundendaten ── */}
        {customer && (
          <PrintSection title="Versicherungsnehmer">
            <PrintGrid cols={3}>
              <PrintField label="Name" value={`${customer.first_name} ${customer.last_name}`} />
              <PrintField label="Geburtsdatum" value={customer.birthdate ? new Date(customer.birthdate).toLocaleDateString('de-CH') : null} />
              <PrintField label="Zivilstand" value={CIVIL_STATUS_LABELS[customer.civil_status] || customer.civil_status} />
              <PrintField label="Adresse" value={[customer.street, `${customer.zip_code || ''} ${customer.city || ''}`.trim(), customer.canton].filter(Boolean).join(', ')} />
              <PrintField label="Telefon" value={customer.phone || customer.mobile} />
              <PrintField label="E-Mail" value={customer.email} />
              <PrintField label="AHV-Nummer" value={customer.ahv_number} />
              <PrintField label="Beruf" value={customer.profession} />
              <PrintField label="Nationalität" value={customer.nationality} />
            </PrintGrid>
          </PrintSection>
        )}

        {/* ── Familie ── */}
        {family_members?.length > 0 && (
          <PrintSection title="Haushaltsmitglieder">
            <PrintGrid cols={family_members.length > 2 ? 3 : 2}>
              {family_members.map((m, i) => (
                <div key={i} style={{ border: '1px solid #e2e8f0', borderRadius: '6px', padding: '8px', background: '#f8fafc' }}>
                  <div style={{ fontWeight: 700, fontSize: '11px', color: '#1e293b', marginBottom: '4px' }}>
                    {m.first_name} {m.last_name}
                  </div>
                  {m.birthdate && (
                    <div style={{ fontSize: '10px', color: '#64748b' }}>
                      Geb. {new Date(m.birthdate).toLocaleDateString('de-CH')}
                    </div>
                  )}
                  {m.family_role && (
                    <div style={{ fontSize: '10px', color: '#94a3b8', textTransform: 'capitalize' }}>{m.family_role}</div>
                  )}
                </div>
              ))}
            </PrintGrid>
          </PrintSection>
        )}

        {/* ── Vergleichstabellen ── */}
        {sections.map(section => {
          const sectionEntries = entries.filter(e => e.section === section);
          if (sectionEntries.length === 0) return null;
          const persons = [...new Set(sectionEntries.map(e => e.person_name || 'Unbekannt'))];

          return (
            <PrintSection key={section} title={SECTION_LABELS[section]}>
              {persons.map(person => {
                const personEntries = sectionEntries.filter(e => (e.person_name || 'Unbekannt') === person);
                const prices = personEntries.map(e => e.praemie_monatlich).filter(p => p != null);
                const lowestPraemie = prices.length > 0 ? Math.min(...prices) : null;

                return (
                  <div key={person} style={{ marginBottom: '12px' }}>
                    <div style={{ fontSize: '10px', fontWeight: 700, color: '#475569', marginBottom: '6px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <span style={{ background: '#1e3a5f', color: 'white', borderRadius: '50%', width: '16px', height: '16px', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', fontSize: '9px', fontWeight: 800 }}>
                        {person[0]?.toUpperCase()}
                      </span>
                      {person}
                    </div>

                    {/* Table */}
                    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '10px' }}>
                      <thead>
                        <tr style={{ background: '#f1f5f9' }}>
                          {['Gesellschaft / Produkt', 'Prämie/Mt.', 'Prämie/Jahr', 'Franchise', 'Modell', 'Deckung', 'Bewertung', 'Status'].map(h => (
                            <th key={h} style={{
                              padding: '5px 8px', textAlign: 'left', fontWeight: 600,
                              color: '#475569', fontSize: '9px', textTransform: 'uppercase',
                              letterSpacing: '0.04em', border: '1px solid #e2e8f0',
                            }}>{h}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {personEntries.map((e, i) => {
                          const isCheapest = e.praemie_monatlich != null && e.praemie_monatlich === lowestPraemie && !e.is_current;
                          const rowBg = e.is_recommended ? '#f0fdf4' : e.is_current ? '#f8fafc' : i % 2 === 0 ? '#ffffff' : '#fafafa';
                          const praemieColor = e.is_recommended ? '#059669' : isCheapest ? '#2563eb' : '#1e293b';
                          return (
                            <tr key={e.id} style={{ background: rowBg }}>
                              <td style={{ padding: '6px 8px', border: '1px solid #e2e8f0', fontWeight: 600, color: '#1e293b' }}>
                                {e.gesellschaft}
                                {e.product_name && <div style={{ fontSize: '9px', color: '#64748b', fontWeight: 400 }}>{e.product_name}</div>}
                              </td>
                              <td style={{ padding: '6px 8px', border: '1px solid #e2e8f0', fontWeight: 700, color: praemieColor }}>
                                {fmtCHF(e.praemie_monatlich)}
                              </td>
                              <td style={{ padding: '6px 8px', border: '1px solid #e2e8f0', color: '#475569' }}>
                                {e.praemie_monatlich != null ? fmtCHF(e.praemie_monatlich * 12) : '—'}
                              </td>
                              <td style={{ padding: '6px 8px', border: '1px solid #e2e8f0', color: '#475569' }}>
                                {e.franchise ? `CHF ${Number(e.franchise).toLocaleString('de-CH')}` : '—'}
                              </td>
                              <td style={{ padding: '6px 8px', border: '1px solid #e2e8f0', color: '#475569' }}>
                                {e.modell || '—'}
                              </td>
                              <td style={{ padding: '6px 8px', border: '1px solid #e2e8f0', color: '#475569', maxWidth: '120px' }}>
                                {e.deckung_details || '—'}
                              </td>
                              <td style={{ padding: '6px 8px', border: '1px solid #e2e8f0' }}>
                                <ScoreBar score={e.leistungs_score} />
                              </td>
                              <td style={{ padding: '6px 8px', border: '1px solid #e2e8f0' }}>
                                {e.is_recommended && (
                                  <span style={{ background: '#dcfce7', color: '#166534', fontSize: '9px', fontWeight: 700, padding: '2px 6px', borderRadius: '10px', border: '1px solid #bbf7d0' }}>
                                    ★ Empfohlen
                                  </span>
                                )}
                                {e.is_current && (
                                  <span style={{ background: '#f1f5f9', color: '#475569', fontSize: '9px', fontWeight: 600, padding: '2px 6px', borderRadius: '10px', border: '1px solid #e2e8f0' }}>
                                    Aktuell
                                  </span>
                                )}
                                {isCheapest && !e.is_current && !e.is_recommended && (
                                  <span style={{ background: '#dbeafe', color: '#1d4ed8', fontSize: '9px', fontWeight: 600, padding: '2px 6px', borderRadius: '10px', border: '1px solid #bfdbfe' }}>
                                    Günstigste
                                  </span>
                                )}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                );
              })}
            </PrintSection>
          );
        })}

        {/* ── Bestehende Verträge ── */}
        {contracts?.length > 0 && (
          <PrintSection title="Bestehende Verträge (CRM-Bestand)">
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '10px' }}>
              <thead>
                <tr style={{ background: '#f1f5f9' }}>
                  {['Gesellschaft', 'Produkt / Sparte', 'Jahresprämie', 'Beginn', 'Ablauf', 'Status'].map(h => (
                    <th key={h} style={{ padding: '5px 8px', textAlign: 'left', fontWeight: 600, color: '#475569', fontSize: '9px', textTransform: 'uppercase', letterSpacing: '0.04em', border: '1px solid #e2e8f0' }}>
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {contracts.map((c, i) => (
                  <tr key={c.id} style={{ background: i % 2 === 0 ? '#ffffff' : '#fafafa' }}>
                    <td style={{ padding: '5px 8px', border: '1px solid #e2e8f0', fontWeight: 600 }}>{c.insurer}</td>
                    <td style={{ padding: '5px 8px', border: '1px solid #e2e8f0', color: '#475569' }}>
                      {c.product || c.sparte || c.insurance_type || '—'}
                    </td>
                    <td style={{ padding: '5px 8px', border: '1px solid #e2e8f0', fontWeight: 600 }}>
                      {fmtCHF(c.premium_yearly ?? (c.premium_monthly ? c.premium_monthly * 12 : null))}
                    </td>
                    <td style={{ padding: '5px 8px', border: '1px solid #e2e8f0', color: '#64748b' }}>
                      {c.start_date ? new Date(c.start_date).toLocaleDateString('de-CH') : '—'}
                    </td>
                    <td style={{ padding: '5px 8px', border: '1px solid #e2e8f0', color: '#64748b' }}>
                      {c.renewal_date ? new Date(c.renewal_date).toLocaleDateString('de-CH') : c.end_date ? new Date(c.end_date).toLocaleDateString('de-CH') : '—'}
                    </td>
                    <td style={{ padding: '5px 8px', border: '1px solid #e2e8f0', color: c.status === 'active' ? '#059669' : '#64748b', fontWeight: 600, textTransform: 'capitalize' }}>
                      {c.status}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </PrintSection>
        )}

        {/* ── Empfehlung / Beratungsnotiz ── */}
        {dossier.recommendation_notes && (
          <PrintSection title="Beratungsnotiz / Empfehlung">
            <div style={{
              border: '1px solid #bbf7d0', background: '#f0fdf4', borderRadius: '8px',
              padding: '12px 16px', fontSize: '11px', color: '#166534', lineHeight: '1.6',
              whiteSpace: 'pre-wrap',
            }}>
              {dossier.recommendation_notes}
            </div>
          </PrintSection>
        )}

        {/* ── Footer ── */}
        <div style={{
          marginTop: '24px', paddingTop: '12px', borderTop: '1px solid #e2e8f0',
          display: 'flex', justifyContent: 'space-between', alignItems: 'center',
          fontSize: '9px', color: '#94a3b8',
        }}>
          <span>Swiss Premium Broker · Vertraulich · Nur für den persönlichen Gebrauch</span>
          <span>Dossier v{dossier.version ?? 1} · {new Date(snapshot.snapshot_created_at).toLocaleDateString('de-CH')}</span>
        </div>

      </div>
    </>
  );
}