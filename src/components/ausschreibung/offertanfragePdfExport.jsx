import { jsPDF } from 'jspdf';

const FIELD_LABELS = {
  // Motorfahrzeug
  kategorie: 'Kategorie', marke: 'Marke', modell: 'Modell / Typ', jahrgang: 'Jahrgang',
  erstzulassung: 'Erstzulassung', fahrzeugwert: 'Fahrzeugwert (CHF)', hubraum: 'Hubraum (ccm)',
  leistung_kw: 'Leistung (kW)', km_pro_jahr: 'Kilometer pro Jahr', schildernummer: 'Kontrollschild',
  leasing: 'Leasing', fahrerkreis: 'Fahrerkreis', juengster_fahrer_jg: 'Jüngster Fahrer Jg.',
  bonusstufe: 'Bonusstufe', vorversicherer: 'Vorversicherer', parkierungsort: 'Parkierungsort',
  deckung_gewuenscht: 'Gewünschte Deckung', selbstbehalt_kasko: 'Selbstbehalt Kasko',
  assistance: 'Pannenhilfe', insassen: 'Insassenunfall', zubehoer: 'Zubehör (CHF)',
  zubehoer_beschreibung: 'Zubehör Beschreibung', bemerkungen: 'Bemerkungen',
  // Haushalt
  wohnflaeche: 'Wohnfläche (m²)', zimmer: 'Zimmeranzahl', baujahr: 'Baujahr',
  versicherungssumme: 'Versicherungssumme (CHF)', wertsachen: 'Wertsachen (CHF)',
  glasdeckung: 'Glasdeckung', fahrraeder: 'Fahrräder (CHF)', elementar: 'Elementarschäden',
  grobfahrlaessigkeit: 'Grobfahrlässigkeit',
  // Privathaftpflicht
  haustiere: 'Haustiere', eigentuemer: 'Eigentümer/Mieter',
  // Gebäude
  gebaeudeart: 'Gebäudeart', versicherungswert: 'Versicherungswert (CHF)',
  standort: 'Standort/PLZ',
  // Betriebshaftpflicht
  branche: 'Branche', mitarbeiter: 'Mitarbeiteranzahl', umsatz: 'Jahresumsatz (CHF)',
  lohnsumme: 'Lohnsumme (CHF)', schadenhistorie: 'Schadenhistorie',
  // Cyber
  it_dienstleister: 'IT-Dienstleister', backups: 'Regelmässige Backups',
};

function addSection(doc, title, y, pageH, margin) {
  if (y > pageH - 40) { doc.addPage(); y = 20; }
  doc.setFillColor(59, 130, 246);
  doc.rect(margin, y, 170, 7, 'F');
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(10);
  doc.setFont('helvetica', 'bold');
  doc.text(title, margin + 3, y + 5);
  doc.setTextColor(30, 30, 30);
  doc.setFont('helvetica', 'normal');
  return y + 12;
}

function addRow(doc, label, value, y, pageH, margin, isEven) {
  if (y > pageH - 15) { doc.addPage(); y = 20; }
  if (isEven) {
    doc.setFillColor(245, 248, 255);
    doc.rect(margin, y - 4, 170, 8, 'F');
  }
  doc.setFontSize(9);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(80, 80, 80);
  doc.text(String(label), margin + 2, y);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(20, 20, 20);
  const val = value != null && value !== '' ? String(value) : '—';
  const lines = doc.splitTextToSize(val, 90);
  doc.text(lines, margin + 82, y);
  return y + Math.max(8, lines.length * 5);
}

export function exportOffertanfragePDF(ausschreibung, customer) {
  const doc = new jsPDF();
  const margin = 20;
  const pageH = 297;
  let y = 20;

  // Header
  doc.setFillColor(30, 58, 100);
  doc.rect(0, 0, 210, 30, 'F');
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(16);
  doc.setFont('helvetica', 'bold');
  doc.text('Offertanfrage', margin, 14);
  doc.setFontSize(9);
  doc.setFont('helvetica', 'normal');
  doc.text(`Datum: ${new Date().toLocaleDateString('de-CH')}`, 140, 10);
  if (ausschreibung.ausschreibung_nummer) {
    doc.text(`Nr: ${ausschreibung.ausschreibung_nummer}`, 140, 16);
  }
  doc.text(`Sparten: ${(ausschreibung.sparten || []).join(', ')}`, 140, 22);
  doc.setTextColor(30, 30, 30);
  y = 38;

  // Titel
  doc.setFontSize(13);
  doc.setFont('helvetica', 'bold');
  doc.text(ausschreibung.titel || 'Offertanfrage', margin, y);
  y += 8;
  if (ausschreibung.fristdatum) {
    doc.setFontSize(9);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(180, 60, 60);
    doc.text(`Offertfrist: ${ausschreibung.fristdatum}`, margin, y);
    doc.setTextColor(30, 30, 30);
    y += 7;
  }
  y += 4;

  // Kundendaten
  y = addSection(doc, 'Kundendaten / Versicherungsnehmer', y, pageH, margin);
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
    if (customer.ahv_number) rows.push(['AHV-Nummer', customer.ahv_number]);
    if (customer.nationality) rows.push(['Nationalität', customer.nationality]);
    if (customer.civil_status) rows.push(['Zivilstand', customer.civil_status]);
    if (customer.profession) rows.push(['Beruf', customer.profession]);
  } else {
    rows.push(['Kundenname', ausschreibung.customer_name || '—']);
  }
  if (ausschreibung.ansprechpartner) rows.push(['Ansprechpartner', ausschreibung.ansprechpartner]);
  if (ausschreibung.laufende_praemie) rows.push(['Laufende Jahresprämie', `CHF ${Number(ausschreibung.laufende_praemie).toLocaleString('de-CH')}`]);
  rows.forEach((r, i) => { y = addRow(doc, r[0], r[1], y, pageH, margin, i % 2 === 0); });
  y += 6;

  // Risikodaten je Sparte
  const risiko = ausschreibung.risiko_daten || {};
  (ausschreibung.sparten || []).forEach(sparte => {
    const sparteData = risiko[sparte];
    if (!sparteData || Object.keys(sparteData).length === 0) return;
    y = addSection(doc, `Risikodaten – ${sparte}`, y, pageH, margin);
    Object.entries(sparteData).forEach(([k, v], i) => {
      if (v == null || v === '') return;
      const label = FIELD_LABELS[k] || k;
      y = addRow(doc, label, v, y, pageH, margin, i % 2 === 0);
    });
    y += 6;
  });

  // Bemerkungen
  if (ausschreibung.bemerkungen) {
    y = addSection(doc, 'Bemerkungen / Besonderheiten', y, pageH, margin);
    doc.setFontSize(9);
    doc.setFont('helvetica', 'normal');
    const lines = doc.splitTextToSize(ausschreibung.bemerkungen, 166);
    if (y + lines.length * 5 > pageH - 15) { doc.addPage(); y = 20; }
    doc.text(lines, margin, y);
    y += lines.length * 5 + 6;
  }

  // Hinweistext
  if (y > pageH - 35) { doc.addPage(); y = 20; }
  y += 6;
  doc.setFontSize(8);
  doc.setTextColor(120, 120, 120);
  doc.setFont('helvetica', 'italic');
  doc.text('Bitte senden Sie Ihre Offerte bis zum oben genannten Fristdatum. Bei Fragen stehen wir Ihnen gerne zur Verfügung.', margin, y);
  y += 8;
  doc.text(`Dieses Dokument wurde automatisch erstellt am ${new Date().toLocaleString('de-CH')}.`, margin, y);

  // Footer auf allen Seiten
  const pageCount = doc.getNumberOfPages();
  for (let p = 1; p <= pageCount; p++) {
    doc.setPage(p);
    doc.setFontSize(8);
    doc.setTextColor(160, 160, 160);
    doc.setFont('helvetica', 'normal');
    doc.text(`Seite ${p} / ${pageCount}`, 105, 290, { align: 'center' });
  }

  const filename = `Offertanfrage_${(ausschreibung.customer_name || 'Kunde').replace(/\s+/g, '_')}_${(ausschreibung.titel || '').replace(/\s+/g, '_').substring(0, 30)}.pdf`;
  doc.save(filename);
}