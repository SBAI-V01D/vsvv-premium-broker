import { jsPDF } from 'jspdf';

// ── Hilfsfunktionen ────────────────────────────────────────────────────────

function checkPage(doc, y, needed, pageH) {
  if (y + needed > pageH - 20) { doc.addPage(); return 22; }
  return y;
}

function sectionHeader(doc, title, y, pageH, margin) {
  y = checkPage(doc, y, 14, pageH);
  doc.setFillColor(30, 58, 100);
  doc.rect(margin, y, 170, 8, 'F');
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(9.5);
  doc.setFont('helvetica', 'bold');
  doc.text(title.toUpperCase(), margin + 3, y + 5.5);
  doc.setTextColor(30, 30, 30);
  doc.setFont('helvetica', 'normal');
  return y + 12;
}

function subHeader(doc, title, y, pageH, margin) {
  y = checkPage(doc, y, 10, pageH);
  doc.setFillColor(59, 130, 246);
  doc.rect(margin, y, 170, 6.5, 'F');
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(8.5);
  doc.setFont('helvetica', 'bold');
  doc.text(title, margin + 3, y + 4.5);
  doc.setTextColor(30, 30, 30);
  doc.setFont('helvetica', 'normal');
  return y + 10;
}

function addRow(doc, label, value, y, pageH, margin, isEven) {
  const val = (value != null && value !== '' && value !== false) ? String(value) : '—';
  const lines = doc.splitTextToSize(val, 88);
  const rowH = Math.max(8, lines.length * 5);
  y = checkPage(doc, y, rowH, pageH);
  if (isEven) {
    doc.setFillColor(246, 249, 255);
    doc.rect(margin, y - 4, 170, rowH, 'F');
  }
  doc.setFontSize(8.5);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(80, 80, 100);
  doc.text(String(label), margin + 2, y);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(20, 20, 20);
  doc.text(lines, margin + 82, y);
  return y + rowH;
}

function addCheckRow(doc, label, checked, y, pageH, margin, isEven) {
  y = checkPage(doc, y, 7, pageH);
  if (isEven) {
    doc.setFillColor(246, 249, 255);
    doc.rect(margin, y - 3.5, 170, 7, 'F');
  }
  doc.setDrawColor(100, 120, 180);
  doc.setFillColor(checked ? 59 : 255, checked ? 130 : 255, checked ? 246 : 255);
  doc.roundedRect(margin + 2, y - 3, 4.5, 4.5, 0.8, 0.8, checked ? 'FD' : 'D');
  if (checked) {
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(6);
    doc.text('X', margin + 3.2, y + 0.8);
  }
  doc.setFontSize(8.5);
  doc.setFont('helvetica', checked ? 'bold' : 'normal');
  doc.setTextColor(checked ? 20 : 140, checked ? 20 : 140, checked ? 20 : 140);
  doc.text(label, margin + 10, y);
  doc.setTextColor(30, 30, 30);
  doc.setFont('helvetica', 'normal');
  return y + 7;
}

function groupedChecks(doc, items, checkedSet, y, pageH, margin) {
  // 2-Spalten Checkbox-Layout
  for (let r = 0; r < Math.ceil(items.length / 2); r++) {
    y = checkPage(doc, y, 7, pageH);
    const left = items[r * 2];
    const right = items[r * 2 + 1];
    const isEvenRow = r % 2 === 0;
    if (isEvenRow) {
      doc.setFillColor(246, 249, 255);
      doc.rect(margin, y - 3.5, 170, 7, 'F');
    }
    if (left) {
      const checked = checkedSet.has(left[0]);
      doc.setDrawColor(100, 120, 180);
      doc.setFillColor(checked ? 59 : 255, checked ? 130 : 255, checked ? 246 : 255);
      doc.roundedRect(margin + 2, y - 3, 4.5, 4.5, 0.8, 0.8, checked ? 'FD' : 'D');
      if (checked) { doc.setTextColor(255,255,255); doc.setFontSize(6); doc.text('X', margin + 3.2, y + 0.8); }
      doc.setFontSize(8.5);
      doc.setFont('helvetica', checked ? 'bold' : 'normal');
      doc.setTextColor(checked ? 20 : 140, 20, checked ? 20 : 140);
      doc.text(left[1], margin + 10, y);
    }
    if (right) {
      const checked = checkedSet.has(right[0]);
      doc.setDrawColor(100, 120, 180);
      doc.setFillColor(checked ? 59 : 255, checked ? 130 : 255, checked ? 246 : 255);
      doc.roundedRect(margin + 88, y - 3, 4.5, 4.5, 0.8, 0.8, checked ? 'FD' : 'D');
      if (checked) { doc.setTextColor(255,255,255); doc.setFontSize(6); doc.text('X', margin + 89.2, y + 0.8); }
      doc.setFontSize(8.5);
      doc.setFont('helvetica', checked ? 'bold' : 'normal');
      doc.setTextColor(checked ? 20 : 140, 20, checked ? 20 : 140);
      doc.text(right[1], margin + 96, y);
    }
    doc.setTextColor(30,30,30); doc.setFont('helvetica','normal');
    y += 7;
  }
  return y;
}

function addNote(doc, text, y, pageH, margin) {
  y = checkPage(doc, y, 7, pageH);
  doc.setFontSize(8);
  doc.setFont('helvetica', 'italic');
  doc.setTextColor(100, 100, 130);
  doc.text(text, margin + 10, y);
  doc.setTextColor(30, 30, 30);
  doc.setFont('helvetica', 'normal');
  return y + 6;
}

function labelLine(doc, text, y, pageH, margin) {
  y = checkPage(doc, y, 7, pageH);
  doc.setFontSize(8.5);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(59, 130, 246);
  doc.text(text, margin + 2, y);
  doc.setTextColor(30, 30, 30);
  doc.setFont('helvetica', 'normal');
  return y + 6;
}

// ── Deckungsbezeichnungen ─────────────────────────────────────────────────

const DECKUNG_LABELS = {
  haftpflicht: 'Haftpflicht',
  teilkasko: 'Teilkasko',
  vollkasko: 'Vollkasko',
  parkschaden: 'Parkschaden',
  unfallinsassen: 'Unfallinsassen',
  pannenhilfe: 'Pannenhilfe / Assistance',
  verkehrsrechtsschutz: 'Verkehrsrechtsschutz',
  grobfahrlaessigkeitsschutz: 'Grobfahrlässigkeitsschutz',
};

const HP_SUMMEN = { '50mio': 'CHF 50 Mio.', '100mio': 'CHF 100 Mio.', '200mio': 'CHF 200 Mio.' };

const TK_DECKUNGEN = [
  ['diebstahl','Diebstahl'], ['feuer','Feuer'], ['elementar','Elementarschäden'],
  ['marder','Marderschäden'], ['tiere','Kollision mit Tieren'], ['vandalismus','Vandalismus'],
  ['schluessel','Schlüsselverlust'], ['mitsachen','Mitgeführte Sachen'],
  ['glas','Glasbruch'], // legacy
  ['ladekabel','Ladekabel (E-Fahrzeuge)'], ['wallbox','Wallbox'],
];

const VK_OPTIONEN = [
  ['bonusschutz','Bonusschutz'], ['neuwert','Neuwertentschädigung'],
  ['kaufwert','Kaufwertentschädigung'], ['gap','GAP-Deckung Leasing'],
  ['grobfahrlaessigkeit','Grobfahrlässigkeit'],
  // mitsachen war früher hier, jetzt unter TK — ignorieren
];

const PH_LEISTUNGEN = [
  ['weiterfahrt','Weiterfahrt organisieren'], ['ruecktransport','Rücktransport Fahrzeug'],
  ['ersatzfahrzeug','Ersatzfahrzeug'], ['hotel','Hotelkosten'],
  ['bergung','Fahrzeugbergung'], ['rueckfuehrung','Fahrzeugrückführung'], ['heimreise','Heimreise'],
];

const UI_STANDARD = [
  ['heilung','Heilungskosten'], ['taggeld','Taggeld'],
  ['invaliditaet','Invalidität'], ['todesfall','Todesfall'],
];
const UI_PLUS = [
  ['kapital','Erweiterte Kapitalleistungen'],
  ['invaliditaet_hoch','Höhere Invaliditätssummen'],
  ['weltweit','Weltweite Deckung'],
];

const VR_BEREICHE = [
  ['fahrzeug','Fahrzeugrechtsschutz'], ['fuehrerausweis','Führerausweisverfahren'],
  ['strafrecht','Strafrechtsschutz Verkehr'], ['vertragsrecht','Vertragsrechtsschutz Fahrzeug'],
  ['europa','Europa Deckung'], ['weltweit','Weltweite Deckung'],
];

// ── Motorfahrzeug Deckungen rendern ───────────────────────────────────────

function renderMFZDeckungen(doc, d, y, pageH, margin) {
  const deckungen = new Set(d.deckungen || []);

  // Falls keine strukturierten Deckungen → Fallback auf Legacy-Felder
  if (deckungen.size === 0 && d.deckung_gewuenscht) {
    y = addRow(doc, 'Gewünschte Deckung', d.deckung_gewuenscht, y, pageH, margin, true);
    if (d.selbstbehalt_kasko) y = addRow(doc, 'Selbstbehalt Kasko', d.selbstbehalt_kasko, y, pageH, margin, false);
    if (d.assistance) y = addRow(doc, 'Pannenhilfe', d.assistance, y, pageH, margin, true);
    if (d.insassen) y = addRow(doc, 'Insassenunfall', d.insassen, y, pageH, margin, false);
    return y;
  }

  if (deckungen.size === 0) {
    return addNote(doc, 'Keine Deckungen ausgewählt.', y, pageH, margin);
  }

  // Übersicht gewählter Deckungen
  y = checkPage(doc, y, 10, pageH);
  doc.setFontSize(8.5);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(30, 58, 100);
  doc.text('Gewählte Deckungen:', margin + 2, y); y += 5;
  const deckungNames = [...deckungen].map(k => DECKUNG_LABELS[k] || k).join('  ·  ');
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(20, 20, 20);
  const dLines = doc.splitTextToSize(deckungNames, 165);
  y = checkPage(doc, y, dLines.length * 5 + 4, pageH);
  doc.text(dLines, margin + 2, y);
  y += dLines.length * 5 + 8;

  // ── Haftpflicht ──────────────────────────────────────────────────────
  if (deckungen.has('haftpflicht')) {
    y = subHeader(doc, 'Haftpflicht', y, pageH, margin);
    let i = 0;
    y = addRow(doc, 'Versicherungssumme', HP_SUMMEN[d.hp_summe] || d.hp_summe || '—', y, pageH, margin, i++ % 2 === 0);
    y = addRow(doc, 'Bonus-Schutz', d.hp_bonusschutz ? 'Ja' : 'Nein', y, pageH, margin, i++ % 2 === 0);
    y = addRow(doc, 'Grobfahrlässigkeitsschutz', d.hp_grobfahrlaessigkeit ? 'Ja' : 'Nein', y, pageH, margin, i++ % 2 === 0);
    y += 4;
  }

  // ── Teilkasko ────────────────────────────────────────────────────────
  if (deckungen.has('teilkasko')) {
    y = subHeader(doc, 'Teilkasko', y, pageH, margin);
    let i = 0;
    y = addRow(doc, 'Selbstbehalt', d.tk_selbstbehalt || '—', y, pageH, margin, i++ % 2 === 0);
    // Glasbruch: aus tk_glas (neu) oder glas in tk_deckungen (legacy)
    const glasbruch = d.tk_glas || ((d.tk_deckungen || []).includes('glas') ? 'Standard' : null);
    if (glasbruch) y = addRow(doc, 'Glasbruch', glasbruch, y, pageH, margin, i++ % 2 === 0);

    y = labelLine(doc, 'Deckungen:', y, pageH, margin);
    const tkSet = new Set(d.tk_deckungen || []);
    y = groupedChecks(doc, TK_DECKUNGEN.filter(([k]) => k !== 'glas'), tkSet, y, pageH, margin);
    y += 4;
  }

  // ── Vollkasko ────────────────────────────────────────────────────────
  if (deckungen.has('vollkasko')) {
    y = subHeader(doc, 'Vollkasko', y, pageH, margin);
    let i = 0;
    y = addRow(doc, 'Selbstbehalt Kollisionsschäden', d.vk_selbstbehalt || d.selbstbehalt_kasko || '—', y, pageH, margin, i++ % 2 === 0);
    y = labelLine(doc, 'Zusatzoptionen:', y, pageH, margin);
    const vkSet = new Set(d.vk_optionen || []);
    VK_OPTIONEN.forEach(([k, label], idx) => {
      y = addCheckRow(doc, label, vkSet.has(k), y, pageH, margin, idx % 2 === 0);
    });
    y += 4;
  }

  // ── Parkschaden ───────────────────────────────────────────────────────
  if (deckungen.has('parkschaden')) {
    y = subHeader(doc, 'Parkschaden', y, pageH, margin);
    const variante = d.ps_variante || '—';
    let i = 0;
    y = addRow(doc, 'Variante', variante, y, pageH, margin, i++ % 2 === 0);
    if (d.ps_variante) {
      y = addNote(doc, d.ps_variante === 'Standard' ? '2 Ereignisse pro Jahr' : 'Unbeschränkte Ereignisse · Erweiterte Deckung', y, pageH, margin);
    }
    y += 2;
  }

  // ── Unfallinsassen ────────────────────────────────────────────────────
  if (deckungen.has('unfallinsassen')) {
    y = subHeader(doc, 'Unfallinsassen', y, pageH, margin);
    // Legacy: insassen-Feld
    if (!d.ui_variante && d.insassen) {
      y = addRow(doc, 'Insassenunfall', d.insassen, y, pageH, margin, true);
    } else {
      let i = 0;
      y = addRow(doc, 'Variante', d.ui_variante || '—', y, pageH, margin, i++ % 2 === 0);
      if (d.ui_deckungen && d.ui_deckungen.length > 0) {
        y = labelLine(doc, 'Leistungen:', y, pageH, margin);
        const uiSet = new Set(d.ui_deckungen);
        const uiItems = d.ui_variante === 'Plus' ? UI_PLUS : UI_STANDARD;
        uiItems.forEach(([k, label], idx) => {
          y = addCheckRow(doc, label, uiSet.has(k), y, pageH, margin, idx % 2 === 0);
        });
      }
    }
    y += 4;
  }

  // ── Pannenhilfe ───────────────────────────────────────────────────────
  if (deckungen.has('pannenhilfe')) {
    y = subHeader(doc, 'Pannenhilfe / Assistance', y, pageH, margin);
    // Legacy
    if (!d.ph_gebiet && d.assistance) {
      y = addRow(doc, 'Pannenhilfe', d.assistance, y, pageH, margin, true);
    } else {
      let i = 0;
      y = addRow(doc, 'Deckungsgebiet', d.ph_gebiet || '—', y, pageH, margin, i++ % 2 === 0);
      if (d.ph_leistungen && d.ph_leistungen.length > 0) {
        y = labelLine(doc, 'Leistungen:', y, pageH, margin);
        const phSet = new Set(d.ph_leistungen);
        PH_LEISTUNGEN.forEach(([k, label], idx) => {
          y = addCheckRow(doc, label, phSet.has(k), y, pageH, margin, idx % 2 === 0);
        });
      }
    }
    y += 4;
  }

  // ── Verkehrsrechtsschutz ──────────────────────────────────────────────
  if (deckungen.has('verkehrsrechtsschutz')) {
    y = subHeader(doc, 'Verkehrsrechtsschutz', y, pageH, margin);
    let i = 0;
    y = addRow(doc, 'Deckungsumfang', d.vr_umfang || '—', y, pageH, margin, i++ % 2 === 0);
    if (d.vr_bereiche && d.vr_bereiche.length > 0) {
      y = labelLine(doc, 'Bereiche:', y, pageH, margin);
      const vrSet = new Set(d.vr_bereiche);
      VR_BEREICHE.forEach(([k, label], idx) => {
        y = addCheckRow(doc, label, vrSet.has(k), y, pageH, margin, idx % 2 === 0);
      });
    }
    y += 4;
  }

  // ── Grobfahrlässigkeitsschutz ─────────────────────────────────────────
  if (deckungen.has('grobfahrlaessigkeitsschutz')) {
    y = subHeader(doc, 'Grobfahrlässigkeitsschutz', y, pageH, margin);
    y = addNote(doc, 'Grobfahrlässigkeitsschutz gewünscht — bitte in Offerte ausweisen.', y, pageH, margin);
    y += 4;
  }

  return y;
}

// ── Motorfahrzeug-spezifische Feldgruppen ─────────────────────────────────

const MFZ_FAHRZEUG_KEYS = [
  ['kategorie','Kategorie'], ['marke','Marke'], ['modell','Modell / Typ'], ['jahrgang','Jahrgang'],
  ['erstzulassung','Erstzulassung'], ['fahrzeugwert','Fahrzeugwert (CHF)'],
  ['hubraum','Hubraum (ccm)'], ['leistung_kw','Leistung (kW)'],
  ['schildernummer','Kontrollschild'], ['stammnummer','Stammnummer'],
  ['fahrgestellnummer','Fahrgestellnummer (VIN)'], ['aktueller_km_stand','Kilometerstand (km)'],
  ['leasing','Leasing'], ['e_fahrzeug','Elektrofahrzeug'], ['parkierungsort','Parkierungsort'],
];
const MFZ_NUTZUNG_KEYS = [
  ['km_pro_jahr','Kilometer pro Jahr'], ['fahrerkreis','Fahrerkreis'],
  ['juengster_fahrer_jg','Jüngster Fahrer Jg.'], ['bonusstufe','Bonusstufe'],
];
const MFZ_VERTRAG_KEYS = [
  ['vertrag_beginn','Vertragsbeginn'], ['vertrag_laufzeit','Laufzeit (Jahre)'],
  ['vertrag_ablauf','Vertragsablauf'], ['zahlungsart','Zahlungsart'],
  ['jaehrliches_kuendigungsrecht','Jährl. Kündigungsrecht'],
];
const MFZ_ZUBEHOER_KEYS = [
  ['zubehoer','Zubehör (CHF)'], ['zubehoer_beschreibung','Zubehör Beschreibung'],
];

// Keys die separat als Deckungsblock gerendert werden (nicht nochmals als Rohfeld ausgeben)
const MFZ_DECKUNG_KEYS = new Set([
  'deckungen','deckung_gewuenscht','selbstbehalt_kasko','assistance','insassen',
  'hp_summe','hp_bonusschutz','hp_grobfahrlaessigkeit',
  'tk_selbstbehalt','tk_glas','tk_deckungen',
  'vk_selbstbehalt','vk_optionen',
  'ps_variante',
  'ui_variante','ui_deckungen',
  'ph_gebiet','ph_leistungen','ph_paket',
  'vr_umfang','vr_bereiche',
]);

// ── Haupt-Export ──────────────────────────────────────────────────────────

export function exportOffertanfragePDF(ausschreibung, customer) {
  const doc = new jsPDF();
  const margin = 20;
  const pageH = 297;
  let y = 20;

  // ── Header ────────────────────────────────────────────────────────────
  doc.setFillColor(30, 58, 100);
  doc.rect(0, 0, 210, 32, 'F');
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(17);
  doc.setFont('helvetica', 'bold');
  doc.text('Offertanfrage', margin, 13);
  doc.setFontSize(9.5);
  doc.setFont('helvetica', 'normal');
  doc.text(`Datum: ${new Date().toLocaleDateString('de-CH')}`, 140, 9);
  if (ausschreibung.ausschreibung_nummer) doc.text(`Nr: ${ausschreibung.ausschreibung_nummer}`, 140, 15);
  const spartenLines = doc.splitTextToSize(`Sparten: ${(ausschreibung.sparten || []).join(', ')}`, 55);
  doc.text(spartenLines, 140, 21);
  doc.setTextColor(30, 30, 30);
  y = 40;

  // ── Titel & Frist ─────────────────────────────────────────────────────
  doc.setFontSize(13);
  doc.setFont('helvetica', 'bold');
  doc.text(ausschreibung.titel || 'Offertanfrage', margin, y);
  y += 7;
  if (ausschreibung.fristdatum) {
    doc.setFontSize(9);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(180, 50, 50);
    doc.text(`Offertfrist: ${ausschreibung.fristdatum}`, margin, y);
    doc.setTextColor(30, 30, 30);
    y += 7;
  }
  y += 3;

  // ── Kundendaten ───────────────────────────────────────────────────────
  y = sectionHeader(doc, 'Versicherungsnehmer / Kundendaten', y, pageH, margin);
  const rows = [];
  if (customer) {
    const name = customer.customer_type === 'business'
      ? (customer.company_name || `${customer.first_name} ${customer.last_name}`)
      : `${customer.first_name} ${customer.last_name}`;
    rows.push(['Name / Firma', name]);
    if (customer.street) rows.push(['Adresse', `${customer.street}, ${customer.zip_code || ''} ${customer.city || ''}`]);
    if (customer.email) rows.push(['E-Mail', customer.email]);
    if (customer.phone || customer.mobile) rows.push(['Telefon', customer.phone || customer.mobile]);
    if (customer.birthdate) rows.push(['Geburtsdatum', customer.birthdate]);
    if (customer.nationality) rows.push(['Nationalität', customer.nationality]);
    if (customer.civil_status) rows.push(['Zivilstand', customer.civil_status]);
    if (customer.profession) rows.push(['Beruf', customer.profession]);
  } else {
    rows.push(['Kundenname', ausschreibung.customer_name || '—']);
  }
  if (ausschreibung.ansprechpartner) rows.push(['Ansprechpartner', ausschreibung.ansprechpartner]);
  if (ausschreibung.laufende_praemie) rows.push(['Laufende Jahresprämie', `CHF ${Number(ausschreibung.laufende_praemie).toLocaleString('de-CH')}`]);
  rows.forEach((r, i) => { y = addRow(doc, r[0], r[1], y, pageH, margin, i % 2 === 0); });
  y += 8;

  // ── Risikodaten je Sparte ─────────────────────────────────────────────
  const risiko = ausschreibung.risiko_daten || {};

  (ausschreibung.sparten || []).forEach(sparte => {
    const d = risiko[sparte];
    if (!d || Object.keys(d).length === 0) return;

    y = sectionHeader(doc, `Risikodaten – ${sparte}`, y, pageH, margin);

    if (sparte === 'Motorfahrzeug') {

      // Fahrzeugdaten
      const fzRows = MFZ_FAHRZEUG_KEYS.filter(([k]) => d[k] != null && d[k] !== '');
      if (fzRows.length > 0) {
        y = labelLine(doc, 'Fahrzeugdaten', y, pageH, margin);
        fzRows.forEach(([k, label], i) => { y = addRow(doc, label, d[k], y, pageH, margin, i % 2 === 0); });
        y += 5;
      }

      // Nutzung & Fahrer
      const nutzRows = MFZ_NUTZUNG_KEYS.filter(([k]) => d[k] != null && d[k] !== '');
      if (nutzRows.length > 0) {
        y = labelLine(doc, 'Nutzung & Fahrer', y, pageH, margin);
        nutzRows.forEach(([k, label], i) => { y = addRow(doc, label, d[k], y, pageH, margin, i % 2 === 0); });
        y += 5;
      }

      // Gewünschte Deckungen
      y = checkPage(doc, y, 12, pageH);
      y = labelLine(doc, 'Gewünschte Deckungen', y, pageH, margin);
      y = renderMFZDeckungen(doc, d, y, pageH, margin);

      // Vertragsbedingungen
      const vtRows = MFZ_VERTRAG_KEYS.filter(([k]) => d[k] != null && d[k] !== '');
      if (vtRows.length > 0) {
        y = labelLine(doc, 'Vertragsbedingungen', y, pageH, margin);
        vtRows.forEach(([k, label], i) => { y = addRow(doc, label, d[k], y, pageH, margin, i % 2 === 0); });
        y += 5;
      }

      // Zubehör
      const zbRows = MFZ_ZUBEHOER_KEYS.filter(([k]) => d[k] != null && d[k] !== '');
      if (zbRows.length > 0) {
        y = labelLine(doc, 'Zubehör', y, pageH, margin);
        zbRows.forEach(([k, label], i) => { y = addRow(doc, label, d[k], y, pageH, margin, i % 2 === 0); });
        y += 5;
      }

      // Bemerkungen MFZ
      if (d.bemerkungen) {
        y = labelLine(doc, 'Bemerkungen', y, pageH, margin);
        y = addRow(doc, 'Bemerkungen', d.bemerkungen, y, pageH, margin, true);
        y += 5;
      }

    } else {
      // Alle anderen Sparten: generischer Render
      Object.entries(d).forEach(([k, v], i) => {
        if (v == null || v === '') return;
        const label = k;
        y = addRow(doc, label, Array.isArray(v) ? v.join(', ') : v, y, pageH, margin, i % 2 === 0);
      });
    }
    y += 8;
  });

  // ── Bemerkungen Ausschreibung ─────────────────────────────────────────
  if (ausschreibung.bemerkungen) {
    y = sectionHeader(doc, 'Bemerkungen / Besonderheiten', y, pageH, margin);
    doc.setFontSize(9);
    doc.setFont('helvetica', 'normal');
    const lines = doc.splitTextToSize(ausschreibung.bemerkungen, 166);
    y = checkPage(doc, y, lines.length * 5 + 4, pageH);
    doc.text(lines, margin, y);
    y += lines.length * 5 + 8;
  }

  // ── Schlusstext ───────────────────────────────────────────────────────
  y = checkPage(doc, y, 22, pageH);
  y += 4;
  doc.setDrawColor(200, 210, 230);
  doc.line(margin, y, 190, y);
  y += 6;
  doc.setFontSize(8);
  doc.setTextColor(110, 110, 130);
  doc.setFont('helvetica', 'italic');
  doc.text('Bitte senden Sie Ihre Offerte bis zum oben genannten Fristdatum zurück. Bei Rückfragen stehen wir Ihnen gerne zur Verfügung.', margin, y);
  y += 6;
  doc.text(`Automatisch erstellt am ${new Date().toLocaleString('de-CH')}`, margin, y);

  // ── Footer ────────────────────────────────────────────────────────────
  const pageCount = doc.getNumberOfPages();
  for (let p = 1; p <= pageCount; p++) {
    doc.setPage(p);
    doc.setFontSize(8);
    doc.setTextColor(160, 160, 160);
    doc.setFont('helvetica', 'normal');
    doc.text(`Seite ${p} / ${pageCount}`, 105, 291, { align: 'center' });
    doc.setDrawColor(200, 210, 230);
    doc.line(margin, 287, 190, 287);
  }

  const filename = `Offertanfrage_${(ausschreibung.customer_name || 'Kunde').replace(/\s+/g, '_')}_${(ausschreibung.titel || '').replace(/\s+/g, '_').substring(0, 30)}.pdf`;
  doc.save(filename);
}