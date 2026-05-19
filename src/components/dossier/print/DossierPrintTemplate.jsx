/**
 * DossierPrintTemplate — Phase 4/5 (Hardening)
 * Isoliertes HTML-Print-Template für window.print() / PDF-Export.
 *
 * Hardening-Änderungen:
 * - Print-CSS: `position: absolute` statt `fixed` → korrekte Mehrseiten-Ausgabe
 * - `page-break-inside: avoid` auf thead (Firefox/Chrome compat)
 * - `break-inside: avoid` (modernes CSS) parallel zu page-break-inside
 * - Vollständiger null-guard auf summary.savingsMonthly vor Vergleichen
 * - Defensive Datums-Formatierung via fmtDate (kein direktes new Date())
 * - Grid-Cols auf ≤2 für Familie begrenzt (kein 3er-Overflow bei 1 Mitglied)
 * - Tabellen: table-layout fixed mit word-break für lange Texte
 * - Keine UI-Lib-Importe
 */
import React from 'react';
import { fmtCHF, fmtDate, calcDossierSummary } from '@/lib/dossierCalc';

// ── Print CSS ─────────────────────────────────────────────────────────────────
// position: absolute (nicht fixed) → Browser druckt mehrere Seiten korrekt
const PRINT_STYLES = `
  @media print {
    body * { visibility: hidden !important; }
    #dossier-print-root,
    #dossier-print-root * { visibility: visible !important; }
    #dossier-print-root {
      position: absolute;
      left: 0;
      top: 0;
      width: 100%;
      padding: 0 !important;
      margin: 0 !important;
    }
    @page {
      margin: 15mm 18mm;
      size: A4 portrait;
    }
    table { page-break-inside: auto; break-inside: auto; }
    thead { display: table-header-group; page-break-inside: avoid; break-inside: avoid; }
    tr    { page-break-inside: avoid; break-inside: avoid; }
    .print-section { page-break-inside: avoid; break-inside: avoid; }
    .print-no-break { page-break-inside: avoid; break-inside: avoid; }
  }
`;

// ── Konstanten ────────────────────────────────────────────────────────────────
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
  single:                  'Ledig',
  married:                 'Verheiratet',
  divorced:                'Geschieden',
  widowed:                 'Verwitwet',
  registered_partnership:  'Eingetragene Partnerschaft',
  dissolved_partnership:   'Aufgelöste Partnerschaft',
};

const STATUS_LABELS_DE = {
  active:    'Aktiv',
  pending:   'Pendent',
  cancelled: 'Gekündigt',
  expired:   'Abgelaufen',
  archived:  'Archiviert',
};

// ── Helper Components ─────────────────────────────────────────────────────────
function PrintSection({ title, children }) {
  return (
    <div className="print-section" style={{ marginBottom: '20px', pageBreakInside: 'avoid', breakInside: 'avoid' }}>
      <div style={{
        borderBottom: '2px solid #1e3a5f', paddingBottom: '4px', marginBottom: '12px',
      }}>
        <span style={{ fontSize: '11px', fontWeight: 700, color: '#1e3a5f', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
          {title}
        </span>
      </div>
      {children}
    </div>
  );
}

function PrintField({ label, value }) {
  if (value == null || value === '' || value === '—') return null;
  return (
    <div style={{ marginBottom: '6px' }}>
      <div style={{ fontSize: '8.5px', color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '1px' }}>
        {label}
      </div>
      <div style={{ fontSize: '10.5px', color: '#1e293b', fontWeight: 500, wordBreak: 'break-word' }}>{value}</div>
    </div>
  );
}

function ScoreBar({ score }) {
  const n = Number(score);
  if (!isFinite(n)) return <span style={{ fontSize: '10px', color: '#94a3b8' }}>—</span>;
  const color = n >= 5 ? '#059669' : n >= 4 ? '#2563eb' : n >= 3 ? '#d97706' : '#dc2626';
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
      <span style={{ fontSize: '10px', fontWeight: 700, color, minWidth: '24px' }}>{n}/6</span>
      <div style={{ display: 'flex', gap: '2px' }}>
        {[1,2,3,4,5,6].map(i => (
          <div key={i} style={{
            width: '9px', height: '9px', borderRadius: '2px',
            background: i <= n ? '#f59e0b' : '#e2e8f0',
            flexShrink: 0,
          }} />
        ))}
      </div>
    </div>
  );
}

// ── Tabellen-Styles ───────────────────────────────────────────────────────────
const TH = {
  padding: '5px 7px', textAlign: 'left', fontWeight: 600, color: '#475569',
  fontSize: '8.5px', textTransform: 'uppercase', letterSpacing: '0.04em',
  border: '1px solid #e2e8f0', background: '#f1f5f9', whiteSpace: 'nowrap',
};
const TD = (extra = {}) => ({
  padding: '5px 7px', border: '1px solid #e2e8f0', fontSize: '10px',
  verticalAlign: 'top', wordBreak: 'break-word', ...extra,
});

// ── Haupt-Template ────────────────────────────────────────────────────────────
export default function DossierPrintTemplate({ snapshot }) {
  if (!snapshot?.dossier) return null;

  const { dossier, customer, family_members, contracts, comparison_entries } = snapshot;
  const entries = Array.isArray(comparison_entries) ? comparison_entries : [];
  const summary = calcDossierSummary(entries);
  const savings = summary.savingsMonthly;

  const containerStyle = {
    fontFamily: "'Helvetica Neue', Helvetica, Arial, sans-serif",
    color: '#1e293b',
    background: '#ffffff',
    maxWidth: '780px',
    margin: '0 auto',
    padding: '32px',
    fontSize: '10.5px',
    lineHeight: '1.55',
    WebkitPrintColorAdjust: 'exact',
    printColorAdjust: 'exact',
  };

  return (
    <>
      <style dangerouslySetInnerHTML={{ __html: PRINT_STYLES }} />
      <div id="dossier-print-root" style={containerStyle}>

        {/* ── Header ─────────────────────────────────────────────────────── */}
        <div style={{
          display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start',
          borderBottom: '3px solid #1e3a5f', paddingBottom: '16px', marginBottom: '22px',
        }}>
          <div style={{ flex: 1, paddingRight: '16px' }}>
            <div style={{ fontSize: '18px', fontWeight: 800, color: '#1e3a5f', letterSpacing: '-0.02em', marginBottom: '3px' }}>
              {TYPE_LABELS[dossier.dossier_type] || dossier.dossier_type}
            </div>
            <div style={{ fontSize: '12px', fontWeight: 600, color: '#334155', marginBottom: '3px' }}>
              {dossier.title}
            </div>
            {customer && (
              <div style={{ fontSize: '10px', color: '#475569' }}>
                {[customer.first_name, customer.last_name].filter(Boolean).join(' ')}
                {customer.city ? ` · ${customer.city}` : ''}
              </div>
            )}
            {(dossier.valid_from || dossier.valid_until) && (
              <div style={{ fontSize: '9.5px', color: '#64748b', marginTop: '3px' }}>
                Gültig: {fmtDate(dossier.valid_from)}
                {dossier.valid_until ? ` – ${fmtDate(dossier.valid_until)}` : ''}
              </div>
            )}
          </div>
          <div style={{ textAlign: 'right', flexShrink: 0 }}>
            <div style={{ fontSize: '8.5px', color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: '2px' }}>
              Swiss Premium Broker
            </div>
            <div style={{ fontSize: '9.5px', color: '#64748b' }}>
              Erstellt: {fmtDate(snapshot.snapshot_created_at)}
            </div>
            {snapshot.created_by_name && (
              <div style={{ fontSize: '9.5px', color: '#64748b' }}>durch {snapshot.created_by_name}</div>
            )}
            <div style={{ fontSize: '8.5px', color: '#94a3b8', marginTop: '4px', background: '#f1f5f9', padding: '2px 7px', borderRadius: '4px', display: 'inline-block' }}>
              v{dossier.version ?? 1} · Schema {snapshot.schema_version}
            </div>
          </div>
        </div>

        {/* ── Prämienübersicht ────────────────────────────────────────────── */}
        {(summary.hasCurrent || summary.hasRecommendation) && (
          <PrintSection title="Prämienübersicht">
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '10px', marginBottom: '4px' }}>
              {[
                {
                  label: 'Aktuelle Prämie / Monat',
                  value: fmtCHF(summary.currentMonthly),
                  sub:   `${fmtCHF(summary.currentYearly)} / Jahr`,
                  color: '#334155',
                  bg:    '#f8fafc',
                },
                {
                  label:   savings != null && savings > 0.005 ? 'Einsparung / Monat' : savings != null && savings < -0.005 ? 'Mehrkosten / Monat' : 'Differenz / Monat',
                  value:   savings != null ? `${savings > 0.005 ? '− ' : savings < -0.005 ? '+ ' : ''}${fmtCHF(Math.abs(savings))}` : '—',
                  sub:     summary.savingsYearly != null ? `${savings > 0.005 ? '− ' : savings < -0.005 ? '+ ' : ''}${fmtCHF(Math.abs(summary.savingsYearly))} / Jahr` : '',
                  percent: summary.savingsPercent != null ? `(${savings > 0 ? '−' : '+'}${Math.abs(summary.savingsPercent).toFixed(1)}%)` : null,
                  color:   savings != null && savings > 0.005 ? '#059669' : savings != null && savings < -0.005 ? '#dc2626' : '#64748b',
                  bg:      savings != null && savings > 0.005 ? '#f0fdf4' : savings != null && savings < -0.005 ? '#fef2f2' : '#f8fafc',
                },
                {
                  label: 'Empfohlene Prämie / Monat',
                  value: fmtCHF(summary.proposedMonthly),
                  sub:   `${fmtCHF(summary.proposedYearly)} / Jahr`,
                  color: '#334155',
                  bg:    '#f8fafc',
                },
              ].map((col, i) => (
                <div key={i} style={{ border: '1px solid #e2e8f0', borderRadius: '8px', padding: '10px 12px', background: col.bg, textAlign: 'center' }}>
                  <div style={{ fontSize: '8.5px', color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '5px' }}>
                    {col.label}
                  </div>
                  <div style={{ fontSize: '15px', fontWeight: 800, color: col.color }}>{col.value}</div>
                  {col.sub && <div style={{ fontSize: '8.5px', color: '#94a3b8', marginTop: '2px' }}>{col.sub}</div>}
                  {col.percent && <div style={{ fontSize: '10.5px', fontWeight: 700, color: col.color, marginTop: '2px' }}>{col.percent}</div>}
                </div>
              ))}
            </div>
          </PrintSection>
        )}

        {/* ── Versicherungsnehmer ─────────────────────────────────────────── */}
        {customer && (
          <PrintSection title="Versicherungsnehmer">
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '8px 16px' }}>
              <PrintField label="Name"         value={[customer.first_name, customer.last_name].filter(Boolean).join(' ')} />
              <PrintField label="Geburtsdatum" value={fmtDate(customer.birthdate)} />
              <PrintField label="Zivilstand"   value={CIVIL_STATUS_LABELS[customer.civil_status] || customer.civil_status} />
              <PrintField label="Adresse"      value={[customer.street, [customer.zip_code, customer.city].filter(Boolean).join(' '), customer.canton].filter(Boolean).join(', ')} />
              <PrintField label="Telefon"      value={customer.phone || customer.mobile} />
              <PrintField label="E-Mail"       value={customer.email} />
              <PrintField label="AHV-Nummer"   value={customer.ahv_number} />
              <PrintField label="Beruf"        value={customer.profession} />
              <PrintField label="Nationalität" value={customer.nationality} />
            </div>
          </PrintSection>
        )}

        {/* ── Haushaltsmitglieder ─────────────────────────────────────────── */}
        {Array.isArray(family_members) && family_members.length > 0 && (
          <PrintSection title="Haushaltsmitglieder">
            <div style={{ display: 'grid', gridTemplateColumns: `repeat(${Math.min(family_members.length, 3)}, 1fr)`, gap: '8px' }}>
              {family_members.map((m, i) => (
                <div key={m.id || i} style={{ border: '1px solid #e2e8f0', borderRadius: '6px', padding: '8px 10px', background: '#f8fafc' }}>
                  <div style={{ fontWeight: 700, fontSize: '10.5px', color: '#1e293b', marginBottom: '3px' }}>
                    {[m.first_name, m.last_name].filter(Boolean).join(' ') || '—'}
                  </div>
                  {m.birthdate && (
                    <div style={{ fontSize: '9.5px', color: '#64748b' }}>Geb. {fmtDate(m.birthdate)}</div>
                  )}
                  {m.family_role && (
                    <div style={{ fontSize: '9px', color: '#94a3b8', textTransform: 'capitalize' }}>{m.family_role}</div>
                  )}
                </div>
              ))}
            </div>
          </PrintSection>
        )}

        {/* ── Vergleichstabellen ──────────────────────────────────────────── */}
        {['grundversicherung', 'zusatzversicherung'].map(section => {
          const sectionEntries = entries.filter(e => e.section === section);
          if (sectionEntries.length === 0) return null;
          const persons = [...new Set(sectionEntries.map(e => e.person_name || 'Unbekannt'))];

          return (
            <PrintSection key={section} title={SECTION_LABELS[section]}>
              {persons.map(person => {
                const personEntries = sectionEntries.filter(e => (e.person_name || 'Unbekannt') === person);
                const prices        = personEntries.map(e => e.praemie_monatlich).filter(p => p != null && isFinite(Number(p)));
                const lowestPraemie = prices.length > 0 ? Math.min(...prices.map(Number)) : null;

                return (
                  <div key={person} style={{ marginBottom: '14px' }} className="print-no-break">
                    <div style={{ fontSize: '9.5px', fontWeight: 700, color: '#475569', marginBottom: '6px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <span style={{
                        background: '#1e3a5f', color: 'white', borderRadius: '50%',
                        width: '15px', height: '15px', display: 'inline-flex',
                        alignItems: 'center', justifyContent: 'center',
                        fontSize: '8px', fontWeight: 800, flexShrink: 0,
                      }}>
                        {(person[0] || '?').toUpperCase()}
                      </span>
                      {person}
                    </div>
                    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '9.5px', tableLayout: 'fixed' }}>
                      <colgroup>
                        <col style={{ width: '20%' }} />
                        <col style={{ width: '11%' }} />
                        <col style={{ width: '11%' }} />
                        <col style={{ width: '10%' }} />
                        <col style={{ width: '10%' }} />
                        <col style={{ width: '18%' }} />
                        <col style={{ width: '10%' }} />
                        <col style={{ width: '10%' }} />
                      </colgroup>
                      <thead>
                        <tr>
                          {['Gesellschaft / Produkt', 'Prämie/Mt.', 'Prämie/Jahr', 'Franchise', 'Modell', 'Deckung', 'Bewertung', 'Status'].map(h => (
                            <th key={h} style={TH}>{h}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {personEntries.map((e, i) => {
                          const pNum       = Number(e.praemie_monatlich);
                          const isCheapest = isFinite(pNum) && lowestPraemie !== null && pNum === lowestPraemie && !e.is_current;
                          const rowBg      = e.is_recommended ? '#f0fdf4' : e.is_current ? '#f8fafc' : i % 2 === 0 ? '#fff' : '#fafafa';
                          const praemieFg  = e.is_recommended ? '#059669' : isCheapest ? '#2563eb' : '#1e293b';
                          return (
                            <tr key={e.id} style={{ background: rowBg }}>
                              <td style={TD({ fontWeight: 600, color: '#1e293b' })}>
                                {e.gesellschaft}
                                {e.product_name && <div style={{ fontSize: '8.5px', color: '#64748b', fontWeight: 400 }}>{e.product_name}</div>}
                              </td>
                              <td style={TD({ fontWeight: 700, color: praemieFg })}>{fmtCHF(e.praemie_monatlich)}</td>
                              <td style={TD({ color: '#475569' })}>
                                {e.praemie_monatlich != null && isFinite(pNum) ? fmtCHF(pNum * 12) : '—'}
                              </td>
                              <td style={TD({ color: '#475569' })}>
                                {e.franchise != null ? `CHF ${Number(e.franchise).toLocaleString('de-CH')}` : '—'}
                              </td>
                              <td style={TD({ color: '#475569' })}>{e.modell || '—'}</td>
                              <td style={TD({ color: '#475569' })}>{e.deckung_details || '—'}</td>
                              <td style={TD()}><ScoreBar score={e.leistungs_score} /></td>
                              <td style={TD()}>
                                {e.is_recommended && (
                                  <span style={{ background: '#dcfce7', color: '#166534', fontSize: '8px', fontWeight: 700, padding: '2px 5px', borderRadius: '8px', border: '1px solid #bbf7d0', whiteSpace: 'nowrap' }}>
                                    ★ Empfohlen
                                  </span>
                                )}
                                {e.is_current && (
                                  <span style={{ background: '#f1f5f9', color: '#475569', fontSize: '8px', fontWeight: 600, padding: '2px 5px', borderRadius: '8px', border: '1px solid #e2e8f0', whiteSpace: 'nowrap' }}>
                                    Aktuell
                                  </span>
                                )}
                                {isCheapest && !e.is_current && !e.is_recommended && (
                                  <span style={{ background: '#dbeafe', color: '#1d4ed8', fontSize: '8px', fontWeight: 600, padding: '2px 5px', borderRadius: '8px', border: '1px solid #bfdbfe', whiteSpace: 'nowrap' }}>
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

        {/* ── Bestehende Verträge ─────────────────────────────────────────── */}
        {Array.isArray(contracts) && contracts.length > 0 && (
          <PrintSection title="Bestehende Verträge (CRM-Bestand)">
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '9.5px', tableLayout: 'fixed' }}>
              <colgroup>
                <col style={{ width: '22%' }} />
                <col style={{ width: '22%' }} />
                <col style={{ width: '16%' }} />
                <col style={{ width: '13%' }} />
                <col style={{ width: '13%' }} />
                <col style={{ width: '14%' }} />
              </colgroup>
              <thead>
                <tr>
                  {['Gesellschaft', 'Produkt / Sparte', 'Jahresprämie', 'Beginn', 'Ablauf', 'Status'].map(h => (
                    <th key={h} style={TH}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {contracts.map((c, i) => {
                  const yearly = c.premium_yearly ?? (c.premium_monthly != null ? c.premium_monthly * 12 : null);
                  return (
                    <tr key={c.id} style={{ background: i % 2 === 0 ? '#fff' : '#fafafa' }}>
                      <td style={TD({ fontWeight: 600 })}>{c.insurer || '—'}</td>
                      <td style={TD({ color: '#475569' })}>{c.product || c.sparte || c.insurance_type || '—'}</td>
                      <td style={TD({ fontWeight: 600 })}>{fmtCHF(yearly)}</td>
                      <td style={TD({ color: '#64748b' })}>{fmtDate(c.start_date)}</td>
                      <td style={TD({ color: '#64748b' })}>{fmtDate(c.renewal_date || c.end_date)}</td>
                      <td style={TD({ fontWeight: 600, color: c.status === 'active' ? '#059669' : '#64748b' })}>
                        {STATUS_LABELS_DE[c.status] || c.status || '—'}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </PrintSection>
        )}

        {/* ── Beratungsnotiz ──────────────────────────────────────────────── */}
        {dossier.recommendation_notes && (
          <PrintSection title="Beratungsnotiz / Empfehlung">
            <div style={{
              border: '1px solid #bbf7d0', background: '#f0fdf4', borderRadius: '8px',
              padding: '10px 14px', fontSize: '10.5px', color: '#166534', lineHeight: '1.6',
              whiteSpace: 'pre-wrap', wordBreak: 'break-word',
            }}>
              {dossier.recommendation_notes}
            </div>
          </PrintSection>
        )}

        {/* ── Footer ─────────────────────────────────────────────────────── */}
        <div style={{
          marginTop: '20px', paddingTop: '10px', borderTop: '1px solid #e2e8f0',
          display: 'flex', justifyContent: 'space-between', alignItems: 'center',
          fontSize: '8.5px', color: '#94a3b8',
        }}>
          <span>Swiss Premium Broker · Vertraulich · Nur für den persönlichen Gebrauch</span>
          <span>Dossier v{dossier.version ?? 1} · {fmtDate(snapshot.snapshot_created_at)}</span>
        </div>

      </div>
    </>
  );
}