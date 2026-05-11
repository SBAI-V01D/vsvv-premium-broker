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

    // Create PDF (A4 Landscape) with UTF-8 support
    const doc = new jsPDF({ 
      orientation: 'landscape', 
      unit: 'mm', 
      format: 'a4',
      compress: false 
    });
    
    // Register Arial Unicode for UTF-8 support
    doc.setFont('helvetica');
    let yPos = 15;
    const pageWidth = doc.internal.pageSize.getWidth();
    const margin = 12;
    const contentWidth = pageWidth - 2 * margin;

    // Helper functions
    const addSection = (title) => {
      doc.setFontSize(14);
      doc.setFont('helvetica', 'bold');
      doc.text(String(title).normalize('NFC'), margin, yPos);
      yPos += 8;
      doc.setDrawColor(180);
      doc.line(margin, yPos - 2, pageWidth - margin, yPos - 2);
      yPos += 4;
    };

    const addSubsection = (title) => {
      doc.setFontSize(12);
      doc.setFont('helvetica', 'bold');
      doc.text(String(title).normalize('NFC'), margin, yPos);
      yPos += 6;
    };

    const addField = (label, value) => {
      doc.setFontSize(10);
      doc.setFont('helvetica', 'bold');
      doc.text(String(label).normalize('NFC'), margin, yPos);
      doc.setFont('helvetica', 'normal');
      const fieldWidth = contentWidth / 2 - 5;
      const val = String(value || '—').normalize('NFC');
      doc.text(val, margin + 55, yPos, { maxWidth: fieldWidth });
      yPos += 5;
    };

    const newPageIfNeeded = () => {
      if (yPos > 185) {
        doc.addPage();
        yPos = 15;
      }
    };

    // === HEADER ===
    doc.setFontSize(18);
    doc.setFont('helvetica', 'bold');
    const headerText = 'Haushalts-/Familienübersicht';
    // Encode text properly for UTF-8
    doc.text(headerText, margin, yPos);
    yPos += 10;
    doc.setFontSize(10);
    doc.setFont('helvetica', 'normal');
    doc.text(`Erstellt: ${new Date().toLocaleDateString('de-CH')}`, margin, yPos);
    yPos += 12;

    // === HAUPTKONTAKT ===
    addSection('Hauptkontakt'.normalize('NFC'));
    addField('Name', `${customer.first_name || ''} ${customer.last_name || ''}`);
    addField('Email', customer.email || '—');
    addField('Telefon', customer.phone || customer.mobile || '—');
    addField('Geburtsdatum', customer.birthdate ? new Date(customer.birthdate).toLocaleDateString('de-CH') : '—');
    addField('Adresse', `${customer.street || '—'}, ${customer.zip_code || '—'} ${customer.city || '—'}`);
    yPos += 5;

    newPageIfNeeded();

    // === FAMILIENMITGLIEDER ===
    if (familyMembers.length > 0) {
      addSection('Familienmitglieder'.normalize('NFC'));
      familyMembers.forEach((member, i) => {
        addSubsection(`${i + 1}. ${member.first_name || ''} ${member.last_name || ''}`);
        addField('Rolle', member.family_role === 'spouse' ? 'Ehepartner/in' : member.family_role === 'child' ? 'Kind' : member.family_role || 'Mitglied');
        addField('Geburtsdatum', member.birthdate ? new Date(member.birthdate).toLocaleDateString('de-CH') : '—');
        yPos += 4;
        newPageIfNeeded();
      });
    }

    // === VERTRÄGE ===
    if (contracts.length > 0) {
      addSection('Verträge'.normalize('NFC'));
      
      // Group by person
      const primaryContracts = contracts.filter(c => c.customer_id === customer.id);
      
      if (primaryContracts.length > 0) {
        addSubsection(`${customer.first_name || ''} ${customer.last_name || ''}`);
        primaryContracts.forEach(c => {
          const statusLabel = c.status === 'active' ? '✓ Aktiv' : c.status === 'expired' ? '✗ Abgelaufen' : '— Inaktiv';
          doc.setFontSize(9);
          doc.setFont('helvetica', 'normal');
          const contractText = `${c.insurer || '—'} | ${c.sparte || c.insurance_type || '—'} | ${c.policy_number || '—'} | ${statusLabel}`;
          doc.text(String(contractText).normalize('NFC'), margin + 5, yPos, { maxWidth: contentWidth - 10 });
          yPos += 4;
          
          if (c.end_date) {
            doc.setFont('helvetica', 'bold');
            doc.setFontSize(9);
            doc.text(`Ablauf: ${new Date(c.end_date).toLocaleDateString('de-CH')}`, margin + 5, yPos);
            yPos += 4;
          }
          newPageIfNeeded();
        });
        yPos += 3;
      }

      familyMembers.forEach(member => {
        const memberContracts = contracts.filter(c => c.customer_id === member.id);
        if (memberContracts.length > 0) {
          addSubsection(`${member.first_name || ''} ${member.last_name || ''}`);
          memberContracts.forEach(c => {
            const statusLabel = c.status === 'active' ? '✓ Aktiv' : c.status === 'expired' ? '✗ Abgelaufen' : '— Inaktiv';
            doc.setFontSize(9);
            doc.setFont('helvetica', 'normal');
            const contractText = `${c.insurer || '—'} | ${c.sparte || c.insurance_type || '—'} | ${c.policy_number || '—'} | ${statusLabel}`;
            doc.text(String(contractText).normalize('NFC'), margin + 5, yPos, { maxWidth: contentWidth - 10 });
            yPos += 4;
            
            if (c.end_date) {
              doc.setFont('helvetica', 'bold');
              doc.setFontSize(9);
              doc.text(`Ablauf: ${new Date(c.end_date).toLocaleDateString('de-CH')}`, margin + 5, yPos);
              yPos += 4;
            }
            newPageIfNeeded();
          });
          yPos += 3;
        }
      });
    }

    newPageIfNeeded();

    // === OFFENE AUFGABEN ===
    if (tasks.length > 0) {
      const openTasks = tasks.filter(t => t.status !== 'completed').slice(0, 10);
      if (openTasks.length > 0) {
        addSection('Offene Aufgaben'.normalize('NFC'));
        openTasks.forEach(t => {
          doc.setFontSize(9);
          doc.setFont('helvetica', 'normal');
          const taskText = `${t.title || '—'} | Priorität: ${t.priority || '—'}`;
          doc.text(String(taskText).normalize('NFC'), margin + 5, yPos, { maxWidth: contentWidth - 10 });
          yPos += 4;
          newPageIfNeeded();
        });
      }
    }

    newPageIfNeeded();

    // === VERKAUFSCHANCEN ===
    if (opportunities.length > 0) {
      const openOpp = opportunities.filter(o => !['gewonnen', 'verloren'].includes(o.status)).slice(0, 5);
      if (openOpp.length > 0) {
        addSection('Verkaufschancen'.normalize('NFC'));
        openOpp.forEach(o => {
          doc.setFontSize(9);
          doc.setFont('helvetica', 'normal');
          const oppText = `${o.title || '—'} | ${o.sparte || '—'} | Status: ${o.status || '—'}`;
          doc.text(String(oppText).normalize('NFC'), margin + 5, yPos, { maxWidth: contentWidth - 10 });
          yPos += 4;
          newPageIfNeeded();
        });
      }
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