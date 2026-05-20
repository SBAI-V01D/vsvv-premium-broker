/**
 * DossierLegende — Enterprise Struktur mit dynamischen produktspezifischen Hinweisen
 * 
 * Struktur:
 *   1. Allgemeine Hinweise (immer anzeigen)
 *   2. Produktspezifische Hinweise (nur wenn Produkt vorhanden)
 *      - Flexible Spitalversicherung (separat, nur wenn enthalten)
 *      - Spitaltaggeld / Kostenbeteiligung (separat, nur wenn enthalten)
 * 
 * Alle Titel: fett, gleiche Grösse, gleiche Abstände
 */
import React from 'react';
import { fmtDate } from '@/lib/dossierCalc';
import { AlertCircle, FileText, Shield, Stethoscope, Hospital, Calculator, TrendingUp, Users, BookOpen } from 'lucide-react';

// ── Konfiguration: Allgemeine Hinweise (immer anzeigen) ───────────────────────
const ALLGEMEINE_HINWEISE = [
  {
    key: 'gesundheitsprüfung',
    label: 'Gesundheitsprüfung Zusatzversicherungen',
    text: 'Der Abschluss von Zusatzversicherungen erfolgt vorbehaltlich Gesundheitsprüfung und Annahme durch die jeweilige Versicherungsgesellschaft.',
    icon: Stethoscope,
    color: '#dc2626',
    bgColor: '#fef2f2',
    borderColor: '#fecaca',
  },
  {
    key: 'franschise',
    label: 'Franchise-Hinweis',
    text: 'Eine höhere Franchise reduziert die monatliche Prämie, erhöht jedoch die Kostenbeteiligung im Leistungsfall.',
    icon: Calculator,
    color: '#b45309',
    bgColor: '#fffbeb',
    borderColor: '#fde68a',
  },
  {
    key: 'praemienberechnung',
    label: 'Berechnungsgrundlage Prämien',
    text: 'Die Berechnungsgrundlagen der Prämien basieren auf dem Tarifjahr 2026.',
    icon: FileText,
    color: '#1d4ed8',
    bgColor: '#eff6ff',
    borderColor: '#bfdbfe',
  },
  {
    key: 'bag_genehmigung',
    label: 'Definitive Grundversicherungsprämien',
    text: 'Die definitiven Prämientarife 2027 der obligatorischen Grundversicherung werden voraussichtlich Ende September 2026 durch das BAG genehmigt.',
    icon: AlertCircle,
    color: '#047857',
    bgColor: '#ecfdf5',
    borderColor: '#a7f3d0',
  },
  {
    key: 'zusatz_praemien',
    label: 'Hinweis Zusatzversicherungen',
    text: 'Anpassungen der Prämien in den Zusatzversicherungen können vorbehaltlich Prämienanpassungen der Versicherungsgesellschaften erfolgen.',
    icon: TrendingUp,
    color: '#6d28d9',
    bgColor: '#f5f3ff',
    borderColor: '#ddd6fe',
  },
  {
    key: 'altersgruppenwechsel',
    label: 'Altersgruppen-/Kollektivwechsel',
    text: 'Prämienanpassungen können zusätzlich aufgrund eines Altersgruppensprungs oder eines Kollektivwechsels entstehen.',
    icon: Users,
    color: '#0f766e',
    bgColor: '#f0fdfa',
    borderColor: '#99f6e4',
  },
  {
    key: 'beratungsgrundlage',
    label: 'Beratungsgrundlage',
    text: 'Die Optimierung wurde unter Berücksichtigung der aktuellen Bedürfnisse, der vorhandenen Versicherungsdeckung sowie des gewünschten Preis-Leistungs-Verhältnisses erstellt.',
    icon: BookOpen,
    color: '#475569',
    bgColor: '#f8fafc',
    borderColor: '#e2e8f0',
  },
];

// ── Konfiguration: Produktspezifische Hinweise (nur bei Bedarf) ────────────────
const PRODUKT_HINWEISE = {
  flexible_spital: {
    key: 'flexible_spital',
    label: 'Flexible Spitalversicherung',
    text: 'Flexible Spitalversicherungen ermöglichen die Wahl der Spitalabteilung erst im Zeitpunkt des Spitaleintritts. Je nach gewählter Abteilung kann eine zusätzliche Kostenbeteiligung entstehen.',
    icon: Hospital,
    color: '#be123c',
    bgColor: '#fff1f2',
    borderColor: '#fecdd3',
    condition: (entries) => {
      return entries.some(e => 
        e.section === 'zusatzversicherung' &&
        (e.modell?.toLowerCase().includes('flex') ||
         e.product_name?.toLowerCase().includes('flex') ||
         e.deckung_details?.toLowerCase().includes('flex') ||
         e.deckung_details?.toLowerCase().includes('wahl'))
      );
    },
  },
  spitaltaggeld: {
    key: 'spitaltaggeld',
    label: 'Spitaltaggeld / Kostenbeteiligung',
    text: 'Allfällige Kostenbeteiligungen bei flexiblen Spitalversicherungen können je nach gewählter Deckung teilweise oder vollständig durch eine Spitaltaggeldversicherung gedeckt werden.',
    icon: Shield,
    color: '#0891b2',
    bgColor: '#ecfeff',
    borderColor: '#a5f3fc',
    condition: (entries) => {
      return entries.some(e => 
        e.section === 'zusatzversicherung' &&
        (e.product_name?.toLowerCase().includes('taggeld') ||
         e.product_name?.toLowerCase().includes('tagesgeld') ||
         e.deckung_details?.toLowerCase().includes('taggeld') ||
         e.deckung_details?.toLowerCase().includes('kostenbeteiligung'))
      );
    },
  },
};

// ── Einzelner Hinweis (einheitliches Design) ───────────────────────────────────
function HinweisBox({ hinweis }) {
  const Icon = hinweis.icon;
  
  return (
    <div style={{
      border: `1px solid ${hinweis.borderColor}`,
      borderRadius: '6px',
      padding: '9px 12px',
      background: hinweis.bgColor,
      marginBottom: '6px',
      WebkitPrintColorAdjust: 'exact',
      printColorAdjust: 'exact',
    }}>
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: '7px' }}>
        <Icon 
          style={{ 
            width: '13px', 
            height: '13px', 
            color: hinweis.color,
            flexShrink: 0,
            marginTop: '1.5px',
          }} 
        />
        <div style={{ flex: 1 }}>
          <div style={{
            fontSize: '8px',
            fontWeight: 700,
            color: hinweis.color,
            marginBottom: '2.5px',
            textTransform: 'uppercase',
            letterSpacing: '0.03em',
          }}>
            {hinweis.label}
          </div>
          <div style={{
            fontSize: '8.5px',
            color: '#334155',
            lineHeight: '1.45',
            textAlign: 'justify',
          }}>
            {hinweis.text}
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Hauptkomponente ───────────────────────────────────────────────────────────
export default function DossierLegende({ entries, snapshot, mainTitle, subTitle }) {
  // Filtere produktspezifische Hinweise
  const visibleProduktHinweise = Object.values(PRODUKT_HINWEISE).filter(hinweis => {
    return hinweis.condition && entries && hinweis.condition(entries);
  });

  return (
    <div style={{
      paddingTop: '8px',
    }}>
      {/* Haupttitel (konsistent mit Seite 1 & 2) */}
      <div style={{
        fontSize: '22px',
        fontWeight: 900,
        color: '#1e3a5f',
        letterSpacing: '-0.02em',
        marginBottom: '2px',
      }}>
        {mainTitle || 'Beratungsdossier'}
      </div>
      
      {/* Untertitel (Dossier-Titel) */}
      {subTitle && (
        <div style={{
          fontSize: '11px',
          fontWeight: 500,
          color: '#64748b',
          marginBottom: '14px',
        }}>
          {subTitle}
        </div>
      )}
      {/* Abschnitt 1: Allgemeine Hinweise */}
      <div style={{ marginBottom: '14px' }}>
        {ALLGEMEINE_HINWEISE.map(hinweis => (
          <HinweisBox key={hinweis.key} hinweis={hinweis} />
        ))}
      </div>

      {/* Abschnitt 2: Produktspezifische Hinweise (nur wenn vorhanden) */}
      {visibleProduktHinweise.length > 0 && (
        <div style={{
          borderTop: '1.5px dashed #cbd5e1',
          paddingTop: '12px',
          marginTop: '8px',
        }}>
          {/* Separater Header für produktspezifische Hinweise */}
          <div style={{
            fontSize: '8.5px',
            fontWeight: 700,
            color: '#64748b',
            textTransform: 'uppercase',
            letterSpacing: '0.08em',
            marginBottom: '8px',
            display: 'flex',
            alignItems: 'center',
            gap: '5px',
          }}>
            <Shield style={{ width: '12px', height: '12px' }} />
            Produktspezifische Hinweise
          </div>
          
          {visibleProduktHinweise.map(hinweis => (
            <HinweisBox key={hinweis.key} hinweis={hinweis} />
          ))}
        </div>
      )}

      {/* Footer mit Erstellungsdatum */}
      <div style={{
        marginTop: '10px',
        paddingTop: '6px',
        borderTop: '1px solid #e2e8f0',
        fontSize: '7.5px',
        color: '#94a3b8',
        textAlign: 'center',
      }}>
        Swiss Premium Broker · {fmtDate(snapshot?.snapshot_created_at)} · v{snapshot?.dossier?.version ?? 1}
      </div>
    </div>
  );
}