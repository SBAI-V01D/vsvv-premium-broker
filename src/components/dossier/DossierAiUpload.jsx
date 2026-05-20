/**
 * DossierAiUpload — Phase B
 *
 * Vollständige Upload-Session-Pipeline:
 *   Upload → Analyse → Vorschau → Korrektur → Bestätigung → Persistierung
 *
 * Sicherheits-Prinzipien (unveränderlich):
 *   - Kein direktes Speichern ohne explizite Benutzerbestätigung
 *   - Kein Write auf CRM-Entities
 *   - Alle KI-Daten sind initial als "ungeprüft" markiert
 *   - Jedes Feld einzeln editierbar vor der Übernahme
 *   - Nur Write auf ComparisonEntry nach Bestätigung
 *
 * Phase B+C Erweiterungen:
 *   - Multi-Produkt-Extraktion (mehrere Produkte pro Dokument)
 *   - Personen-Erkennung aus Dokument
 *   - Gruppen-Logik: KVG + VVG pro Gesamtlösung
 *   - Erweitertes Confidence-System (rot/amber/grün)
 *   - Gesamttotal-Berechnung pro Person
 *   - [Phase C] Korrektur-Tracking & Qualitätsmessung
 *   - [Phase C] Schnellkorrektur-Modus: unsichere Felder zuerst
 *   - [Phase C] Anonymisiertes Feedback-Logging via aiCorrectionLogger
 */
import React, { useState, useRef, useMemo } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import {
  Upload, Sparkles, AlertTriangle, Check, X,
  Loader2, FileText, ChevronDown, ChevronUp, Shield,
  User, RefreshCw, CheckCircle, AlertCircle, Eye, Zap
} from 'lucide-react';
import { detectCorrections, logCorrections, sessionQualityScore } from '@/lib/aiCorrectionLogger';

// ── Konstanten ────────────────────────────────────────────────────────────────
const MAX_FILE_SIZE_MB = 10;
const ALLOWED_TYPES = ['application/pdf', 'image/png', 'image/jpeg', 'image/jpg', 'image/webp'];

const GRUPPE_OPTIONS = [
  { value: 'aktuelle_loesung', label: 'Aktuelle Lösung' },
  { value: 'optimiert',        label: 'Optimiert' },
  { value: 'angebot_1',        label: 'Angebot 1' },
  { value: 'angebot_2',        label: 'Angebot 2' },
  { value: 'angebot_3',        label: 'Angebot 3' },
  { value: 'manuell',          label: 'Ohne Gruppe' },
];

// ── Confidence-Hilfsfunktionen ─────────────────────────────────────────────
function confLevel(v) {
  if (v == null) return 'unknown';
  if (v >= 0.82) return 'high';
  if (v >= 0.60) return 'medium';
  return 'low';
}

function ConfidencePill({ confidence }) {
  if (confidence == null) return null;
  const level = confLevel(confidence);
  const pct = Math.round(confidence * 100);
  const cfg = {
    high:    { cls: 'bg-emerald-50 text-emerald-700 border-emerald-200', icon: '✓' },
    medium:  { cls: 'bg-amber-50 text-amber-700 border-amber-200', icon: '?' },
    low:     { cls: 'bg-red-50 text-red-700 border-red-200', icon: '!' },
    unknown: { cls: 'bg-slate-100 text-slate-500 border-slate-200', icon: '–' },
  }[level];
  return (
    <span className={`inline-flex items-center gap-0.5 text-[9px] font-bold border px-1.5 py-0.5 rounded-full ${cfg.cls}`}>
      {cfg.icon} {pct}%
    </span>
  );
}

function ConfidenceBar({ confidence }) {
  if (confidence == null) return null;
  const level = confLevel(confidence);
  const pct = Math.round(confidence * 100);
  const barCls = level === 'high' ? 'bg-emerald-500' : level === 'medium' ? 'bg-amber-400' : 'bg-red-400';
  return (
    <div className="flex items-center gap-1.5 mt-0.5">
      <div className="flex-1 h-1 bg-muted rounded-full overflow-hidden">
        <div className={`h-full rounded-full transition-all ${barCls}`} style={{ width: `${pct}%` }} />
      </div>
      <span className={`text-[9px] font-medium ${level === 'high' ? 'text-emerald-600' : level === 'medium' ? 'text-amber-600' : 'text-red-600'}`}>
        {pct}%
      </span>
    </div>
  );
}

// ── Editierbares KI-Feld ──────────────────────────────────────────────────────
function AiField({ label, fieldKey, value, confidence, type = 'text', options, onChange, required }) {
  const level = confLevel(confidence);
  const borderCls =
    level === 'low'     ? 'border-red-300 bg-red-50/40' :
    level === 'medium'  ? 'border-amber-300 bg-amber-50/30' :
                          'border-input bg-background';
  const inputCls = `w-full border rounded-md px-3 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-ring ${borderCls}`;

  return (
    <div>
      <div className="flex items-center gap-1.5 mb-0.5">
        <label className="text-[10px] text-muted-foreground uppercase tracking-wide font-medium">
          {label}{required && ' *'}
        </label>
        <ConfidencePill confidence={confidence} />
        {level === 'low' && (
          <span className="text-[9px] text-red-600 flex items-center gap-0.5">
            <AlertCircle className="w-2.5 h-2.5" /> Bitte prüfen
          </span>
        )}
        {level === 'medium' && (
          <span className="text-[9px] text-amber-600 flex items-center gap-0.5">
            <Eye className="w-2.5 h-2.5" /> Überprüfen
          </span>
        )}
      </div>
      {options ? (
        <select className={inputCls} value={value || ''} onChange={e => onChange(fieldKey, e.target.value)}>
          {options.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
        </select>
      ) : (
        <input className={inputCls} type={type} value={value ?? ''} step={type === 'number' ? '0.05' : undefined}
          onChange={e => onChange(fieldKey, e.target.value)} />
      )}
      {confidence != null && <ConfidenceBar confidence={confidence} />}
    </div>
  );
}

// ── Konfidenz-Zusammenfassung ─────────────────────────────────────────────────
function ConfidenceSummary({ products }) {
  const allConfs = products.flatMap(p =>
    Object.values(p.confidence || {}).filter(v => v != null)
  );
  if (allConfs.length === 0) return null;
  const avg = allConfs.reduce((a, b) => a + b, 0) / allConfs.length;
  const lowCount = allConfs.filter(v => v < 0.60).length;
  const medCount = allConfs.filter(v => v >= 0.60 && v < 0.82).length;
  const highCount = allConfs.filter(v => v >= 0.82).length;
  const level = confLevel(avg);

  return (
    <div className={`rounded-lg border px-4 py-3 flex items-center gap-4 flex-wrap text-xs
      ${level === 'high' ? 'bg-emerald-50 border-emerald-200 text-emerald-800' :
        level === 'medium' ? 'bg-amber-50 border-amber-200 text-amber-800' :
        'bg-red-50 border-red-200 text-red-800'}`}>
      <div className="flex items-center gap-1.5 font-semibold">
        {level === 'high' ? <CheckCircle className="w-3.5 h-3.5" /> : <AlertTriangle className="w-3.5 h-3.5" />}
        Gesamt-Konfidenz: {Math.round(avg * 100)}%
      </div>
      <div className="flex items-center gap-3 text-[10px]">
        {highCount > 0 && <span className="text-emerald-700">✓ {highCount} sicher</span>}
        {medCount > 0  && <span className="text-amber-700">? {medCount} prüfen</span>}
        {lowCount > 0  && <span className="text-red-700">! {lowCount} unsicher</span>}
      </div>
      {lowCount > 0 && (
        <span className="text-[10px] font-medium">
          Bitte rot markierte Felder vor dem Speichern korrigieren.
        </span>
      )}
    </div>
  );
}

// ── Produktkarte im Review ────────────────────────────────────────────────────
function ProductReviewCard({ product, index, personName, onChange, onRemove, knownPersons }) {
  const [expanded, setExpanded] = useState(true);
  const conf = product.confidence || {};
  const totalMonthly = product.praemie_monatlich ? Number(product.praemie_monatlich) : null;

  const handleChange = (key, val) => onChange(index, key, val);

  // Unsichere Felder zählen für Schnellkorrektur-Hinweis
  const lowConfFields = Object.entries(conf).filter(([, v]) => v != null && v < 0.60);
  const medConfFields = Object.entries(conf).filter(([, v]) => v != null && v >= 0.60 && v < 0.82);

  return (
    <div className={`border rounded-xl overflow-hidden transition-shadow
      ${product.section === 'grundversicherung' ? 'border-blue-200' : 'border-violet-200'}`}>
      {/* Kartenheader */}
      <div
        className={`flex items-center justify-between px-4 py-2.5 cursor-pointer
          ${product.section === 'grundversicherung' ? 'bg-blue-50' : 'bg-violet-50'}`}
        onClick={() => setExpanded(e => !e)}
      >
        <div className="flex items-center gap-2 flex-wrap">
          <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border
            ${product.section === 'grundversicherung'
              ? 'bg-blue-100 text-blue-700 border-blue-200'
              : 'bg-violet-100 text-violet-700 border-violet-200'}`}>
            {product.section === 'grundversicherung' ? 'KVG' : 'VVG'}
          </span>
          <span className="text-sm font-semibold text-foreground">
            {product.gesellschaft || <span className="text-muted-foreground italic">Gesellschaft ausfüllen</span>}
          </span>
          {product.product_name && (
            <span className="text-xs text-muted-foreground">{product.product_name}</span>
          )}
          {totalMonthly && (
            <span className="text-xs font-bold text-foreground">
              CHF {Number(totalMonthly).toLocaleString('de-CH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}/Mt.
            </span>
          )}
          <ConfidencePill confidence={
            Object.values(conf).filter(v => v != null).length > 0
              ? Object.values(conf).filter(v => v != null).reduce((a, b) => a + b, 0) /
                Object.values(conf).filter(v => v != null).length
              : null
          } />
          {/* Schnellkorrektur-Hinweis */}
          {lowConfFields.length > 0 && (
            <span className="flex items-center gap-0.5 text-[9px] font-bold text-red-700 bg-red-50 border border-red-200 px-1.5 py-0.5 rounded-full">
              <Zap className="w-2.5 h-2.5" />
              {lowConfFields.length} unsicher
            </span>
          )}
          {lowConfFields.length === 0 && medConfFields.length > 0 && (
            <span className="flex items-center gap-0.5 text-[9px] font-semibold text-amber-700 bg-amber-50 border border-amber-200 px-1.5 py-0.5 rounded-full">
              <Eye className="w-2.5 h-2.5" />
              {medConfFields.length} prüfen
            </span>
          )}
        </div>
        <div className="flex items-center gap-2">
          <button type="button" onClick={e => { e.stopPropagation(); onRemove(index); }}
            className="p-1 text-muted-foreground hover:text-destructive rounded transition-colors">
            <X className="w-3.5 h-3.5" />
          </button>
          {expanded ? <ChevronUp className="w-4 h-4 text-muted-foreground" /> : <ChevronDown className="w-4 h-4 text-muted-foreground" />}
        </div>
      </div>

      {expanded && (
        <div className="p-4 space-y-4 bg-card">
          {/* Person & Gruppe */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-[10px] text-muted-foreground uppercase tracking-wide mb-0.5">Person</label>
              {knownPersons.length > 0 ? (
                <select
                  className="w-full border border-input rounded-md px-3 py-1.5 text-sm bg-background focus:outline-none focus:ring-1 focus:ring-ring"
                  value={product.person_name || personName}
                  onChange={e => handleChange('person_name', e.target.value)}
                >
                  {knownPersons.map(p => <option key={p} value={p}>{p}</option>)}
                  <option value="__other">Andere Person…</option>
                </select>
              ) : (
                <input
                  className="w-full border border-input rounded-md px-3 py-1.5 text-sm bg-background focus:outline-none focus:ring-1 focus:ring-ring"
                  value={product.person_name || personName}
                  onChange={e => handleChange('person_name', e.target.value)}
                />
              )}
            </div>
            <div>
              <label className="block text-[10px] text-muted-foreground uppercase tracking-wide mb-0.5">Gruppe</label>
              <select
                className="w-full border border-input rounded-md px-3 py-1.5 text-sm bg-background focus:outline-none focus:ring-1 focus:ring-ring"
                value={product.gruppe || 'manuell'}
                onChange={e => handleChange('gruppe', e.target.value)}
              >
                {GRUPPE_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
              </select>
            </div>
          </div>

          {/* Hauptfelder */}
          <div className="grid grid-cols-2 gap-3">
            <AiField label="Abschnitt" fieldKey="section" value={product.section} confidence={conf.section}
              options={[
                { value: 'grundversicherung', label: 'Grundversicherung (KVG)' },
                { value: 'zusatzversicherung', label: 'Zusatzversicherung (VVG)' },
              ]}
              onChange={handleChange} />
            <AiField label="Gesellschaft" fieldKey="gesellschaft" value={product.gesellschaft}
              confidence={conf.gesellschaft} onChange={handleChange} required />
            <AiField label="Produkt / Tarif" fieldKey="product_name" value={product.product_name}
              confidence={conf.product_name} onChange={handleChange} />
            <AiField label="Prämie/Mt. (CHF)" fieldKey="praemie_monatlich" type="number"
              value={product.praemie_monatlich} confidence={conf.praemie_monatlich} onChange={handleChange} />
            <AiField label="Franchise (CHF)" fieldKey="franchise" type="number"
              value={product.franchise} confidence={conf.franchise} onChange={handleChange} />
            <AiField label="Modell" fieldKey="modell" value={product.modell}
              confidence={conf.modell} onChange={handleChange} />
            <div className="col-span-2">
              <AiField label="Deckungsdetails" fieldKey="deckung_details" value={product.deckung_details}
                confidence={conf.deckung_details} onChange={handleChange} />
            </div>
          </div>

          {/* Flags */}
          <div className="flex items-center gap-4 text-xs">
            <label className="flex items-center gap-1.5 cursor-pointer">
              <input type="checkbox" checked={product.is_current || false}
                onChange={e => handleChange('is_current', e.target.checked)} />
              Aktuelle Police
            </label>
          </div>
        </div>
      )}
    </div>
  );
}

// ── Gesamttotal pro Person ────────────────────────────────────────────────────
function PersonTotal({ products, personName }) {
  const personProds = products.filter(p => (p.person_name || '') === personName);
  const total = personProds.reduce((sum, p) => sum + (p.praemie_monatlich ? Number(p.praemie_monatlich) : 0), 0);
  if (total === 0) return null;
  return (
    <div className="flex items-center justify-between text-xs px-3 py-2 bg-muted/50 rounded-lg border border-border/60">
      <div className="flex items-center gap-2">
        <User className="w-3.5 h-3.5 text-muted-foreground" />
        <span className="font-medium text-foreground">{personName}</span>
        <span className="text-muted-foreground">· {personProds.length} Produkt{personProds.length !== 1 ? 'e' : ''}</span>
      </div>
      <span className="font-bold text-foreground">
        Σ CHF {total.toLocaleString('de-CH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}/Mt.
        <span className="font-normal text-muted-foreground ml-1">
          (CHF {(total * 12).toLocaleString('de-CH', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}/Jahr)
        </span>
      </span>
    </div>
  );
}

// ── KI-Extraktions-Schema (Phase B+: Groupe-Mutuel-kompatibel) ───────────────
const EXTRACTION_SCHEMA = {
  type: 'object',
  properties: {
    document_type: {
      type: 'string',
      enum: ['police', 'offerte', 'vergleich', 'unbekannt'],
      description: 'Dokumenttyp',
    },
    detected_persons: {
      type: 'array',
      description: 'Erkannte Personen im Dokument (Versicherungsnehmer, mitversicherte)',
      items: { type: 'string' },
    },
    insurer_name: {
      type: 'string',
      description: 'Hauptversicherer des Dokuments (z.B. "Groupe Mutuel")',
    },
    total_monthly_premium: {
      type: 'number',
      description: 'Gesamtmonatsprämie laut Dokument (nach Rabatten)',
    },
    discount_amount: {
      type: 'number',
      description: 'Rabattbetrag/Monat falls erkennbar',
    },
    products: {
      type: 'array',
      description: 'ALLE erkannten Versicherungsprodukte — jede Zeile/Block ist ein separates Produkt',
      items: {
        type: 'object',
        properties: {
          gesellschaft:      { type: 'string', description: 'Versicherungsgesellschaft' },
          product_name:      { type: 'string', description: 'Exakter Produktname aus dem Dokument' },
          section:           { type: 'string', enum: ['grundversicherung', 'zusatzversicherung'] },
          praemie_monatlich: { type: 'number', description: 'Monatsprämie CHF (nur Zahl)' },
          praemie_jaehrlich: { type: 'number', description: 'Jahresprämie CHF falls angegeben' },
          franchise:         { type: 'number', description: 'Franchise CHF (nur für KVG relevant)' },
          modell:            { type: 'string', description: 'Versicherungsmodell (HMO, HAM, Standard, TelFirst, SanaTel, etc.)' },
          deckung_details:   { type: 'string', description: 'Kurzbeschreibung Deckung max 120 Zeichen' },
          person_name:       { type: 'string', description: 'Versicherte Person falls erkennbar' },
          is_current:        { type: 'boolean', description: 'true = bestehende Police, false = Offerte' },
          confidence: {
            type: 'object',
            properties: {
              gesellschaft:      { type: 'number' },
              product_name:      { type: 'number' },
              section:           { type: 'number' },
              praemie_monatlich: { type: 'number' },
              franchise:         { type: 'number' },
              modell:            { type: 'number' },
              deckung_details:   { type: 'number' },
              person_name:       { type: 'number' },
            },
          },
        },
      },
    },
    extraction_notes: {
      type: 'string',
      description: 'Hinweise zur Extraktion: was war klar, was war unsicher, welche Seiten wurden berücksichtigt',
    },
    partial_extraction: {
      type: 'boolean',
      description: 'true wenn nur Teile des Dokuments erkannt wurden (trotzdem alle gefundenen Produkte zurückgeben)',
    },
  },
};

const EXTRACTION_PROMPT = `
Du bist ein erfahrener Schweizer Versicherungsberater. Analysiere das GESAMTE mehrseitige Dokument (alle Seiten) und extrahiere JEDES Versicherungsprodukt als separaten Eintrag.

═══════════════════════════════════════════════════════
GROUPE MUTUEL POLICE-STRUKTUR (häufiges Format):
═══════════════════════════════════════════════════════
Groupe Mutuel Policen sind typischerweise so aufgebaut:

SEITE 1: "Versicherungsausweis" (KVG-Teil)
  → Überschrift: "Versicherungen gemäss Bundesgesetz über die Krankenversicherung (KVG)"
  → section: "grundversicherung"
  → Produkte haben 2-Buchstaben-Code + Name, z.B.:
    "RT  SanaTel - obligatorische Krankenpflegeversicherung   433.00"
    "RF  SanaFlex..."  "RS  SanaStart..."
  → "Monatlicher Abzug" = Rabatt/Abzug (KEIN Produkt, in discount_amount)
  → "Monatsprämie der Versicherungen gemäss KVG" = KVG-Subtotal (KEIN Produkt)

SEITE 2+: "Versicherungspolice" (VVG-Teil)
  → Überschrift: "Versicherungen gemäss Bundesgesetz über den Versicherungsvertrag (VVG)"
  → section: "zusatzversicherung" (WICHTIG!)
  → Produkte mit 2-Buchstaben-Code + Name:
    "BH  Taggeldversicherung bei Spitalaufenthalt   20.00"
    "GO  Global smart - Zusatzversicherung ...   28.20"
    "KH  H-Capital - Kapitalversicherung ...   22.00"
    "MU  Mundo - Zusatzversicherung für Auslandreisen   3.50"
    "SP  Supra..." "HO  Hospi..." "CO  Complementa..." "DE  Denta..."
  → "Ihr Kombinationsrabatt" = Rabatt (KEIN Produkt, in discount_amount)
  → "Monatsprämie der Versicherungen gemäss VVG" = VVG-Subtotal (KEIN Produkt)

LETZTE SEITE: Zusammenfassung
  → "Monatsprämie zu Ihren Lasten" = GESAMTTOTAL → total_monthly_premium
  → "Kombinationsrabatt" = Gesamtrabatt → discount_amount

═══════════════════════════════════════════════════════
ANDERE VERSICHERER (CSS, Helsana, SWICA, Sanitas, etc.)
═══════════════════════════════════════════════════════
KVG (section: "grundversicherung"): Standard, HMO, HAM, Hausarzt, TelFirst, Medbase, Callmed, flexmed
  → Produkte mit "Grundversicherung", "KVG", "obligatorisch" im Namen
VVG (section: "zusatzversicherung"): Spital allg./halbprivat/privat, Ambulant, Dental, Komplementär, Reise, Taggeld, Global, Ausland
  → Produkte mit "Zusatzversicherung", "VVG", "Spital", "Ambulant", "Dental", "Taggeld", "Reise" im Namen
  → ALLE Produkte die NICHT explizit "Grundversicherung" oder "KVG" sind = zusatzversicherung

═══════════════════════════════════════════════════════
EXTRAKTIONSREGELN
═══════════════════════════════════════════════════════
1. JEDER Produktblock = 1 separater Eintrag im products-Array
2. section: "grundversicherung" NUR für KVG (obligatorische Grundversicherung), "zusatzversicherung" für ALLE VVG-Produkte
   → Wenn Produkt "Grundversicherung" oder "KVG" oder "obligatorisch" enthält = grundversicherung
   → Wenn Produkt "Zusatzversicherung", "VVG", "Spital", "Ambulant", "Dental", "Taggeld", "Reise", "Global", "H-Capital", "Mundo" enthält = zusatzversicherung
   → Im ZWEIFEL: lieber "zusatzversicherung" (VVG ist der häufigere Fall bei Zusatzprodukten)
3. gesellschaft: Hauptversicherer (z.B. "Groupe Mutuel", "CSS", "Helsana")
4. product_name: Exakter Produktname (z.B. "SanaTel", "Global Smart", "H-Capital", "Mundo", "Taggeldversicherung bei Spitalaufenthalt")
5. praemie_monatlich: CHF-Betrag rechts neben dem Produktnamen (nur Zahl, z.B. 433.00)
6. franchise: Nur KVG — aus "Jahresfranchise von CHF X" (z.B. 2500)
7. modell: z.B. "SanaTel" = Telmed-Modell, "SanaFlex" = freie Arztwahl, "HMO" etc.
8. is_current: true (Police = bestehende Versicherung)
9. Prämien-Abzüge / Totale / Rabatte: NICHT als Produkt — in total_monthly_premium / discount_amount
10. Falls Feld nicht lesbar: null (NIE Platzhalterwert)

═══════════════════════════════════════════════════════
KONFIDENZ (für jedes Feld 0.0–1.0)
═══════════════════════════════════════════════════════
1.00: Zahl/Text exakt im Dokument lesbar
0.80–0.99: Aus Kontext klar ableitbar
0.60–0.79: Wahrscheinlich korrekt, Berater sollte prüfen
0.00–0.59: Unsicher oder nicht im Dokument

═══════════════════════════════════════════════════════
FEHLERTOLERANZ
═══════════════════════════════════════════════════════
- Alle erkennbaren Produkte IMMER zurückgeben (partial_extraction: true wenn unvollständig)
- NIEMALS leeres products-Array wenn irgendein Produkt erkennbar ist
- extraction_notes: Was erkannt / was unklar war

Antworte NUR mit dem JSON-Objekt.
`;

// ── Schritt-Indikator ─────────────────────────────────────────────────────────
const STEPS = [
  { key: 'upload',    label: 'Upload' },
  { key: 'analyzing', label: 'Analyse' },
  { key: 'review',   label: 'Vorschau' },
  { key: 'confirm',  label: 'Bestätigung' },
];

function StepBar({ step }) {
  const idx = STEPS.findIndex(s => s.key === step);
  return (
    <div className="flex items-center gap-0">
      {STEPS.filter(s => s.key !== 'analyzing').map((s, i) => {
        const displayIdx = ['upload', 'review', 'confirm'].indexOf(s.key);
        const currentDisplayIdx = ['upload', 'review', 'confirm'].indexOf(
          step === 'analyzing' ? 'upload' : step
        );
        const done = displayIdx < currentDisplayIdx;
        const active = displayIdx === currentDisplayIdx;
        return (
          <React.Fragment key={s.key}>
            {i > 0 && (
              <div className={`flex-1 h-0.5 mx-1 ${done ? 'bg-primary' : 'bg-border'}`} />
            )}
            <div className={`flex items-center gap-1 text-[10px] font-semibold px-2 py-1 rounded-full transition-colors
              ${active ? 'bg-primary text-primary-foreground' :
                done ? 'bg-primary/15 text-primary' :
                'bg-muted text-muted-foreground'}`}>
              {done ? <Check className="w-2.5 h-2.5" /> : null}
              {s.label}
            </div>
          </React.Fragment>
        );
      })}
    </div>
  );
}

// ── Hauptkomponente ───────────────────────────────────────────────────────────
export default function DossierAiUpload({ dossierId, personName, onEntryAdded, onClose, knownPersons = [] }) {
  const [file, setFile] = useState(null);
  const [fileError, setFileError] = useState('');
  const [step, setStep] = useState('upload');
  const [sessionProducts, setSessionProducts] = useState([]); // temporäre Session
  const [detectedPersons, setDetectedPersons] = useState([]);
  const [documentType, setDocumentType] = useState('');
  const [extractionNotes, setExtractionNotes] = useState('');
  const [defaultGruppe, setDefaultGruppe] = useState('aktuelle_loesung');
  const [confirmedCount, setConfirmedCount] = useState(0);
  const [originalProducts, setOriginalProducts] = useState([]); // Phase C: Korrektur-Tracking
  const fileInputRef = useRef();
  const qc = useQueryClient();

  const allPersons = [...new Set([...knownPersons, ...detectedPersons, personName].filter(Boolean))];

  // ── Analyse ────────────────────────────────────────────────────────────────
  const analyzeMutation = useMutation({
    mutationFn: async (uploadedFile) => {
      const { file_url } = await base44.integrations.Core.UploadFile({ file: uploadedFile });
      return base44.integrations.Core.InvokeLLM({
        prompt: EXTRACTION_PROMPT,
        file_urls: [file_url],
        response_json_schema: EXTRACTION_SCHEMA,
        model: 'claude_sonnet_4_6',
      });
    },
    onSuccess: (rawData) => {
      // InvokeLLM wraps the result in { response: { ... } } — unwrap it
      const data = rawData?.response ?? rawData ?? {};

      setDocumentType(data.document_type || 'unbekannt');
      setDetectedPersons(data.detected_persons || []);
      // Notizen inkl. partial_extraction-Warnung
      const notes = [
        data.extraction_notes,
        data.partial_extraction ? '⚠️ Teilextraktion: Nicht alle Seiten konnten vollständig analysiert werden. Bitte Produkte manuell prüfen.' : null,
        data.total_monthly_premium ? `Gesamtprämie laut Dokument: CHF ${data.total_monthly_premium.toLocaleString('de-CH', { minimumFractionDigits: 2 })}/Mt.` : null,
        data.discount_amount ? `Rabatt berücksichtigt: CHF ${data.discount_amount.toLocaleString('de-CH', { minimumFractionDigits: 2 })}/Mt.` : null,
      ].filter(Boolean).join(' · ');
      setExtractionNotes(notes);

      // insurer_name als Fallback für gesellschaft
      const insurerFallback = data.insurer_name || '';

      const products = (data.products || []).map((p, i) => {
        // Confidence-Objekt normalisieren — Schema gibt entweder p.confidence{} oder flache conf_*-Felder
        const conf = p.confidence && typeof p.confidence === 'object' ? p.confidence : {
          gesellschaft:      p.conf_product ?? null,
          product_name:      p.conf_product ?? null,
          section:           p.conf_section ?? null,
          praemie_monatlich: p.conf_praemie ?? null,
          franchise:         null,
          modell:            null,
          deckung_details:   null,
          person_name:       null,
        };
        return {
          ...p,
          // Monatsprämie ableiten wenn nur Jahresprämie
          praemie_monatlich: p.praemie_monatlich ?? (p.praemie_jaehrlich ? Math.round(p.praemie_jaehrlich / 12 * 100) / 100 : null),
          // Gesellschaft-Fallback auf Dokumentversicherer
          gesellschaft: p.gesellschaft || insurerFallback || '',
          // section-Fallback
          section: p.section || 'grundversicherung',
          // Standardwerte
          person_name: p.person_name || personName,
          gruppe: p.is_current !== false ? 'aktuelle_loesung' : defaultGruppe,
          gruppe_label: '',
          confidence: conf,
          _session_id: `session_${Date.now()}_${i}`,
          _verified: false,
        };
      });

      setSessionProducts(products);
      setOriginalProducts(JSON.parse(JSON.stringify(products)));
      setStep('review');
    },
    onError: (err) => {
      setExtractionNotes(`Fehler bei der Analyse: ${err?.message || 'Unbekannter Fehler'}. Bitte erneut versuchen.`);
      setStep('upload');
    },
  });

  // ── Persistierung ─────────────────────────────────────────────────────────
  const saveMutation = useMutation({
    mutationFn: async (products) => {
      const results = [];
      for (const p of products) {
        const entry = await base44.entities.ComparisonEntry.create({
          dossier_id:        dossierId,
          person_name:       p.person_name || personName,
          section:           p.section || 'grundversicherung',
          gruppe:            p.gruppe || 'manuell',
          gruppe_label:      p.gruppe_label || null,
          gesellschaft:      p.gesellschaft,
          product_name:      p.product_name || null,
          praemie_monatlich: p.praemie_monatlich != null ? Number(p.praemie_monatlich) : null,
          franchise:         p.franchise != null ? Number(p.franchise) : null,
          modell:            p.modell || null,
          deckung_details:   p.deckung_details || null,
          is_current:        p.is_current || false,
          is_recommended:    false,
          ai_extracted:      true,
          ai_confidence:     p.confidence
            ? (Object.values(p.confidence).filter(v => v != null).reduce((a, b) => a + b, 0) /
               Object.values(p.confidence).filter(v => v != null).length) || null
            : null,
          ai_source_document: file?.name || null,
          manually_verified:  true, // Benutzer hat explizit bestätigt
        });
        results.push(entry);
      }
      return results;
    },
    onSuccess: (results) => {
      setConfirmedCount(results.length);
      qc.invalidateQueries({ queryKey: ['dossier_comparison', dossierId] });
      setStep('confirm');
    },
  });

  // ── File-Handling ─────────────────────────────────────────────────────────
  const handleFileChange = (f) => {
    setFileError('');
    if (!f) return;
    if (!ALLOWED_TYPES.includes(f.type)) {
      setFileError('Nur PDF oder Bild-Dateien erlaubt (PDF, PNG, JPG, WEBP).');
      return;
    }
    if (f.size > MAX_FILE_SIZE_MB * 1024 * 1024) {
      setFileError(`Datei zu gross. Maximum: ${MAX_FILE_SIZE_MB} MB.`);
      return;
    }
    setFile(f);
  };

  const handleProductChange = (index, key, val) => {
    setSessionProducts(ps => ps.map((p, i) => i === index ? { ...p, [key]: val } : p));
  };

  const handleRemoveProduct = (index) => {
    setSessionProducts(ps => ps.filter((_, i) => i !== index));
  };

  const handleSave = () => {
    const valid = sessionProducts.filter(p => p.gesellschaft && p.gesellschaft.trim());
    if (valid.length === 0) return;

    // Phase C: Korrekturen erkennen und anonymisiert loggen
    const allCorrections = valid.flatMap((editedProduct, i) => {
      const original = originalProducts[i] || {};
      return detectCorrections(original, editedProduct);
    });
    logCorrections(allCorrections, file?.name, valid.length);

    saveMutation.mutate(valid);
  };

  // Phase C: Qualitätsscore der aktuellen Session
  const qualityScore = useMemo(() => {
    if (sessionProducts.length === 0 || originalProducts.length === 0) return null;
    const corrections = sessionProducts.flatMap((p, i) =>
      detectCorrections(originalProducts[i] || {}, p)
    );
    return sessionQualityScore(sessionProducts, corrections);
  }, [sessionProducts, originalProducts]);

  // Personen aus Session ableiten
  const sessionPersons = [...new Set(sessionProducts.map(p => p.person_name || personName).filter(Boolean))];

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <div className="border border-violet-200 bg-violet-50/30 rounded-xl overflow-hidden">

      {/* Header */}
      <div className="flex items-center justify-between px-5 py-3 bg-violet-50 border-b border-violet-200">
        <div className="flex items-center gap-2.5">
          <div className="w-7 h-7 rounded-lg bg-violet-100 flex items-center justify-center">
            <Sparkles className="w-3.5 h-3.5 text-violet-700" />
          </div>
          <div>
            <h3 className="text-sm font-semibold text-foreground">KI-Dokumentenanalyse</h3>
            <p className="text-[10px] text-violet-600">Phase B — Multi-Produkt-Extraktion</p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <StepBar step={step} />
          <button onClick={onClose} className="p-1.5 hover:bg-violet-100 rounded-lg transition-colors">
            <X className="w-4 h-4 text-muted-foreground" />
          </button>
        </div>
      </div>

      <div className="p-5 space-y-4">

        {/* Sicherheitshinweis */}
        <div className="flex items-start gap-2 text-xs bg-slate-50 border border-slate-200 text-slate-700 rounded-lg px-3 py-2">
          <Shield className="w-3.5 h-3.5 shrink-0 mt-0.5 text-slate-500" />
          <span>
            KI-Daten werden <strong>niemals automatisch gespeichert</strong>.
            Jedes Feld kann vor der Übernahme geprüft und korrigiert werden.
            Nur nach expliziter Bestätigung wird in ComparisonEntry geschrieben.
          </span>
        </div>

        {/* ── Step: Upload ──────────────────────────────────────────────── */}
        {step === 'upload' && (
          <div className="space-y-4">
            {/* Gruppe Vorauswahl */}
            <div>
              <label className="block text-xs font-medium text-muted-foreground mb-1.5">
                Zu welcher Vergleichsgruppe gehören die extrahierten Daten?
              </label>
              <div className="grid grid-cols-3 gap-2">
                {GRUPPE_OPTIONS.slice(0, 5).map(o => (
                  <button key={o.value} type="button" onClick={() => setDefaultGruppe(o.value)}
                    className={`text-xs font-medium py-2 px-3 rounded-lg border transition-colors
                      ${defaultGruppe === o.value
                        ? 'bg-primary text-primary-foreground border-primary'
                        : 'border-border text-muted-foreground hover:bg-muted'}`}>
                    {o.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Drop-Zone */}
            <div
              onDragOver={e => e.preventDefault()}
              onDrop={e => { e.preventDefault(); handleFileChange(e.dataTransfer.files?.[0]); }}
              onClick={() => fileInputRef.current?.click()}
              className={`border-2 border-dashed rounded-xl p-8 text-center cursor-pointer transition-colors
                ${file ? 'border-violet-400 bg-violet-50' : 'border-border hover:border-violet-300 hover:bg-violet-50/30'}`}
            >
              <input ref={fileInputRef} type="file" className="hidden"
                accept=".pdf,image/png,image/jpeg,image/jpg,image/webp"
                onChange={e => handleFileChange(e.target.files?.[0])} />
              {file ? (
                <div className="flex items-center justify-center gap-2">
                  <FileText className="w-5 h-5 text-violet-600" />
                  <span className="text-sm font-medium text-foreground">{file.name}</span>
                  <span className="text-xs text-muted-foreground">({(file.size / 1024 / 1024).toFixed(1)} MB)</span>
                </div>
              ) : (
                <>
                  <Upload className="w-8 h-8 mx-auto mb-2 text-muted-foreground/50" />
                  <p className="text-sm text-muted-foreground">PDF oder Bild hierher ziehen oder klicken</p>
                  <p className="text-xs text-muted-foreground/60 mt-1">Max. {MAX_FILE_SIZE_MB} MB · PDF, PNG, JPG, WEBP</p>
                </>
              )}
            </div>

            {fileError && (
              <p className="text-xs text-destructive flex items-center gap-1.5">
                <AlertTriangle className="w-3 h-3" /> {fileError}
              </p>
            )}

            <button onClick={() => { setStep('analyzing'); analyzeMutation.mutate(file); }}
              disabled={!file || !!fileError}
              className="w-full flex items-center justify-center gap-2 py-2.5 bg-violet-600 text-white text-sm font-medium rounded-lg hover:bg-violet-700 transition-colors disabled:opacity-50">
              <Sparkles className="w-4 h-4" />
              KI-Analyse starten
            </button>
          </div>
        )}

        {/* ── Step: Analyzing ───────────────────────────────────────────── */}
        {step === 'analyzing' && (
          <div className="flex flex-col items-center justify-center py-12 gap-4">
            <div className="relative">
              <Loader2 className="w-10 h-10 text-violet-500 animate-spin" />
              <Sparkles className="w-4 h-4 text-violet-600 absolute -top-1 -right-1" />
            </div>
            <div className="text-center">
              <p className="text-sm font-semibold text-foreground">Dokument wird analysiert…</p>
              <p className="text-xs text-muted-foreground mt-1">
                KI extrahiert alle Versicherungsprodukte, Personen und Prämien.
              </p>
              <p className="text-xs text-muted-foreground/60 mt-0.5">Dauert 15–40 Sekunden.</p>
            </div>
          </div>
        )}

        {/* ── Step: Review ──────────────────────────────────────────────── */}
        {step === 'review' && (
          <div className="space-y-4">
            {/* Dokument-Info */}
            <div className="flex items-center gap-4 flex-wrap text-xs bg-muted/50 border border-border/60 rounded-lg px-3 py-2">
              <div className="flex items-center gap-1.5">
                <FileText className="w-3.5 h-3.5 text-muted-foreground" />
                <span className="font-medium text-foreground">{file?.name}</span>
              </div>
              {documentType && (
                <span className="bg-slate-100 text-slate-700 border border-slate-200 px-2 py-0.5 rounded-full text-[10px] font-semibold uppercase">
                  {documentType}
                </span>
              )}
              {detectedPersons.length > 0 && (
                <div className="flex items-center gap-1 text-muted-foreground">
                  <User className="w-3 h-3" />
                  {detectedPersons.join(', ')}
                </div>
              )}
              <span className="text-muted-foreground">{sessionProducts.length} Produkt{sessionProducts.length !== 1 ? 'e' : ''} erkannt</span>
            </div>

            {extractionNotes && (
              <div className="text-xs text-muted-foreground bg-muted/30 rounded-lg px-3 py-2 border border-border/40">
                <strong>KI-Hinweis:</strong> {extractionNotes}
              </div>
            )}

            {/* Konfidenz-Zusammenfassung + Session-Qualität */}
            <ConfidenceSummary products={sessionProducts} />

            {/* Phase C: Session-Qualitätsscore */}
            {qualityScore != null && (
              <div className={`flex items-center gap-3 text-xs px-3 py-2 rounded-lg border
                ${qualityScore >= 75 ? 'bg-emerald-50 border-emerald-200 text-emerald-800' :
                  qualityScore >= 45 ? 'bg-amber-50 border-amber-200 text-amber-800' :
                  'bg-red-50 border-red-200 text-red-800'}`}>
                <Zap className="w-3.5 h-3.5 shrink-0" />
                <span>
                  <strong>Extraktionsqualität: {qualityScore}/100</strong>
                  {qualityScore >= 75 && ' — Hohe Qualität, wenige Korrekturen erwartet'}
                  {qualityScore >= 45 && qualityScore < 75 && ' — Mittlere Qualität, gelb/rot markierte Felder prüfen'}
                  {qualityScore < 45 && ' — Niedrige Qualität, bitte alle Felder sorgfältig prüfen'}
                </span>
              </div>
            )}

            {/* Gesamttotale pro Person */}
            {sessionPersons.length > 0 && (
              <div className="space-y-1.5">
                <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wide">Gesamttotal pro Person</p>
                {sessionPersons.map(p => (
                  <PersonTotal key={p} products={sessionProducts} personName={p} />
                ))}
              </div>
            )}

            {/* Produkt-Karten */}
            {sessionProducts.length === 0 ? (
              <div className="rounded-xl border border-amber-200 bg-amber-50 p-6 space-y-3">
                <div className="flex items-center gap-2 text-amber-800 font-semibold text-sm">
                  <AlertTriangle className="w-4 h-4 shrink-0" />
                  Keine Produkte automatisch erkannt
                </div>
                <p className="text-xs text-amber-700">
                  Die KI konnte in diesem Dokument keine strukturierten Versicherungsprodukte identifizieren.
                  Mögliche Ursachen: Sehr komprimiertes PDF, Scan-Qualität, ungewöhnliches Dokumentformat.
                </p>
                <div className="flex gap-2 flex-wrap">
                  <button
                    onClick={() => { setStep('upload'); setFile(null); setSessionProducts([]); setExtractionNotes(''); }}
                    className="flex items-center gap-1.5 px-3 py-1.5 bg-amber-700 text-white text-xs font-medium rounded-lg hover:bg-amber-800 transition-colors"
                  >
                    <RefreshCw className="w-3 h-3" />
                    Erneut analysieren
                  </button>
                  <button
                    onClick={onClose}
                    className="px-3 py-1.5 border border-amber-300 text-amber-800 text-xs font-medium rounded-lg hover:bg-amber-100 transition-colors"
                  >
                    Manuell erfassen
                  </button>
                </div>
              </div>
            ) : (
              <div className="space-y-3">
                <p className="text-xs font-semibold text-foreground">
                  Extrahierte Produkte — <span className="text-muted-foreground font-normal">Alle Felder prüfen und ggf. korrigieren:</span>
                </p>
                {sessionProducts.map((p, i) => (
                  <ProductReviewCard
                    key={p._session_id || i}
                    product={p}
                    index={i}
                    personName={personName}
                    knownPersons={allPersons}
                    onChange={handleProductChange}
                    onRemove={handleRemoveProduct}
                  />
                ))}
              </div>
            )}

            {/* Aktionsbuttons */}
            <div className="flex items-center gap-2 pt-3 border-t border-border/60 flex-wrap">
              <button
                onClick={handleSave}
                disabled={sessionProducts.filter(p => p.gesellschaft?.trim()).length === 0 || saveMutation.isPending}
                className="flex items-center gap-1.5 px-4 py-2 bg-emerald-600 text-white text-xs font-semibold rounded-lg hover:bg-emerald-700 transition-colors disabled:opacity-50"
              >
                <Check className="w-3.5 h-3.5" />
                {saveMutation.isPending
                  ? 'Wird gespeichert…'
                  : `${sessionProducts.filter(p => p.gesellschaft?.trim()).length} Einträge speichern`}
              </button>
              <button
                onClick={() => { setStep('upload'); setFile(null); setSessionProducts([]); }}
                className="flex items-center gap-1.5 px-3 py-2 border border-border text-xs font-medium rounded-lg hover:bg-muted transition-colors"
              >
                <RefreshCw className="w-3.5 h-3.5" />
                Neu analysieren
              </button>
              <button onClick={onClose}
                className="px-3 py-2 border border-border text-xs font-medium rounded-lg hover:bg-muted transition-colors">
                Abbrechen
              </button>
            </div>
          </div>
        )}

        {/* ── Step: Confirm (Erfolg) ────────────────────────────────────── */}
        {step === 'confirm' && (
          <div className="flex flex-col items-center justify-center py-8 gap-4 text-center">
            <div className="w-12 h-12 rounded-full bg-emerald-50 border-2 border-emerald-200 flex items-center justify-center">
              <CheckCircle className="w-6 h-6 text-emerald-600" />
            </div>
            <div>
              <p className="text-sm font-semibold text-foreground">
                {confirmedCount} Einträge gespeichert
              </p>
              <p className="text-xs text-muted-foreground mt-1">
                Alle Daten wurden von Ihnen geprüft und im Dossier-Vergleich gespeichert.
              </p>
              {qualityScore != null && (
                <p className={`text-xs mt-1.5 font-medium
                  ${qualityScore >= 75 ? 'text-emerald-600' : qualityScore >= 45 ? 'text-amber-600' : 'text-red-600'}`}>
                  Extraktionsqualität dieser Session: {qualityScore}/100
                </p>
              )}
            </div>
            <button
              onClick={onClose}
              className="px-5 py-2 bg-primary text-primary-foreground text-xs font-semibold rounded-lg hover:bg-primary/90 transition-colors"
            >
              Fertig
            </button>
          </div>
        )}

      </div>
    </div>
  );
}