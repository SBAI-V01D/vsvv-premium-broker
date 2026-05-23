import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await req.json();
    const level = body.level || 'quick';

    // ── ALLE Daten laden (für tiefe Prüfungen) ───────────────────────────────
    const [customers, contracts, tasks, documents, verkaufschancen, dossiers] = await Promise.all([
      base44.entities.Customer.filter({ archived: false }, '-updated_date', 1000),
      base44.entities.Contract.filter({ archived: false }, '-created_date', 1000),
      base44.entities.Task.filter({}, '-created_date', 500),
      base44.entities.Document.list('-uploaded_at', 500),
      base44.entities.Verkaufschance.filter({}, '-created_date', 500),
      base44.entities.AdvisoryDossier.filter({ archived: false }, '-created_date', 300),
    ]);

    const primaryCustomers = customers.filter(c => !c.is_family_member);
    const activeContracts = contracts.filter(c => c.status === 'active');
    const openTasks = tasks.filter(t => t.status === 'open' || t.status === 'in_progress');

    const now = new Date();
    const in30Days = new Date(now); in30Days.setDate(in30Days.getDate() + 30);
    const in90Days = new Date(now); in90Days.setDate(in90Days.getDate() + 90);
    const ago90Days = new Date(now); ago90Days.setDate(ago90Days.getDate() - 90);
    const ago365Days = new Date(now); ago365Days.setDate(ago365Days.getDate() - 365);

    // ── HELPER: Prozess-Status prüfen ─────────────────────────────────────────
    const custName = (c) => c.company_name || `${c.first_name || ''} ${c.last_name || ''}`.trim() || c.email;
    const hasOpenTask = (customerId) => tasks.some(t => t.customer_id === customerId && t.status !== 'completed');
    const hasOpenOpportunity = (customerId) => verkaufschancen.some(o => o.customer_id === customerId && !['gewonnen', 'verloren'].includes(o.status));
    const hasDocument = (contractId) => documents.some(d => d.linked_contract_id === contractId);
    const hasActiveContract = (customerId) => contracts.some(c => c.customer_id === customerId && c.status === 'active');
    const hasDossier = (customerId) => dossiers.some(d => d.customer_id === customerId && d.status !== 'archiviert');

    // ── TIEFENPRÜFUNG 1: Mandate (ALLE Kunden mit Problemen, wie Broker Reporting) ──
    const mandateIssues = [];
    for (const c of customers) {
      if (!['pending', 'expired', 'invalid'].includes(c.mandate_status)) continue;
      if (c.archived) continue;
      // NICHT nach status filtern — Broker Reporting zeigt auch prospects
      // NICHT nach Tasks filtern — Mandat-Problem bleibt Problem, auch mit Task
      
      mandateIssues.push({
        customer: c,
        hasOpenProcess: hasOpenTask(c.id),
      });
    }

    // ── TIEFENPRÜFUNG 2: Renewals (nur ohne laufenden Prozess) ───────────────
    const renewalRisks = [];
    for (const c of activeContracts) {
      const ed = c.end_date ? new Date(c.end_date) : null;
      const cd = c.cancellation_deadline ? new Date(c.cancellation_deadline) : null;
      
      if (!(ed && ed >= now && ed <= in90Days) && !(cd && cd >= now && cd <= in90Days)) continue;
      if (c.renewal_status === 'in_progress' || c.renewal_status === 'completed') continue;
      if (hasOpenOpportunity(c.customer_id)) continue;
      
      renewalRisks.push({
        contract: c,
        daysToEnd: ed ? Math.ceil((ed - now) / 86400000) : null,
        daysToCancel: cd ? Math.ceil((cd - now) / 86400000) : null,
        hasDocs: hasDocument(c.id),
      });
    }

    // ── TIEFENPRÜFUNG 3: Kunden ohne Berater (nur mit aktiven Verträgen) ─────
    const noAdvisor = primaryCustomers.filter(c =>
      !c.advisor_id && !c.primary_advisor_id &&
      c.status === 'active' && hasActiveContract(c.id)
    );

    // ── TIEFENPRÜFUNG 4: Cross-Selling (nur Bestandskunden ohne Opportunity) ─
    const recommendedPrivate = ['kvg', 'vvg_krankenzusatz', 'haftpflicht_privat', 'hausrat', 'rechtsschutz', 'leben', 'reise'];
    const sparteLabels = { kvg: 'KVG', vvg_krankenzusatz: 'VVG Krankenzusatz', haftpflicht_privat: 'Haftpflicht', hausrat: 'Hausrat', rechtsschutz: 'Rechtsschutz', leben: 'Lebensversicherung', reise: 'Reiseversicherung' };
    
    const crossSellGaps = [];
    for (const c of primaryCustomers) {
      if (c.customer_type === 'business') continue;
      if (c.status !== 'active') continue;
      
      const customerContracts = activeContracts.filter(ct => ct.customer_id === c.id);
      if (customerContracts.length === 0) continue; // Nur Bestandskunden
      if (hasOpenOpportunity(c.id)) continue;
      
      const sparten = new Set(customerContracts.map(ct => ct.sparte || ct.insurance_type));
      const missing = recommendedPrivate.filter(s => !sparten.has(s));
      
      if (missing.length >= 2) {
        crossSellGaps.push({
          customer: c,
          missingProducts: missing,
          existingContracts: customerContracts.length,
        });
      }
    }

    // ── TIEFENPRÜFUNG 5: Überfällige Tasks ────────────────────────────────────
    const overdueTasks = openTasks.filter(t => t.due_date && new Date(t.due_date) < now);

    // ── TIEFENPRÜFUNG 6: Verträge ohne Dokumente (nur aktive ohne Uploads) ───
    const contractsWithoutDocs = activeContracts.filter(c =>
      !hasDocument(c.id) &&
      !documents.some(d => d.linked_contract_id === c.id && d.processing_stage !== 'uploaded')
    );

    // ── TIEFENPRÜFUNG 7: Inaktive Kunden (nur mit Verträgen) ─────────────────
    const inactiveCustomers = primaryCustomers.filter(c => {
      if (c.status !== 'active') return false;
      const lastActivity = c.updated_date ? new Date(c.updated_date) : null;
      if (!lastActivity || lastActivity >= ago365Days) return false;
      return hasActiveContract(c.id);
    });

    // ── TIEFENPRÜFUNG 8: Stuck Opportunities (>30 Tage ohne Task) ────────────
    const stuckOpportunities = verkaufschancen.filter(o => {
      if (['gewonnen', 'verloren'].includes(o.status)) return false;
      if (hasOpenTask(o.customer_id)) return false;
      const created = o.created_date ? new Date(o.created_date) : null;
      return created && (now - created) / 86400000 > 30;
    });

    // ── TIEFENPRÜFUNG 9: Aktive Kunden ohne Verträge ─────────────────────────
    const noContractCustomers = primaryCustomers.filter(c =>
      c.status === 'active' && !hasActiveContract(c.id)
    );

    // ── Entity-Links ──────────────────────────────────────────────────────────
    const makeLink = (type, id, customerId) => {
      if (type === 'customer') return `/kunden/${id}`;
      if (type === 'contract') return `/kunden/${customerId || ':customerId'}/360`;
      if (type === 'task') return `/aufgaben`;
      if (type === 'opportunity') return `/verkaufschancen`;
      if (type === 'document') return `/dokumente`;
      return '/';
    };

    // ── FINDINGS generieren (nur handlungsrelevante) ─────────────────────────
    const findings = [];

    // 1. Mandat-Probleme (kritisch: Compliance) — exakt wie Broker Reporting
    if (mandateIssues.length > 0) {
      findings.push({
        id: 'COMP-001',
        area: 'operative_risiken',
        severity: 'critical',
        title: `Kunden ohne gültiges Mandat (${mandateIssues.length} Fälle)`,
        explanation: `${mandateIssues.length} Kunden haben Mandat-Status "pending", "expired" oder "invalid" — sofortige Prüfung erforderlich.`,
        business_impact: 'Beratungen ohne gültiges Mandat sind rechtlich nicht abgesichert.',
        affected_entities: mandateIssues.slice(0, 10).map(m => ({
          type: 'customer',
          id: m.customer.id,
          name: custName(m.customer),
          detail: `Mandat: ${m.customer.mandate_status} · ${m.customer.status}`,
          link: makeLink('customer', m.customer.id),
        })),
        recommendation: 'Mandate für alle betroffenen Kunden umgehend prüfen und erneuern.',
        quick_actions: [
          { type: 'open_customer', label: 'Kunde öffnen', link: makeLink('customer', mandateIssues[0].customer.id) },
          { type: 'create_task', label: 'Task erstellen', link: '/aufgaben' },
        ],
        why_ai_suggests: `Mandat-Status ist "${mandateIssues[0].customer.mandate_status}" (pending/expired/invalid) — identisch mit Broker Reporting Filter.`,
      });
    }

    // 2. Renewal-Risiken (kritisch/warning basierend auf Tagen)
    const criticalRenewals = renewalRisks.filter(r => (r.daysToEnd && r.daysToEnd < 30) || (r.daysToCancel && r.daysToCancel < 30));
    const warningRenewals = renewalRisks.filter(r => !criticalRenewals.includes(r));
    
    if (criticalRenewals.length > 0) {
      findings.push({
        id: 'REN-001',
        area: 'operative_risiken',
        severity: 'critical',
        title: 'Kritische Renewals (<30 Tage)',
        explanation: `${criticalRenewals.length} Verträge enden in weniger als 30 Tagen — sofortiges Handeln erforderlich.`,
        business_impact: `Umsatzgefährdung von ca. CHF ${criticalRenewals.reduce((sum, r) => sum + (r.contract.premium_yearly || 0), 0).toLocaleString('de-CH')}.`,
        affected_entities: criticalRenewals.slice(0, 10).map(r => ({
          type: 'contract',
          id: r.contract.id,
          name: r.contract.policy_number,
          detail: `${r.contract.insurer} · Ende: ${r.contract.end_date} · ${r.daysToEnd} Tage`,
          link: makeLink('contract', r.contract.id, r.contract.customer_id),
        })),
        recommendation: 'Renewal-Prozess sofort einleiten — Kunde kontaktieren und Offerte vorbereiten.',
        quick_actions: [
          { type: 'open_contracts', label: 'Vertrag öffnen', link: makeLink('contract', criticalRenewals[0].contract.id, criticalRenewals[0].contract.customer_id) },
          { type: 'create_task', label: 'Renewal-Task', link: '/aufgaben' },
        ],
        why_ai_suggests: 'Vertragsende/Kündigungsfrist in <30 Tagen und kein Renewal-Prozess läuft.',
      });
    }
    
    if (warningRenewals.length > 0) {
      findings.push({
        id: 'REN-002',
        area: 'operative_risiken',
        severity: 'warning',
        title: 'Renewals nächste 90 Tage',
        explanation: `${warningRenewals.length} Verträge laufen in 30-90 Tagen aus — Planung empfohlen.`,
        business_impact: 'Rechtzeitige Planung verhindert Kündigungen und sichert Umsatz.',
        affected_entities: warningRenewals.slice(0, 10).map(r => ({
          type: 'contract',
          id: r.contract.id,
          name: r.contract.policy_number,
          detail: `${r.contract.insurer} · Ende: ${r.contract.end_date}`,
          link: makeLink('contract', r.contract.id, r.contract.customer_id),
        })),
        recommendation: 'Renewal-Pipeline vorbereiten und Kunden frühzeitig kontaktieren.',
        quick_actions: [
          { type: 'open_contracts', label: 'Vertrag öffnen', link: makeLink('contract', warningRenewals[0].contract.id, warningRenewals[0].contract.customer_id) },
        ],
        why_ai_suggests: 'Vertragsende/Kündigungsfrist in 30-90 Tagen und kein Renewal-Prozess läuft.',
      });
    }

    // 3. Kunden ohne Berater
    if (noAdvisor.length > 0) {
      findings.push({
        id: 'ADV-001',
        area: 'operative_risiken',
        severity: 'warning',
        title: 'Aktive Kunden ohne Berater',
        explanation: `${noAdvisor.length} Kunden mit aktiven Verträgen haben keinen zugewiesenen Berater.`,
        business_impact: 'Keine Betreuung führt zu Kündigungsrisiko und verpassten Chancen.',
        affected_entities: noAdvisor.slice(0, 10).map(c => ({
          type: 'customer',
          id: c.id,
          name: custName(c),
          detail: `${c.email} · ${contracts.filter(ct => ct.customer_id === c.id && ct.status === 'active').length} Verträge`,
          link: makeLink('customer', c.id),
        })),
        recommendation: 'Berater zuweisen und Erstkontakt herstellen.',
        quick_actions: [
          { type: 'open_customer', label: 'Kunde öffnen', link: makeLink('customer', noAdvisor[0].id) },
        ],
        why_ai_suggests: 'Kunde hat aktive Verträge aber keinen zugewiesenen Berater.',
      });
    }

    // 4. Cross-Selling
    if (crossSellGaps.length > 0) {
      findings.push({
        id: 'CRS-001',
        area: 'umsatzpotenziale',
        severity: 'opportunity',
        title: 'Cross-Selling Potenzial bei Bestandskunden',
        explanation: `${crossSellGaps.length} Bestandskunden haben Produktlücken in ihrem Portfolio.`,
        business_impact: `Potenzieller Zusatzumsatz durch Schließen der Produktlücken.`,
        affected_entities: crossSellGaps.slice(0, 10).map(g => ({
          type: 'customer',
          id: g.customer.id,
          name: custName(g.customer),
          detail: `Fehlt: ${g.missingProducts.slice(0, 3).map(s => sparteLabels[s] || s).join(', ')} · ${g.existingContracts} bestehende Verträge`,
          link: makeLink('customer', g.customer.id),
        })),
        recommendation: 'Beratungstermin für Produktlücken-Analyse vereinbaren.',
        quick_actions: [
          { type: 'open_customer', label: 'Kunde öffnen', link: makeLink('customer', crossSellGaps[0].customer.id) },
          { type: 'open_opportunities', label: 'Opportunity erstellen', link: '/verkaufschancen' },
        ],
        why_ai_suggests: 'Bestandskunde hat aktive Verträge, aber Produktlücken und keine offene Opportunity.',
      });
    }

    // 5. Überfällige Tasks (nach Priorität)
    const highPriorityOverdue = overdueTasks.filter(t => t.priority === 'high' || t.priority === 'urgent');
    const normalOverdue = overdueTasks.filter(t => !highPriorityOverdue.includes(t));
    
    if (highPriorityOverdue.length > 0) {
      findings.push({
        id: 'TSK-001',
        area: 'prozesse',
        severity: 'critical',
        title: 'Überfällige High-Priority Tasks',
        explanation: `${highPriorityOverdue.length} hochprioritäre Aufgaben sind überfällig.`,
        business_impact: 'Kritische Prozesse verzögern sich — Kundenbetreuung leidet.',
        affected_entities: highPriorityOverdue.slice(0, 10).map(t => ({
          type: 'task',
          id: t.id,
          name: t.title,
          detail: `Fällig: ${t.due_date} · ${t.assigned_to || 'Nicht zugewiesen'}`,
          link: makeLink('task', t.id),
        })),
        recommendation: 'Tasks sofort bearbeiten oder neu zuweisen.',
        quick_actions: [
          { type: 'open_tasks', label: 'Task öffnen', link: '/aufgaben' },
        ],
        why_ai_suggests: 'Task ist überfällig (Fälligkeitsdatum < heute) und hat hohe Priorität.',
      });
    }
    
    if (normalOverdue.length > 0) {
      findings.push({
        id: 'TSK-002',
        area: 'prozesse',
        severity: 'warning',
        title: 'Überfällige Tasks',
        explanation: `${normalOverdue.length} Aufgaben sind überfällig.`,
        business_impact: 'Offene Aufgaben beeinträchtigen operative Effizienz.',
        affected_entities: normalOverdue.slice(0, 10).map(t => ({
          type: 'task',
          id: t.id,
          name: t.title,
          detail: `Fällig: ${t.due_date}`,
          link: makeLink('task', t.id),
        })),
        recommendation: 'Task-Liste bereinigen und Prioritäten setzen.',
        quick_actions: [
          { type: 'open_tasks', label: 'Aufgaben öffnen', link: '/aufgaben' },
        ],
        why_ai_suggests: 'Task ist überfällig (Fälligkeitsdatum < heute).',
      });
    }

    // 6. Verträge ohne Dokumente
    if (contractsWithoutDocs.length > 0) {
      findings.push({
        id: 'DOC-001',
        area: 'datenqualitaet',
        severity: 'warning',
        title: 'Verträge ohne Dokumente',
        explanation: `${contractsWithoutDocs.length} aktive Verträge haben keine hinterlegten Dokumente.`,
        business_impact: 'Unvollständige Dokumentation erschwert Beratung und Compliance.',
        affected_entities: contractsWithoutDocs.slice(0, 10).map(c => ({
          type: 'contract',
          id: c.id,
          name: c.policy_number,
          detail: `${c.insurer} · ${c.customer_name}`,
          link: makeLink('contract', c.id, c.customer_id),
        })),
        recommendation: 'Fehlende Policen und Dokumente nachreichen.',
        quick_actions: [
          { type: 'open_contracts', label: 'Vertrag öffnen', link: makeLink('contract', contractsWithoutDocs[0].id, contractsWithoutDocs[0].customer_id) },
          { type: 'open_documents', label: 'Dokument hochladen', link: '/dokumente' },
        ],
        why_ai_suggests: 'Aktiver Vertrag hat keine verknüpften Dokumente und keine Uploads in Bearbeitung.',
      });
    }

    // 7. Stuck Opportunities
    if (stuckOpportunities.length > 0) {
      findings.push({
        id: 'OPP-001',
        area: 'prozesse',
        severity: 'warning',
        title: 'Offene Opportunities ohne Aktivität',
        explanation: `${stuckOpportunities.length} Verkaufschancen sind älter als 30 Tage ohne Task.`,
        business_impact: 'Verpasste Abschlüsse durch fehlende Nachverfolgung.',
        affected_entities: stuckOpportunities.slice(0, 10).map(o => ({
          type: 'opportunity',
          id: o.id,
          name: o.title,
          detail: `${custName(verkaufschancen.find(oc => oc.id === o.id) || o)} · Status: ${o.status}`,
          link: makeLink('opportunity', o.id),
        })),
        recommendation: 'Opportunity prüfen und Follow-up Task erstellen.',
        quick_actions: [
          { type: 'open_opportunities', label: 'Opportunity öffnen', link: '/verkaufschancen' },
          { type: 'create_task', label: 'Follow-up Task', link: '/aufgaben' },
        ],
        why_ai_suggests: 'Opportunity ist >30 Tage alt, nicht gewonnen/verloren, und hat keinen offenen Task.',
      });
    }

    // 8. Inaktive Kunden
    if (inactiveCustomers.length > 0) {
      findings.push({
        id: 'INA-001',
        area: 'umsatzpotenziale',
        severity: 'info',
        title: 'Inaktive Bestandskunden (12+ Monate)',
        explanation: `${inactiveCustomers.length} Kunden mit Verträgen hatten seit 12+ Monaten keine Aktivität.`,
        business_impact: 'Kündigungsrisiko und verpasste Cross-Selling-Chancen.',
        affected_entities: inactiveCustomers.slice(0, 10).map(c => ({
          type: 'customer',
          id: c.id,
          name: custName(c),
          detail: `Letzte Aktivität: ${c.updated_date} · ${contracts.filter(ct => ct.customer_id === c.id && ct.status === 'active').length} Verträge`,
          link: makeLink('customer', c.id),
        })),
        recommendation: 'Reaktivierungskampagne oder persönlicher Kontakt.',
        quick_actions: [
          { type: 'open_customer', label: 'Kunde öffnen', link: makeLink('customer', inactiveCustomers[0].id) },
        ],
        why_ai_suggests: 'Kunde hat aktive Verträge, aber keine Aktualisierung seit 12+ Monaten.',
      });
    }

    // 9. Kunden ohne Verträge
    if (noContractCustomers.length > 0) {
      findings.push({
        id: 'NOC-001',
        area: 'umsatzpotenziale',
        severity: 'info',
        title: 'Aktive Kunden ohne Verträge',
        explanation: `${noContractCustomers.length} aktive Kunden haben keine Verträge im System.`,
        business_impact: 'Ungenutztes Potenzial für Erstgeschäfte.',
        affected_entities: noContractCustomers.slice(0, 10).map(c => ({
          type: 'customer',
          id: c.id,
          name: custName(c),
          detail: `${c.email} · Status: ${c.status}`,
          link: makeLink('customer', c.id),
        })),
        recommendation: 'Kontaktaufnahme und Bedarfsermittlung.',
        quick_actions: [
          { type: 'open_customer', label: 'Kunde öffnen', link: makeLink('customer', noContractCustomers[0].id) },
          { type: 'open_opportunities', label: 'Opportunity erstellen', link: '/verkaufschancen' },
        ],
        why_ai_suggests: 'Kunde ist aktiv, hat aber keine zugeordneten Verträge.',
      });
    }

    // ── LLM Prompt (für Priorisierung und Erklärung) ─────────────────────────
    const levelInstructions = {
      quick: 'Zeige NUR: Mandat-Probleme, kritische Renewals (<30 Tage), überfällige High-Priority Tasks. Maximal 4 Findings.',
      operational: 'Zeige alle Risiken und Potenziale. Maximal 10 Findings.',
      enterprise: 'Zeige vollständige Analyse inkl. Datenqualität. Maximal 15 Findings.',
    };

    const prompt = `Du bist operative KI für Versicherungsbroker.

DEEP AUDIT RESULTS (alle Findings wurden prozessgeprüft):
${JSON.stringify({ findings, total: findings.length }, null, 2)}

LEVEL: ${level}
ANWEISUNG: ${levelInstructions[level]}

AUFGABE:
1. PRIORISIERE nach: critical > warning > opportunity > info
2. ENTFERNE irrelevante Findings gemäss Level-Anweisung
3. BEHALTE alle affected_entities (max 10)
4. KORRIGIERE explanation/business_impact falls unklar

ANTWORTE ALS JSON:
{
  "findings": [...],
  "level": "${level}",
  "reviewed_at": "${new Date().toISOString()}",
  "reviewed_by": "${user.full_name || user.email}"
}`;

    const result = await base44.integrations.Core.InvokeLLM({
      prompt,
      response_json_schema: {
        type: 'object',
        properties: {
          findings: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                id: { type: 'string' },
                area: { type: 'string' },
                severity: { type: 'string' },
                title: { type: 'string' },
                explanation: { type: 'string' },
                business_impact: { type: 'string' },
                affected_entities: {
                  type: 'array',
                  items: {
                    type: 'object',
                    properties: {
                      type: { type: 'string' },
                      id: { type: 'string' },
                      name: { type: 'string' },
                      detail: { type: 'string' },
                      link: { type: 'string' },
                    },
                  },
                },
                recommendation: { type: 'string' },
                quick_actions: {
                  type: 'array',
                  items: {
                    type: 'object',
                    properties: {
                      type: { type: 'string' },
                      label: { type: 'string' },
                      link: { type: 'string' },
                    },
                  },
                },
                why_ai_suggests: { type: 'string' },
              },
            },
          },
          level: { type: 'string' },
          reviewed_at: { type: 'string' },
          reviewed_by: { type: 'string' },
        },
      },
    });

    // ── Review persistent speichern ─────────────────────────────────────────
    const previousReview = await base44.entities.AiReview.list('-reviewed_at', 1);
    const reviewRecord = await base44.entities.AiReview.create({
      level: result.level,
      status: 'completed',
      findings: result.findings,
      finding_count: result.findings.length,
      critical_count: result.findings.filter(f => f.severity === 'critical').length,
      warning_count: result.findings.filter(f => f.severity === 'warning').length,
      opportunity_count: result.findings.filter(f => f.severity === 'opportunity').length,
      reviewed_at: result.reviewed_at,
      reviewed_by: result.reviewed_by,
      previous_review_id: previousReview[0]?.id || null,
    });

    return Response.json({ ...result, review_id: reviewRecord.id });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});