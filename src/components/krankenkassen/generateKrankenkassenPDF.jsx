import { jsPDF } from 'jspdf';

export function generateKrankenkassenVergleichPDF(vergleich) {
  const doc = new jsPDF();
  const margin = 20;
  const pageH = 297;
  let y = 20;

  // Header
  doc.setFillColor(30, 58, 100);
  doc.rect(0, 0, 210, 35, 'F');
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(18);
  doc.setFont('helvetica', 'bold');
  doc.text('Krankenkassenvergleich Schweiz', margin, 13);
  doc.setFontSize(10);
  doc.setFont('helvetica', 'normal');
  doc.text('Grundversicherung (KVG) - Offizieller BAG-Prämienvergleich', margin, 20);
  doc.text(`Erstellt am: ${new Date(vergleich.vergleichsdatum).toLocaleString('de-CH')}`, 120, 28);
  doc.setTextColor(30, 30, 30);
  y = 42;

  // Berater-Info
  doc.setFontSize(9);
  doc.setFont('helvetica', 'bold');
  doc.text('Beratung durch:', margin, y);
  doc.setFont('helvetica', 'normal');
  doc.text(vergleich.advisor_name || 'Unbekannt', margin + 35, y);
  y += 8;

  // Kundendaten
  y = addSection(doc, 'Kundendaten', y, pageH, margin);
  const pers = vergleich.persoenliche_daten || {};
  const rows = [
    ['Name', `${pers.vorname || ''} ${pers.nachname || ''}`],
    ['Geburtsdatum', pers.geburtsdatum || '—'],
    ['Wohnort', `${pers.plz || ''} ${pers.wohnort || ''}`],
    ['Kanton', pers.kanton || '—'],
  ];
  rows.forEach((r, i) => { y = addRow(doc, r[0], r[1], y, pageH, margin, i % 2 === 0); });
  y += 6;

  // Aktuelle Versicherung
  y = addSection(doc, 'Aktuelle Krankenversicherung', y, pageH, margin);
  const aktuell = vergleich.aktuelle_versicherung || {};
  const aktuelleRows = [
    ['Krankenkasse', aktuell.krankenkasse || '—'],
    ['Modell', formatModell(aktuell.modell)],
    ['Franchise', aktuell.franchise ? `CHF ${aktuell.franchise.toLocaleString('de-CH')}` : '—'],
    ['Unfalldeckung', aktuell.unfall ? 'Ja (NBU)' : 'Nein'],
  ];
  aktuelleRows.forEach((r, i) => { y = addRow(doc, r[0], r[1], y, pageH, margin, i % 2 === 0); });
  y += 6;

  // Vergleichsoptionen
  y = addSection(doc, 'Vergleichsoptionen', y, pageH, margin);
  const optionen = vergleich.vergleichsoptionen || {};
  const optionsText = [
    optionen.zeige_telmed && 'Telmed-Modelle',
    optionen.zeige_hausarzt && 'Hausarztmodelle',
    optionen.zeige_hmo && 'HMO-Modelle',
    optionen.zeige_standard && 'Standardmodelle',
    optionen.nur_gleiche_franchise && 'Nur gleiche Franchise',
    optionen.alle_modelle && 'Alle Modelle vergleichen',
  ].filter(Boolean).join(', ');
  y = addRow(doc, 'Verglichene Modelle', optionsText || 'Alle', y, pageH, margin, true);
  y += 6;

  // Top 10 Ergebnisse
  y = addSection(doc, 'Top 10 Vergleichsergebnisse', y, pageH, margin);
  const ergebnisse = (vergleich.vergleichsergebnisse || []).slice(0, 10);
  
  // Tabellen-Header
  y = checkPage(doc, y, 10, pageH);
  doc.setFontSize(8);
  doc.setFont('helvetica', 'bold');
  doc.setFillColor(240, 245, 255);
  doc.rect(margin, y - 4, 170, 6, 'F');
  doc.text('Rang', margin + 2, y);
  doc.text('Krankenkasse', margin + 12, y);
  doc.text('Modell', margin + 52, y);
  doc.text('Franchise', margin + 92, y);
  doc.text('Monat', margin + 122, y);
  doc.text('Jahr', margin + 147, y);
  doc.text('Ersparnis', margin + 172, y);
  doc.setTextColor(30, 30, 30);
  doc.setFont('helvetica', 'normal');
  y += 4;

  ergebnisse.forEach((e, idx) => {
    y = checkPage(doc, y, 7, pageH);
    const isEven = idx % 2 === 0;
    if (isEven) {
      doc.setFillColor(248, 251, 255);
      doc.rect(margin, y - 3.5, 170, 7, 'F');
    }
    
    doc.setFontSize(7.5);
    
    // Rang mit Icon
    if (e.ist_empfohlen) {
      doc.setTextColor(16, 185, 129);
      doc.text(`#${e.rang} ✓`, margin + 2, y);
    } else if (e.ist_aktuell) {
      doc.setTextColor(59, 130, 246);
      doc.text(`#${e.rang} *`, margin + 2, y);
    } else {
      doc.setTextColor(100, 100, 100);
      doc.text(`#${e.rang}`, margin + 2, y);
    }
    
    doc.setTextColor(20, 20, 20);
    doc.setFont('helvetica', e.ist_empfohlen ? 'bold' : 'normal');
    doc.text(e.krankenkasse, margin + 12, y);
    
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(80, 80, 80);
    doc.text(formatModell(e.modell).substring(0, 18), margin + 52, y);
    
    doc.text(`CHF ${e.franchise}`, margin + 92, y);
    doc.text(`CHF ${e.praemie_monatlich.toFixed(2)}`, margin + 122, y);
    doc.text(`CHF ${e.praemie_jaehrlich.toLocaleString('de-CH')}`, margin + 147, y);
    
    if (e.ersparnis_jaehrlich > 0) {
      doc.setTextColor(16, 185, 129);
      doc.setFont('helvetica', 'bold');
      doc.text(`+CHF ${e.ersparnis_jaehrlich.toLocaleString('de-CH')}`, margin + 172, y);
    } else {
      doc.setTextColor(150, 150, 150);
      doc.text('—', margin + 172, y);
    }
    
    doc.setTextColor(30, 30, 30);
    doc.setFont('helvetica', 'normal');
    y += 7;
  });

  y += 4;
  doc.setFontSize(7);
  doc.setTextColor(120, 120, 120);
  doc.text('* Aktuelle Versicherung  ✓ Empfohlene Lösung', margin, y);
  y += 8;

  // KI-Empfehlung
  if (vergleich.ki_analyse) {
    y = addSection(doc, 'KI-Beratungsempfehlung', y, pageH, margin);
    const ki = vergleich.ki_analyse;
    
    y = checkPage(doc, y, 20, pageH);
    doc.setFontSize(8.5);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(30, 30, 30);
    
    const lines = doc.splitTextToSize(ki.empfehlung_text, 166);
    doc.text(lines, margin, y);
    y += lines.length * 5 + 6;

    // KPIs
    doc.setFillColor(240, 250, 245);
    doc.roundedRect(margin, y - 3, 170, 20, 3, 3, 'F');
    
    doc.setFontSize(9);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(16, 185, 129);
    doc.text(`Jährliche Ersparnis: CHF ${ki.sparpotenzial.toLocaleString('de-CH')}`, margin + 5, y + 5);
    
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(30, 30, 30);
    doc.text(`Wechsel empfohlen: ${ki.wechsel_empfohlen ? 'Ja' : 'Nein'}`, margin + 90, y + 5);
    
    doc.text(`Empfohlene Kasse: ${ki.empfohlene_krankenkasse}`, margin + 5, y + 12);
    doc.text(`Empfohlenes Modell: ${formatModell(ki.empfohlenes_modell)}`, margin + 90, y + 12);
    
    y += 22;
  }

  // Footer
  const pageCount = doc.getNumberOfPages();
  for (let p = 1; p <= pageCount; p++) {
    doc.setPage(p);
    doc.setFontSize(8);
    doc.setTextColor(160, 160, 160);
    doc.setFont('helvetica', 'normal');
    doc.text(`Seite ${p} / ${pageCount}`, 105, 290, { align: 'center' });
    doc.text(`Premium Swiss Broker · Krankenkassenvergleich · BAG-Datenbasis`, 105, 10, { align: 'center' });
  }

  const filename = `KKVergleich_${(vergleich.customer_name || 'Kunde').replace(/\s+/g, '_')}_${new Date(vergleich.vergleichsdatum).toISOString().split('T')[0]}.pdf`;
  doc.save(filename);
}

function addSection(doc, title, y, pageH, margin) {
  if (y > pageH - 40) { doc.addPage(); y = 20; }
  doc.setFillColor(59, 130, 246);
  doc.rect(margin, y, 170, 7, 'F');
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(9.5);
  doc.setFont('helvetica', 'bold');
  doc.text(title, margin + 3, y + 5);
  doc.setTextColor(30, 30, 30);
  doc.setFont('helvetica', 'normal');
  return y + 12;
}

function addRow(doc, label, value, y, pageH, margin, isEven) {
  y = checkPage(doc, y, 10, pageH);
  const val = value != null && value !== '' ? String(value) : '—';
  const lines = doc.splitTextToSize(val, 90);
  const rowH = Math.max(8, lines.length * 5);
  
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
  
  return y + rowH + 1;
}

function checkPage(doc, y, needed, pageH) {
  if (y + needed > pageH - 20) { doc.addPage(); return 22; }
  return y;
}

function formatModell(modell) {
  const modelle = {
    standard: 'Standard',
    telmed: 'Telmed',
    hausarzt: 'Hausarzt',
    hmo: 'HMO'
  };
  return modelle[modell] || modell;
}