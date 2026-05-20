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
import React from 'react';
import { fmtCHF, fmtDate, calcDossierSummary } from '@/lib/dossierCalc';

// ── Gruppen-Konfiguration (Farben) ────────────────────────────────────────────
const GRUPPE_CFG = {
  aktuelle_loesung: { label: 'Aktuelle Lösung',    headerBg: '#475569', accentColor: '#475569' },
  optimiert:        { label: 'Optimierte Lösung',  headerBg: '#1d4ed8', accentColor: '#1d4ed8' },
  angebot_1:        { label: 'Angebot 1',          headerBg: '#047857', accentColor: '#047857' },
  angebot_2:        { label: 'Angebot 2',          headerBg: '#6d28d9', accentColor: '#6d28d9' },
  angebot_3:        { label: 'Angebot 3',          headerBg: '#b45309', accentColor: '#b45309' },
  angebot_4:        { label: 'Angebot 4',          headerBg: '#be123c', accentColor: '#be123c' },
  angebot_5:        { label: 'Angebot 5',          headerBg: '#0f766e', accentColor: '#0f766e' },
  manuell:          { label: 'Weitere Einträge',   headerBg: '#64748b', accentColor: '#64748b' },
};
const GRUPPE_ORDER = ['aktuelle_loesung', 'optimiert', 'angebot_1', 'angebot_2', 'angebot_3', 'angebot_4', 'angebot_5', 'manuell'];

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
function PageHeader({ dossier, customer, pageLabel, snapshot }) {
  return (
    <div style={{
      display: 'flex', justifyContent: 'space-between', alignItems: 'center',
      borderBottom: '2px solid #1e3a5f', paddingBottom: '8px', marginBottom: '14px',
    }}>
      <div>
        <div style={{ fontSize: '14px', fontWeight: 800, color: '#1e3a5f', letterSpacing: '-0.02em' }}>
          {TYPE_LABELS[dossier.dossier_type] || dossier.dossier_type}
        </div>
        <div style={{ fontSize: '10px', color: '#64748b', marginTop: '1px' }}>
          {dossier.title}
          {customer ? ` · ${[customer.first_name, customer.last_name].filter(Boolean).join(' ')}` : ''}
        </div>
      </div>
      <div style={{ textAlign: 'right' }}>
        <div style={{ fontSize: '9px', fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.08em' }}>
          {pageLabel}
        </div>
        <div style={{ fontSize: '8.5px', color: '#94a3b8' }}>
          Swiss Premium Broker · {fmtDate(snapshot?.snapshot_created_at)} · v{dossier.version ?? 1}
        </div>
      </div>
    </div>
  );
}

// ── Lösungs-Säule: eine Gruppe als Beratungsangebot ──────────────────────────
function LösungsSäule({ gruppe, label, entries, referenceTotal }) {
  const cfg = GRUPPE_CFG[gruppe] || GRUPPE_CFG.manuell;
  const persons = [...new Set(entries.map(e => e.person_name || 'Unbekannt'))];
  const gruppeTotal = entries.reduce((s, e) => s + (Number(e.praemie_monatlich) || 0), 0);
  const gesellschaften = [...new Set(entries.map(e => e.gesellschaft).filter(Boolean))];
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
        <div style={{ fontSize: '12px', fontWeight: 800, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {gesellschaften.length > 0
            ? gesellschaften.map(g => g.length > 30 ? g.substring(0, 28) + '…' : g).join(' · ')
            : <span style={{ opacity: 0.5, fontStyle: 'italic' }}>Keine Gesellschaft</span>}
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
function VergleichsSeite({ dossier, customer, snapshot, gruppe1, gruppe2, entries, referenceTotal, pageLabel }) {
  const g1entries = entries.filter(e => (e.gruppe || 'manuell') === gruppe1);
  const g2entries = gruppe2 ? entries.filter(e => (e.gruppe || 'manuell') === gruppe2) : [];
  const cfg1 = GRUPPE_CFG[gruppe1] || GRUPPE_CFG.manuell;
  const cfg2 = gruppe2 ? (GRUPPE_CFG[gruppe2] || GRUPPE_CFG.manuell) : null;
  const label1 = g1entries[0]?.gruppe_label || cfg1.label;
  const label2 = cfg2 ? (g2entries[0]?.gruppe_label || cfg2.label) : null;

  return (
    <div className="print-page" style={{ padding: '0' }}>
      {/* Deckblatt-Stil Titel für Seite 2+ */}
      <div style={{
        display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start',
        borderBottom: '3px solid #1e3a5f', paddingBottom: '12px', marginBottom: '14px',
      }}>
        <div>
          <div style={{ fontSize: '22px', fontWeight: 900, color: '#1e3a5f', letterSpacing: '-0.02em' }}>
            {dossier.title}
          </div>
        </div>
        <div style={{ textAlign: 'right' }}>
          <div style={{ fontSize: '9px', color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: '2px' }}>{pageLabel}</div>
          <div style={{ fontSize: '8.5px', color: '#94a3b8' }}>Swiss Premium Broker · {fmtDate(snapshot?.snapshot_created_at)} · v{dossier.version ?? 1}</div>
        </div>
      </div>

      <div style={{ display: 'flex', gap: '14px', alignItems: 'stretch' }}>
        <LösungsSäule
          gruppe={gruppe1}
          label={label1}
          entries={g1entries}
          referenceTotal={referenceTotal}
        />
        {gruppe2 && (
          <LösungsSäule
            gruppe={gruppe2}
            label={label2}
            entries={g2entries}
            referenceTotal={referenceTotal}
          />
        )}
        {!gruppe2 && <div style={{ flex: 1 }} />}
      </div>
    </div>
  );
}

// ── Seite 1: Deckblatt — Personen oben, Prämienübersicht unten ────────────────
function DeckblattSeite({ dossier, customer, family_members, snapshot, summary, savings }) {
  const hasFamilyMembers = Array.isArray(family_members) && family_members.length > 0;

  return (
    <div className="print-page">
      {/* ── Dossier-Header ── */}
      <div style={{
        display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start',
        borderBottom: '3px solid #1e3a5f', paddingBottom: '12px', marginBottom: '18px',
      }}>
        <div>
          <div style={{ fontSize: '22px', fontWeight: 900, color: '#1e3a5f', letterSpacing: '-0.02em', marginBottom: '3px' }}>
            {dossier.title || (TYPE_LABELS[dossier.dossier_type] || dossier.dossier_type)}
          </div>
          {dossier.title && dossier.title !== (TYPE_LABELS[dossier.dossier_type] || dossier.dossier_type) && (
            <div style={{ fontSize: '11px', fontWeight: 500, color: '#64748b', marginTop: '2px' }}>
              {TYPE_LABELS[dossier.dossier_type] || dossier.dossier_type}
            </div>
          )}
        </div>
        <div style={{ textAlign: 'right' }}>
          <div style={{ fontSize: '9px', color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: '2px' }}>Swiss Premium Broker</div>
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

      {/* ── 2. Prämienübersicht ── */}
      {(summary.hasCurrent || summary.hasRecommendation) && (
        <div style={{ WebkitPrintColorAdjust: 'exact', printColorAdjust: 'exact' }}>
          <div style={{ fontSize: '9px', fontWeight: 700, color: '#1e3a5f', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '10px' }}>
            Prämienübersicht
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '12px' }}>
            {[
              {
                label: 'Aktuelle Prämie / Monat',
                value: fmtCHF(summary.currentMonthly),
                sub: `${fmtCHF(summary.currentYearly)} / Jahr`,
                color: '#334155', bg: '#f8fafc', border: '#e2e8f0',
                icon: '📋',
              },
              {
                label: summary.savingsMonthly != null && summary.savingsMonthly > 0.005 ? 'Einsparung / Monat' : summary.savingsMonthly != null && summary.savingsMonthly < -0.005 ? 'Mehrkosten / Monat' : 'Differenz',
                value: summary.savingsMonthly != null ? `${summary.savingsMonthly > 0.005 ? '− ' : summary.savingsMonthly < -0.005 ? '+ ' : ''}${fmtCHF(Math.abs(summary.savingsMonthly))}` : '—',
                sub: summary.savingsYearly != null ? `${summary.savingsMonthly > 0 ? '− ' : '+ '}${fmtCHF(Math.abs(summary.savingsYearly))} / Jahr` : '',
                percent: summary.savingsPercent != null ? `${summary.savingsMonthly > 0 ? '−' : '+'}${Math.abs(summary.savingsPercent).toFixed(1)}%` : null,
                color: summary.savingsMonthly != null && summary.savingsMonthly > 0.005 ? '#059669' : summary.savingsMonthly != null && summary.savingsMonthly < -0.005 ? '#dc2626' : '#64748b',
                bg: summary.savingsMonthly != null && summary.savingsMonthly > 0.005 ? '#f0fdf4' : summary.savingsMonthly != null && summary.savingsMonthly < -0.005 ? '#fef2f2' : '#f8fafc',
                border: summary.savingsMonthly != null && summary.savingsMonthly > 0.005 ? '#bbf7d0' : summary.savingsMonthly != null && summary.savingsMonthly < -0.005 ? '#fecaca' : '#e2e8f0',
                icon: summary.savingsMonthly != null && summary.savingsMonthly > 0.005 ? '↓' : summary.savingsMonthly != null && summary.savingsMonthly < -0.005 ? '↑' : '=',
              },
              {
                label: summary.proposedGruppe
                  ? `${GRUPPE_CFG[summary.proposedGruppe]?.label || summary.proposedGruppe} / Monat`
                  : 'Optimierte Prämie / Monat',
                value: fmtCHF(summary.proposedMonthly),
                sub: `${fmtCHF(summary.proposedYearly)} / Jahr`,
                color: '#1d4ed8', bg: '#eff6ff', border: '#bfdbfe',
                icon: '✓',
              },
            ].map((col, i) => (
              <div key={i} style={{
                border: `1px solid ${col.border}`, borderRadius: '10px',
                padding: '14px 16px', background: col.bg, textAlign: 'center',
              }}>
                <div style={{ fontSize: '8px', color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '8px' }}>{col.label}</div>
                <div style={{ fontSize: '20px', fontWeight: 900, color: col.color }}>{col.value}</div>
                {col.sub && <div style={{ fontSize: '8.5px', color: '#94a3b8', marginTop: '3px' }}>{col.sub}</div>}
                {col.percent && <div style={{ fontSize: '13px', fontWeight: 800, color: col.color, marginTop: '4px' }}>{col.percent}</div>}
              </div>
            ))}
          </div>
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
  if (!snapshot?.dossier) return null;

  const { dossier, customer, family_members, comparison_entries } = snapshot;
  const entries = Array.isArray(comparison_entries)
    ? comparison_entries.map(e => ({ ...e, gruppe: e.gruppe || 'manuell' }))
    : [];
  const summary = calcDossierSummary(entries);
  const savings = summary.savingsMonthly;

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

        {/* Deckblatt */}
        <DeckblattSeite
          dossier={dossier}
          customer={customer}
          family_members={family_members}
          snapshot={snapshot}
          summary={summary}
          savings={savings}
        />

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
          />
        ))}

        {/* Beratungsnotiz — nur als eigene Seite wenn Text lang (kurze Notizen stehen bereits auf Deckblatt) */}
        {dossier.recommendation_notes && dossier.recommendation_notes.length >= 300 && (
          <div className="print-page" style={{ minHeight: '185mm' }}>
            <PageHeader dossier={dossier} customer={customer} snapshot={snapshot} pageLabel="Beratungsnotiz" />
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

      </div>
    </>
  );
}