/**
 * DossierAiUpload — Phase 5.4
 * KI-gestützte Offerten-/Policenanalyse via LLM.
 * STRENG ISOLIERT:
 *   - Kein direktes Speichern ohne Benutzerbestätigung
 *   - Kein Write auf CRM-Entities
 *   - Nur Write auf ComparisonEntry nach expliziter Bestätigung
 *   - Confidence-Werte pro Feld sichtbar
 *   - Unsichere Felder (confidence < 0.7) visuell markiert
 *
 * Sicherheits-Guards:
 *   - Max. Dateigrösse: 10 MB
 *   - Nur PDF/Bild-Formate
 *   - Rate-Limit: 1 Analyse gleichzeitig
 */
import React, { useState, useRef } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Upload, Sparkles, AlertTriangle, Check, X, Info, Loader2, FileText } from 'lucide-react';

const MAX_FILE_SIZE_MB = 10;
const ALLOWED_TYPES = ['application/pdf', 'image/png', 'image/jpeg', 'image/jpg', 'image/webp'];

const SECTION_OPTIONS = [
  { value: 'grundversicherung', label: 'Grundversicherung (KVG)' },
  { value: 'zusatzversicherung', label: 'Zusatzversicherung (VVG)' },
];

// ── Confidence-Anzeige ────────────────────────────────────────────────────────
function ConfidenceBadge({ confidence }) {
  if (confidence == null) return null;
  const pct = Math.round(confidence * 100);
  const cls =
    pct >= 85 ? 'bg-emerald-50 text-emerald-700 border-emerald-200' :
    pct >= 65 ? 'bg-amber-50 text-amber-700 border-amber-200' :
                'bg-red-50 text-red-700 border-red-200';
  return (
    <span className={`text-[9px] font-semibold border px-1.5 py-0.5 rounded-full ml-1.5 ${cls}`}>
      {pct}%
    </span>
  );
}

// ── Einzelnes editierbares Feld mit Confidence ────────────────────────────────
function AiField({ label, fieldKey, value, confidence, type = 'text', options, onChange }) {
  const isLowConf = confidence != null && confidence < 0.7;
  const inputCls = `w-full border rounded-md px-3 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-ring
    ${isLowConf ? 'border-amber-300 bg-amber-50/50 focus:ring-amber-400' : 'border-input bg-background'}`;

  return (
    <div>
      <label className="flex items-center text-[10px] text-muted-foreground mb-0.5 uppercase tracking-wide">
        {label}
        <ConfidenceBadge confidence={confidence} />
        {isLowConf && (
          <span className="ml-1.5 text-amber-600 flex items-center gap-0.5">
            <AlertTriangle className="w-2.5 h-2.5" />
            <span className="text-[9px]">Bitte prüfen</span>
          </span>
        )}
      </label>
      {options ? (
        <select className={inputCls} value={value || ''} onChange={e => onChange(fieldKey, e.target.value)}>
          {options.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
        </select>
      ) : (
        <input
          className={inputCls}
          type={type}
          value={value ?? ''}
          onChange={e => onChange(fieldKey, e.target.value)}
        />
      )}
    </div>
  );
}

// ── KI-Extraktions-Prompt ─────────────────────────────────────────────────────
const EXTRACTION_SCHEMA = {
  type: 'object',
  properties: {
    gesellschaft:      { type: 'string', description: 'Versicherungsgesellschaft / Anbieter' },
    product_name:      { type: 'string', description: 'Produktname oder Tarifbezeichnung' },
    praemie_monatlich: { type: 'number', description: 'Monatliche Prämie in CHF (Zahl ohne Einheit)' },
    praemie_jaehrlich: { type: 'number', description: 'Jährliche Prämie in CHF (Zahl ohne Einheit)' },
    franchise:         { type: 'number', description: 'Franchise in CHF (Zahl)' },
    modell:            { type: 'string', description: 'Versicherungsmodell z.B. HMO, HAM, Standard, TelFirst' },
    deckung_details:   { type: 'string', description: 'Deckungsdetails, Leistungsumfang kurz beschrieben' },
    section:           { type: 'string', enum: ['grundversicherung', 'zusatzversicherung'], description: 'KVG = grundversicherung, VVG/Zusatz = zusatzversicherung' },
    confidence: {
      type: 'object',
      description: 'Extraktions-Konfidenz pro Feld (0.0–1.0)',
      properties: {
        gesellschaft:      { type: 'number' },
        product_name:      { type: 'number' },
        praemie_monatlich: { type: 'number' },
        franchise:         { type: 'number' },
        modell:            { type: 'number' },
        deckung_details:   { type: 'number' },
        section:           { type: 'number' },
      },
    },
  },
};

const EXTRACTION_PROMPT = `
Du bist ein Schweizer Versicherungsexperte. Analysiere das folgende Dokument (Offerte, Police oder Vergleich).

Extrahiere folgende Felder in strukturierter Form:
- Versicherungsgesellschaft (z.B. SWICA, Helsana, CSS, Concordia, KPT, Sanitas, etc.)
- Produktname / Tarifbezeichnung
- Monatliche Prämie in CHF (reine Zahl, kein Text)
- Jährliche Prämie in CHF (falls vorhanden)
- Franchise in CHF (z.B. 300, 500, 1000, 1500, 2000, 2500)
- Versicherungsmodell (HMO, HAM, Standard, TelFirst, Medbase, etc.)
- Deckungsdetails / Leistungsumfang (max. 80 Zeichen)
- Ob es KVG Grundversicherung (grundversicherung) oder VVG Zusatzversicherung (zusatzversicherung) ist

Gib pro extrahiertem Feld einen Konfidenzwert zwischen 0.0 (sehr unsicher) und 1.0 (sehr sicher) an.
Wenn ein Feld nicht gefunden wird, verwende null.
Antworte NUR mit dem JSON-Objekt, ohne zusätzlichen Text.
`;

// ── Hauptkomponente ───────────────────────────────────────────────────────────
export default function DossierAiUpload({ dossierId, personName, onEntryAdded, onClose }) {
  const [file, setFile] = useState(null);
  const [fileError, setFileError] = useState('');
  const [aiResult, setAiResult] = useState(null); // { fields, confidence }
  const [editedResult, setEditedResult] = useState(null);
  const [section, setSection] = useState('grundversicherung');
  const [step, setStep] = useState('upload'); // 'upload' | 'analyzing' | 'review' | 'saving'
  const fileInputRef = useRef();
  const qc = useQueryClient();

  const analyzeMutation = useMutation({
    mutationFn: async (uploadedFile) => {
      // 1. Datei hochladen
      const { file_url } = await base44.integrations.Core.UploadFile({ file: uploadedFile });
      // 2. LLM-Analyse
      const result = await base44.integrations.Core.InvokeLLM({
        prompt: EXTRACTION_PROMPT,
        file_urls: [file_url],
        response_json_schema: EXTRACTION_SCHEMA,
        model: 'claude_sonnet_4_6', // Hochwertigeres Modell für Dokument-Extraktion
      });
      return result;
    },
    onSuccess: (data) => {
      setAiResult(data);
      // Monatsprämie: direkt oder aus Jahrsprämie berechnen
      const praemie = data.praemie_monatlich ?? (data.praemie_jaehrlich ? Math.round(data.praemie_jaehrlich / 12 * 100) / 100 : '');
      setEditedResult({
        gesellschaft:      data.gesellschaft || '',
        product_name:      data.product_name || '',
        praemie_monatlich: praemie,
        franchise:         data.franchise || '',
        modell:            data.modell || '',
        deckung_details:   data.deckung_details || '',
        section:           data.section || section,
        is_current:        false,
        is_recommended:    false,
        leistungs_score:   '',
      });
      if (data.section) setSection(data.section);
      setStep('review');
    },
    onError: () => {
      setStep('upload');
    },
  });

  const saveMutation = useMutation({
    mutationFn: (data) => base44.entities.ComparisonEntry.create(data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['dossier_comparison', dossierId] });
      if (onEntryAdded) onEntryAdded();
      onClose();
    },
  });

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

  const handleAnalyze = () => {
    if (!file) return;
    setStep('analyzing');
    analyzeMutation.mutate(file);
  };

  const handleFieldChange = (key, val) => {
    setEditedResult(r => ({ ...r, [key]: val }));
  };

  const handleSave = () => {
    setStep('saving');
    saveMutation.mutate({
      dossier_id:        dossierId,
      person_name:       personName,
      section:           editedResult.section,
      gesellschaft:      editedResult.gesellschaft,
      product_name:      editedResult.product_name || null,
      praemie_monatlich: editedResult.praemie_monatlich !== '' ? Number(editedResult.praemie_monatlich) : null,
      franchise:         editedResult.franchise !== '' ? Number(editedResult.franchise) : null,
      modell:            editedResult.modell || null,
      deckung_details:   editedResult.deckung_details || null,
      leistungs_score:   editedResult.leistungs_score !== '' ? Number(editedResult.leistungs_score) : null,
      is_current:        editedResult.is_current,
      is_recommended:    editedResult.is_recommended,
    });
  };

  const conf = aiResult?.confidence || {};
  const lowConfFields = Object.entries(conf).filter(([, v]) => v != null && v < 0.7).length;

  return (
    <div className="border border-primary/20 bg-primary/5 rounded-xl p-5 space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-lg bg-primary/10 flex items-center justify-center">
            <Sparkles className="w-3.5 h-3.5 text-primary" />
          </div>
          <div>
            <h3 className="text-sm font-semibold text-foreground">KI-Offerten-Analyse</h3>
            <p className="text-[10px] text-muted-foreground">Für: {personName}</p>
          </div>
        </div>
        <button onClick={onClose} className="p-1.5 hover:bg-muted rounded-lg transition-colors">
          <X className="w-4 h-4 text-muted-foreground" />
        </button>
      </div>

      {/* Sicherheitshinweis */}
      <div className="flex items-start gap-2 text-xs bg-amber-50 border border-amber-200 text-amber-800 rounded-lg px-3 py-2">
        <Info className="w-3.5 h-3.5 shrink-0 mt-0.5" />
        <span>KI-Daten werden <strong>niemals automatisch gespeichert</strong>. Jedes Feld kann vor der Übernahme geprüft und korrigiert werden.</span>
      </div>

      {/* ── Step: Upload ── */}
      {step === 'upload' && (
        <div className="space-y-4">
          <div>
            <label className="block text-xs font-medium text-muted-foreground mb-1.5">
              Abschnitt
            </label>
            <div className="flex gap-2">
              {SECTION_OPTIONS.map(o => (
                <button
                  key={o.value}
                  type="button"
                  onClick={() => setSection(o.value)}
                  className={`flex-1 text-xs font-medium py-2 px-3 rounded-lg border transition-colors
                    ${section === o.value ? 'bg-primary text-primary-foreground border-primary' : 'border-border text-muted-foreground hover:bg-muted'}`}
                >
                  {o.label}
                </button>
              ))}
            </div>
          </div>

          <div
            onClick={() => fileInputRef.current?.click()}
            className={`border-2 border-dashed rounded-xl p-8 text-center cursor-pointer transition-colors
              ${file ? 'border-primary/40 bg-primary/5' : 'border-border hover:border-primary/40 hover:bg-muted/30'}`}
          >
            <input
              ref={fileInputRef}
              type="file"
              className="hidden"
              accept=".pdf,image/png,image/jpeg,image/jpg,image/webp"
              onChange={e => handleFileChange(e.target.files?.[0])}
            />
            {file ? (
              <div className="flex items-center justify-center gap-2">
                <FileText className="w-5 h-5 text-primary" />
                <span className="text-sm font-medium text-foreground">{file.name}</span>
                <span className="text-xs text-muted-foreground">({(file.size / 1024 / 1024).toFixed(1)} MB)</span>
              </div>
            ) : (
              <>
                <Upload className="w-8 h-8 mx-auto mb-2 text-muted-foreground/60" />
                <p className="text-sm text-muted-foreground">PDF oder Bild hochladen</p>
                <p className="text-xs text-muted-foreground/70 mt-1">Max. {MAX_FILE_SIZE_MB} MB · PDF, PNG, JPG, WEBP</p>
              </>
            )}
          </div>

          {fileError && (
            <p className="text-xs text-destructive flex items-center gap-1.5">
              <AlertTriangle className="w-3 h-3" />
              {fileError}
            </p>
          )}

          <button
            onClick={handleAnalyze}
            disabled={!file || !!fileError}
            className="w-full flex items-center justify-center gap-2 py-2.5 bg-primary text-primary-foreground text-sm font-medium rounded-lg hover:bg-primary/90 transition-colors disabled:opacity-50"
          >
            <Sparkles className="w-4 h-4" />
            KI-Analyse starten
          </button>
        </div>
      )}

      {/* ── Step: Analyzing ── */}
      {step === 'analyzing' && (
        <div className="flex flex-col items-center justify-center py-10 gap-4">
          <Loader2 className="w-8 h-8 text-primary animate-spin" />
          <div className="text-center">
            <p className="text-sm font-medium text-foreground">Dokument wird analysiert…</p>
            <p className="text-xs text-muted-foreground mt-1">KI extrahiert Versicherungsdaten. Dies kann 10–30 Sekunden dauern.</p>
          </div>
        </div>
      )}

      {/* ── Step: Review ── */}
      {step === 'review' && editedResult && (
        <div className="space-y-4">
          {/* Confidence-Warnung */}
          {lowConfFields > 0 && (
            <div className="flex items-center gap-2 text-xs bg-amber-50 border border-amber-200 text-amber-800 rounded-lg px-3 py-2">
              <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
              <span>{lowConfFields} Feld{lowConfFields !== 1 ? 'er' : ''} mit niedriger KI-Konfidenz — bitte vor dem Speichern prüfen.</span>
            </div>
          )}

          <p className="text-xs font-semibold text-foreground">
            KI-Extraktion — Bitte alle Felder prüfen und ggf. korrigieren:
          </p>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <AiField label="Abschnitt" fieldKey="section" value={editedResult.section} confidence={conf.section}
              options={SECTION_OPTIONS} onChange={handleFieldChange} />
            <AiField label="Gesellschaft *" fieldKey="gesellschaft" value={editedResult.gesellschaft} confidence={conf.gesellschaft}
              onChange={handleFieldChange} />
            <AiField label="Produkt" fieldKey="product_name" value={editedResult.product_name} confidence={conf.product_name}
              onChange={handleFieldChange} />
            <AiField label="Prämie/Mt. (CHF)" fieldKey="praemie_monatlich" type="number" value={editedResult.praemie_monatlich}
              confidence={conf.praemie_monatlich} onChange={handleFieldChange} />
            <AiField label="Franchise (CHF)" fieldKey="franchise" type="number" value={editedResult.franchise}
              confidence={conf.franchise} onChange={handleFieldChange} />
            <AiField label="Modell" fieldKey="modell" value={editedResult.modell} confidence={conf.modell}
              onChange={handleFieldChange} />
            <div className="sm:col-span-2">
              <AiField label="Deckungsdetails" fieldKey="deckung_details" value={editedResult.deckung_details}
                confidence={conf.deckung_details} onChange={handleFieldChange} />
            </div>
            <AiField label="Leistungsbewertung (1–6, optional)" fieldKey="leistungs_score" type="number"
              value={editedResult.leistungs_score} onChange={handleFieldChange} />
          </div>

          <div className="flex items-center gap-4 text-xs">
            <label className="flex items-center gap-1.5 cursor-pointer">
              <input type="checkbox" checked={editedResult.is_current}
                onChange={e => handleFieldChange('is_current', e.target.checked)} />
              Aktuelle Police
            </label>
            <label className="flex items-center gap-1.5 cursor-pointer">
              <input type="checkbox" checked={editedResult.is_recommended}
                onChange={e => handleFieldChange('is_recommended', e.target.checked)} />
              Als Empfehlung markieren
            </label>
          </div>

          <div className="flex gap-2 pt-2 border-t border-border/60">
            <button
              onClick={handleSave}
              disabled={!editedResult.gesellschaft || saveMutation.isPending}
              className="flex items-center gap-1.5 px-4 py-2 bg-primary text-primary-foreground text-xs font-medium rounded-lg hover:bg-primary/90 transition-colors disabled:opacity-50"
            >
              <Check className="w-3 h-3" />
              {saveMutation.isPending ? 'Speichern…' : 'Geprüft — Eintrag speichern'}
            </button>
            <button
              onClick={() => { setStep('upload'); setFile(null); setAiResult(null); }}
              className="px-4 py-2 border border-border text-xs font-medium rounded-lg hover:bg-muted transition-colors"
            >
              Neu analysieren
            </button>
            <button onClick={onClose}
              className="px-4 py-2 border border-border text-xs font-medium rounded-lg hover:bg-muted transition-colors">
              Abbrechen
            </button>
          </div>
        </div>
      )}
    </div>
  );
}