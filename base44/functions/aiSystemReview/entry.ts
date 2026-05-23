import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await req.json();
    const level = body.level || 'quick'; // quick | operational | enterprise

    // ── Fetch data ──────────────────────────────────────────────────
    const [customers, contracts, tasks, documents, verkaufschancen] = await Promise.all([
      base44.entities.Customer.filter({ archived: false }, '-updated_date', 500),
      base44.entities.Contract.filter({ archived: false }, '-created_date', 500),
      base44.entities.Task.filter({}, '-created_date', 300),
      base44.entities.Document.list('-uploaded_at', 200),
      base44.entities.Verkaufschance.filter({}, '-created_date', 300),
    ]);

    const primaryCustomers = customers.filter(c => !c.is_family_member);
    const activeContracts = contracts.filter(c => c.status === 'active');
    const openTasks = tasks.filter(t => t.status === 'open' || t.status === 'in_progress');

    const now = new Date();
    const in90Days = new Date(now); in90Days.setDate(in90Days.getDate() + 90);
    const in180Days = new Date(now); in180Days.setDate(in180Days.getDate() + 180);
    const ago90Days = new Date(now); ago90Days.setDate(ago90Days.getDate() - 90);

    // ── Compute stats ─────────────────────────────────────────────
    const noAdvisor = primaryCustomers.filter(c => !c.advisor_id && !c.primary_advisor_id);
    const mandatePending = primaryCustomers.filter(c => ['pending', 'expired', 'invalid'].includes(c.mandate_status));
    const noContracts = primaryCustomers.filter(c => !activeContracts.some(ct => ct.customer_id === c.id));
    const expiringContracts = activeContracts.filter(c => c.end_date && new Date(c.end_date) <= in90Days && new Date(c.end_date) >= now);
    const expiringNoAction = expiringContracts.filter(c => !c.renewal_status || c.renewal_status === 'none');
    const cancelledContracts = contracts.filter(c => c.status === 'cancelled');
    const overdueTasksCount = openTasks.filter(t => t.due_date && new Date(t.due_date) < now).length;
    const noActivityCustomers = primaryCustomers.filter(c => {
      const lastUpdate = new Date(c.updated_date || c.created_date);
      return lastUpdate < ago90Days && c.status === 'active';
    });

    // Households
    const familyMembers = customers.filter(c => c.is_family_member);
    const householdsWithFamily = primaryCustomers.filter(c => familyMembers.some(f => f.primary_customer_id === c.id));

    // Cross-selling gaps
    const recommendedPrivate = ['kvg', 'vvg_krankenzusatz', 'haftpflicht_privat', 'hausrat', 'rechtsschutz', 'leben', 'reise'];
    const crossSellGaps = primaryCustomers.filter(c => {
      if (c.customer_type === 'business') return false;
      const customerContracts = activeContracts.filter(ct => ct.customer_id === c.id);
      const sparten = new Set(customerContracts.map(ct => ct.sparte || ct.insurance_type));
      const missing = recommendedPrivate.filter(s => !sparten.has(s));
      return missing.length >= 3;
    });

    // Open VS without activity
    const staleOpportunities = verkaufschancen.filter(v => {
      if (['gewonnen', 'verloren'].includes(v.status)) return false;
      const lastUpdate = new Date(v.updated_date || v.created_date);
      return lastUpdate < ago90Days;
    });

    // Missing docs
    const contractsWithoutDocs = activeContracts.filter(c =>
      !documents.some(d => d.linked_contract_id === c.id || d.customer_id === c.customer_id)
    );

    // ── Build analysis prompt ─────────────────────────────────────
    const stats = {
      total_customers: primaryCustomers.length,
      no_advisor: noAdvisor.length,
      mandate_issues: mandatePending.length,
      no_contracts: noContracts.length,
      expiring_90d: expiringContracts.length,
      expiring_no_action: expiringNoAction.length,
      cancelled_contracts: cancelledContracts.length,
      overdue_tasks: overdueTasksCount,
      total_open_tasks: openTasks.length,
      no_activity_90d: noActivityCustomers.length,
      households_with_family: householdsWithFamily.length,
      cross_sell_gaps: crossSellGaps.length,
      stale_opportunities: staleOpportunities.length,
      contracts_without_docs: contractsWithoutDocs.length,
      total_active_contracts: activeContracts.length,
    };

    const levelInstructions = {
      quick: 'Analysiere nur Datenqualität, Operative Risiken und kritische Renewals. Maximal 8 Findings. Fokus auf unmittelbar actionable Punkte.',
      operational: 'Analysiere Datenqualität, Operative Risiken, Renewals, Cross-Selling und Verkaufschancen. Maximal 15 Findings.',
      enterprise: 'Vollständige Analyse aller 5 Bereiche (Datenqualität, Operative Risiken, Umsatzpotenziale, Prozesse, Systemqualität). Maximal 25 Findings.',
    };

    const prompt = `Du bist ein intelligenter Systemberater für eine Schweizer Versicherungsbroker-Plattform (FINMA-konform).

Analysiere die folgenden System-Statistiken und erstelle strukturierte Findings.

STATISTIKEN:
${JSON.stringify(stats, null, 2)}

REVIEW LEVEL: ${level.toUpperCase()}
ANWEISUNG: ${levelInstructions[level]}

WICHTIG: 
- Gib NUR Empfehlungen, KEINE automatischen Änderungen
- Jedes Finding muss konkret, actionable und auf den Daten basieren
- Erkläre IMMER welche Datenbasis das Finding begründet
- Format: strukturiertes JSON-Array

Erstelle ein Array von Findings. Jedes Finding hat:
- id: string (z.B. "DQ-001")
- area: "datenqualitaet" | "operative_risiken" | "umsatzpotenziale" | "prozesse" | "systemqualitaet"
- severity: "critical" | "warning" | "info" | "opportunity"
- title: string (max 60 Zeichen)
- explanation: string (1-2 Sätze, klar und direkt)
- data_basis: string (welche Daten, welcher Trigger)
- recommendation: string (konkrete Handlungsempfehlung)
- metric: string | null (z.B. "14 Kunden betroffen")
- link: string | null (z.B. "/kunden" oder "/vertraege")
- why_ai_suggests: string (kurze Erklärung der KI-Logik/Regel)

Antworte NUR mit dem JSON-Array, kein Text davor oder danach.`;

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
                data_basis: { type: 'string' },
                recommendation: { type: 'string' },
                metric: { type: 'string' },
                link: { type: 'string' },
                why_ai_suggests: { type: 'string' },
              }
            }
          }
        }
      }
    });

    return Response.json({
      level,
      stats,
      findings: result.findings || [],
      reviewed_at: new Date().toISOString(),
      reviewed_by: user.full_name || user.email,
    });

  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});