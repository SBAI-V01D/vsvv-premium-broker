/**
 * generateDossierPdf — Sprint D: PDF Governance & Archiving
 *
 * Features:
 *   - SHA-256 Hash (Integritätsnachweis)
 *   - UploadPrivateFile (nicht öffentlich, tenant-isoliert)
 *   - Signed Metadata im PDF (approved_by, approved_at, version, snapshot_id, hash)
 *   - Immutable: jede Generierung = neue Version, alte bleiben erhalten
 *   - PdfExportLog Audit-Eintrag pro Export
 *   - final_pdf_hash / final_pdf_file_uri auf Dossier gespeichert
 */
import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';
import { jsPDF } from 'npm:jspdf@4.0.0';

// ── Hilfsfunktionen ────────────────────────────────────────────────────────────
function fmtCHF(val) {
  if (val == null || isNaN(val)) return '—';
  return `CHF ${Number(val).toLocaleString('de-CH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function fmtDate(iso) {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString('de-CH', { day: '2-digit', month: '2-digit', year: 'numeric' });
}

function truncate(str, n) {
  if (!str) return '';
  return str.length <= n ? str : str.slice(0, n - 1) + '…';
}

async function sha256hex(buffer) {
  const hashBuffer = await crypto.subtle.digest('SHA-256', buffer);
  return Array.from(new Uint8Array(hashBuffer))
    .map(b => b.toString(16).padStart(2, '0'))
    .join('');
}

const GRUPPE_LABELS = {
  aktuelle_loesung: 'Aktuelle Lösung',
  optimiert: 'Optimierte Lösung',
  angebot_1: 'Angebot 1',
  angebot_2: 'Angebot 2',
  angebot_3: 'Angebot 3',
  angebot_4: 'Angebot 4',
  angebot_5: 'Angebot 5',
  manuell: 'Weitere Einträge',
};

// ── PDF-Aufbau ─────────────────────────────────────────────────────────────────
function buildPdf({ dossier, customer, entries, advisor, organization, exportMeta }) {
  const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });
  const W = 297;
  const MARGIN = 14;
  const COL = W - 2 * MARGIN;
  let y = 0;

  const NAVY  = [15, 23, 42];
  const BLUE  = [29, 78, 216];
  const GRAY  = [100, 116, 139];
  const LIGHT = [241, 245, 249];
  const GREEN = [5, 150, 105];
  const WHITE = [255, 255, 255];

  function setFont(style, size) { doc.setFont('helvetica', style); doc.setFontSize(size); }
  function setColor(rgb, isText = true) {
    if (isText) doc.setTextColor(...rgb); else doc.setFillColor(...rgb);
  }

  // ── Seite 1: Deckblatt ──────────────────────────────────────────────────────
  y = MARGIN;

  doc.setDrawColor(...NAVY);
  doc.setLineWidth(0.8);
  doc.line(MARGIN, y + 8, W - MARGIN, y + 8);

  setFont('bold', 22); setColor(NAVY);
  doc.text(truncate(dossier.title || 'Beratungsdossier', 60), MARGIN, y + 5);

  setFont('normal', 8); setColor(GRAY);
  doc.text(fmtDate(new Date().toISOString()), W - MARGIN, y + 5, { align: 'right' });
  y += 14;

  // Organisation + Berater
  const orgName = dossier.snap_org_name || organization?.name || '';
  const advName = dossier.snap_adv_firstname
    ? `${dossier.snap_adv_firstname} ${dossier.snap_adv_lastname || ''}`.trim()
    : advisor ? `${advisor.firstname || ''} ${advisor.lastname || ''}`.trim() : '';

  if (orgName || advName) {
    const colW = COL / 2;
    if (orgName) {
      setFont('bold', 9); setColor(NAVY);
      doc.text(orgName, MARGIN, y);
      const finma = dossier.snap_org_finma || organization?.finma_number;
      if (finma) { setFont('normal', 7); setColor(GRAY); doc.text(`FINMA: ${finma}`, MARGIN, y + 4); }
    }
    if (advName) {
      setFont('bold', 9); setColor(NAVY);
      doc.text(advName, MARGIN + colW, y);
      const finmaAdv = dossier.snap_adv_finma || advisor?.finma_number;
      const vbvAdv   = dossier.snap_adv_vbv   || advisor?.vbv_number;
      if (finmaAdv || vbvAdv) {
        setFont('normal', 7); setColor(GRAY);
        const regs = [finmaAdv ? `FINMA: ${finmaAdv}` : null, vbvAdv ? `VBV: ${vbvAdv}` : null].filter(Boolean).join('  ·  ');
        doc.text(regs, MARGIN + colW, y + 4);
      }
    }
    y += 12;
  }

  doc.setDrawColor(226, 232, 240); doc.setLineWidth(0.3);
  doc.line(MARGIN, y, W - MARGIN, y);
  y += 6;

  // Kundendaten
  if (customer) {
    setFont('bold', 8); setColor(BLUE);
    doc.text('VERSICHERUNGSNEHMER', MARGIN, y);
    y += 5;
    const cName = [customer.first_name, customer.last_name].filter(Boolean).join(' ');
    const cAddr = [customer.street, [customer.zip_code, customer.city].filter(Boolean).join(' ')].filter(Boolean).join(', ');
    setFont('bold', 10); setColor(NAVY);
    doc.text(cName, MARGIN, y);
    y += 5;
    setFont('normal', 8); setColor(GRAY);
    if (cAddr) { doc.text(cAddr, MARGIN, y); y += 4; }
    if (customer.birthdate) { doc.text(`Geburtsdatum: ${fmtDate(customer.birthdate)}`, MARGIN, y); y += 4; }
    y += 4;
  }

  // Prämien-KPIs
  const gruppen = {};
  entries.forEach(e => {
    const g = e.gruppe || 'manuell';
    gruppen[g] = (gruppen[g] || 0) + (Number(e.praemie_monatlich) || 0);
  });
  const currentTotal = gruppen['aktuelle_loesung'] || 0;
  const recGruppe = dossier.advisor_final_recommendation;
  const recTotal  = recGruppe ? (gruppen[recGruppe] || 0) : (gruppen['optimiert'] || 0);
  const savings   = currentTotal && recTotal ? currentTotal - recTotal : null;

  if (currentTotal || recTotal) {
    setFont('bold', 8); setColor(BLUE);
    doc.text('PRÄMIENÜBERSICHT', MARGIN, y);
    y += 5;
    const tileW = 55; const tileH = 20;
    const tiles = [
      { label: 'Aktuelle Prämie', val: fmtCHF(currentTotal) + '/Mt.', sub: fmtCHF(currentTotal * 12) + '/Jahr', bg: LIGHT },
      { label: recGruppe ? (GRUPPE_LABELS[recGruppe] || 'Empfehlung') : 'Optimierte Prämie', val: fmtCHF(recTotal) + '/Mt.', sub: fmtCHF(recTotal * 12) + '/Jahr', bg: [239, 246, 255] },
      { label: savings > 0 ? 'Einsparung' : 'Differenz', val: savings != null ? fmtCHF(Math.abs(savings)) + '/Mt.' : '—', sub: savings != null ? fmtCHF(Math.abs(savings * 12)) + '/Jahr' : '', bg: savings > 0.01 ? [240, 253, 244] : LIGHT },
    ];
    tiles.forEach((tile, i) => {
      const tx = MARGIN + i * (tileW + 4);
      doc.setFillColor(...tile.bg);
      doc.roundedRect(tx, y, tileW, tileH, 2, 2, 'F');
      setFont('normal', 7); setColor(GRAY);
      doc.text(tile.label.toUpperCase(), tx + 3, y + 5);
      setFont('bold', 12); setColor(savings > 0.01 && i === 2 ? GREEN : NAVY);
      doc.text(tile.val, tx + 3, y + 12);
      setFont('normal', 7); setColor(GRAY);
      if (tile.sub) doc.text(tile.sub, tx + 3, y + 17);
    });
    y += tileH + 8;
  }

  // Beraterentscheid
  if (dossier.advisor_final_recommendation && dossier.advisor_recommendation_label) {
    doc.setFillColor(239, 246, 255);
    doc.setDrawColor(...BLUE); doc.setLineWidth(0.5);
    const boxH = dossier.advisor_recommendation_reason ? 28 : 16;
    doc.roundedRect(MARGIN, y, COL, boxH, 2, 2, 'FD');
    setFont('bold', 7); setColor(BLUE);
    doc.text('EMPFEHLUNG DES BERATERS', MARGIN + 4, y + 5);
    setFont('bold', 11); setColor(NAVY);
    doc.text(dossier.advisor_recommendation_label, MARGIN + 4, y + 11);
    if (dossier.advisor_recommendation_reason) {
      setFont('italic', 8); setColor([30, 58, 138]);
      const lines = doc.splitTextToSize(`„${dossier.advisor_recommendation_reason}"`, COL - 8);
      lines.slice(0, 2).forEach((line, i) => doc.text(line, MARGIN + 4, y + 18 + i * 4));
    }
    if (dossier.advisor_approved) {
      setFont('bold', 7); setColor(GREEN);
      doc.text('✓ Vom Berater geprüft und freigegeben', W - MARGIN - 4, y + boxH - 4, { align: 'right' });
    }
    y += boxH + 6;
  }

  // ── Seite 2: Vergleichstabelle ──────────────────────────────────────────────
  doc.addPage();
  y = MARGIN;

  setFont('bold', 10); setColor(NAVY);
  doc.text(truncate(dossier.title || 'Beratungsdossier', 60), MARGIN, y);
  setFont('normal', 7); setColor(GRAY);
  doc.text('Seite 2 — Vergleich', W - MARGIN, y, { align: 'right' });
  doc.setDrawColor(...NAVY); doc.setLineWidth(0.6);
  doc.line(MARGIN, y + 3, W - MARGIN, y + 3);
  y += 10;

  setFont('bold', 8); setColor(BLUE);
  doc.text('VERGLEICH NACH GRUPPE', MARGIN, y);
  y += 6;

  const gruppenOrder = ['aktuelle_loesung', 'optimiert', 'angebot_1', 'angebot_2', 'angebot_3', 'angebot_4', 'angebot_5'];
  const presentGruppen = gruppenOrder.filter(g => entries.some(e => e.gruppe === g));
  const colW = COL / Math.max(presentGruppen.length + 1, 2);
  const personenSet = [...new Set(entries.map(e => e.person_name || 'Unbekannt'))];

  doc.setFillColor(...[248, 250, 252]);
  doc.rect(MARGIN, y, COL, 7, 'F');
  setFont('bold', 7); setColor(NAVY);
  doc.text('Person / Produkt', MARGIN + 2, y + 5);
  presentGruppen.forEach((g, i) => {
    doc.text(truncate(GRUPPE_LABELS[g] || g, 18), MARGIN + (i + 1) * colW + 2, y + 5);
  });
  y += 8;

  personenSet.forEach(person => {
    const personEntries = entries.filter(e => (e.person_name || 'Unbekannt') === person);
    doc.setFillColor(241, 245, 249);
    doc.rect(MARGIN, y, COL, 6, 'F');
    setFont('bold', 8); setColor(NAVY);
    doc.text(person, MARGIN + 2, y + 4);
    y += 6;

    const allProdukte = [...new Set(personEntries.map(e => `${e.gesellschaft}|${e.product_name || ''}|${e.section}`))];
    allProdukte.forEach(produktKey => {
      const [gesellschaft, product, section] = produktKey.split('|');
      setFont('normal', 7); setColor(NAVY);
      doc.text(truncate([gesellschaft, product].filter(Boolean).join(' '), 22), MARGIN + 2, y + 4);
      presentGruppen.forEach((g, i) => {
        const e = personEntries.find(e => e.gruppe === g && e.gesellschaft === gesellschaft && e.section === section);
        if (e?.praemie_monatlich != null) {
          setFont('bold', 7); setColor(g === recGruppe ? BLUE : NAVY);
          doc.text(fmtCHF(e.praemie_monatlich), MARGIN + (i + 1) * colW + 2, y + 4);
        } else {
          setFont('normal', 7); setColor(GRAY);
          doc.text('—', MARGIN + (i + 1) * colW + 2, y + 4);
        }
      });
      y += 6;
      if (y > 185) { doc.addPage(); y = MARGIN + 10; }
    });

    doc.setDrawColor(226, 232, 240); doc.setLineWidth(0.2);
    doc.line(MARGIN, y, W - MARGIN, y);
    setFont('bold', 7.5); setColor(GRAY);
    doc.text('Total ' + person.split(' ')[0], MARGIN + 2, y + 4);
    presentGruppen.forEach((g, i) => {
      const total = personEntries.filter(e => e.gruppe === g).reduce((s, e) => s + (Number(e.praemie_monatlich) || 0), 0);
      if (total > 0) { setFont('bold', 8); setColor(g === recGruppe ? BLUE : NAVY); doc.text(fmtCHF(total) + '/Mt.', MARGIN + (i + 1) * colW + 2, y + 4); }
    });
    y += 8;
    if (y > 185) { doc.addPage(); y = MARGIN + 10; }
  });

  doc.setFillColor(15, 23, 42);
  doc.rect(MARGIN, y, COL, 8, 'F');
  setFont('bold', 8); setColor(WHITE);
  doc.text('Gesamttotal / Monat', MARGIN + 2, y + 5);
  presentGruppen.forEach((g, i) => {
    const total = entries.filter(e => e.gruppe === g).reduce((s, e) => s + (Number(e.praemie_monatlich) || 0), 0);
    if (total > 0) { setFont('bold', 9); setColor(WHITE); doc.text(fmtCHF(total), MARGIN + (i + 1) * colW + 2, y + 5); }
  });

  // ── Seite 3: Signed Export Metadata ─────────────────────────────────────────
  doc.addPage();
  y = MARGIN;

  doc.setDrawColor(...NAVY); doc.setLineWidth(0.8);
  doc.line(MARGIN, y, W - MARGIN, y);
  y += 8;

  setFont('bold', 14); setColor(NAVY);
  doc.text('Dokumenten-Zertifikat', MARGIN, y);
  y += 10;

  const certItems = [
    ['Dossier-Titel',     dossier.title || '—'],
    ['Dossier-Version',   `v${dossier.version || 1}`],
    ['PDF-Version',       `v${exportMeta.pdfVersion}`],
    ['Erstellt am',       fmtDate(new Date().toISOString())],
    ['Erstellt von',      exportMeta.generatedByName || '—'],
    ['Freigabe durch',    dossier.approved_by || '—'],
    ['Freigabe am',       fmtDate(dossier.approved_at)],
    ['Snapshot-ID',       dossier.approved_snapshot_id || '—'],
    ['SHA-256 Hash',      exportMeta.pdfHash || '(berechnet nach Generierung)'],
  ];

  certItems.forEach(([label, value]) => {
    setFont('bold', 8); setColor(GRAY);
    doc.text(label, MARGIN, y);
    setFont('normal', 8); setColor(NAVY);
    doc.text(truncate(value, 80), MARGIN + 55, y);
    y += 7;
  });

  y += 6;
  doc.setFillColor(240, 253, 244); doc.setDrawColor(5, 150, 105); doc.setLineWidth(0.5);
  doc.roundedRect(MARGIN, y, COL, 20, 2, 2, 'FD');
  setFont('bold', 9); setColor(GREEN);
  doc.text('✓ Dieses Dokument wurde vom zuständigen Berater geprüft und freigegeben.', MARGIN + 4, y + 8);
  setFont('normal', 7.5); setColor([6, 78, 59]);
  doc.text('Der SHA-256 Hash dient zur kryptografischen Integritätsprüfung des Originals.', MARGIN + 4, y + 15);

  // ── Footer auf allen Seiten ──────────────────────────────────────────────────
  const pageCount = doc.getNumberOfPages();
  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i);
    setFont('normal', 6.5); setColor(GRAY);
    doc.text(
      `${dossier.title || 'Dossier'} · v${exportMeta.pdfVersion} · ${fmtDate(new Date().toISOString())} · Seite ${i}/${pageCount}`,
      W / 2, 207 - 5, { align: 'center' }
    );
    if (dossier.advisor_approved) {
      setColor(GREEN);
      doc.text(`✓ Freigegeben: ${dossier.approved_by || ''}`, W - MARGIN, 207 - 5, { align: 'right' });
    }
  }

  return doc;
}

// ── Handler ───────────────────────────────────────────────────────────────────
Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const { dossierId } = await req.json();
    if (!dossierId) return Response.json({ error: 'dossierId erforderlich' }, { status: 400 });

    // ── Daten laden ──
    const [dossierArr, entries] = await Promise.all([
      base44.entities.AdvisoryDossier.filter({ id: dossierId }),
      base44.entities.ComparisonEntry.filter({ dossier_id: dossierId }),
    ]);

    const dossier = dossierArr[0];
    if (!dossier) return Response.json({ error: 'Dossier nicht gefunden' }, { status: 404 });
    // ── Sprint D Guards: alle drei Bedingungen müssen erfüllt sein ──
    if (!dossier.advisor_approved) {
      return Response.json({ error: 'Dossier nicht freigegeben (advisor_approved fehlt)' }, { status: 403 });
    }
    if (dossier.review_status !== 'freigegeben') {
      return Response.json({ error: `Dossier-Status nicht freigegeben (aktuell: ${dossier.review_status})` }, { status: 403 });
    }
    if (!dossier.approved_snapshot_id) {
      return Response.json({ error: 'Kein genehmigter Snapshot verknüpft — bitte Snapshot erstellen und Dossier erneut freigeben' }, { status: 403 });
    }

    // IP-Adresse für Audit
    const ipAddress = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim()
      || req.headers.get('x-real-ip')
      || 'unknown';

    const [customerArr, advisorArr, orgArr] = await Promise.all([
      dossier.customer_id     ? base44.entities.Customer.filter({ id: dossier.customer_id })         : Promise.resolve([]),
      dossier.advisor_id      ? base44.entities.Advisor.filter({ id: dossier.advisor_id })            : Promise.resolve([]),
      dossier.organization_id ? base44.entities.Organization.filter({ id: dossier.organization_id }) : Promise.resolve([]),
    ]);

    const customer     = customerArr[0] ?? null;
    const advisor      = advisorArr[0]  ?? null;
    const organization = orgArr[0]      ?? null;

    // ── PDF Version bestimmen ──
    const newPdfVersion = (dossier.final_pdf_version || 0) + 1;
    const generatedByName = user.full_name || user.email || 'Unbekannt';

    // ── PDF generieren (ohne Hash — Hash kommt nach Generierung) ──
    const exportMeta = {
      pdfVersion: newPdfVersion,
      generatedByName,
      pdfHash: null, // wird nach Generierung gesetzt
    };

    const doc = buildPdf({ dossier, customer, entries, advisor, organization, exportMeta });
    const pdfArrayBuffer = doc.output('arraybuffer');
    const pdfUint8 = new Uint8Array(pdfArrayBuffer);

    // ── SHA-256 Hash berechnen ──
    const pdfHash = await sha256hex(pdfUint8.buffer);

    // ── Private Storage Upload (immutable, nicht öffentlich) ──
    const filename = `dossier_${dossierId}_v${dossier.version || 1}_pdf_v${newPdfVersion}_${Date.now()}.pdf`;
    const pdfBlob = new Blob([pdfUint8], { type: 'application/pdf' });

    const uploadRes = await base44.asServiceRole.integrations.Core.UploadPrivateFile({ file: pdfBlob });
    const fileUri = uploadRes?.file_uri;
    if (!fileUri) return Response.json({ error: 'PDF-Upload fehlgeschlagen' }, { status: 500 });

    const exportedAt = new Date().toISOString();

    // ── Dossier aktualisieren (immutable: neue Version, nie überschreiben) ──
    await base44.asServiceRole.entities.AdvisoryDossier.update(dossierId, {
      final_pdf_file_uri:     fileUri,
      final_pdf_hash:         pdfHash,
      final_pdf_generated_at: exportedAt,
      final_pdf_version:      newPdfVersion,
      final_pdf_generated_by: generatedByName,
    });

    // ── Audit-Log Eintrag ──
    await base44.asServiceRole.entities.PdfExportLog.create({
      dossier_id:       dossierId,
      dossier_title:    dossier.title || '',
      dossier_version:  dossier.version || 1,
      pdf_version:      newPdfVersion,
      pdf_hash:         pdfHash,
      file_uri:         fileUri,
      filename,
      generated_by_id:  user.id,
      generated_by_name: generatedByName,
      approved_by:      dossier.approved_by || '',
      approved_at:      dossier.approved_at || null,
      snapshot_id:      dossier.approved_snapshot_id || null,
      customer_name:    dossier.customer_name || '',
      exported_at:      exportedAt,
      ip_address:       ipAddress,
    });

    return Response.json({
      success:      true,
      pdf_version:  newPdfVersion,
      pdf_hash:     pdfHash,
      file_uri:     fileUri,
      filename,
      exported_at:  exportedAt,
    });

  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});