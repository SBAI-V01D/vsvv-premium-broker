import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';
import { jsPDF } from 'npm:jspdf@4.0.0';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    
    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { customer_id } = await req.json();
    if (!customer_id) {
      return Response.json({ error: 'customer_id required' }, { status: 400 });
    }

    // Fetch data
    const [customer, familyMembers, allContracts, tasks, opportunities] = await Promise.all([
      base44.entities.Customer.filter({ id: customer_id }).then(r => r[0]),
      base44.entities.Customer.filter({ primary_customer_id: customer_id, is_family_member: true }),
      base44.entities.Contract.filter({ customer_id }),
      base44.entities.Task.filter({ customer_id }),
      base44.entities.Verkaufschance.filter({ customer_id })
    ]);

    if (!customer) {
      return Response.json({ error: 'Customer not found' }, { status: 404 });
    }

    // Get family member contracts
    const familyContractPromises = familyMembers.map(fm => 
      base44.entities.Contract.filter({ customer_id: fm.id })
    );
    const familyContractResults = await Promise.all(familyContractPromises);
    const allFamilyContracts = familyContractResults.flat();
    const contracts = [...allContracts, ...allFamilyContracts];

    // Create PDF (Portrait) with UTF-8 support
    const doc = new jsPDF({ 
      orientation: 'portrait', 
      unit: 'mm', 
      format: 'a4',
      compress: false 
    });
    
    doc.setFont('helvetica');
    let yPos = 15;
    const pageHeight = doc.internal.pageSize.getHeight();
    const pageWidth = doc.internal.pageSize.getWidth();
    const margin = 15;
    const contentWidth = pageWidth - 2 * margin;

    // Helpers
    const addNewPage = () => {
      doc.addPage();
      yPos = margin;
    };

    const checkPageBreak = (needed = 15) => {
      if (yPos + needed > pageHeight - margin) {
        addNewPage();
      }
    };

    const addSection = (title) => {
      checkPageBreak(10);
      doc.setFontSize(14);
      doc.setFont('helvetica', 'bold');
      doc.text(String(title).normalize('NFC'), margin, yPos);
      yPos += 8;
      doc.setDrawColor(31, 41, 55);
      doc.line(margin, yPos - 2, pageWidth - margin, yPos - 2);
      yPos += 4;
    };

    const addField = (label, value) => {
      doc.setFontSize(9);
      doc.setFont('helvetica', 'bold');
      doc.text(String(label).normalize('NFC'), margin, yPos);
      doc.setFont('helvetica', 'normal');
      doc.text(String(value || '—').normalize('NFC'), margin + 50, yPos);
      yPos += 5;
    };

    // === PAGE 1: DECKBLATT ===
    // Header Background
    doc.setFillColor(31, 41, 55);
    doc.rect(0, 0, pageWidth, 60, 'F');

    // Title
    doc.setFontSize(28);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(255, 255, 255);
    doc.text('Haushaltsübersicht'.normalize('NFC'), margin, 25);

    // Date
    doc.setFontSize(10);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(200, 200, 200);
    doc.text(new Date().toLocaleDateString('de-CH', { year: 'numeric', month: 'long', day: 'numeric' }), margin, 40);

    // Reset colors
    doc.setTextColor(0, 0, 0);
    yPos = 75;

    // Primary Customer
    doc.setFontSize(12);
    doc.setFont('helvetica', 'bold');
    doc.text('Hauptkontakt'.normalize('NFC'), margin, yPos);
    yPos += 7;

    doc.setFontSize(14);
    doc.setFont('helvetica', 'bold');
    doc.text(`${customer.first_name || ''} ${customer.last_name || ''}`.normalize('NFC'), margin, yPos);
    yPos += 8;

    doc.setFontSize(10);
    doc.setFont('helvetica', 'normal');
    if (customer.birthdate) {
      doc.text(`Geburtsdatum: ${customer.birthdate}`, margin, yPos);
      yPos += 6;
    }
    if (customer.street) {
      doc.text(`${customer.street}`.normalize('NFC'), margin, yPos);
      yPos += 5;
    }
    if (customer.zip_code || customer.city) {
      doc.text(`${customer.zip_code || ''} ${customer.city || ''}`.normalize('NFC'), margin, yPos);
      yPos += 5;
    }

    yPos += 10;

    // Stats
    const totalPremium = contracts.reduce((s, c) => s + (c.premium_yearly || 0), 0);
    const stats = [
      ['👨‍👩‍👧‍👦 Familienmitglieder', (familyMembers.length + 1).toString()],
      ['📋 Aktive Verträge', contracts.filter(c => c.status === 'active').length.toString()],
      ['🏢 Gesellschaften', new Set(contracts.map(c => c.insurer)).size.toString()],
      ['💰 Jahresprämie', `CHF ${totalPremium.toLocaleString('de-CH')}`]
    ];

    doc.setFontSize(10);
    doc.setFont('helvetica', 'bold');
    doc.text('Haushalts-Kennzahlen:'.normalize('NFC'), margin, yPos);
    yPos += 7;

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9);
    stats.forEach(([label, value]) => {
      doc.text(`${label}`, margin, yPos);
      doc.setFont('helvetica', 'bold');
      doc.text(value, margin + 70, yPos);
      doc.setFont('helvetica', 'normal');
      yPos += 6;
    });

    // === PAGE 2: FAMILIENMITGLIEDER ===
    addNewPage();
    addSection('👨‍👩‍👧‍👦 Familienmitglieder');

    // Hauptkontakt
    doc.setFontSize(9);
    doc.setFont('helvetica', 'bold');
    doc.text('Hauptkontakt'.normalize('NFC'), margin, yPos);
    yPos += 5;

    addField('Name', `${customer.first_name || ''} ${customer.last_name || ''}`);
    addField('Rolle', 'Hauptkontakt');
    addField('Geburtsdatum', customer.birthdate || '—');
    addField('E-Mail', customer.email || '—');
    addField('Telefon', customer.phone || customer.mobile || '—');
    
    yPos += 3;

    // Family Members
    if (familyMembers.length > 0) {
      familyMembers.forEach((m, idx) => {
        checkPageBreak(15);
        doc.setFontSize(9);
        doc.setFont('helvetica', 'bold');
        doc.text(`Mitglied ${idx + 1}`.normalize('NFC'), margin, yPos);
        yPos += 5;

        const roleLabel = m.family_role === 'spouse' ? 'Ehepartner/in' : m.family_role === 'child' ? 'Kind' : m.family_role === 'parent' ? 'Elternteil' : 'Mitglied';
        addField('Name', `${m.first_name || ''} ${m.last_name || ''}`);
        addField('Rolle', roleLabel);
        addField('Geburtsdatum', m.birthdate || '—');
        
        yPos += 2;
      });
    }

    // === PAGE 3+: VERTRÄGE NACH SPARTEN ===
    if (contracts.length > 0) {
      addNewPage();
      addSection('📋 Vertragsübersicht');

      // Group by sparte
      const bySparte = {};
      contracts.forEach(c => {
        const sparte = c.sparte || c.insurance_type || 'Sonstige';
        if (!bySparte[sparte]) bySparte[sparte] = [];
        bySparte[sparte].push(c);
      });

      // Gesamtprämie
      doc.setFontSize(9);
      doc.setFont('helvetica', 'bold');
      doc.setFillColor(240, 240, 240);
      doc.rect(margin, yPos - 3, contentWidth, 8, 'F');
      doc.text('Gesamtprämie (jährlich):', margin + 2, yPos + 2);
      doc.text(`CHF ${totalPremium.toLocaleString('de-CH')}`, margin + 70, yPos + 2);
      yPos += 10;

      Object.entries(bySparte).forEach(([sparteKey, sparteContracts]) => {
        checkPageBreak(12);
        doc.setFontSize(10);
        doc.setFont('helvetica', 'bold');
        doc.setTextColor(31, 41, 55);
        doc.text(`${sparteKey} (${sparteContracts.length})`.normalize('NFC'), margin, yPos);
        doc.setTextColor(0, 0, 0);
        yPos += 6;

        sparteContracts.forEach(c => {
          checkPageBreak(8);
          doc.setFontSize(9);
          doc.setFont('helvetica', 'normal');

          const personName = c.customer_id === customer.id 
            ? customer.first_name 
            : familyMembers.find(m => m.id === c.customer_id)?.first_name || '—';

          // Company
          doc.setFont('helvetica', 'bold');
          doc.text(String(c.insurer || '—').normalize('NFC'), margin + 3, yPos);
          yPos += 4;

          // Details
          doc.setFont('helvetica', 'normal');
          doc.setFontSize(8);
          const details = [
            c.policy_number ? `Police: ${c.policy_number}` : '',
            `Person: ${personName}`,
            c.end_date ? `Ablauf: ${new Date(c.end_date).toLocaleDateString('de-CH')}` : 'Ablauf: —'
          ].filter(Boolean).join(' | ');
          doc.text(details, margin + 3, yPos);
          yPos += 4;

          // Premium
          if (c.premium_yearly) {
            doc.text(`Prämie: CHF ${c.premium_yearly.toLocaleString('de-CH')}/a`, margin + 3, yPos);
            yPos += 3;
          }

          // Status
          const days = c.end_date ? Math.ceil((new Date(c.end_date) - new Date()) / (1000 * 60 * 60 * 24)) : null;
          let statusLabel = '✓ Stabil';
          if (days !== null) {
            if (days < 0) statusLabel = '✗ Überfällig';
            else if (days <= 30) statusLabel = '⚠ Ablauf < 30 Tage';
            else if (days <= 90) statusLabel = '⏰ Ablauf < 90 Tage';
          }
          doc.setFont('helvetica', 'bold');
          doc.setFontSize(8);
          doc.setTextColor(statusLabel.includes('✗') ? 220 : statusLabel.includes('⚠') ? 180 : 34, 180, 34);
          doc.text(statusLabel, margin + 3, yPos);
          doc.setTextColor(0, 0, 0);
          yPos += 4;

          yPos += 1;
        });

        yPos += 2;
      });
    }

    // === PAGE: VERTRAGSABLÄUFE & REVIEWS ===
    const expiringContracts = contracts
      .filter(c => c.end_date && Math.ceil((new Date(c.end_date) - new Date()) / (1000 * 60 * 60 * 24)) <= 180)
      .sort((a, b) => new Date(a.end_date) - new Date(b.end_date))
      .slice(0, 10);
    
    const openReviewTasks = tasks
      .filter(t => t.task_type === 'consultation' && t.status !== 'completed')
      .slice(0, 5);

    if (expiringContracts.length > 0 || openReviewTasks.length > 0) {
      addNewPage();
      addSection('⏰ Vertragsabläufe & Beratungsbedarf');

      if (expiringContracts.length > 0) {
        doc.setFontSize(10);
        doc.setFont('helvetica', 'bold');
        doc.text('Nächste Ablaufdaten:'.normalize('NFC'), margin, yPos);
        yPos += 6;

        expiringContracts.forEach(c => {
          checkPageBreak(6);
          const days = Math.ceil((new Date(c.end_date) - new Date()) / (1000 * 60 * 60 * 24));
          const urgency = days < 0 ? '✗ Überfällig' : days <= 30 ? '⚠ Dringend' : '⏰ Geplant';
          
          doc.setFontSize(9);
          doc.setFont('helvetica', 'normal');
          doc.text(String(c.insurer || '—').normalize('NFC'), margin + 3, yPos);
          doc.setFont('helvetica', 'bold');
          doc.text(new Date(c.end_date).toLocaleDateString('de-CH'), margin + 70, yPos);
          doc.text(urgency, margin + 100, yPos);
          doc.setFont('helvetica', 'normal');
          yPos += 5;
        });
      }

      if (openReviewTasks.length > 0) {
        yPos += 3;
        doc.setFontSize(10);
        doc.setFont('helvetica', 'bold');
        doc.text('Offene Beratungen:'.normalize('NFC'), margin, yPos);
        yPos += 6;

        openReviewTasks.forEach(t => {
          checkPageBreak(5);
          doc.setFontSize(9);
          doc.setFont('helvetica', 'normal');
          doc.text(String(t.title || '—').normalize('NFC'), margin + 3, yPos, { maxWidth: contentWidth - 6 });
          yPos += 5;
        });
      }
    }

    // === PAGE: VERKAUFSCHANCEN ===
    const openOpp = opportunities
      .filter(o => !['gewonnen', 'verloren'].includes(o.status))
      .slice(0, 8);

    if (openOpp.length > 0) {
      addNewPage();
      addSection('💡 Verkaufschancen & Beratungspotential');

      openOpp.forEach(o => {
        checkPageBreak(10);
        doc.setFontSize(9);
        doc.setFont('helvetica', 'bold');
        doc.text(String(o.title || '—').normalize('NFC'), margin, yPos);
        yPos += 4;

        doc.setFont('helvetica', 'normal');
        doc.setFontSize(8);
        doc.text(`Sparte: ${o.sparte || '—'} | Status: ${o.status || '—'}`, margin + 2, yPos);
        yPos += 3;

        if (o.estimated_value) {
          doc.text(`Geschätztes Volumen: CHF ${o.estimated_value.toLocaleString('de-CH')}`, margin + 2, yPos);
          yPos += 3;
        }

        if (o.expected_close_date) {
          doc.text(`Geplanter Abschluss: ${new Date(o.expected_close_date).toLocaleDateString('de-CH')}`, margin + 2, yPos);
          yPos += 3;
        }

        yPos += 2;
      });
    }

    // === PAGE: OFFENE AUFGABEN ===
    const openTasks = tasks.filter(t => t.status !== 'completed').slice(0, 12);

    if (openTasks.length > 0) {
      addNewPage();
      addSection('📝 Offene Aufgaben & Punkte');

      openTasks.forEach(t => {
        checkPageBreak(7);
        doc.setFontSize(9);
        doc.setFont('helvetica', 'bold');
        doc.text(String(t.title || '—').normalize('NFC'), margin, yPos);
        yPos += 4;

        doc.setFont('helvetica', 'normal');
        doc.setFontSize(8);
        const priorityLabel = t.priority === 'urgent' ? '🔴 Dringend' : t.priority === 'high' ? '🟠 Hoch' : '🟡 Normal';
        const dueDate = t.due_date ? `Fällig: ${new Date(t.due_date).toLocaleDateString('de-CH')}` : '';
        doc.text(`Priorität: ${priorityLabel}${dueDate ? ` | ${dueDate}` : ''}`, margin + 2, yPos);
        yPos += 3;

        yPos += 1;
      });
    }

    // Generate PDF
    const pdfBytes = doc.output('arraybuffer');

    return new Response(pdfBytes, {
      status: 200,
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="Haushaltsübersicht_${customer.last_name}_${new Date().toISOString().split('T')[0]}.pdf"`
      }
    });

  } catch (error) {
    console.error('Error:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});