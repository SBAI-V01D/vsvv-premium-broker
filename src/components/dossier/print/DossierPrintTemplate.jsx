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

// ── Gemeinsamer Seiten-Header (klein, wiederholt auf jeder Seite) ─────────────
function PageHeader({ dossier, customer, pageLabel, snapshot, organization, advisor }) {
  return (
    <div style={{
      display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start',
      borderBottom: '2px solid #1e3a5f', paddingBottom: '8px', marginBottom: '14px',
    }}>
      <div>
        {/* Haupttitel: Dossier-Titel (ohne Kundennamen) */}
        <div style={{ fontSize: '13px', fontWeight: 800, color: '#1e3a5f', letterSpacing: '-0.02em', marginBottom: '2px' }}>
          {dossier.title || TYPE_LABELS[dossier.dossier_type] || dossier.dossier_type}
        </div>
        {/* Untertitel: Seiten-spezifisch */}
        <div style={{ fontSize: '9px', color: '#64748b' }}>
          {pageLabel}
        </div>
        {/* Berater/Organisation (klein, nur wenn vorhanden) */}
        {(organization?.name || advisor) && (
          <div style={{ fontSize: '7.5px', color: '#94a3b8', marginTop: '4px' }}>
            {organization?.name && <div>{organization.name}</div>}
            {advisor && <div>{advisor.firstname} {advisor.lastname}</div>}
          </div>
        )}
      </div>
      <div style={{ textAlign: 'right' }}>
        <div style={{ fontSize: '8.5px', color: '#94a3b8' }}>
          {fmtDate(snapshot?.snapshot_created_at)} · v{dossier.version ?? 1}
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
  const gesellschaften = [...new Set(entries.map(e => e.gesellschaft).filter(Boolean))];
  // Titel aus Prop oder generieren
  const titelToUse = titel || generateTitelFromGesellschaften(entries);
  const isRef = gruppe === 'aktuelle_loesung';

  // Einsparung vs. Aktuelle Lösung
  const diff = referenceTotal && referenceTotal > 0 ? referenceTotal - gruppeTotal : null;
  const diffPct = diff !== null ? ((diff / referenceTotal) * 100).toFixed(1) : null;

  return (
    <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column' }}>
      {/* ── Säulen-Header ── */}
      <div style={{
        background: cfg.headerBg, borderRadius: '8px 8px 0 0',
        padding: '10px 14px', color: 'white',
        WebkitPrintColorAdjust: 'exact', printColorAdjust: 'exact',
      }}>
        <div style={{ fontSize: '8px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.12em', opacity: 0.8, marginBottom: '2px' }}>
          {label}
        </div>
        {/* Dynamischer Titel aus allen Gesellschaften */}
        <div style={{ fontSize: '11px', fontWeight: 700, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', marginBottom: '4px' }}>
          {titelToUse || <span style={{ opacity: 0.5, fontStyle: 'italic' }}>Keine Gesellschaft</span>}
        </div>
        {/* Gesellschaften als kleine Badges */}
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '3px', marginBottom: '8px' }}>
          {gesellschaften.slice(0, 5).map((g, i) => (
            <span key={i} style={{
              fontSize: '7px',
              fontWeight: 600,
              background: 'rgba(255,255,255,0.2)',
              padding: '2px 5px',
              borderRadius: '3px',
            }}>
              {g.length > 20 ? g.substring(0, 18) + '…' : g}
            </span>
          ))}
          {gesellschaften.length > 5 && (
            <span style={{ fontSize: '7px', opacity: 0.8 }}>+{gesellschaften.length - 5}</span>
          )}
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', marginTop: '8px' }}>
          <div>
            <div style={{ fontSize: '18px', fontWeight: 900, letterSpacing: '-0.02em' }}>
              {gruppeTotal > 0 ? fmtCHF(gruppeTotal) : '—'}
            </div>
            <div style={{ fontSize: '8px', opacity: 0.75 }}>Total / Monat · {gruppeTotal > 0 ? fmtCHF(gruppeTotal * 12) + '/Jahr' : ''}</div>
          </div>
          {/* Einsparung */}
          {!isRef && diff !== null && gruppeTotal > 0 && (
            <div style={{
              background: diff > 0.01 ? 'rgba(255,255,255,0.2)' : 'rgba(255,100,100,0.2)',
              border: '1px solid rgba(255,255,255,0.3)',
              borderRadius: '6px', padding: '4px 8px', textAlign: 'right',
            }}>
              <div style={{ fontSize: '11px', fontWeight: 800 }}>
                {diff > 0.01 ? `− ${fmtCHF(diff)}/Mt.` : diff < -0.01 ? `+ ${fmtCHF(Math.abs(diff))}/Mt.` : '= gleich'}
              </div>
              {diffPct && Math.abs(diff) > 0.01 && (
                <div style={{ fontSize: '8px', opacity: 0.85 }}>
                  {diff > 0 ? `${diffPct}% günstiger` : `${diffPct}% teurer`}
                </div>
              )}
            </div>
          )}
          {isRef && (
            <div style={{ background: 'rgba(255,255,255,0.15)', border: '1px solid rgba(255,255,255,0.3)', borderRadius: '6px', padding: '4px 8px' }}>
              <div style={{ fontSize: '9px', fontWeight: 700 }}>Referenz</div>
            </div>
          )}
        </div>
      </div>

      {/* ── Säulen-Body: Personen-Blöcke ── */}
      <div style={{
        border: `1px solid ${cfg.headerBg}`, borderTop: 'none', borderRadius: '0 0 8px 8px',
        flex: 1, padding: '10px',
        WebkitPrintColorAdjust: 'exact', printColorAdjust: 'exact',
      }}>
        {persons.map(person => {
          const pEntries = entries.filter(e => (e.person_name || 'Unbekannt') === person);
          const kvg = pEntries.filter(e => e.section === 'grundversicherung');
          const vvgAll = pEntries.filter(e => e.section === 'zusatzversicherung');
          // VVG-Sortierung: Grundversicherer-VVG zuerst, dann andere Gesellschaften
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
                  background: cfg.headerBg, color: 'white',
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
                    fontSize: '7.5px', fontWeight: 700, color: '#1d4ed8',
                    textTransform: 'uppercase', letterSpacing: '0.08em',
                    background: '#eff6ff', border: '1px solid #bfdbfe',
                    borderRadius: '4px', padding: '2px 6px', display: 'inline-block',
                    marginBottom: '4px',
                    WebkitPrintColorAdjust: 'exact', printColorAdjust: 'exact',
                  }}>KVG — Grundversicherung</div>
                  {kvg.map(e => <ProductRow key={e.id} entry={e} accentColor={cfg.accentColor} />)}
                </div>
              )}

              {/* VVG */}
              {vvg.length > 0 && (
                <div style={{ marginBottom: '6px' }}>
                  <div style={{
                    fontSize: '7.5px', fontWeight: 700, color: '#6d28d9',
                    textTransform: 'uppercase', letterSpacing: '0.08em',
                    background: '#f5f3ff', border: '1px solid #ddd6fe',
                    borderRadius: '4px', padding: '2px 6px', display: 'inline-block',
                    marginBottom: '4px',
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
      {/* Seiten-spezifischer Header */}
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
      {/* Dossier-Header mit Berater/Organisation */}
      <div style={{
        display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start',
        borderBottom: '3px solid #1e3a5f', paddingBottom: '12px', marginBottom: '18px',
      }}>
        {/* Linke Seite: Organisation + Berater */}
        <div style={{ flex: 1 }}>
          {organization?.name && (
            <div style={{ fontSize: '13px', fontWeight: 800, color: '#1e3a5f', marginBottom: '6px' }}>
              {organization.name}
            </div>
          )}
          <div style={{ fontSize: '8.5px', color: '#64748b', lineHeight: '1.5' }}>
            {organization?.street && <div>{organization.street}{organization?.zip_code || organization?.city ? ',' : ''} {organization?.zip_code} {organization?.city}</div>}
            {organization?.phone && <div>Tel: {organization.phone}</div>}
            {organization?.email && <div>Email: {organization.email}</div>}
            {advisor && (
              <div style={{ marginTop: '6px', paddingTop: '6px', borderTop: '1px solid #e2e8f0' }}>
                <div style={{ fontWeight: 600, color: '#1e3a5f' }}>{advisor.firstname} {advisor.lastname}</div>
                {advisor?.phone && <div>Tel: {advisor.phone}</div>}
                {advisor?.email && <div>Email: {advisor.email}</div>}
                {advisor?.finma_number && <div>FINMA: {advisor.finma_number}</div>}
                {advisor?.vbv_number && <div>VBV: {advisor.vbv_number}</div>}
              </div>
            )}
          </div>
        </div>
        
        {/* Rechte Seite: Dossier-Info */}
        <div style={{ textAlign: 'right', minWidth: '180px' }}>
          <div style={{ fontSize: '9px', color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: '2px' }}>
            {dossier.title || TYPE_LABELS[dossier.dossier_type] || dossier.dossier_type}
          </div>
          <div style={{ fontSize: '9.5px', color: '#64748b' }}>Erstellt: {fmtDate(snapshot?.snapshot_created_at)}</div>
          {snapshot?.created_by_name && <div style={{ fontSize: '9.5px', color: '#64748b' }}>durch {snapshot.created_by_name}</div>}
          <div style={{ fontSize: '8.5px', color: '#94a3b8', marginTop: '3px', background: '#f1f5f9', padding: '2px 7px', borderRadius: '4px', display: 'inline-block' }}>
            v{dossier.version ?? 1}
          </div>
        </div>
      </div>

      {/* ── 1. Versicherungsnehmer + Familienmitglieder ── */}
      <div style={{ display: 'grid', gridTemplateColumns: hasFamilyMembers ? '1fr 1fr' : '1fr', gap: '16px', marginBottom: '20px' }}>
        {/* Versicherungsnehmer */}
        {customer && (
          <div style={{
            border: '1px solid #e2e8f0', borderRadius: '10px', padding: '14px 16px',
            background: '#f8fafc',
            WebkitPrintColorAdjust: 'exact', printColorAdjust: 'exact',
          }}>
            <div style={{ fontSize: '9px', fontWeight: 700, color: '#1e3a5f', textTransform: 'uppercase', letterSpacing: '0.06em', borderBottom: '1px solid #e2e8f0', paddingBottom: '5px', marginBottom: '10px' }}>
              Versicherungsnehmer
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '6px 14px', fontSize: '9.5px' }}>
              {[
                ['Name', [customer.first_name, customer.last_name].filter(Boolean).join(' ')],
                ['Geburtsdatum', fmtDate(customer.birthdate)],
                ['Zivilstand', CIVIL_LABELS[customer.civil_status] || customer.civil_status],
                ['Adresse', [customer.street, [customer.zip_code, customer.city].filter(Boolean).join(' ')].filter(Boolean).join(', ')],
                ['Telefon', customer.phone || customer.mobile],
                ['E-Mail', customer.email],
              ].filter(([, v]) => v).map(([l, v]) => (
                <div key={l}>
                  <div style={{ fontSize: '7.5px', color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.05em' }}>{l}</div>
                  <div style={{ fontWeight: 500, color: '#1e293b', wordBreak: 'break-word' }}>{v}</div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Haushaltsmitglieder */}
        {hasFamilyMembers && (
          <div style={{
            border: '1px solid #e2e8f0', borderRadius: '10px', padding: '14px 16px',
            background: '#f8fafc',
            WebkitPrintColorAdjust: 'exact', printColorAdjust: 'exact',
          }}>
            <div style={{ fontSize: '9px', fontWeight: 700, color: '#1e3a5f', textTransform: 'uppercase', letterSpacing: '0.06em', borderBottom: '1px solid #e2e8f0', paddingBottom: '5px', marginBottom: '10px' }}>
              Haushaltsmitglieder
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: `repeat(${Math.min(family_members.length, 3)}, 1fr)`, gap: '8px' }}>
              {family_members.map((m, i) => (
                <div key={m.id || i} style={{ border: '1px solid #e2e8f0', borderRadius: '6px', padding: '8px 10px', background: '#ffffff', fontSize: '9px' }}>
                  <div style={{ fontWeight: 700, color: '#1e293b', marginBottom: '3px' }}>
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

      {/* ── 2. Prämienübersicht — ERWEITERT für alle Angebote ── */}
      {(summary.hasCurrent || summary.hasRecommendation || angebotPrämien.length > 0) && (
        <div style={{ WebkitPrintColorAdjust: 'exact', printColorAdjust: 'exact' }}>
          <div style={{ fontSize: '9px', fontWeight: 700, color: '#1e3a5f', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '10px' }}>
            Prämienübersicht — Alle Lösungen im Vergleich
          </div>
          
          {/* Zeile 1: Aktuelle Lösung + Einsparung/Optimiert */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '12px', marginBottom: '12px' }}>
            <div style={{
              border: '1px solid #e2e8f0', borderRadius: '10px',
              padding: '14px 16px', background: '#f8fafc', textAlign: 'center',
            }}>
              <div style={{ fontSize: '8px', color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '8px' }}>Aktuelle Prämie / Monat</div>
              <div style={{ fontSize: '20px', fontWeight: 900, color: '#334155' }}>{fmtCHF(summary.currentMonthly)}</div>
              <div style={{ fontSize: '8.5px', color: '#94a3b8', marginTop: '3px' }}>{fmtCHF(summary.currentYearly)} / Jahr</div>
            </div>
            
            <div style={{
              border: `1px solid ${summary.savingsMonthly > 0.005 ? '#bbf7d0' : summary.savingsMonthly < -0.005 ? '#fecaca' : '#e2e8f0'}`,
              borderRadius: '10px',
              padding: '14px 16px',
              background: summary.savingsMonthly > 0.005 ? '#f0fdf4' : summary.savingsMonthly < -0.005 ? '#fef2f2' : '#f8fafc',
              textAlign: 'center',
            }}>
              <div style={{ fontSize: '8px', color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '8px' }}>
                {summary.savingsMonthly > 0.005 ? 'Einsparung / Monat' : summary.savingsMonthly < -0.005 ? 'Mehrkosten / Monat' : 'Differenz'}
              </div>
              <div style={{ fontSize: '20px', fontWeight: 900, color: summary.savingsMonthly > 0.005 ? '#059669' : summary.savingsMonthly < -0.005 ? '#dc2626' : '#64748b' }}>
                {summary.savingsMonthly != null ? `${summary.savingsMonthly > 0.005 ? '− ' : summary.savingsMonthly < -0.005 ? '+ ' : ''}${fmtCHF(Math.abs(summary.savingsMonthly))}` : '—'}
              </div>
              {summary.savingsYearly != null && (
                <div style={{ fontSize: '8.5px', color: '#94a3b8', marginTop: '3px' }}>
                  {summary.savingsMonthly > 0 ? '− ' : '+ '}{fmtCHF(Math.abs(summary.savingsYearly))} / Jahr
                </div>
              )}
              {summary.savingsPercent != null && (
                <div style={{ fontSize: '13px', fontWeight: 800, color: summary.savingsMonthly > 0.005 ? '#059669' : summary.savingsMonthly < -0.005 ? '#dc2626' : '#64748b', marginTop: '4px' }}>
                  {summary.savingsMonthly > 0 ? '−' : '+'}{Math.abs(summary.savingsPercent).toFixed(1)}%
                </div>
              )}
            </div>
            
            <div style={{
              border: '1px solid #bfdbfe', borderRadius: '10px',
              padding: '14px 16px', background: '#eff6ff', textAlign: 'center',
            }}>
              <div style={{ fontSize: '8px', color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '8px' }}>
                {summary.proposedGruppe ? `${GRUPPE_CFG[summary.proposedGruppe]?.label || summary.proposedGruppe} / Monat` : 'Optimierte Prämie / Monat'}
              </div>
              <div style={{ fontSize: '20px', fontWeight: 900, color: '#1d4ed8' }}>{fmtCHF(summary.proposedMonthly)}</div>
              <div style={{ fontSize: '8.5px', color: '#94a3b8', marginTop: '3px' }}>{fmtCHF(summary.proposedYearly)} / Jahr</div>
            </div>
          </div>
          
          {/* Zeile 2: Alle Angebote im Vergleich zur optimierten Lösung */}
          {angebotPrämien.length > 0 && (
            <div>
              <div style={{ fontSize: '8px', color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '8px' }}>
                Angebote im Vergleich zur {referenceLabel}
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: `repeat(${Math.min(angebotPrämien.length, 4)}, 1fr)`, gap: '10px' }}>
                {angebotPrämien.map((angebot, i) => {
                  // Angebot 1 verwendet blaue Farbe (wie Optimierte Lösung), alle anderen grün/rot je nach Einsparung
                  const istAngebot1 = angebot.gruppe === 'angebot_1';
                  const farbe = istAngebot1 ? '#1d4ed8' : (angebot.diff > 0 ? '#059669' : angebot.diff < 0 ? '#dc2626' : '#64748b');
                  const borderFarbe = istAngebot1 ? '#bfdbfe' : (angebot.diff > 0 ? '#bbf7d0' : angebot.diff < 0 ? '#fecaca' : '#e2e8f0');
                  const bgFarbe = istAngebot1 ? '#eff6ff' : (angebot.diff > 0 ? '#f0fdf4' : angebot.diff < 0 ? '#fef2f2' : '#f8fafc');
                  
                  return (
                    <div key={angebot.gruppe} style={{
                      border: `1px solid ${borderFarbe}`,
                      borderRadius: '10px',
                      padding: '12px 14px',
                      background: bgFarbe,
                      textAlign: 'center',
                    }}>
                      <div style={{ fontSize: '8px', color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '6px' }}>
                        {angebot.label}
                      </div>
                      <div style={{ fontSize: '18px', fontWeight: 900, color: farbe }}>
                        {fmtCHF(angebot.monthly)}
                      </div>
                      <div style={{ fontSize: '7.5px', color: '#94a3b8', marginTop: '2px' }}>
                        {fmtCHF(angebot.yearly)} / Jahr
                      </div>
                      {Math.abs(angebot.diff) > 0.01 && (
                        <div style={{
                          fontSize: '10px',
                          fontWeight: 700,
                          color: istAngebot1 ? '#1d4ed8' : (angebot.diff > 0 ? '#059669' : '#dc2626'),
                          marginTop: '4px',
                          background: istAngebot1 ? 'rgba(29,78,216,0.1)' : (angebot.diff > 0 ? 'rgba(5,150,105,0.1)' : 'rgba(220,38,38,0.1)'),
                          padding: '2px 6px',
                          borderRadius: '4px',
                          display: 'inline-block',
                        }}>
                          {angebot.diff > 0 ? '−' : '+'}{fmtCHF(Math.abs(angebot.diff))}/Mt. {angebot.pct > 0 ? `(${angebot.pct.toFixed(1)}%)` : ''}
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
            <div style={{ fontSize: '9px', fontWeight: 700, color: '#1e3a5f', textTransform: 'uppercase', letterSpacing: '0.06em', borderBottom: '1px solid #e2e8f0', paddingBottom: '4px', marginBottom: '10px' }}>
              Beratungsnotiz / Empfehlung
            </div>
            <div style={{
              border: '1px solid #bbf7d0', background: '#f0fdf4', borderRadius: '8px',
              padding: '12px 16px', fontSize: '10.5px', color: '#166534', lineHeight: '1.6',
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
          <DossierLegende entries={entries} snapshot={snapshot} />
        </div>

      </div>
    </>
  );
}