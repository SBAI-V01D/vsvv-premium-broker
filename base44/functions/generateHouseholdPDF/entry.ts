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
  if (days === null) return { bg: [200, 230, 201], text: [27, 94, 32], label: 'unbegrenzt' }; // green
  if (days < 0) return { bg: [255, 205, 210], text: [179, 0, 0], label: 'abgelaufen' }; // red
  if (days <= 30) return { bg: [255, 179, 71], text: [230, 126, 34], label: 'kritisch' }; // orange-red
  if (days <= 90) return { bg: [255, 235, 130], text: [240, 175, 0], label: 'warnung' }; // orange
  return { bg: [200, 230, 201], text: [27, 94, 32], label: 'stabil' }; // green
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

    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { customer_id } = await req.json();

    if (!customer_id) {
      return Response.json({ error: 'Missing customer_id' }, { status: 400 });
    }

    // Fetch data
    const [customer, allCustomers, contracts, verkaufschancen, tasks] = await Promise.all([
      base44.entities.Customer.filter({ id: customer_id }).then(res => res[0]),
      base44.entities.Customer.list(null, 1000),
      base44.entities.Contract.list(null, 1000),
      base44.entities.Verkaufschance.filter({ customer_id }),
      base44.entities.Task.list(null, 1000)
    ]);

    if (!customer) {
      return Response.json({ error: 'Customer not found' }, { status: 404 });
    }

    // Get household members (primary + family)
    const primaryCustomerId = customer.primary_customer_id || customer.id;
    const householdMembers = allCustomers.filter(c =>
      c.primary_customer_id === primaryCustomerId || c.id === primaryCustomerId
    ).sort((a, b) => (b.id === primaryCustomerId ? 1 : -1)); // Primary first

    // Get contracts and tasks for household
    const householdCustomerIds = householdMembers.map(m => m.id);
    const householdContracts = contracts.filter(c => householdCustomerIds.includes(c.customer_id));
    const householdTasks = tasks.filter(t =>
      householdCustomerIds.includes(t.customer_id) &&
      ['open', 'in_progress'].includes(t.status)
    );

    // Create PDF in LANDSCAPE format
    const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'A4' });
    const pageWidth = doc.internal.pageSize.getWidth();
    const pageHeight = doc.internal.pageSize.getHeight();
    const margin = 15;
    let yPos = margin;

    // ===== PAGE 1: HOUSEHOLD OVERVIEW =====

    // Title
    doc.setFontSize(24);
    doc.setFont('helvetica', 'bold');
    doc.text('Haushaltsübersicht', margin, yPos);
    yPos += 12;

    // Divider
    doc.setDrawColor(200, 200, 200);
    doc.line(margin, yPos, pageWidth - margin, yPos);
    yPos += 8;

    // Primary contact + address section
    doc.setFontSize(11);
    doc.setFont('helvetica', 'normal');

    const contactBoxHeight = 35;
    doc.setFillColor(245, 245, 245);
    doc.rect(margin, yPos, pageWidth - 2 * margin, contactBoxHeight, 'F');

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(12);
    doc.text(`${customer.first_name} ${customer.last_name}`, margin + 5, yPos + 8);

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(10);
    const addressLines = [
      customer.street ? `${customer.street}` : '',
      `${customer.zip_code} ${customer.city}`,
      customer.email || '',
      customer.phone || ''
    ].filter(l => l);

    let addressY = yPos + 15;
    addressLines.forEach(line => {
      doc.text(line, margin + 5, addressY);
      addressY += 5;
    });

    yPos += contactBoxHeight + 8;

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
    const statColWidth = (pageWidth - 2 * margin) / 3;

    stats.forEach((stat, idx) => {
      const row = Math.floor(idx / 3);
      const col = idx % 3;
      const x = margin + col * statColWidth;
      const y = yPos + row * 12;

      doc.setFont('helvetica', 'bold');
      doc.setFontSize(9);
      doc.text(stat.label, x + 2, y);

      doc.setFont('helvetica', 'normal');
      doc.setFontSize(10);
      doc.text(String(stat.value), x + 2, y + 6);
    });

    yPos += 30;
    doc.line(margin, yPos, pageWidth - margin, yPos);
    yPos += 8;

    // ===== FAMILY MEMBER SECTIONS =====

    householdMembers.forEach((member, memberIdx) => {
      const memberContracts = householdContracts.filter(c => c.customer_id === member.id);
      
      // Check if we need a new page
      const estimatedHeight = 50 + memberContracts.length * 8;
      if (yPos + estimatedHeight > pageHeight - margin) {
        doc.addPage();
        yPos = margin;
      }

      // Member header box
      const headerColor = memberIdx === 0 ? [66, 139, 202] : [100, 150, 180]; // Different colors
      doc.setFillColor(...headerColor);
      doc.setTextColor(255, 255, 255);
      doc.rect(margin, yPos, pageWidth - 2 * margin, 10, 'F');

      doc.setFont('helvetica', 'bold');
      doc.setFontSize(11);
      const roleLabel = member.id === customer.id ? '(Hauptkontakt)' : `(${member.family_role === 'spouse' ? 'Ehepartner/in' : member.family_role === 'child' ? 'Kind' : 'Familienmitglied'})`;
      doc.text(`${member.first_name} ${member.last_name} ${roleLabel}`, margin + 5, yPos + 6.5);
      doc.setTextColor(0, 0, 0);

      yPos += 12;

      // Member info
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(9);
      const infoLines = [
        member.birthdate ? `Geb.: ${formatDate(member.birthdate)}` : '',
        `Verträge: ${memberContracts.length}`,
        `Jahresprämie: ${formatCurrency(memberContracts.reduce((sum, c) => sum + (c.premium_yearly || 0), 0))}`
      ].filter(l => l);

      infoLines.forEach((line, idx) => {
        doc.text(line, margin + 5, yPos + idx * 5);
      });

      yPos += infoLines.length * 5 + 5;

      // Contracts table header
      if (memberContracts.length > 0) {
        const tableTop = yPos;
        const colWidths = {
          sparte: 35,
          insurer: 45,
          policy: 35,
          expiry: 30,
          premium: 30
        };

        doc.setFillColor(230, 230, 230);
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(8);

        const headers = [
          { label: 'Sparte', width: colWidths.sparte },
          { label: 'Gesellschaft', width: colWidths.insurer },
          { label: 'Police', width: colWidths.policy },
          { label: 'Ablauf', width: colWidths.expiry },
          { label: 'Jahresprämie', width: colWidths.premium }
        ];

        let xPos = margin;
        headers.forEach(h => {
          doc.rect(xPos, yPos, h.width, 7, 'F');
          doc.text(h.label, xPos + 2, yPos + 5);
          xPos += h.width;
        });

        yPos += 8;

        // Contract rows
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(8);

        memberContracts.forEach(contract => {
          const statusColor = getStatusColor(contract);
          xPos = margin;

          // Row background color based on status
          doc.setFillColor(...statusColor.bg);
          doc.rect(xPos, yPos, pageWidth - 2 * margin, 6, 'F');

          doc.setTextColor(...statusColor.text);

          // Sparte
          doc.text(contract.sparte || contract.insurance_type || '–', xPos + 2, yPos + 4.5);
          xPos += colWidths.sparte;

          // Insurer
          doc.text(contract.insurer || '–', xPos + 2, yPos + 4.5);
          xPos += colWidths.insurer;

          // Policy
          doc.text(contract.policy_number || '–', xPos + 2, yPos + 4.5);
          xPos += colWidths.policy;

          // Expiry
          if (contract.end_date) {
            const days = getDaysUntilExpiry(contract.end_date);
            const expiryText = days === null ? formatDate(contract.end_date) : `${formatDate(contract.end_date)} (${days}d)`;
            doc.text(expiryText, xPos + 2, yPos + 4.5);
          } else {
            doc.text('–', xPos + 2, yPos + 4.5);
          }
          xPos += colWidths.expiry;

          // Premium
          doc.text(formatCurrency(contract.premium_yearly), xPos + 2, yPos + 4.5);

          doc.setTextColor(0, 0, 0);
          yPos += 7;
        });
      }

      yPos += 8;
    });

    // ===== FINAL PAGE: OPPORTUNITIES & REVIEWS =====

    if (yPos > pageHeight - 80) {
      doc.addPage();
      yPos = margin;
    }

    doc.setDrawColor(200, 200, 200);
    doc.line(margin, yPos, pageWidth - margin, yPos);
    yPos += 8;

    doc.setFontSize(14);
    doc.setFont('helvetica', 'bold');
    doc.text('Beratungspotential & Abläufe', margin, yPos);
    yPos += 10;

    doc.setFontSize(9);
    doc.setFont('helvetica', 'normal');

    // Open opportunities
    const openOpportunities = verkaufschancen.filter(v => !['gewonnen', 'verloren'].includes(v.status));
    if (openOpportunities.length > 0) {
      doc.setFont('helvetica', 'bold');
      doc.text('Offene Verkaufschancen:', margin, yPos);
      yPos += 6;

      doc.setFont('helvetica', 'normal');
      openOpportunities.slice(0, 5).forEach(opp => {
        doc.text(`• ${opp.title} (${opp.sparte || '–'})`, margin + 5, yPos);
        yPos += 5;
      });

      yPos += 3;
    }

    // Open reviews
    if (householdTasks.length > 0) {
      doc.setFont('helvetica', 'bold');
      doc.text('Offene Aufgaben:', margin, yPos);
      yPos += 6;

      doc.setFont('helvetica', 'normal');
      householdTasks.slice(0, 5).forEach(task => {
        const priority = task.priority === 'urgent' ? '🔴' : task.priority === 'high' ? '🟠' : '🟡';
        doc.text(`${priority} ${task.title}`, margin + 5, yPos);
        yPos += 5;
      });

      yPos += 3;
    }

    // Status legend
    yPos += 5;
    doc.setDrawColor(200, 200, 200);
    doc.line(margin, yPos, pageWidth - margin, yPos);
    yPos += 8;

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(9);
    doc.text('Status-Legende:', margin, yPos);
    yPos += 6;

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);

    const legend = [
      { color: [200, 230, 201], label: 'GRÜN: Stabil – keine Massnahmen nötig' },
      { color: [255, 235, 130], label: 'ORANGE: Warnung – Ablauf in < 90 Tagen' },
      { color: [255, 179, 71], label: 'ORANGE-ROT: Kritisch – Ablauf in < 30 Tagen' },
      { color: [255, 205, 210], label: 'ROT: Überfällig – sofort handeln' }
    ];

    legend.forEach(item => {
      doc.setFillColor(...item.color);
      doc.rect(margin + 5, yPos - 2, 4, 4, 'F');
      doc.text(item.label, margin + 11, yPos);
      yPos += 6;
    });

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