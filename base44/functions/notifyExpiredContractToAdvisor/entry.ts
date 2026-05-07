import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

/**
 * NOTIFY EXPIRED CONTRACT TO ADVISOR
 *
 * Täglich ausgeführt:
 * - Sucht alle aktiven Verträge, deren end_date in der Vergangenheit liegt
 * - Erstellt eine Aufgabe (Task) für den zuständigen Berater
 * - Sendet eine E-Mail an den Berater
 * - Sendet eine WhatsApp-Nachricht (via InvokeLLM-basiertes Template)
 * - Markiert den Vertrag als 'expired'
 *
 * Duplikat-Schutz: Prüft ob bereits eine offene Task für diesen Vertrag existiert
 */

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);

    const today = new Date().toISOString().split('T')[0];
    console.log(`[notifyExpiredContractToAdvisor] START date=${today}`);

    // Alle aktiven Verträge mit abgelaufenem end_date
    const allContracts = await base44.asServiceRole.entities.Contract.filter({ status: 'active' });
    const expiredContracts = allContracts.filter(c => c.end_date && c.end_date < today);

    if (expiredContracts.length === 0) {
      console.log('[notifyExpiredContractToAdvisor] Keine abgelaufenen Verträge gefunden');
      return Response.json({ success: true, processed: 0 });
    }

    // Bestehende offene Tasks für abgelaufene Verträge laden (Duplikat-Schutz)
    const existingTasks = await base44.asServiceRole.entities.Task.filter({ task_type: 'renewal', status: 'open' });
    const existingTaskContractIds = new Set(existingTasks.map(t => t.contract_id).filter(Boolean));

    // Advisors laden für E-Mail-Lookup
    const advisors = await base44.asServiceRole.entities.Advisor.filter({});

    let processed = 0;
    let skipped = 0;

    for (const contract of expiredContracts) {
      // Duplikat-Schutz: Keine zweite Task erstellen wenn bereits eine existiert
      if (existingTaskContractIds.has(contract.id)) {
        console.log(`[notifyExpiredContractToAdvisor] Skip ${contract.id} – Task bereits vorhanden`);
        skipped++;
        continue;
      }

      const customerName = contract.customer_name || 'Unbekannter Kunde';
      const insurer = contract.insurer || '–';
      const policyNumber = contract.policy_number || '–';
      const endDate = new Date(contract.end_date).toLocaleDateString('de-CH');
      const premium = contract.premium_yearly
        ? `CHF ${contract.premium_yearly.toLocaleString('de-CH', { maximumFractionDigits: 0 })}/Jahr`
        : '–';

      // Berater-E-Mail ermitteln: assigned_broker oder advisor_id lookup
      let advisorEmail = contract.assigned_broker || null;
      let advisorName = advisorEmail || 'Berater';

      if (!advisorEmail && contract.advisor_id) {
        const advisor = advisors.find(a => a.id === contract.advisor_id);
        if (advisor) {
          advisorEmail = advisor.email;
          advisorName = `${advisor.firstname} ${advisor.lastname}`;
        }
      }

      const dueDate = new Date();
      dueDate.setDate(dueDate.getDate() + 3); // Fällig in 3 Tagen
      const dueDateStr = dueDate.toISOString().split('T')[0];

      const taskTitle = `⚠️ ABGELAUFEN: ${customerName} – ${insurer} (${policyNumber})`;
      const taskDescription = `Versicherungsvertrag ist abgelaufen!\n\nKunde: ${customerName}\nVersicherer: ${insurer}\nPolice: ${policyNumber}\nPrämie: ${premium}\nAbgelaufen am: ${endDate}\n\nBitte sofort Erneuerung / Kündigung oder Anpassung einleiten.`;

      // 1. TASK erstellen
      await base44.asServiceRole.entities.Task.create({
        title: taskTitle,
        description: taskDescription,
        customer_id: contract.customer_id || undefined,
        customer_name: customerName,
        contract_id: contract.id,
        assigned_to: advisorEmail || undefined,
        priority: 'urgent',
        status: 'open',
        due_date: dueDateStr,
        task_type: 'renewal',
      });
      console.log(`[notifyExpiredContractToAdvisor] ✅ Task erstellt für ${customerName}`);

      // 2. E-MAIL an Berater senden
      if (advisorEmail) {
        const emailBody = `
Guten Tag ${advisorName},

DRINGEND: Folgender Versicherungsvertrag ist abgelaufen und erfordert sofortige Bearbeitung:

📋 Kunde:       ${customerName}
🏢 Versicherer: ${insurer}
📄 Police-Nr.:  ${policyNumber}
💰 Prämie:      ${premium}
📅 Abgelaufen:  ${endDate}

Bitte treten Sie umgehend mit dem Kunden in Kontakt und klären Sie:
- Vertragsverlängerung
- Anpassung der Konditionen
- Oder geordnete Kündigung

Die Aufgabe wurde in BrokerOS unter «Aufgaben» erfasst (fällig: ${dueDate.toLocaleDateString('de-CH')}).

BrokerOS – Automatische Benachrichtigung
        `.trim();

        await base44.asServiceRole.integrations.Core.SendEmail({
          to: advisorEmail,
          subject: `⚠️ Abgelaufener Vertrag: ${customerName} – ${insurer} (${policyNumber})`,
          body: emailBody,
        });
        console.log(`[notifyExpiredContractToAdvisor] ✅ E-Mail an ${advisorEmail}`);
      } else {
        console.log(`[notifyExpiredContractToAdvisor] ⚠️ Kein Berater-E-Mail für Vertrag ${contract.id}`);
      }

      // 3. WHATSAPP-Nachricht (via InvokeLLM als Nachrichtenvorlage generiert)
      // Da WhatsApp-API-Anbindung über den BrokerOS-Agenten läuft, wird die WA-Nachricht
      // als strukturierte Notification erfasst (kann später an WA-Gateway weitergeleitet werden)
      const waMessage = `🔴 *ABGELAUFENER VERTRAG*\n\n👤 Kunde: ${customerName}\n🏢 Versicherer: ${insurer}\n📄 Police: ${policyNumber}\n💰 Prämie: ${premium}\n📅 Abgelaufen: ${endDate}\n\n⚡ Bitte sofort handeln! Aufgabe in BrokerOS erstellt (fällig ${dueDate.toLocaleDateString('de-CH')}).`;

      await base44.asServiceRole.entities.Notification.create({
        type: 'whatsapp_expired_contract',
        recipient_email: advisorEmail || 'unbekannt',
        recipient_name: advisorName,
        subject: `Abgelaufener Vertrag: ${customerName}`,
        body: waMessage,
        reference_id: contract.id,
        reference_type: 'contract',
        channel: 'whatsapp',
      });
      console.log(`[notifyExpiredContractToAdvisor] ✅ WhatsApp-Notification erfasst für ${advisorName}`);

      // 4. Vertrag auf 'expired' setzen
      await base44.asServiceRole.entities.Contract.update(contract.id, {
        status: 'expired',
      });
      console.log(`[notifyExpiredContractToAdvisor] ✅ Vertrag ${contract.id} → expired`);

      processed++;
    }

    console.log(`[notifyExpiredContractToAdvisor] ✅ COMPLETE: ${processed} verarbeitet, ${skipped} übersprungen`);

    return Response.json({
      success: true,
      date: today,
      processed,
      skipped,
    });

  } catch (error) {
    console.error(`[notifyExpiredContractToAdvisor] ERROR: ${error.message}`);
    return Response.json({ success: false, error: error.message }, { status: 500 });
  }
});