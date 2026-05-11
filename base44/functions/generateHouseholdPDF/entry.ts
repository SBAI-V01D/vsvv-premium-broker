import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';
import { jsPDF } from 'npm:jspdf@4.0.0';

// Helper: Format date
const formatDate = (dateStr) => {
  if (!dateStr) return '–';
  try {
    return new Date(dateStr).toLocaleDateString('de-CH', { year: 'numeric', month: '2-digit', day: '2-digit' });
  } catch {
    return '–';
  }
};

// Helper: Get days until expiration
const getDaysUntilExpiry = (endDate) => {
  if (!endDate) return null;
  const today = new Date();
  const end = new Date(endDate);
  return Math.floor((end - today) / (1000 * 60 * 60 * 24));
};

// Helper: Get status color for contract
const getStatusColor = (contract) => {
  const days = getDaysUntilExpiry(contract.end_date);
  if (days === null) return { bg: [200, 230, 201], text: [27, 94, 32], label: 'stabil' };
  if (days < 0) return { bg: [255, 205, 210], text: [179, 0, 0], label: 'überfällig' };
  if (days <= 30) return { bg: [255, 179, 71], text: [230, 126, 34], label: 'kritisch' };
  if (days <= 90) return { bg: [255, 235, 130], text: [240, 175, 0], label: 'warnung' };
  return { bg: [200, 230, 201], text: [27, 94, 32], label: 'stabil' };
};

// Helper: Format currency
const formatCurrency = (value) => {
  if (!value) return '–';
  return new Intl.NumberFormat('de-CH', {
    style: 'currency',
    currency: 'CHF',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0
  }).format(value);
};

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const { customer_id } = await req.json();

    // Fetch data
    const [allCustomers, contracts, verkaufschancen, tasks] = await Promise.all([
      base44.entities.Customer.list(null, 500),
      base44.entities.Contract.list(null, 1000),
      base44.entities.Verkaufschance.list(null, 500),
      base44.entities.Task.list(null, 500),
    ]);

    const customer = allCustomers.find(c => c.id === customer_id);
    if (!customer) return Response.json({ error: 'Customer not found' }, { status: 404 });

    // Get household
    const primaryCustomerId = customer.primary_customer_id || customer.id;
    const householdMembers = [customer, ...allCustomers.filter(c => c.primary_customer_id === primaryCustomerId && c.id !== customer.id)];
    const customerIds = householdMembers.map(m => m.id);

    const householdContracts = contracts.filter(c => customerIds.includes(c.customer_id));
    const householdTasks = tasks.filter(t => customerIds.includes(t.customer_id) && t.status !== 'completed');

    // Create PDF in LANDSCAPE
    const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'A4' });
    doc.setFont('helvetica');
    const pageWidth = doc.internal.pageSize.getWidth();
    const pageHeight = doc.internal.pageSize.getHeight();
    const margin = 18;
    let yPos = margin;

    // ===== PAGE 1: HOUSEHOLD OVERVIEW =====

    // Title
    doc.setFontSize(26);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(33, 105, 180);
    doc.text('Haushaltsübersicht', margin, yPos);
    doc.setTextColor(0, 0, 0);
    yPos += 14;

    // Divider
    doc.setDrawColor(100, 150, 200);
    doc.setLineWidth(1);
    doc.line(margin, yPos, pageWidth - margin, yPos);
    yPos += 10;

    // Primary contact box
    const contactBoxHeight = 38;
    doc.setFillColor(235, 245, 255);
    doc.setDrawColor(100, 150, 200);
    doc.setLineWidth(0.8);
    doc.rect(margin, yPos, pageWidth - 2 * margin, contactBoxHeight, 'FD');

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(14);
    doc.setTextColor(33, 33, 33);
    doc.text(`${customer.first_name} ${customer.last_name}`, margin + 6, yPos + 8);

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(10);
    doc.setTextColor(70, 70, 70);
    const addressLines = [
      customer.street || '',
      `${customer.zip_code} ${customer.city || ''}`,
      customer.email || '',
      customer.phone || ''
    ].filter(l => l);

    let addressY = yPos + 16;
    addressLines.forEach(line => {
      doc.text(line, margin + 6, addressY);
      addressY += 5;
    });

    yPos += contactBoxHeight + 12;

    // Summary stats
    const activeContracts = householdContracts.filter(c => c.status === 'active').length;
    const insurers = new Set(householdContracts.map(c => c.insurer)).size;
    const totalPremium = householdContracts.reduce((sum, c) => sum + (c.premium_yearly || 0), 0);
    const openReviews = householdTasks.filter(t => t.task_type === 'consultation').length;
    const expiringCount = householdContracts.filter(c => {
      const days = getDaysUntilExpiry(c.end_date);
      return days !== null && days >= 0 && days <= 180;
    }).length;

    const stats = [
      { label: 'Familienmitglieder', value: householdMembers.length },
      { label: 'Aktive Verträge', value: activeContracts },
      { label: 'Gesellschaften', value: insurers },
      { label: 'Jahresprämie gesamt', value: formatCurrency(totalPremium) },
      { label: 'Offene Reviews', value: openReviews },
      { label: 'Abläufe (180d)', value: expiringCount }
    ];

    doc.setFontSize(9);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(60, 60, 60);
    const statColWidth = (pageWidth - 2 * margin) / 3;

    stats.forEach((stat, idx) => {
      const row = Math.floor(idx / 3);
      const col = idx % 3;
      const x = margin + col * statColWidth;
      const y = yPos + row * 15;

      doc.setFont('helvetica', 'bold');
      doc.setFontSize(9);
      doc.text(stat.label, x + 4, y);

      doc.setFont('helvetica', 'normal');
      doc.setFontSize(11);
      doc.setTextColor(33, 105, 180);
      doc.text(String(stat.value), x + 4, y + 7);
      doc.setTextColor(60, 60, 60);
    });

    yPos += 36;
    doc.setDrawColor(100, 150, 200);
    doc.setLineWidth(1);
    doc.line(margin, yPos, pageWidth - margin, yPos);
    yPos += 12;

    // ===== HOUSEHOLD MEMBERS & CONTRACTS =====

    householdMembers.forEach((member, memberIdx) => {
      const memberContracts = householdContracts.filter(c => c.customer_id === member.id);
      
      // Check if we need a new page
      const estimatedHeight = 55 + memberContracts.length * 8;
      if (yPos + estimatedHeight > pageHeight - margin) {
        doc.addPage();
        yPos = margin;
      }

      // Member header
      const headerColors = [
        [33, 105, 180],
        [52, 152, 219],
        [155, 89, 182],
        [46, 125, 50]
      ];
      const headerColor = headerColors[memberIdx % headerColors.length];
      
      doc.setFillColor(...headerColor);
      doc.setDrawColor(...headerColor);
      doc.setLineWidth(0.8);
      doc.rect(margin, yPos, pageWidth - 2 * margin, 12, 'FD');

      doc.setTextColor(255, 255, 255);
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(12);
      const roleLabel = member.id === customer.id ? '(Hauptkontakt)' : `(${member.family_role === 'spouse' ? 'Ehepartner/in' : member.family_role === 'child' ? 'Kind' : 'Familienmitglied'})`;
      doc.text(`${member.first_name} ${member.last_name} ${roleLabel}`, margin + 6, yPos + 8);
      doc.setTextColor(0, 0, 0);

      yPos += 16;

      // Member info
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(10);
      doc.setTextColor(70, 70, 70);
      const infoLines = [
        member.birthdate ? `Geb.: ${formatDate(member.birthdate)}` : '',
        `Verträge: ${memberContracts.length}`,
        `Jahresprämie: ${formatCurrency(memberContracts.reduce((sum, c) => sum + (c.premium_yearly || 0), 0))}`
      ].filter(l => l);

      infoLines.forEach((line, idx) => {
        doc.text(line, margin + 6, yPos + idx * 5.5);
      });

      yPos += infoLines.length * 5.5 + 8;

      // Contracts table
      if (memberContracts.length > 0) {
        const colWidths = {
          sparte: 35,
          insurer: 45,
          policy: 35,
          expiry: 30,
          premium: 30
        };

        // Table header
        doc.setFillColor(...headerColor);
        doc.setTextColor(255, 255, 255);
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(9);

        const headers = [
          { label: 'Sparte', width: colWidths.sparte },
          { label: 'Gesellschaft', width: colWidths.insurer },
          { label: 'Police', width: colWidths.policy },
          { label: 'Ablauf', width: colWidths.expiry },
          { label: 'Jahresprämie', width: colWidths.premium }
        ];

        let xPos = margin;
        headers.forEach(h => {
          doc.setLineWidth(0.3);
          doc.rect(xPos, yPos, h.width, 8, 'F');
          doc.text(h.label, xPos + 2, yPos + 5.5);
          xPos += h.width;
        });

        yPos += 9;

        // Contract rows
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(9);
        doc.setTextColor(0, 0, 0);

        memberContracts.forEach(contract => {
          const statusColor = getStatusColor(contract);
          xPos = margin;

          // Row background
          doc.setFillColor(...statusColor.bg);
          doc.setLineWidth(0.2);
          doc.rect(xPos, yPos, pageWidth - 2 * margin, 7.5, 'F');

          doc.setTextColor(...statusColor.text);

          // Sparte
          doc.text(contract.sparte || contract.insurance_type || '–', xPos + 2, yPos + 5);
          xPos += colWidths.sparte;

          // Insurer
          doc.text(contract.insurer || '–', xPos + 2, yPos + 5);
          xPos += colWidths.insurer;

          // Policy
          doc.text(contract.policy_number || '–', xPos + 2, yPos + 5);
          xPos += colWidths.policy;

          // Expiry
          if (contract.end_date) {
            const days = getDaysUntilExpiry(contract.end_date);
            const expiryText = days === null ? formatDate(contract.end_date) : `${formatDate(contract.end_date)} (${days}d)`;
            doc.text(expiryText, xPos + 2, yPos + 5);
          } else {
            doc.text('–', xPos + 2, yPos + 5);
          }
          xPos += colWidths.expiry;

          // Premium
          doc.text(formatCurrency(contract.premium_yearly), xPos + 2, yPos + 5);

          yPos += 8;
        });
      }

      yPos += 12;
    });

    // ===== FINAL PAGE: OPPORTUNITIES & REVIEWS =====

    if (yPos > pageHeight - 80) {
      doc.addPage();
      yPos = margin;
    }

    doc.setDrawColor(100, 150, 200);
    doc.setLineWidth(1);
    doc.line(margin, yPos, pageWidth - margin, yPos);
    yPos += 12;

    doc.setFontSize(14);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(33, 105, 180);
    doc.text('Beratungspotential & Abläufe', margin, yPos);
    yPos += 11;

    doc.setFontSize(10);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(60, 60, 60);

    // Open opportunities
    const openOpportunities = verkaufschancen.filter(v => v.customer_id === customer.id && !['gewonnen', 'verloren'].includes(v.status));
    if (openOpportunities.length > 0) {
      doc.setFont('helvetica', 'bold');
      doc.text('Offene Verkaufschancen:', margin, yPos);
      yPos += 7;

      doc.setFont('helvetica', 'normal');
      openOpportunities.slice(0, 5).forEach(opp => {
        doc.text(`• ${opp.title} (${opp.sparte || '–'})`, margin + 5, yPos);
        yPos += 5.5;
      });

      yPos += 4;
    }

    // Open reviews
    if (householdTasks.length > 0) {
      doc.setFont('helvetica', 'bold');
      doc.text('Offene Aufgaben:', margin, yPos);
      yPos += 7;

      doc.setFont('helvetica', 'normal');
      householdTasks.slice(0, 5).forEach(task => {
        doc.text(`• ${task.title}`, margin + 5, yPos);
        yPos += 5.5;
      });

      yPos += 4;
    }

    // Status legend
    yPos += 8;
    doc.setDrawColor(100, 150, 200);
    doc.setLineWidth(1);
    doc.line(margin, yPos, pageWidth - margin, yPos);
    yPos += 10;

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(11);
    doc.setTextColor(33, 105, 180);
    doc.text('Status-Farbcodierung:', margin, yPos);
    yPos += 8;

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9);
    doc.setTextColor(60, 60, 60);

    const legend = [
      { color: [200, 230, 201], label: 'GRÜN: stabil – keine Massnahmen nötig' },
      { color: [255, 235, 130], label: 'ORANGE: Warnung – Ablauf in < 90 Tagen' },
      { color: [255, 179, 71], label: 'ORANGE-ROT: kritisch – Ablauf in < 30 Tagen' },
      { color: [255, 205, 210], label: 'ROT: überfällig – sofort handeln' }
    ];

    legend.forEach(item => {
      doc.setFillColor(...item.color);
      doc.setDrawColor(200, 200, 200);
      doc.setLineWidth(0.2);
      doc.rect(margin + 5, yPos - 2.5, 6, 6, 'FD');
      doc.text(item.label, margin + 13, yPos);
      yPos += 7;
    });

    // Footer
    doc.setFontSize(8);
    doc.setTextColor(150, 150, 150);
    doc.setFont('helvetica', 'normal');
    const now = new Date();
    const dateStr = now.toLocaleDateString('de-CH') + ', ' + now.toLocaleTimeString('de-CH', { hour: '2-digit', minute: '2-digit' });
    doc.text(`Erstellt: ${dateStr}`, margin, pageHeight - 6);

    // Export PDF as binary
    const pdfBytes = doc.output('arraybuffer');

    return new Response(pdfBytes, {
      status: 200,
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename=Haushaltsübersicht_${customer.last_name}_${new Date().toISOString().split('T')[0]}.pdf`
      }
    });
  } catch (error) {
    console.error('PDF Generation Error:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});