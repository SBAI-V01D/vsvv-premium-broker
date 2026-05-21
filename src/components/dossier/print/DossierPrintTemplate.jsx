/**
 * DossierPrintTemplate — Lösungsorientiert / A4 Querformat
 *
 * Seitenstruktur:
 *   Seite 1 (A4 Quer): Deckblatt + Aktuelle Lösung + Optimierte Lösung (nebeneinander)
 *   Seite 2+:          Je 2 Angebote nebeneinander (Angebot 1+2, Angebot 3+4, …)
 *
 * Lösungsorientierung: Jede Gruppe = eigenständiges Beratungsangebot.
 * Keine CRM-Entities, nur ComparisonEntry.
 */
import React, { useMemo, useState, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { fmtCHF, fmtDate, calcDossierSummary } from '@/lib/dossierCalc';
import DossierLegende from '@/components/dossier/print/DossierLegende';
import DossierDocumentHeader from '@/components/dossier/print/DossierDocumentHeader';

// ── Gruppen-Konfiguration (Farben) ────────────────────────────────────────────
const GRUPPE_CFG = {
  aktuelle_loesung: { label: 'Aktuelle Lösung',    headerBg: '#475569', accentColor: '#475569' },
  optimiert:        { label: 'Optimierte Lösung',  headerBg: '#1d4ed8', accentColor: '#1d4ed8' },
  angebot_1:        { label: 'Angebot 1',          headerBg: '#1d4ed8', accentColor: '#1d4ed8' },
  angebot_2:        { label: 'Angebot 2',          headerBg: '#6d28d9', accentColor: '#6d28d9' },
  angebot_3:        { label: 'Angebot 3',          headerBg: '#b45309', accentColor: '#b45309' },
  angebot_4:        { label: 'Angebot 4',          headerBg: '#be123c', accentColor: '#be123c' },
  angebot_5:        { label: 'Angebot 5',          headerBg: '#0f766e', accentColor: '#0f766e' },
  manuell:          { label: 'Weitere Einträge',   headerBg: '#64748b', accentColor: '#64748b' },
};
const GRUPPE_ORDER = ['aktuelle_loesung', 'optimiert', 'angebot_1', 'angebot_2', 'angebot_3', 'angebot_4', 'angebot_5', 'manuell'];

// ── Hilfsfunktion: Titel aus Gesellschaften generieren (KVG zuerst, dann VVG) ──
function generateTitelFromGesellschaften(entries) {
  if (!entries || entries.length === 0) return '';
  
  // KVG-Einträge zuerst, dann VVG (Reihenfolge aus entries bewahren)
  const kvgGesellschaften = entries
    .filter(e => e.section === 'grundversicherung' && e.gesellschaft)
    .map(e => e.gesellschaft);
  
  const vvgGesellschaften = entries
    .filter(e => e.section === 'zusatzversicherung' && e.gesellschaft)
    .map(e => e.gesellschaft);
  
  // Kombiniere KVG + VVG, entferne Duplikate aber behalte Reihenfolge
  const alleGesellschaften = [];
  const gesehen = new Set();
  
  [...kvgGesellschaften, ...vvgGesellschaften].forEach(g => {
    if (!gesehen.has(g)) {
      gesehen.add(g);
      alleGesellschaften.push(g);
    }
  });
  
  if (alleGesellschaften.length === 0) return '';
  if (alleGesellschaften.length <= 3) return alleGesellschaften.join(' / ');
  // Bei mehr als 3: erste 2 + "u.a."
  return `${alleGesellschaften[0]} / ${alleGesellschaften[1]} u.a.`;
}

// ── Print CSS — A4 Querformat ─────────────────────────────────────────────────
const PRINT_STYLES = `
  /* ── Screen: Seiten als einzelne Blöcke mit Trenner ── */
  .print-page {
    margin-bottom: 32px;
    border-bottom: 2px dashed #e2e8f0;
    padding-bottom: 24px;
  }
  .print-page:last-child {
    border-bottom: none;
    margin-bottom: 0;
  }

  @media print {
    @page {
      size: A4 landscape;
      margin: 10mm 14mm;
    }
    .print-page {
      page-break-after: always !important;
      break-after: page !important;
      margin-bottom: 0 !important;
      border-bottom: none !important;
      padding-bottom: 0 !important;
    }
    .print-page:last-child {
      page-break-after: avoid !important;
      break-after: avoid !important;
    }
    .print-no-break { page-break-inside: avoid; break-inside: avoid; }
  }
`;

const CIVIL_LABELS = {
  single: 'Ledig', married: 'Verheiratet', divorced: 'Geschieden',
  widowed: 'Verwitwet', registered_partnership: 'Eingetr. Partnerschaft',
};
const TYPE_LABELS = {
  kk_vergleich: 'Krankenversicherungsvergleich', vorsorge: 'Vorsorgedossier',
  sachversicherung: 'Sachversicherungsdossier', gesamtdossier: 'Gesamtdossier',
};

// ── Gemeinsamer Seiten-Header (Enterprise-Stil, minimalistisch) ────────────────
function PageHeader({ dossier, customer, pageLabel, snapshot, organization, advisor }) {
  return (
    <div style={{
      display: 'flex',
      justifyContent: 'space-between',
      alignItems: 'flex-end',
      borderBottom: '2px solid #0f172a',
      paddingBottom: '10px',
      marginBottom: '16px',
    }}>
      <div>
        <div style={{ fontSize: '13px', fontWeight: 800, color: '#0f172a', letterSpacing: '-0.02em', marginBottom: '2px' }}>
          {dossier.title || TYPE_LABELS[dossier.dossier_type] || dossier.dossier_type}
        </div>
        <div style={{ fontSize: '8.5px', color: '#64748b' }}>{pageLabel}</div>
      </div>
      <div style={{ textAlign: 'right' }}>
        {organization?.name && (
          <div style={{ fontSize: '9px', fontWeight: 600, color: '#334155', marginBottom: '1px' }}>{organization.name}</div>
        )}
        <div style={{ fontSize: '8px', color: '#94a3b8' }}>
          {fmtDate(snapshot?.snapshot_created_at)} · Version {dossier.version ?? 1}
        </div>
      </div>
    </div>
  );
}

// ── Lösungs-Säule: eine Gruppe als Beratungsangebot ──────────────────────────
function LösungsSäule({ gruppe, label, entries, referenceTotal, titel }) {
  const cfg = GRUPPE_CFG[gruppe] || GRUPPE_CFG.manuell;
  const persons = [...new Set(entries.map(e => e.person_name || 'Unbekannt'))];
  const gruppeTotal = entries.reduce((s, e) => s + (Number(e.praemie_monatlich) || 0), 0);
  const isRef = gruppe === 'aktuelle_loesung';
  const titelToUse = titel || generateTitelFromGesellschaften(entries);

  const diff = referenceTotal && referenceTotal > 0 ? referenceTotal - gruppeTotal : null;
  const diffPct = diff !== null ? ((diff / referenceTotal) * 100).toFixed(1) : null;

  return (
    <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column' }}>
      {/* ── Spalten-Header: saubere Accent-Linie oben, kein dunkler Block ── */}
      <div style={{
        borderTop: `3px solid ${cfg.accentColor}`,
        border: `1px solid #e2e8f0`,
        borderTopColor: cfg.accentColor,
        borderRadius: '8px 8px 0 0',
        padding: '12px 14px',
        background: isRef ? '#f8fafc' : '#ffffff',
        WebkitPrintColorAdjust: 'exact', printColorAdjust: 'exact',
      }}>
        {/* Label */}
        <div style={{ fontSize: '7px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.12em', color: cfg.accentColor, marginBottom: '4px' }}>
          {label}
        </div>
        {/* Titel (alle Gesellschaften) */}
        <div style={{ fontSize: '11px', fontWeight: 700, color: '#0f172a', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', marginBottom: '10px' }}>
          {titelToUse || <span style={{ opacity: 0.35, fontStyle: 'italic', fontWeight: 400 }}>Keine Gesellschaft</span>}
        </div>
        {/* Prämie + Differenz */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end' }}>
          <div>
            <div style={{ fontSize: '20px', fontWeight: 900, color: cfg.accentColor, letterSpacing: '-0.02em', lineHeight: 1 }}>
              {gruppeTotal > 0 ? fmtCHF(gruppeTotal) : '—'}
            </div>
            <div style={{ fontSize: '7.5px', color: '#94a3b8', marginTop: '2px' }}>
              pro Monat{gruppeTotal > 0 ? ` · ${fmtCHF(gruppeTotal * 12)}/Jahr` : ''}
            </div>
          </div>
          {!isRef && diff !== null && gruppeTotal > 0 && (
            <div style={{
              background: diff > 0.01 ? '#f0fdf4' : diff < -0.01 ? '#fef2f2' : '#f8fafc',
              border: `1px solid ${diff > 0.01 ? '#bbf7d0' : diff < -0.01 ? '#fecaca' : '#e2e8f0'}`,
              borderRadius: '6px', padding: '4px 8px', textAlign: 'right',
              WebkitPrintColorAdjust: 'exact', printColorAdjust: 'exact',
            }}>
              <div style={{ fontSize: '10px', fontWeight: 800, color: diff > 0.01 ? '#059669' : diff < -0.01 ? '#dc2626' : '#64748b' }}>
                {diff > 0.01 ? `−${fmtCHF(diff)}/Mt.` : diff < -0.01 ? `+${fmtCHF(Math.abs(diff))}/Mt.` : '= gleich'}
              </div>
              {diffPct && Math.abs(diff) > 0.01 && (
                <div style={{ fontSize: '7.5px', color: '#94a3b8' }}>
                  {diff > 0 ? `${diffPct}% günstiger` : `${diffPct}% teurer`}
                </div>
              )}
            </div>
          )}
          {isRef && (
            <div style={{ background: '#f1f5f9', border: '1px solid #e2e8f0', borderRadius: '6px', padding: '4px 8px' }}>
              <div style={{ fontSize: '8px', fontWeight: 700, color: '#64748b' }}>Referenz</div>
            </div>
          )}
        </div>
      </div>

      {/* ── Spalten-Body: Personen-Blöcke ── */}
      <div style={{
        border: '1px solid #e2e8f0', borderTop: 'none', borderRadius: '0 0 8px 8px',
        flex: 1, padding: '10px 12px',
        WebkitPrintColorAdjust: 'exact', printColorAdjust: 'exact',
      }}>
        {persons.map(person => {
          const pEntries = entries.filter(e => (e.person_name || 'Unbekannt') === person);
          const kvg = pEntries.filter(e => e.section === 'grundversicherung');
          const vvgAll = pEntries.filter(e => e.section === 'zusatzversicherung');
          const kvgGesellschaft = kvg[0]?.gesellschaft || null;
          const vvg = [
            ...vvgAll.filter(e => e.gesellschaft === kvgGesellschaft),
            ...vvgAll.filter(e => e.gesellschaft !== kvgGesellschaft),
          ];
          const personTotal = pEntries.reduce((s, e) => s + (Number(e.praemie_monatlich) || 0), 0);

          return (
            <div key={person} style={{ marginBottom: '10px' }} className="print-no-break">
              {/* Person-Header */}
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '6px' }}>
                <div style={{
                  width: '16px', height: '16px', borderRadius: '50%',
                  background: cfg.accentColor, color: 'white',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: '8px', fontWeight: 800, flexShrink: 0,
                  WebkitPrintColorAdjust: 'exact', printColorAdjust: 'exact',
                }}>
                  {(person[0] || '?').toUpperCase()}
                </div>
                <span style={{ fontSize: '10px', fontWeight: 700, color: '#1e293b' }}>{person}</span>
              </div>

              {/* KVG */}
              {kvg.length > 0 && (
                <div style={{ marginBottom: '6px' }}>
                  <div style={{
                    fontSize: '7px', fontWeight: 700, color: '#1d4ed8',
                    textTransform: 'uppercase', letterSpacing: '0.08em',
                    borderBottom: '1px solid #dbeafe',
                    paddingBottom: '2px', marginBottom: '4px',
                    WebkitPrintColorAdjust: 'exact', printColorAdjust: 'exact',
                  }}>KVG — Grundversicherung</div>
                  {kvg.map(e => <ProductRow key={e.id} entry={e} accentColor={cfg.accentColor} />)}
                </div>
              )}

              {/* VVG */}
              {vvg.length > 0 && (
                <div style={{ marginBottom: '6px' }}>
                  <div style={{
                    fontSize: '7px', fontWeight: 700, color: '#6d28d9',
                    textTransform: 'uppercase', letterSpacing: '0.08em',
                    borderBottom: '1px solid #ede9fe',
                    paddingBottom: '2px', marginBottom: '4px',
                    WebkitPrintColorAdjust: 'exact', printColorAdjust: 'exact',
                  }}>VVG — Zusatzversicherungen</div>
                  {vvg.map(e => <ProductRow key={e.id} entry={e} accentColor={cfg.accentColor} />)}
                </div>
              )}

              {/* Personen-Total */}
              {personTotal > 0 && (
                <div style={{
                  display: 'flex', justifyContent: 'space-between',
                  borderTop: '1px solid #e2e8f0', paddingTop: '4px', marginTop: '4px',
                }}>
                  <span style={{ fontSize: '8.5px', color: '#64748b' }}>Total {person.split(' ')[0]}</span>
                  <span style={{ fontSize: '9px', fontWeight: 800, color: '#1e293b' }}>{fmtCHF(personTotal)}/Mt.</span>
                </div>
              )}
            </div>
          );
        })}

        {entries.length === 0 && (
          <div style={{ fontSize: '9.5px', color: '#94a3b8', fontStyle: 'italic', textAlign: 'center', padding: '20px 0' }}>
            Keine Einträge
          </div>
        )}
      </div>
    </div>
  );
}

// ── Einzel-Produkt-Zeile ──────────────────────────────────────────────────────
function ProductRow({ entry, accentColor }) {
  return (
    <div style={{
      display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start',
      padding: '3px 0', borderBottom: '1px solid #f1f5f9',
    }}>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: '9.5px', fontWeight: 600, color: '#1e293b' }}>
          {entry.gesellschaft}
          {entry.product_name && (
            <span style={{ fontWeight: 400, color: '#64748b', marginLeft: '4px' }}>{entry.product_name}</span>
          )}
        </div>
        {(entry.modell || entry.franchise != null || entry.deckung_details) && (
          <div style={{ fontSize: '8px', color: '#94a3b8', marginTop: '1px' }}>
            {[
              entry.modell,
              entry.franchise != null && entry.section === 'grundversicherung' ? `Fr. CHF ${Number(entry.franchise).toLocaleString('de-CH')}` : null,
              entry.deckung_details,
            ].filter(Boolean).join(' · ')}
          </div>
        )}
      </div>
      {entry.praemie_monatlich != null && (
        <div style={{ fontSize: '9.5px', fontWeight: 700, color: accentColor, whiteSpace: 'nowrap', marginLeft: '8px' }}>
          {fmtCHF(entry.praemie_monatlich)}
        </div>
      )}
    </div>
  );
}

// ── Seiten-Layout: 2 Lösungen nebeneinander (A4 Quer) ────────────────────────
function VergleichsSeite({ dossier, customer, snapshot, gruppe1, gruppe2, entries, referenceTotal, pageLabel, organization, advisor }) {
  const g1entries = entries.filter(e => (e.gruppe || 'manuell') === gruppe1);
  const g2entries = gruppe2 ? entries.filter(e => (e.gruppe || 'manuell') === gruppe2) : [];
  const cfg1 = GRUPPE_CFG[gruppe1] || GRUPPE_CFG.manuell;
  const cfg2 = gruppe2 ? (GRUPPE_CFG[gruppe2] || GRUPPE_CFG.manuell) : null;
  const label1 = g1entries[0]?.gruppe_label || cfg1.label;
  const label2 = cfg2 ? (g2entries[0]?.gruppe_label || cfg2.label) : null;

  // Dynamische Titel für beide Lösungen
  const titel1 = generateTitelFromGesellschaften(g1entries);
  const titel2 = gruppe2 ? generateTitelFromGesellschaften(g2entries) : null;

  return (
    <div className="print-page" style={{ padding: '0' }}>
      {/* Seiten-spezifischer Header (Enterprise-Stil) */}
      <PageHeader 
        dossier={dossier}
        customer={customer}
        pageLabel={pageLabel}
        snapshot={snapshot}
        organization={organization}
        advisor={advisor}
      />

      <div style={{ display: 'flex', gap: '14px', alignItems: 'stretch' }}>
        <LösungsSäule
          gruppe={gruppe1}
          label={label1}
          entries={g1entries}
          referenceTotal={referenceTotal}
          titel={titel1}
        />
        {gruppe2 && (
          <LösungsSäule
            gruppe={gruppe2}
            label={label2}
            entries={g2entries}
            referenceTotal={referenceTotal}
            titel={titel2}
          />
        )}
        {!gruppe2 && <div style={{ flex: 1 }} />}
      </div>
    </div>
  );
}

// ── Enterprise Header Komponente — horizontal, minimal, premium ─────────────────
function EnterpriseHeader({ organization, advisor, dossier, snapshot }) {
  const hasFinma = organization?.finma_number || advisor?.finma_number;
  const hasVbv = advisor?.vbv_number;
  return (
    <div style={{
      borderBottom: '2.5px solid #0f172a',
      paddingBottom: '14px',
      marginBottom: '22px',
      WebkitPrintColorAdjust: 'exact', printColorAdjust: 'exact',
    }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '24px' }}>
        {/* LEFT: Organisation */}
        <div style={{ flex: 1 }}>
          {organization?.name && (
            <div style={{ fontSize: '17px', fontWeight: 800, color: '#0f172a', letterSpacing: '-0.03em', lineHeight: 1.1, marginBottom: '7px' }}>
              {organization.name}
            </div>
          )}
          <div style={{ display: 'flex', flexWrap: 'wrap', columnGap: '14px', rowGap: '2px' }}>
            {organization?.street && (
              <div style={{ fontSize: '8.5px', color: '#64748b' }}>
                {organization.street}{organization.zip_code ? `, ${organization.zip_code}` : ''}{organization.city ? ` ${organization.city}` : ''}
              </div>
            )}
            {organization?.phone && (
              <div style={{ fontSize: '8.5px', color: '#64748b' }}>Tel {organization.phone}</div>
            )}
            {organization?.email && (
              <div style={{ fontSize: '8.5px', color: '#64748b' }}>{organization.email}</div>
            )}
            {organization?.website && (
              <div style={{ fontSize: '8.5px', color: '#94a3b8' }}>{organization.website}</div>
            )}
          </div>
        </div>

        {/* DIVIDER */}
        <div style={{ width: '1px', background: '#e2e8f0', alignSelf: 'stretch', flexShrink: 0 }} />

        {/* RIGHT: Berater */}
        {advisor && (
          <div style={{ minWidth: '180px', textAlign: 'right' }}>
            <div style={{ fontSize: '8px', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.1em', color: '#94a3b8', marginBottom: '5px' }}>
              Ihr persönlicher Berater
            </div>
            <div style={{ fontSize: '14px', fontWeight: 700, color: '#0f172a', letterSpacing: '-0.01em', marginBottom: '5px' }}>
              {advisor.firstname} {advisor.lastname}
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '2px', alignItems: 'flex-end' }}>
              {advisor.phone && <div style={{ fontSize: '8.5px', color: '#64748b' }}>Tel {advisor.phone}</div>}
              {advisor.email && <div style={{ fontSize: '8.5px', color: '#64748b' }}>{advisor.email}</div>}
            </div>
          </div>
        )}
      </div>

      {/* FINMA / VBV — regulatorische Zeile */}
      {(hasFinma || hasVbv) && (
        <div style={{ marginTop: '9px', paddingTop: '7px', borderTop: '1px solid #f1f5f9', display: 'flex', gap: '20px' }}>
          {hasFinma && (
            <div style={{ fontSize: '7.5px', color: '#94a3b8' }}>
              <span style={{ fontWeight: 700, color: '#475569' }}>FINMA-Reg.-Nr.</span> {organization?.finma_number || advisor?.finma_number}
            </div>
          )}
          {hasVbv && (
            <div style={{ fontSize: '7.5px', color: '#94a3b8' }}>
              <span style={{ fontWeight: 700, color: '#475569' }}>VBV-Mitglied</span> {advisor.vbv_number}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ── Seite 1: Deckblatt — Personen oben, Prämienübersicht unten ────────────────
function DeckblattSeite({ dossier, customer, family_members, snapshot, summary, savings, entries, organization, advisor }) {
  const hasFamilyMembers = Array.isArray(family_members) && family_members.length > 0;

  // Referenz für Vergleich = Optimierte Lösung (nicht Aktuelle, da mehr Leistungen)
  const referenceTotal = summary.proposedMonthly || summary.currentMonthly;
  const referenceLabel = summary.proposedMonthly ? 'optimierte Lösung' : 'aktuelle Lösung';

  // Prämien für ALLE Angebote berechnen (Vergleich gegen Optimierte Lösung)
  const angebotPrämien = useMemo(() => {
    const result = [];
    ['angebot_1', 'angebot_2', 'angebot_3', 'angebot_4', 'angebot_5'].forEach(gruppe => {
      const gruppeEntries = (entries || []).filter(e => e.gruppe === gruppe);
      if (gruppeEntries.length > 0) {
        const total = gruppeEntries.reduce((s, e) => s + (Number(e.praemie_monatlich) || 0), 0);
        // Vergleich gegen Optimierte Lösung
        const diff = referenceTotal - total;
        const pct = referenceTotal > 0 ? ((diff / referenceTotal) * 100) : 0;
        result.push({
          gruppe,
          label: GRUPPE_CFG[gruppe]?.label || gruppe,
          monthly: total,
          yearly: total * 12,
          diff,
          pct,
        });
      }
    });
    return result;
  }, [entries, referenceTotal]);

  return (
    <div>
      {/* Enterprise Header */}
      <EnterpriseHeader 
        organization={organization}
        advisor={advisor}
        dossier={dossier}
        snapshot={snapshot}
      />

      {/* Dokumententitel */}
      <div style={{ marginBottom: '18px' }}>
        <div style={{ fontSize: '22px', fontWeight: 800, color: '#0f172a', letterSpacing: '-0.03em', lineHeight: 1.1, marginBottom: '4px' }}>
          {dossier.title || TYPE_LABELS[dossier.dossier_type] || dossier.dossier_type}
        </div>
        <div style={{ fontSize: '9px', color: '#94a3b8' }}>
          Erstellt am {fmtDate(snapshot?.snapshot_created_at)} · Version {dossier.version ?? 1}
        </div>
      </div>

      {/* ── 1. Versicherungsnehmer + Familienmitglieder ── */}
      <div style={{ display: 'grid', gridTemplateColumns: hasFamilyMembers ? '1fr 1fr' : '1fr', gap: '20px', marginBottom: '20px' }}>
        {/* Versicherungsnehmer */}
        {customer && (
          <div style={{
            borderTop: '2px solid #1d4ed8',
            paddingTop: '10px',
            WebkitPrintColorAdjust: 'exact', printColorAdjust: 'exact',
          }}>
            <div style={{ fontSize: '8px', fontWeight: 700, color: '#1d4ed8', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: '10px' }}>
              Versicherungsnehmer
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '6px 20px', fontSize: '9.5px' }}>
              {[
                ['Name', [customer.first_name, customer.last_name].filter(Boolean).join(' ')],
                ['Geburtsdatum', fmtDate(customer.birthdate)],
                ['Zivilstand', CIVIL_LABELS[customer.civil_status] || customer.civil_status],
                ['Adresse', [customer.street, [customer.zip_code, customer.city].filter(Boolean).join(' ')].filter(Boolean).join(', ')],
                ['Telefon', customer.phone || customer.mobile],
                ['E-Mail', customer.email],
              ].filter(([, v]) => v).map(([l, v]) => (
                <div key={l}>
                  <div style={{ fontSize: '7px', color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '1px' }}>{l}</div>
                  <div style={{ fontWeight: 500, color: '#1e293b', wordBreak: 'break-word' }}>{v}</div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Haushaltsmitglieder */}
        {hasFamilyMembers && (
          <div style={{
            borderTop: '2px solid #6d28d9',
            paddingTop: '10px',
            WebkitPrintColorAdjust: 'exact', printColorAdjust: 'exact',
          }}>
            <div style={{ fontSize: '8px', fontWeight: 700, color: '#6d28d9', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: '10px' }}>
              Haushaltsmitglieder
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: `repeat(${Math.min(family_members.length, 3)}, 1fr)`, gap: '10px' }}>
              {family_members.map((m, i) => (
                <div key={m.id || i} style={{ borderLeft: '2px solid #ede9fe', paddingLeft: '8px', fontSize: '9px' }}>
                  <div style={{ fontWeight: 700, color: '#1e293b', marginBottom: '2px' }}>
                    {[m.first_name, m.last_name].filter(Boolean).join(' ') || '—'}
                  </div>
                  {m.birthdate && <div style={{ color: '#64748b' }}>Geb. {fmtDate(m.birthdate)}</div>}
                  {m.family_role && <div style={{ color: '#94a3b8', fontSize: '8px', marginTop: '1px', textTransform: 'capitalize' }}>{m.family_role}</div>}
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* ── 2. Prämienübersicht ── */}
      {(summary.hasCurrent || summary.hasRecommendation || angebotPrämien.length > 0) && (
        <div style={{ WebkitPrintColorAdjust: 'exact', printColorAdjust: 'exact' }}>
          <div style={{ fontSize: '8px', fontWeight: 700, color: '#475569', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: '12px', borderBottom: '1px solid #e2e8f0', paddingBottom: '6px' }}>
            Prämienübersicht — Alle Lösungen im Vergleich
          </div>

          {/* Zeile 1: Aktuelle Lösung + Einsparung + Optimiert */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '20px', marginBottom: '18px' }}>
            <div style={{ textAlign: 'center', borderTop: '2px solid #64748b', paddingTop: '10px' }}>
              <div style={{ fontSize: '7.5px', color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '6px' }}>Aktuelle Prämie / Monat</div>
              <div style={{ fontSize: '22px', fontWeight: 900, color: '#334155', letterSpacing: '-0.03em', lineHeight: 1 }}>{fmtCHF(summary.currentMonthly)}</div>
              <div style={{ fontSize: '8px', color: '#94a3b8', marginTop: '3px' }}>{fmtCHF(summary.currentYearly)} / Jahr</div>
            </div>

            <div style={{ textAlign: 'center', borderTop: `2px solid ${summary.savingsMonthly > 0.005 ? '#059669' : summary.savingsMonthly < -0.005 ? '#dc2626' : '#94a3b8'}`, paddingTop: '10px' }}>
              <div style={{ fontSize: '7.5px', color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '6px' }}>
                {summary.savingsMonthly > 0.005 ? 'Einsparung / Monat' : summary.savingsMonthly < -0.005 ? 'Mehrkosten / Monat' : 'Differenz'}
              </div>
              <div style={{ fontSize: '22px', fontWeight: 900, letterSpacing: '-0.03em', lineHeight: 1, color: summary.savingsMonthly > 0.005 ? '#059669' : summary.savingsMonthly < -0.005 ? '#dc2626' : '#64748b' }}>
                {summary.savingsMonthly != null ? `${summary.savingsMonthly > 0.005 ? '− ' : summary.savingsMonthly < -0.005 ? '+ ' : ''}${fmtCHF(Math.abs(summary.savingsMonthly))}` : '—'}
              </div>
              {summary.savingsYearly != null && (
                <div style={{ fontSize: '8px', color: '#94a3b8', marginTop: '3px' }}>
                  {summary.savingsMonthly > 0 ? '− ' : '+ '}{fmtCHF(Math.abs(summary.savingsYearly))} / Jahr
                </div>
              )}
              {summary.savingsPercent != null && (
                <div style={{ fontSize: '13px', fontWeight: 800, marginTop: '4px', color: summary.savingsMonthly > 0.005 ? '#059669' : summary.savingsMonthly < -0.005 ? '#dc2626' : '#64748b' }}>
                  {summary.savingsMonthly > 0 ? '−' : '+'}{Math.abs(summary.savingsPercent).toFixed(1)}%
                </div>
              )}
            </div>

            <div style={{ textAlign: 'center', borderTop: '2px solid #1d4ed8', paddingTop: '10px' }}>
              <div style={{ fontSize: '7.5px', color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '6px' }}>
                {summary.proposedGruppe ? `${GRUPPE_CFG[summary.proposedGruppe]?.label || summary.proposedGruppe} / Monat` : 'Optimierte Prämie / Monat'}
              </div>
              <div style={{ fontSize: '22px', fontWeight: 900, color: '#1d4ed8', letterSpacing: '-0.03em', lineHeight: 1 }}>{fmtCHF(summary.proposedMonthly)}</div>
              <div style={{ fontSize: '8px', color: '#94a3b8', marginTop: '3px' }}>{fmtCHF(summary.proposedYearly)} / Jahr</div>
            </div>
          </div>

          {/* Angebote */}
          {angebotPrämien.length > 0 && (
            <div>
              <div style={{ fontSize: '7.5px', color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '10px' }}>
                Angebote im Vergleich zur {referenceLabel}
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: `repeat(${Math.min(angebotPrämien.length, 4)}, 1fr)`, gap: '16px' }}>
                {angebotPrämien.map((angebot) => {
                  const istAngebot1 = angebot.gruppe === 'angebot_1';
                  const farbe = istAngebot1 ? '#1d4ed8' : (angebot.diff > 0 ? '#059669' : angebot.diff < 0 ? '#dc2626' : '#64748b');
                  return (
                    <div key={angebot.gruppe} style={{
                      borderTop: `2px solid ${farbe}`,
                      paddingTop: '8px',
                      textAlign: 'center',
                      WebkitPrintColorAdjust: 'exact', printColorAdjust: 'exact',
                    }}>
                      <div style={{ fontSize: '7px', color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '5px' }}>{angebot.label}</div>
                      <div style={{ fontSize: '17px', fontWeight: 900, color: farbe, letterSpacing: '-0.02em', lineHeight: 1 }}>{fmtCHF(angebot.monthly)}</div>
                      <div style={{ fontSize: '7.5px', color: '#94a3b8', marginTop: '2px' }}>{fmtCHF(angebot.yearly)} / Jahr</div>
                      {Math.abs(angebot.diff) > 0.01 && (
                        <div style={{ fontSize: '9px', fontWeight: 700, color: farbe, marginTop: '4px' }}>
                          {angebot.diff > 0 ? '−' : '+'}{fmtCHF(Math.abs(angebot.diff))}/Mt.
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Beratungsnotiz falls kurz */}
      {dossier.recommendation_notes && dossier.recommendation_notes.length < 300 && (
        <div style={{
          marginTop: '16px', border: '1px solid #bbf7d0', background: '#f0fdf4',
          borderRadius: '8px', padding: '10px 14px', fontSize: '9.5px', color: '#166534', lineHeight: '1.6',
          WebkitPrintColorAdjust: 'exact', printColorAdjust: 'exact',
        }}>
          <div style={{ fontSize: '8px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '4px', color: '#15803d' }}>Beratungsempfehlung</div>
          {dossier.recommendation_notes}
        </div>
      )}
    </div>
  );
}

// ── Hauptkomponente ───────────────────────────────────────────────────────────
export default function DossierPrintTemplate({ snapshot }) {
  const dossier = snapshot?.dossier;
  const customer = snapshot?.customer;
  const family_members = snapshot?.family_members;
  const comparison_entries = snapshot?.comparison_entries;

  // Organization & Advisor Daten laden (Hooks immer aufrufen - Rules of Hooks)
  const { data: organization } = useQuery({
    queryKey: ['dossier_org_ro', dossier?.organization_id],
    queryFn: () => base44.entities.Organization.filter({ id: dossier.organization_id }).then(r => r[0]),
    enabled: !!dossier?.organization_id,
  });

  const { data: advisor } = useQuery({
    queryKey: ['dossier_advisor_ro', dossier?.advisor_id],
    queryFn: () => base44.entities.Advisor.filter({ id: dossier.advisor_id }).then(r => r[0]),
    enabled: !!dossier?.advisor_id,
  });

  if (!dossier) return null;

  const entries = Array.isArray(comparison_entries)
    ? comparison_entries.map(e => ({ ...e, gruppe: e.gruppe || 'manuell' }))
    : [];
  const summary = calcDossierSummary(entries);
  const savings = summary.savingsMonthly;

  // DEBUG: Console-Log für Berechnung
  console.log('[DossierPrintTemplate DEBUG]', {
    totalEntries: entries.length,
    currentEntries: entries.filter(e => e.gruppe === 'aktuelle_loesung' || e.is_current).length,
    currentMonthly: summary.currentMonthly,
    currentYearly: summary.currentYearly,
    proposedMonthly: summary.proposedMonthly,
    savingsMonthly: summary.savingsMonthly,
    savingsYearly: summary.savingsYearly,
    proposedGruppe: summary.proposedGruppe,
    entries: entries.map(e => ({
      gesellschaft: e.gesellschaft,
      praemie: e.praemie_monatlich,
      gruppe: e.gruppe,
      is_current: e.is_current,
      person: e.person_name,
    })),
  });

  // Welche Gruppen sind vorhanden?
  const presentGruppen = GRUPPE_ORDER.filter(g => entries.some(e => e.gruppe === g));

  // Referenz-Total = Aktuelle Lösung
  const referenceTotal = entries
    .filter(e => e.gruppe === 'aktuelle_loesung')
    .reduce((s, e) => s + (Number(e.praemie_monatlich) || 0), 0);

  // Seitenpaare:
  //   Seite 2: Aktuelle Lösung + Optimierte Lösung nebeneinander
  //   Seite 3: Angebot 1 + Angebot 2
  //   Seite 4: Angebot 3 + Angebot 4, usw.
  const vergleichsSeiten = [];
  const remaining = presentGruppen.filter(g => g !== 'aktuelle_loesung' && g !== 'optimiert');

  // Seite 2: Aktuelle Lösung + Optimierte Lösung nebeneinander
  const hasAktuell  = presentGruppen.includes('aktuelle_loesung');
  const hasOptimiert = presentGruppen.includes('optimiert');
  if (hasAktuell || hasOptimiert) {
    vergleichsSeiten.push({
      g1: hasAktuell ? 'aktuelle_loesung' : 'optimiert',
      g2: hasAktuell && hasOptimiert ? 'optimiert' : null,
      label: 'Seite 2 — Aktuelle Lösung & Optimierte Lösung',
    });
  }

  // Seite 3+: je 2 Angebote nebeneinander
  for (let i = 0; i < remaining.length; i += 2) {
    const pageNum = vergleichsSeiten.length + 2;
    vergleichsSeiten.push({
      g1: remaining[i],
      g2: remaining[i + 1] || null,
      label: `Seite ${pageNum} — ${GRUPPE_CFG[remaining[i]]?.label || remaining[i]}${remaining[i+1] ? ' & ' + (GRUPPE_CFG[remaining[i+1]]?.label || remaining[i+1]) : ''}`,
    });
  }

  const containerStyle = {
    fontFamily: "'Helvetica Neue', Helvetica, Arial, sans-serif",
    color: '#1e293b',
    background: '#ffffff',
    padding: '16px 20px',
    fontSize: '10px',
    lineHeight: '1.5',
    WebkitPrintColorAdjust: 'exact',
    printColorAdjust: 'exact',
  };

  return (
    <>
      <style dangerouslySetInnerHTML={{ __html: PRINT_STYLES }} />
      <div id="dossier-print-root" style={containerStyle}>

        {/* Deckblatt mit Berater/Organisation im Header */}
        <div className="print-page">
          <DeckblattSeite
            dossier={dossier}
            customer={customer}
            family_members={family_members}
            snapshot={snapshot}
            summary={summary}
            savings={savings}
            entries={entries}
            organization={organization}
            advisor={advisor}
          />
        </div>

        {/* Vergleichs-Seiten */}
        {vergleichsSeiten.map((seite, i) => seite.g1 && (
          <VergleichsSeite
            key={i}
            dossier={dossier}
            customer={customer}
            snapshot={snapshot}
            gruppe1={seite.g1}
            gruppe2={seite.g2}
            entries={entries}
            referenceTotal={referenceTotal}
            pageLabel={seite.label}
            organization={organization}
            advisor={advisor}
          />
        ))}

        {/* Beratungsnotiz — nur als eigene Seite wenn Text lang (kurze Notizen stehen bereits auf Deckblatt) */}
        {dossier.recommendation_notes && dossier.recommendation_notes.length >= 300 && (
          <div className="print-page" style={{ minHeight: '185mm' }}>
            <PageHeader 
              dossier={dossier} 
              customer={customer} 
              snapshot={snapshot} 
              pageLabel="Beratungsnotiz"
              organization={organization}
              advisor={advisor}
            />
            <div style={{
              border: '1px solid #bbf7d0', background: '#f0fdf4', borderRadius: '10px',
              padding: '16px 20px', fontSize: '10.5px', color: '#166534', lineHeight: '1.6',
              whiteSpace: 'pre-wrap', wordBreak: 'break-word',
              WebkitPrintColorAdjust: 'exact', printColorAdjust: 'exact',
            }}>
              {dossier.recommendation_notes}
            </div>
          </div>
        )}

        {/* Legende / Hinweise — immer am Ende */}
        <div className="print-page" style={{ padding: '0' }}>
          <PageHeader 
            dossier={dossier}
            customer={customer}
            pageLabel="Legende / Hinweise"
            snapshot={snapshot}
            organization={organization}
            advisor={advisor}
          />
          <div style={{ marginTop: '8px' }}>
            <DossierLegende entries={entries} snapshot={snapshot} />
          </div>
        </div>

      </div>
    </>
  );
}