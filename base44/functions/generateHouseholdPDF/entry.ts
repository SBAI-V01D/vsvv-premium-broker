import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';
import { jsPDF } from 'npm:jspdf@4.0.0';

const formatDate = (dateStr) => {
  if (!dateStr) return '–';
  try {
    return new Date(dateStr).toLocaleDateString('de-CH', { 
      year: 'numeric', 
      month: '2-digit', 
      day: '2-digit' 
    });
  } catch {
    return '–';
  }
};

const getDaysUntilExpiry = (endDate) => {
  if (!endDate) return null;
  const today = new Date();
  const end = new Date(endDate);
  return Math.floor((end - today) / (1000 * 60 * 60 * 24));
};

const getStatusStyle = (contract) => {
  const days = getDaysUntilExpiry(contract.end_date);
  if (days === null) return { bg: [76, 175, 80], text: [255, 255, 255], label: '✓ Stabil' };
  if (days < 0) return { bg: [244, 67, 54], text: [255, 255, 255], label: '✗ Überfällig' };
  if (days <= 30) return { bg: [233, 30, 99], text: [255, 255, 255], label: '⚠ Kritisch' };
  if (days <= 90) return { bg: [255, 152, 0], text: [255, 255, 255], label: '! Ablauf' };
  return { bg: [76, 175, 80], text: [255, 255, 255], label: '✓ Stabil' };
};

const formatCurrency = (value) => {
  if (!value && value !== 0) return '–';
  return new Intl.NumberFormat('de-CH', {
    style: 'currency',
    currency: 'CHF',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(value);
};

const addHeader = (doc, pageWidth, title, subtitle) => {
  const margin = 20;
  const y = 20;

  // Hintergrund
  doc.setFillColor(33, 105, 180);
  doc.rect(0, 0, pageWidth, 35, 'F');

  // Titel
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(22);
  doc.setTextColor(255, 255, 255);
  doc.text(title, margin, y + 12);

  // Untertitel
  if (subtitle) {
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(10);
    doc.setTextColor(200, 220, 240);
    doc.text(subtitle, margin, y + 22);
  }

  // WICHTIG: Farbe zurücksetzen
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(10);
  doc.setTextColor(0, 0, 0);
  return y + 35;
};

const addFooter = (doc, pageWidth, pageHeight) => {
  const now = new Date();
  const dateStr = now.toLocaleDateString('de-CH');
  const timeStr = now.toLocaleTimeString('de-CH', { hour: '2-digit', minute: '2-digit' });

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.setTextColor(150, 150, 150);
  doc.text(`Erstellt: ${dateStr} ${timeStr}`, 20, pageHeight - 8);
  const pageNum = doc.internal.pages.length - 1;
  doc.text(`Seite ${pageNum}`, pageWidth - 30, pageHeight - 8);
};

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const { customer_id } = await req.json();

    // Hole Kundendaten direkt (bypasses list-Filter)
    let customer;
    try {
      customer = await base44.asServiceRole.entities.Customer.get(customer_id);
    } catch (e) {
      console.error('Customer fetch error:', e);
      return Response.json({ error: 'Customer not found' }, { status: 404 });
    }

    if (!customer) {
      return Response.json({ error: 'Customer not found' }, { status: 404 });
    }

    // Fetch Familienmitglieder und Verträge
    const primaryCustomerId = customer.primary_customer_id || customer.id;
    const allCustomers = await base44.asServiceRole.entities.Customer.list(null, 500);
    const allContracts = await base44.asServiceRole.entities.Contract.list(null, 1000);
    
    const familyMembers = allCustomers.filter(c => 
      c.primary_customer_id === primaryCustomerId || c.id === primaryCustomerId
    );
    
    // Fallback: Wenn keine Familienmitglieder gefunden, nur dieser Kunde
    const customers = familyMembers.length > 0 ? familyMembers : [customer];
    const contracts = allContracts || [];
    const customerIds = customers.map(m => m.id);
    const householdContracts = contracts.filter(c => customerIds.includes(c.customer_id));

    // PDF im Querformat
    const doc = new jsPDF({ 
      orientation: 'landscape', 
      unit: 'mm', 
      format: 'A4',
      compress: true,
    });

    const pageWidth = doc.internal.pageSize.getWidth();
    const pageHeight = doc.internal.pageSize.getHeight();
    const margin = 20;

    // ========== SEITE 1: ÜBERSICHT ==========
    let yPos = addHeader(doc, pageWidth, 'Haushaltsübersicht', `${customer.first_name || ''} ${customer.last_name || ''}`);
    yPos += 10;

    // Kontakt-Sektion
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(11);
    doc.setTextColor(33, 105, 180);
    doc.text('Hauptkontakt', margin, yPos);
    yPos += 8;

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(10);
    doc.setTextColor(0, 0, 0);
    doc.text(`${customer.first_name || ''} ${customer.last_name || ''}`, margin, yPos);
    yPos += 6;

    if (customer.street) doc.text(`${customer.street}`, margin, yPos), (yPos += 6);
    if (customer.zip_code || customer.city) 
      doc.text(`${customer.zip_code} ${customer.city || ''}`, margin, yPos), (yPos += 6);
    if (customer.phone) doc.text(`Telefon: ${customer.phone}`, margin, yPos), (yPos += 6);
    if (customer.email) doc.text(`Email: ${customer.email}`, margin, yPos), (yPos += 6);

    yPos += 8;

    // KPI-Karten
    const activeCount = householdContracts.filter(c => c.status === 'active').length;
    const totalPremium = householdContracts.reduce((sum, c) => sum + (c.premium_yearly || 0), 0);
    const expiringCount = householdContracts.filter(c => {
      const days = getDaysUntilExpiry(c.end_date);
      return days !== null && days >= 0 && days <= 180;
    }).length;

    const kpis = [
      { label: 'Familienmitglieder', value: customers.length },
      { label: 'Aktive Verträge', value: activeCount },
      { label: 'Jahresprämie', value: formatCurrency(totalPremium) },
      { label: 'Abläufe (180d)', value: expiringCount },
    ];

    const kpiColWidth = (pageWidth - 2 * margin) / 4;
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(10);

    kpis.forEach((kpi, idx) => {
      const x = margin + idx * kpiColWidth;
      
      // Hintergrund
      doc.setFillColor(240, 245, 250);
      doc.rect(x, yPos, kpiColWidth - 2, 18, 'F');
      doc.setDrawColor(200, 220, 240);
      doc.rect(x, yPos, kpiColWidth - 2, 18);

      // Wert
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(14);
      doc.setTextColor(33, 105, 180);
      doc.text(String(kpi.value), x + 4, yPos + 12);

      // Label
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(8);
      doc.setTextColor(100, 100, 100);
      doc.text(kpi.label, x + 4, yPos + 16);
    });

    yPos += 26;

    // ========== FAMILIENMITGLIEDER MIT VERTRÄGEN ==========
    customers.forEach((member, memberIdx) => {
      const memberContracts = householdContracts.filter(c => c.customer_id === member.id);

      // Seitenumbruch wenn nötig
      if (yPos > pageHeight - 50) {
        addFooter(doc, pageWidth, pageHeight);
        doc.addPage();
        yPos = addHeader(doc, pageWidth, 'Haushaltsübersicht (Fortsetzung)', '') + 10;
      }

      // Member-Header
      const headerColor = [[33, 105, 180], [52, 152, 219], [155, 89, 182], [46, 125, 50]][memberIdx % 4];
      doc.setFillColor(...headerColor);
      doc.rect(margin, yPos, pageWidth - 2 * margin, 14, 'F');

      const roleLabel =
        member.id === customer.id
          ? '(Hauptkontakt)'
          : member.family_role === 'spouse'
          ? '(Ehepartner/in)'
          : member.family_role === 'child'
          ? '(Kind)'
          : '(Familienmitglied)';

      doc.setFont('helvetica', 'bold');
      doc.setFontSize(11);
      doc.setTextColor(255, 255, 255);
      doc.text(`${member.first_name || ''} ${member.last_name || ''} ${roleLabel}`, margin + 4, yPos + 9);
      
      // Farbe zurücksetzen NACH Header
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(10);
      doc.setTextColor(0, 0, 0);

      yPos += 16;

      // Member-Info
      if (member.birthdate) {
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(9);
        doc.setTextColor(100, 100, 100);
        doc.text(`Geb.: ${formatDate(member.birthdate)}`, margin, yPos);
        yPos += 5;
      }

      // Verträge-Tabelle
      if (memberContracts.length > 0) {
        yPos += 3;

        // Tabellen-Header
        const colWidths = {
          sparte: 40,
          insurer: 50,
          policy: 40,
          expiry: 35,
          premium: 45,
        };

        doc.setFillColor(245, 245, 245);
        doc.setDrawColor(200, 200, 200);
        doc.setLineWidth(0.3);

        const headerX = [margin, margin + colWidths.sparte, margin + colWidths.sparte + colWidths.insurer, margin + colWidths.sparte + colWidths.insurer + colWidths.policy, margin + colWidths.sparte + colWidths.insurer + colWidths.policy + colWidths.expiry];
        const headers = [
          { label: 'Sparte', x: headerX[0] },
          { label: 'Gesellschaft', x: headerX[1] },
          { label: 'Police', x: headerX[2] },
          { label: 'Ablauf', x: headerX[3] },
          { label: 'Jahresprämie', x: headerX[4] },
        ];

        doc.rect(margin, yPos, pageWidth - 2 * margin, 8, 'F');
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(9);
        doc.setTextColor(50, 50, 50);

        headers.forEach(h => {
          doc.text(h.label, h.x + 2, yPos + 5.5);
        });

        yPos += 9;

        // Datenzeilen
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(9);

        memberContracts.forEach((contract) => {
          if (yPos > pageHeight - 15) {
            addFooter(doc, pageWidth, pageHeight);
            doc.addPage();
            yPos = addHeader(doc, pageWidth, 'Haushaltsübersicht (Fortsetzung)', '') + 10;
          }

          const status = getStatusStyle(contract);

          // Status-Hintergrund
          doc.setFillColor(...status.bg);
          doc.rect(margin, yPos, pageWidth - 2 * margin, 7.5, 'F');

          doc.setFont('helvetica', 'normal');
          doc.setFontSize(9);
          doc.setTextColor(...status.text);

          // Sparte
          doc.text((contract.sparte || contract.insurance_type || '–').substring(0, 15), margin + 2, yPos + 5);

          // Gesellschaft
          doc.text((contract.insurer || '–').substring(0, 18), margin + colWidths.sparte + 2, yPos + 5);

          // Police
          doc.text((contract.policy_number || '–').substring(0, 15), margin + colWidths.sparte + colWidths.insurer + 2, yPos + 5);

          // Ablauf
          let expiryText = '–';
          if (contract.end_date) {
            const days = getDaysUntilExpiry(contract.end_date);
            expiryText = days === null ? formatDate(contract.end_date) : `${formatDate(contract.end_date)} (${days}d)`;
          }
          doc.text(expiryText.substring(0, 20), margin + colWidths.sparte + colWidths.insurer + colWidths.policy + 2, yPos + 5);

          // Jahresprämie
          doc.text(formatCurrency(contract.premium_yearly).substring(0, 12), margin + colWidths.sparte + colWidths.insurer + colWidths.policy + colWidths.expiry + 2, yPos + 5);

          // Farbe zurücksetzen für nächste Zeile
          doc.setTextColor(0, 0, 0);
          yPos += 8;
        });

        yPos += 6;
      } else {
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(9);
        doc.setTextColor(150, 150, 150);
        doc.text('Keine Verträge vorhanden', margin, yPos);
        yPos += 8;
      }

      yPos += 6;
    });

    // ========== LETZTE SEITE: LEGENDE & INFO ==========
    if (yPos > pageHeight - 60) {
      addFooter(doc, pageWidth, pageHeight);
      doc.addPage();
      yPos = addHeader(doc, pageWidth, 'Information', '') + 10;
    }

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(11);
    doc.setTextColor(33, 105, 180);
    doc.text('Status-Farbcodierung', margin, yPos);
    yPos += 10;

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9);

    const legendItems = [
      { bg: [76, 175, 80], label: 'GRÜN – Stabil, keine Massnahmen erforderlich' },
      { bg: [255, 152, 0], label: 'ORANGE – Ablauf nähert sich (< 90 Tage)' },
      { bg: [233, 30, 99], label: 'ROT – Kritisch, Ablauf bevorstehend (< 30 Tage)' },
      { bg: [244, 67, 54], label: 'DUNKELROT – Überfällig, sofort handeln' },
    ];

    legendItems.forEach(item => {
      doc.setFillColor(...item.bg);
      doc.rect(margin, yPos - 2, 4, 4, 'F');
      doc.setTextColor(0, 0, 0);
      doc.text(item.label, margin + 7, yPos);
      yPos += 6;
    });

    // Footer auf letzte Seite
    addFooter(doc, pageWidth, pageHeight);

    // Export
    const pdfBytes = doc.output('arraybuffer');

    return new Response(pdfBytes, {
      status: 200,
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename=Haushaltsübersicht_${customer.last_name || 'Export'}_${new Date().toISOString().split('T')[0]}.pdf`,
      },
    });
  } catch (error) {
    console.error('PDF Generation Error:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});