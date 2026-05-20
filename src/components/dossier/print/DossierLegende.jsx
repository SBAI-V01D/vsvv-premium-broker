/**
 * DossierLegende — Dynamische Hinweise & Disclaimer
 * 
 * Zeigt strukturierte Hinweise basierend auf den enthaltenen Produkten.
 * Alle Überschriften fett, bessere visuelle Unterteilung, professionelle Formatierung.
 */
import React from 'react';
import { fmtDate } from '@/lib/dossierCalc';
import { AlertCircle, FileText, Shield, Stethoscope, Hospital, Calculator, TrendingUp, Users, BookOpen } from 'lucide-react';

// ── Konfiguration der Hinweise ───────────────────────────────────────────────
const HINWEISE_CONFIG = {
  // Immer anzeigen
  gesundheitsprüfung: {
    key: 'gesundheitsprüfung',
    label: 'Gesundheitsprüfung Zusatzversicherungen',
    text: 'Der Abschluss von Zusatzversicherungen erfolgt vorbehaltlich Gesundheitsprüfung und Annahme durch die jeweilige Versicherungsgesellschaft.',
    icon: Stethoscope,
    color: '#dc2626', // red-600
    bgColor: '#fef2f2', // red-50
    borderColor: '#fecaca', // red-200
    alwaysShow: true,
  },
  franschise: {
    key: 'franschise',
    label: 'Franchise-Hinweis',
    text: 'Eine höhere Franchise reduziert die monatliche Prämie, erhöht jedoch die Kostenbeteiligung im Leistungsfall.',
    icon: Calculator,
    color: '#b45309', // amber-700
    bgColor: '#fffbeb', // amber-50
    borderColor: '#fde68a', // amber-200
    alwaysShow: true,
  },
  praemienberechnung: {
    key: 'praemienberechnung',
    label: 'Berechnungsgrundlage Prämien',
    text: 'Die Berechnungsgrundlagen der Prämien basieren auf dem Tarifjahr 2026.',
    icon: FileText,
    color: '#1d4ed8', // blue-700
    bgColor: '#eff6ff', // blue-50
    borderColor: '#bfdbfe', // blue-200
    alwaysShow: true,
  },
  bag_genehmigung: {
    key: 'bag_genehmigung',
    label: 'Definitive Grundversicherungsprämien',
    text: 'Die definitiven Prämientarife 2027 der obligatorischen Grundversicherung werden voraussichtlich Ende September 2026 durch das BAG genehmigt.',
    icon: AlertCircle,
    color: '#047857', // emerald-700
    bgColor: '#ecfdf5', // emerald-50
    borderColor: '#a7f3d0', // emerald-200
    alwaysShow: true,
  },
  zusatz_praemien: {
    key: 'zusatz_praemien',
    label: 'Hinweis Zusatzversicherungen',
    text: 'Anpassungen der Prämien in den Zusatzversicherungen können vorbehaltlich Prämienanpassungen der Versicherungsgesellschaften erfolgen.',
    icon: TrendingUp,
    color: '#6d28d9', // violet-700
    bgColor: '#f5f3ff', // violet-50
    borderColor: '#ddd6fe', // violet-200
    alwaysShow: true,
  },
  altersgruppenwechsel: {
    key: 'altersgruppenwechsel',
    label: 'Altersgruppen-/Kollektivwechsel',
    text: 'Prämienanpassungen können zusätzlich aufgrund eines Altersgruppensprungs oder eines Kollektivwechsels entstehen.',
    icon: Users,
    color: '#0f766e', // teal-700
    bgColor: '#f0fdfa', // teal-50
    borderColor: '#99f6e4', // teal-200
    alwaysShow: true,
  },
  beratungsgrundlage: {
    key: 'beratungsgrundlage',
    label: 'Beratungsgrundlage',
    text: 'Die Optimierung wurde unter Berücksichtigung der aktuellen Bedürfnisse, der vorhandenen Versicherungsdeckung sowie des gewünschten Preis-Leistungs-Verhältnisses erstellt.',
    icon: BookOpen,
    color: '#475569', // slate-600
    bgColor: '#f8fafc', // slate-50
    borderColor: '#e2e8f0', // slate-200
    alwaysShow: true,
  },
  // Nur bei Bedarf anzeigen
  flexible_spital: {
    key: 'flexible_spital',
    label: 'Flexible Spitalversicherung',
    text: 'Flexible Spitalversicherungen ermöglichen die Wahl der Spitalabteilung erst im Zeitpunkt des Spitaleintritts. Je nach gewählter Abteilung kann eine zusätzliche Kostenbeteiligung entstehen.',
    icon: Hospital,
    color: '#be123c', // rose-700
    bgColor: '#fff1f2', // rose-50
    borderColor: '#fecdd3', // rose-200
    alwaysShow: false,
    condition: (entries) => {
      // Prüfen ob flexible Spitalversicherung enthalten ist
      const flexibleKeywords = ['flex', 'wahl', 'abteilung', 'spital', 'hospital'];
      return entries.some(e => 
        e.section === 'zusatzversicherung' &&
        (e.modell?.toLowerCase().includes('flex') ||
         e.product_name?.toLowerCase().includes('flex') ||
         e.deckung_details?.toLowerCase().includes('flex') ||
         e.gesellschaft?.toLowerCase().includes('flex'))
      );
    },
  },
  spitaltaggeld: {
    key: 'spitaltaggeld',
    label: 'Spitaltaggeld / Kostenbeteiligung',
    text: 'Allfällige Kostenbeteiligungen bei flexiblen Spitalversicherungen können je nach gewählter Deckung teilweise oder vollständig durch eine Spitaltaggeldversicherung gedeckt werden.',
    icon: Shield,
    color: '#0891b2', // cyan-700
    bgColor: '#ecfeff', // cyan-50
    borderColor: '#a5f3fc', // cyan-200
    alwaysShow: false,
    condition: (entries) => {
      // Prüfen ob Spitaltaggeld enthalten ist
      const taggeldKeywords = ['taggeld', 'spitaltaggeld', 'tagesgeld', 'kostenbeteiligung'];
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

// ── Einzelner Hinweis ─────────────────────────────────────────────────────────
function HinweisBox({ hinweis }) {
  const Icon = hinweis.icon;
  
  return (
    <div style={{
      border: `1px solid ${hinweis.borderColor}`,
      borderRadius: '8px',
      padding: '10px 14px',
      background: hinweis.bgColor,
      marginBottom: '8px',
      WebkitPrintColorAdjust: 'exact',
      printColorAdjust: 'exact',
    }}>
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: '8px' }}>
        <Icon 
          style={{ 
            width: '14px', 
            height: '14px', 
            color: hinweis.color,
            flexShrink: 0,
            marginTop: '2px',
          }} 
        />
        <div style={{ flex: 1 }}>
          <div style={{
            fontSize: '8.5px',
            fontWeight: 700,
            color: hinweis.color,
            marginBottom: '3px',
            textTransform: 'uppercase',
            letterSpacing: '0.03em',
          }}>
            {hinweis.label}
          </div>
          <div style={{
            fontSize: '9px',
            color: '#334155',
            lineHeight: '1.5',
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
export default function DossierLegende({ entries, snapshot }) {
  // Filtere Hinweise basierend auf Bedingungen
  const visibleHinweise = Object.values(HINWEISE_CONFIG).filter(hinweis => {
    if (hinweis.alwaysShow) return true;
    if (hinweis.condition && entries) {
      return hinweis.condition(entries);
    }
    return false;
  });

  return (
    <div style={{
      borderTop: '3px solid #1e3a5f',
      paddingTop: '14px',
      marginTop: '16px',
    }}>
      {/* Header */}
      <div style={{
        fontSize: '12px',
        fontWeight: 800,
        color: '#1e3a5f',
        marginBottom: '10px',
        display: 'flex',
        alignItems: 'center',
        gap: '6px',
        letterSpacing: '-0.01em',
      }}>
        <FileText style={{ width: '14px', height: '14px' }} />
        <span>Hinweise &amp; Berechnungsgrundlagen</span>
      </div>

      {/* Grid-Layout für bessere Lesbarkeit */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: '1fr',
        gap: '8px',
      }}>
        {visibleHinweise.map(hinweis => (
          <HinweisBox key={hinweis.key} hinweis={hinweis} />
        ))}
      </div>

      {/* Footer mit Erstellungsdatum */}
      <div style={{
        marginTop: '12px',
        paddingTop: '8px',
        borderTop: '1px solid #e2e8f0',
        fontSize: '8px',
        color: '#94a3b8',
        textAlign: 'center',
      }}>
        Swiss Premium Broker · {fmtDate(snapshot?.snapshot_created_at)} · v{snapshot?.dossier?.version ?? 1}
      </div>
    </div>
  );
}